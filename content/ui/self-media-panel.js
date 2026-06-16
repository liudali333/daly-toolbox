// DALY工具箱 - 自媒体平台媒体下载面板（简化版）
// 功能：抖音视频/小红书图文/快手视频 一键下载
// 适用：douyin.com / xiaohongshu.com / kuaishou.com

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  // ========== 从 performance API 提取视频 URL ==========
  function _getVideoUrlsFromPerformance() {
    var urls = [];
    var seen = {};
    if (!window.performance || !performance.getEntriesByType) return urls;

    var resources = performance.getEntriesByType('resource');
    resources.forEach(function(r) {
      if (!r.name) return;
      var name = r.name;
      // 匹配抖音、快手、小红书的视频/图片 CDN
      // ★ 抖音：douyinvod.com 的 mp4/m3u8/ts 都是视频相关
      if (/douyinvod\.com/.test(name) ||
          /v[\d-]*\.douyinvod\.com/.test(name) ||
          /bytevcloud\.com/.test(name) ||
          /ibytedtos\.com/.test(name) ||
          /bytecdn\.cn/.test(name) ||
          /\.mp4(\?|$)/.test(name) ||
          /v\.qyxx\.com.*\.mp4|kuaishou.*\.mp4/.test(name) ||
          /sns-webpic\.hisihq\.com|xhscdn\.com.*\.(jpg|png|webp)/.test(name)) {
        if (!seen[name]) {
          seen[name] = true;
          urls.push(name);
        }
      }
    });
    return urls;
  }

  // ========== 从页面 DOM 中提取抖音视频 URL（简化版）==========
  function _extractDouyinVideoFromDom() {
    var videos = [];
    
    try {
      var bodyHTML = document.body ? document.body.innerHTML || '' : '';
      if (bodyHTML) {
        // 搜索 douyinvod 的 URL
        var matches = bodyHTML.match(/https?:\/\/[^"'\s`]*douyinvod[^"'\s`]{30,}/gi);
        if (matches && matches.length > 0) {
          var cleanUrl = matches[0].replace(/[<>"'\s`]$/, '').replace(/&amp;/g, '&');
          videos.push(cleanUrl);
        }
      }
    } catch(e) {
      // ignore
    }
    
    return videos;
  }

  // ========== 拦截 XHR 获取抖音视频 URL ==========
  function _interceptDouyinXHR() {
    try {
      // 防止重复拦截
      if (window._daly_xhr_intercepted) return;
      window._daly_xhr_intercepted = true;
      
      // 保存原始 XMLHttpRequest
      var originalXHROpen = window.XMLHttpRequest.prototype.open;
      var originalXHRSend = window.XMLHttpRequest.prototype.send;
      
      // 拦截 open
      window.XMLHttpRequest.prototype.open = function(method, url) {
        this._daly_url = url;
        return originalXHROpen.apply(this, arguments);
      };
      
      // 拦截 send
      window.XMLHttpRequest.prototype.send = function() {
        var xhr = this;
        var targetUrl = this._daly_url || '';
        
        // 检查是否是视频播放 API
        if (targetUrl.indexOf('/aweme/v1/play') !== -1 || 
            targetUrl.indexOf('/aweme/v1/playwm') !== -1 ||
            targetUrl.indexOf('play_addr') !== -1) {
          
          Object.defineProperty(xhr, 'onreadystatechange', {
            writable: true,
            configurable: true,
            enumerable: false,
            value: function() {
              if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                  var response = JSON.parse(xhr.responseText);
                  var videoUrl = null;
                  
                  // 抖音播放 API 的响应结构
                  if (response.data && response.data.play_addr) {
                    var playAddr = response.data.play_addr;
                    videoUrl = playAddr.url_list && playAddr.url_list[0] 
                      ? playAddr.url_list[0] 
                      : playAddr.url_key || '';
                  }
                  
                  if (videoUrl) {
                    if (!window._daly_douyin_video_url) {
                      window._daly_douyin_video_url = videoUrl;
                    }
                  }
                } catch(e) {
                  // ignore
                }
              }
              if (xhr._daly_onreadystate) {
                xhr._daly_onreadystate();
              }
            }
          });
        }
        
        return originalXHRSend.apply(this, arguments);
      };
    } catch(e) {
      // ignore - 可能已经被拦截过了
    }
  }

  // ========== 面板主体 ==========
  var DALY_SelfMediaPanel = {

    _platform: null,
    _mediaList: [],
    _pollTimer: null,

    open: function() {
      var self = this;
      var existing = document.getElementById('daly-self-media-panel');
      if (existing) {
        existing.style.display = 'flex';
        self._extractMedia();
        return;
      }

      // 检测当前平台
      var url = window.location.href;
      if (/douyin\.com/.test(url)) {
        self._platform = 'douyin';
        // 抖音：立即启动 XHR 拦截
        _interceptDouyinXHR();
      } else if (/xiaohongshu\.com/.test(url)) {
        self._platform = 'xiaohongshu';
      } else if (/kuaishou\.com/.test(url)) {
        self._platform = 'kuaishou';
      } else {
        self._platform = 'unknown';
      }

      // 创建面板
      var panel = document.createElement('div');
      panel.id = 'daly-self-media-panel';
      panel.className = 'daly-self-media-overlay';

      var titleMap = {
        'douyin': '抖音视频',
        'xiaohongshu': '小红书',
        'kuaishou': '快手视频',
        'unknown': '媒体资源'
      };
      var contentTypeHint = '';
      if (self._platform === 'xiaohongshu') {
        var isVideoPost = !!(document.querySelector('.video-player-media, xg-player, .xgplayer'));
        contentTypeHint = isVideoPost ? '（视频帖子）' : '（图文帖子）';
      }

      panel.innerHTML =
        '<div class="daly-self-media-panel">' +
          '<div class="daly-self-media-header">' +
            '<h3>📦 ' + titleMap[self._platform] + contentTypeHint + ' - 下载面板</h3>' +
            '<div class="daly-self-media-actions">' +
              '<button id="daly-self-media-retry" class="daly-btn daly-btn-secondary" style="margin-right:8px;">🔄 重新检测</button>' +
              '<button id="daly-self-media-dl-all" class="daly-btn daly-btn-primary">⬇ 下载全部</button>' +
              '<button id="daly-self-media-close" class="daly-btn daly-btn-close">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="daly-self-media-body" id="daly-self-media-body">' +
            '<div class="daly-media-placeholder">正在提取媒体资源...</div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(panel);

      // 关闭事件
      document.getElementById('daly-self-media-close').addEventListener('click', function() {
        panel.style.display = 'none';
        self._stopPoll();
      });
      panel.addEventListener('click', function(e) {
        if (e.target === panel) {
          panel.style.display = 'none';
          self._stopPoll();
        }
      });

      // 重新检测
      document.getElementById('daly-self-media-retry').addEventListener('click', function() {
        self._extractMedia();
      });

      // 下载全部
      document.getElementById('daly-self-media-dl-all').addEventListener('click', function() {
        self._downloadAll();
      });

      // 提取媒体（同时开始轮询）
      self._extractMedia();
    },

    _stopPoll: function() {
      if (this._pollTimer) {
        clearTimeout(this._pollTimer);
        this._pollTimer = null;
      }
    },

    _startPoll: function() {
      var self = this;
      self._stopPoll();
      // ★ 增加轮询：每 2 秒检测，最多 15 次（30 秒），给 webRequest 拦截更多时间
      var attempts = 0;
      function poll() {
        if (attempts >= 15) return;
        attempts++;
        // ★ 通过 postMessage 桥梁查询 background webRequest 拦截缓存
        if (self._platform === 'douyin') {
          window.postMessage({ _daly_bridge: true, type: 'DALY_GET_DOUYIN_VIDEOS', requestId: 'poll_' + attempts }, '*');
        }
        // 检查拦截缓存
        if (window._daly_douyin_video_urls && window._daly_douyin_video_urls.length > 0) {
          self._mediaList = self._extractDouyin(_getVideoUrlsFromPerformance());
          if (self._mediaList.length > 0) {
            self._renderMediaList();
            self._stopPoll();
            return;
          }
        }
        var urls = _getVideoUrlsFromPerformance();
        if (urls.length > 0) {
          self._mediaList = self._extractCurrent(urls);
          if (self._mediaList.length > 0) {
            self._renderMediaList();
            self._stopPoll();
            return;
          }
        }
        self._pollTimer = setTimeout(poll, 2000);
      }
      self._pollTimer = setTimeout(poll, 2000);
    },

    _extractMedia: function() {
      var self = this;
      var body = document.getElementById('daly-self-media-body');
      if (!body) return;

      body.innerHTML = '<div class="daly-media-placeholder">⏳ 正在提取媒体资源...</div>';
      self._stopPoll();

      // ★ 抖音：确保 XHR/Fetch 拦截已启动
      if (self._platform === 'douyin' && global.DALY_DOUYIN_VIDEO) {
        DALY_DOUYIN_VIDEO._startIntercept();
      }

      // ★ 抖音：通过 postMessage 桥梁查询 background webRequest 拦截缓存
      if (self._platform === 'douyin') {
        var reqId = 'extract_' + Date.now();
        var bridgeHandled = false;
        window.addEventListener('message', function onResp(event) {
          if (event.source !== window || !event.data || !event.data._daly_bridge) return;
          if (event.data.type === 'DALY_GET_DOUYIN_VIDEOS_RESPONSE' && event.data.requestId === reqId) {
            window.removeEventListener('message', onResp);
            bridgeHandled = true;
            clearTimeout(timeoutId);
            if (event.data.videos && event.data.videos.length > 0) {
              window._daly_bg_douyin_videos = event.data.videos;
            }
            self._doExtractMedia();
          }
        });
        window.postMessage({ _daly_bridge: true, type: 'DALY_GET_DOUYIN_VIDEOS', requestId: reqId }, '*');
        // 2秒超时 fallback
        var timeoutId = setTimeout(function() {
          if (!bridgeHandled) {
            self._doExtractMedia();
          }
        }, 2000);
        return;
      }

      self._doExtractMedia();
    },

    _doExtractMedia: function() {
      var self = this;
      var body = document.getElementById('daly-self-media-body');
      if (!body) return;

      // 立即检测一次
      var urls = _getVideoUrlsFromPerformance();
      try {
        if (self._platform === 'douyin') {
          self._mediaList = self._extractDouyin(urls);
        } else if (self._platform === 'xiaohongshu') {
          self._mediaList = self._extractXiaohongshu();
        } else if (self._platform === 'kuaishou') {
          self._mediaList = self._extractKuaishou(urls);
        }

        if (self._mediaList && self._mediaList.length > 0) {
          self._renderMediaList();
        } else {
          body.innerHTML = '<div class="daly-media-placeholder">⚠️ 暂未检测到可下载的媒体资源<br><small>请先播放视频，或点击「重新检测」</small></div>';
          // 开始轮询
          self._startPoll();
        }
      } catch (e) {
        body.innerHTML = '<div class="daly-media-placeholder">❌ 提取失败：' + (e.message || '未知错误') + '</div>';
        if (global.DALY_Log) DALY_Log.error('SelfMediaPanel extractMedia 异常:', e);
      }
    },

    _extractCurrent: function(urls) {
      if (this._platform === 'douyin') {
        return this._extractDouyin(urls);
      } else if (this._platform === 'kuaishou') {
        return this._extractKuaishou(urls);
      }
      return [];
    },

    _extractDouyin: function(perfUrls) {
      var videos = [];
      var seen = {};
      var self = this;

      // 提取视频标题
      var title = '';
      var titleEl = document.querySelector('.video-desc, .desc, [class*="videoDesc"], [class*="desc"][class*="Video"], h1[data-e2e="video-title"], .XSOeZJ1b span, .Oe03vJi5 span, [data-e2e="video-desc"]');
      if (titleEl && titleEl.textContent) {
        title = this._cleanTitle(titleEl.textContent.trim());
      }
      if (!title) title = this._cleanTitle(document.title || '');
      title = title.replace(/\s*#[^#]+$/g, '').replace(/- 抖音$/g, '').trim();

      // ===== 提取视频封面 =====
      var coverUrl = window._daly_douyin_cover_url || null;
      if (!coverUrl) {
        var coverSelectors = [
          'xg-player .xgplayer-poster',  // 西瓜播放器封面
          '.video-player img',
          '[class*="player"] img[class*="poster"]',
          '[class*="player"] img[class*="cover"]',
          '.playerContainer img',
          'img[class*="Poster"]',
          'img[class*="poster"]',
          'img[data-e2e="video-poster"]'
        ];
        for (var ci = 0; ci < coverSelectors.length; ci++) {
          try {
            var coverEl = document.querySelector(coverSelectors[ci]);
            if (coverEl) {
              // 先检查 src
              if (coverEl.src && (coverEl.src.indexOf('douyinpic') !== -1 || coverEl.src.indexOf('byteimg') !== -1)) {
                coverUrl = coverEl.src;
                break;
              }
              // 再检查 background-image
              var bg = getComputedStyle(coverEl).backgroundImage;
              var bgMatch = bg && bg.match(/url\(["']?(https?:[^"')]+)["']?\)/);
              if (bgMatch && bgMatch[1]) {
                coverUrl = bgMatch[1];
                break;
              }
            }
          } catch(e) {}
        }
      } // end if (!coverUrl)

      // ===== 提取当前页面 video ID =====
      // 抖音视频页 URL: https://www.douyin.com/video/738123456789
      var currentVideoId = null;
      var urlMatch = location.pathname.match(/\/video\/(\d+)/);
      if (urlMatch) currentVideoId = urlMatch[1];

      // ===== 收集所有可能的视频 URL =====
      var allUrls = []; // { url, source, priority }

      // 方法0：background webRequest 拦截缓存（最可靠）
      if (window._daly_bg_douyin_videos && window._daly_bg_douyin_videos.length > 0) {
        window._daly_bg_douyin_videos.forEach(function(url) {
          if (!seen[url]) {
            seen[url] = true;
            allUrls.push({ url: url, source: 'background', priority: 1 });
          }
        });
      }

      // 方法1：XHR/Fetch 拦截缓存
      if (window._daly_douyin_video_urls && window._daly_douyin_video_urls.length > 0) {
        window._daly_douyin_video_urls.forEach(function(url) {
          if (!seen[url]) {
            seen[url] = true;
            allUrls.push({ url: url, source: 'xhr_fetch', priority: 2 });
          }
        });
      }

      // 方法2：全局变量提取
      var globalVars = ['__RENDER_DATA__', '__INITIAL_STATE__', '__DOUYIN_DATA__', '__INITIAL_PROPS_DATA__', '__NEXT_DATA__', 'SSR_HYDRATED_DATA'];
      for (var vi = 0; vi < globalVars.length; vi++) {
        try {
          var val = window[globalVars[vi]];
          if (val) {
            var data = (typeof val === 'string') ? JSON.parse(decodeURIComponent(val)) : val;
            var found = _findVideoUrlInObject(data);
            if (found && !seen[found]) {
              seen[found] = true;
              allUrls.push({ url: found, source: 'global_var', priority: 3 });
            }
          }
        } catch(e) {}
      }

      // 方法3：script 标签正则
      try {
        var scriptTags = document.querySelectorAll('script[type="application/json"], script:not([src])');
        for (var si = 0; si < scriptTags.length && allUrls.length < 3; si++) {
          var text = scriptTags[si].textContent || '';
          var mp4Matches = text.match(/https?:\/\/[^"'`\s\\]*douyinvod[^"'`\s\\]*\.mp4[^"'`\s\\]*/gi);
          if (mp4Matches) {
            mp4Matches.forEach(function(m) {
              var cleanUrl = m.replace(/&amp;/g, '&');
              if (!seen[cleanUrl]) {
                seen[cleanUrl] = true;
                allUrls.push({ url: cleanUrl, source: 'script_regex', priority: 4 });
              }
            });
          }
        }
      } catch(e) {}

      // 方法4：Performance API
      if (perfUrls && perfUrls.length > 0) {
        perfUrls.forEach(function(url) {
          if (/douyinvod\.com.*\.mp4/.test(url) && !seen[url]) {
            seen[url] = true;
            allUrls.push({ url: url, source: 'performance', priority: 5 });
          }
        });
      }

      // ===== 过滤和排序 =====
      // 1. 去掉 segment 碎片（MSE 分片不是完整视频）
      allUrls = allUrls.filter(function(item) {
        return !/\/segment\d+\.mp4/i.test(item.url);
      });

      // 2. 如果有当前 video ID，优先匹配包含该 ID 的 URL
      // 抖音 CDN URL 中通常包含 video_id 参数
      if (currentVideoId) {
        var matched = allUrls.filter(function(item) {
          return item.url.indexOf(currentVideoId) !== -1 ||
                 item.url.indexOf('video_id=' + currentVideoId) !== -1;
        });
        if (matched.length > 0) {
          // 只使用匹配的 URL
          allUrls = matched;
        }
      }

      // 3. 按优先级排序，最多取 2 个视频 URL
      allUrls.sort(function(a, b) { return a.priority - b.priority; });
      var topVideos = allUrls.slice(0, 2);

      // ===== 构建结果列表 =====
      topVideos.forEach(function(item) {
        videos.push({
          type: 'video',
          url: item.url,
          name: (title || '抖音视频') + '.mp4',
          cover: coverUrl
        });
      });

      // 如果有封面但没视频，也显示封面图供下载
      if (coverUrl && videos.length === 0) {
        videos.push({
          type: 'image',
          url: coverUrl.replace(/~[\w]+$/, ''),  // 去掉尺寸参数拿原图
          name: (title || '抖音视频封面') + '_封面.jpg'
        });
      }

      return videos;
    },

    _extractXiaohongshu: function() {
      var media = [];
      var seen = {};
      var self = this;

      // 提取标题（优先从 detail-title，fallback 到 document.title）
      var title = '';
      var titleEl = document.querySelector('#detail-title, .note-content .title, [class*="noteTitle"]');
      if (titleEl && titleEl.textContent) title = titleEl.textContent.trim();
      if (!title) title = document.title || '';
      title = this._cleanTitle(title.replace(/\s*#[^#]+$/g, '').trim());

      // ===== 检测是视频帖子还是图文帖子 =====
      var isVideoPost = !!(document.querySelector('.video-player-media, xg-player, .xgplayer'));
      var isImagePost = !!(document.querySelector('.interaction-container, .note-content'));

      // ===== 视频帖子：提取封面图 =====
      if (isVideoPost) {
        // 方法1：从 xgplayer-poster 背景图提取
        var posterEl = document.querySelector('.xgplayer-poster');
        if (posterEl) {
          var bg = getComputedStyle(posterEl).backgroundImage;
          var match = bg.match(/url\(["']?(https?:[^"')]+)["']?\)/);
          if (match && match[1] && !seen[match[1]]) {
            seen[match[1]] = true;
            // 清理 URL 中的尺寸参数，拿到原图
            var origUrl = match[1].replace(/\!nc_n_webp_mw_\d+/, '').replace(/!nd_dft_wlteh_webp_\d+/, '');
            media.push({ type: 'image', url: origUrl, name: (title || '小红书视频封面') + '_封面.jpg' });
          }
        }

        // 方法2：从 xgplayer 容器中查找 img 标签
        if (media.length === 0) {
          var xgImgs = document.querySelectorAll('.xgplayer img, .video-player-media img');
          xgImgs.forEach(function(img) {
            if (img.src && img.naturalWidth > 200 && !seen[img.src] && img.src.indexOf('avatar') === -1) {
              seen[img.src] = true;
              media.push({ type: 'image', url: img.src, name: (title || '小红书视频封面') + '_' + Math.random().toString(36).substr(2, 4) + '.jpg' });
            }
          });
        }

        // 方法3：从 interaction-container 的 img-box 查找评论图
        if (media.length === 0) {
          var imgBoxes = document.querySelectorAll('.img-box img, .note-content-emoji');
          imgBoxes.forEach(function(img) {
            var src = img.src || '';
            if (src.indexOf('sns-webpic') > -1 && img.naturalWidth > 100 && !seen[src]) {
              seen[src] = true;
              media.push({ type: 'image', url: src, name: (title || '小红书') + '_' + Math.random().toString(36).substr(2, 4) + '.jpg' });
            }
          });
        }
      }

      // ===== 图文帖子：提取正文图片 =====
      if (isImagePost && media.length === 0) {
        // interaction-container 内的 img-box 图片（排除头像、小图、emoji）
        var allImgs = document.querySelectorAll('.interaction-container img, .note-content img');
        allImgs.forEach(function(img, idx) {
          var src = img.src || '';
          // 排除头像、emoji、平台图标、小图
          if (src &&
              src.indexOf('avatar') === -1 &&
              src.indexOf('picasso-static') === -1 &&
              src.indexOf('platform') === -1 &&
              img.naturalWidth > 100 &&
              !seen[src]) {
            seen[src] = true;
            var ext = '.jpg';
            if (src.indexOf('/format/webp') > -1) ext = '.webp';
            else if (src.indexOf('.png') > -1) ext = '.png';
            media.push({ type: 'image', url: src, name: (title || '小红书图文') + '_' + (idx + 1) + ext });
          }
        });

        // 也检查 backgroundImage
        if (media.length === 0) {
          var allEls = document.querySelectorAll('[class*="note"], [class*="image"], [class*="gallery"]');
          allEls.forEach(function(el) {
            var bg = getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') {
              var m = bg.match(/url\(["']?(https?:[^"')]+)["']?\)/);
              if (m && m[1] && m[1].indexOf('xhscdn') > -1 && !seen[m[1]]) {
                seen[m[1]] = true;
                media.push({ type: 'image', url: m[1], name: (title || '小红书图文') + '_' + Math.random().toString(36).substr(2, 4) + '.jpg' });
              }
            }
          });
        }
      }

      return media;
    },

    _extractKuaishou: function(perfUrls) {
      var videos = [];
      var seen = {};

      // 提取快手视频标题
      var title = '';
      var titleSpan = document.querySelector('.video-info-title span');
      if (titleSpan && titleSpan.textContent) {
        title = this._cleanTitle(titleSpan.textContent.trim());
      }
      if (!title) {
        title = this._cleanTitle(document.title || '');
        title = title.replace(/\s*#[^#]+$/g, '').trim();
      }

      // ===== 优先方法：从当前播放的 video 标签获取（只取可见且正在播放的）=====
      var currentVideoUrl = null;
      var videoEls = document.querySelectorAll('video');
      
      // 先找可见且正在播放的视频
      for (var i = 0; i < videoEls.length; i++) {
        var v = videoEls[i];
        var rect = v.getBoundingClientRect();
        var isVisible = rect.width > 0 && rect.height > 0 && rect.top >= -100 && rect.left >= -100;
        var isPlaying = !v.paused && !v.ended;
        var hasSrc = v.src && !v.src.startsWith('blob:');
        
        if (isVisible && hasSrc) {
          // 优先选择正在播放的
          if (isPlaying) {
            currentVideoUrl = v.src;
            break;
          }
          // 如果没有正在播放的，记录第一个可见的视频
          if (!currentVideoUrl) {
            currentVideoUrl = v.src;
          }
        }
      }

      // 如果有可见的视频源，只使用它
      if (currentVideoUrl) {
        if (!seen[currentVideoUrl]) {
          seen[currentVideoUrl] = true;
          videos.push({ type: 'video', url: currentVideoUrl, name: (title || '快手视频') + '.mp4' });
        }
        // 检查 source 子元素
        for (var j = 0; j < videoEls.length; j++) {
          var sources = videoEls[j].querySelectorAll('source');
          for (var k = 0; k < sources.length; k++) {
            var sSrc = sources[k].src;
            if (sSrc && !sSrc.startsWith('blob:') && !seen[sSrc] && sSrc === currentVideoUrl) {
              seen[sSrc] = true;
              videos.push({ type: 'video', url: sSrc, name: (title || '快手视频') + '.mp4' });
            }
          }
        }
        return videos;
      }

      // ===== 备用方法1：从 performance API 获取（所有视频）=====
      if (perfUrls && perfUrls.length > 0) {
        perfUrls.forEach(function(url) {
          if (!seen[url]) {
            seen[url] = true;
            if (/kuaishou.*\.mp4|v\.qyxx\.com.*\.mp4|\.mp4/.test(url)) {
              videos.push({ type: 'video', url: url, name: (title || '快手视频') + '.mp4' });
            }
          }
        });
      }

      // ===== 备用方法2：从所有 <video> 标签获取（不做过滤）=====
      if (videos.length === 0) {
        videoEls = document.querySelectorAll('video');
        videoEls.forEach(function(v) {
          if (v.src && !v.src.startsWith('blob:') && !seen[v.src]) {
            seen[v.src] = true;
            videos.push({ type: 'video', url: v.src, name: (title || '快手视频') + '.mp4' });
          }
          var sources = v.querySelectorAll('source');
          sources.forEach(function(s) {
            if (s.src && !s.src.startsWith('blob:') && !seen[s.src]) {
              seen[s.src] = true;
              videos.push({ type: 'video', url: s.src, name: (title || '快手视频') + '.mp4' });
            }
          });
        });
      }

      return videos;
    },

    _renderMediaList: function() {
      var self = this;
      var body = document.getElementById('daly-self-media-body');
      if (!body) return;

      self._stopPoll();

      body.innerHTML = '';
      body.className = 'daly-self-media-body daly-self-media-grid';

      this._mediaList.forEach(function(media, idx) {
        var card = document.createElement('div');
        card.className = 'daly-self-media-card';

        var preview = '';
        if (media.type === 'video' && media.cover) {
          // ★ 有封面图的视频：显示封面 + 播放按钮叠加
          preview = '<div style="width:100%;height:120px;position:relative;border-radius:8px;overflow:hidden;background:#111;">' +
            '<img src="' + media.cover + '" style="width:100%;height:100%;object-fit:cover;" />' +
            '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">▶</div>' +
            '</div>';
        } else if (media.type === 'video') {
          preview = '<div class="daly-self-media-video-icon" style="width:100%;height:120px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:8px;font-size:36px;">🎬</div>';
        } else if (media.url) {
          preview = '<div style="width:100%;height:120px;border-radius:8px;overflow:hidden;background:#222;">' +
            '<img src="' + media.url + '" style="width:100%;height:100%;object-fit:cover;" />' +
            '</div>';
        } else {
          var imgIcon = media.name.indexOf('封面') > -1 ? '🖼️' : '📷';
          preview = '<div style="width:100%;height:120px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:8px;font-size:36px;">' + imgIcon + '</div>';
        }

        card.innerHTML =
          '<div class="daly-self-media-preview">' + preview + '</div>' +
          '<div class="daly-self-media-info">' +
            '<span class="daly-self-media-name" title="' + media.url.substring(0, 100) + '">' + media.name + '</span>' +
            '<button class="daly-btn daly-btn-primary daly-btn-small" data-idx="' + idx + '">⬇ 下载</button>' +
          '</div>';

        body.appendChild(card);
      });

      // 绑定下载按钮事件
      body.querySelectorAll('.daly-btn-small').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(this.getAttribute('data-idx'));
          self._downloadOne(idx);
        });
      });
    },

    _downloadOne: function(idx) {
      var media = this._mediaList[idx];
      if (!media) return;

      if (global.DALY_Log) DALY_Log.info('下载媒体:', media.name);

      // 确保文件名有 .mp4 后缀
      var safeFilename = media.name || 'video';
      if (safeFilename.indexOf('.') === -1) {
        safeFilename = safeFilename + '.mp4';
      } else if (!/\.mp4$/i.test(safeFilename)) {
        safeFilename = safeFilename.replace(/\.[^.]+$/, '') + '.mp4';
      }

      // 使用 postMessage 桥梁发送下载请求（MAIN_WORLD 中 chrome.runtime 不可用）
      var requestId = 'dl_' + Date.now() + '_' + idx;
      var downloadHandled = false;

      // 监听桥梁响应
      function onBridgeResponse(event) {
        if (event.source !== window || !event.data || !event.data._daly_bridge) return;
        if (event.data.type === 'DALY_DOWNLOAD_RESPONSE' && event.data.requestId === requestId) {
          window.removeEventListener('message', onBridgeResponse);
          downloadHandled = true;
          if (event.data.success) {
            console.log('[DALY] 下载已开始:', safeFilename, 'ID:', event.data.downloadId);
          } else {
            console.warn('[DALY] 下载失败:', event.data.error);
            _fallbackDownload(media, safeFilename);
          }
        }
      }
      window.addEventListener('message', onBridgeResponse);

      // 通过 postMessage 发送给 ISOLATED world 桥梁
      window.postMessage({
        _daly_bridge: true,
        type: 'DALY_DOWNLOAD',
        requestId: requestId,
        url: media.url,
        filename: safeFilename
      }, '*');

      // 5秒超时 fallback
      setTimeout(function() {
        if (!downloadHandled) {
          window.removeEventListener('message', onBridgeResponse);
          _fallbackDownload(media, safeFilename);
        }
      }, 5000);

      function _fallbackDownload(m, fname) {
        var a = document.createElement('a');
        a.href = m.url;
        a.download = fname || 'video.mp4';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      this._toast('已开始下载：' + safeFilename);
    },

    _downloadAll: function() {
      var self = this;
      if (!this._mediaList || this._mediaList.length === 0) {
        this._toast('没有可下载的媒体');
        return;
      }

      this._mediaList.forEach(function(media, idx) {
        setTimeout(function() {
          self._downloadOne(idx);
        }, idx * 800);
      });

      this._toast('已开始下载 ' + this._mediaList.length + ' 个文件');
    },

    _toast: function(msg) {
      var existing = document.querySelector('.daly-toast');
      if (existing) existing.remove();

      var tooltip = document.createElement('div');
      tooltip.textContent = msg;
      tooltip.className = 'daly-toast';
      document.body.appendChild(tooltip);
      setTimeout(function() {
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 2500);
    },

    _cleanTitle: function(raw) {
      if (!raw) return '';
      var text = raw.replace(/<[^>]+>/g, '');
      text = text.trim();
      text = text.replace(/[\\/:*?"<>|]/g, '_');
      // 截断到 20 字符（避免文件名过长）
      if (text.length > 20) {
        text = text.substring(0, 20);
      }
      return text;
    }
  };

  global.DALY_SelfMediaPanel = DALY_SelfMediaPanel;

  // ★ 监听桥梁转发的 background 推送（MAIN_WORLD 中 chrome.runtime 不可用）
    window.addEventListener('message', function(event) {
      if (event.source !== window || !event.data || !event.data._daly_bridge) return;
      if (event.data.type === 'DALY_DOUYIN_VIDEO_FOUND' && event.data.url) {
        if (!window._daly_bg_douyin_videos) window._daly_bg_douyin_videos = [];
        var exists = window._daly_bg_douyin_videos.some(function(u) { return u === event.data.url; });
        if (!exists) {
          window._daly_bg_douyin_videos.push(event.data.url);
          console.log('[DALY] 收到 background 推送的视频 URL:', event.data.url.substring(0, 100));
          var panel = document.getElementById('daly-self-media-panel');
          if (panel && panel.style.display !== 'none') {
            if (DALY_SelfMediaPanel._mediaList.length === 0) {
              DALY_SelfMediaPanel._extractMedia();
            }
          }
        }
      }
      // ★ 监听桥梁查询抖音视频缓存的响应
      if (event.data.type === 'DALY_GET_DOUYIN_VIDEOS_RESPONSE' && event.data.videos && event.data.videos.length > 0) {
        if (!window._daly_bg_douyin_videos) window._daly_bg_douyin_videos = [];
        event.data.videos.forEach(function(url) {
          var exists = window._daly_bg_douyin_videos.some(function(u) { return u === url; });
          if (!exists) window._daly_bg_douyin_videos.push(url);
        });
        // 自动刷新面板（如果正在显示且未找到视频）
        var panel = document.getElementById('daly-self-media-panel');
        if (panel && panel.style.display !== 'none' && DALY_SelfMediaPanel._mediaList.length === 0) {
          DALY_SelfMediaPanel._extractMedia();
        }
      }
    });
})(window);
