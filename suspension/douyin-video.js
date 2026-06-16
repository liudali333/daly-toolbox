// DALY工具箱 - 抖音视频悬浮窗
// 域名: douyin.com/*

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  var DALY_DOUYIN_VIDEO = {
    init: function() {
      try {
        // ★ 页面加载时立即启动拦截（不能等到用户点下载按钮）
        this._startIntercept();
        this.createSuspension();
        this.loadData();
        // ★ 监听 SPA 路由切换
        this._watchSPA();
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('DOUYIN_VIDEO init 异常:', e.message || e);
      }
    },

    // ★ 拦截视频请求：XHR + Fetch 双管齐下
    _startIntercept: function() {
      // === 拦截 XHR ===
      if (!window._daly_xhr_intercepted) {
        window._daly_xhr_intercepted = true;
        var origOpen = XMLHttpRequest.prototype.open;
        var origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
          this._daly_url = url;
          return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function() {
          var xhr = this;
          var targetUrl = this._daly_url || '';
          // ★ 更激进：拦截抖音域名的所有 XHR 响应，从中搜索视频数据
          if (/douyin\.com/.test(targetUrl) || /aweme/.test(targetUrl) || /video/.test(targetUrl)) {
            xhr.addEventListener('load', function() {
              try {
                var resp = JSON.parse(xhr.responseText);
                console.log('[DALY] XHR 响应 URL:', targetUrl.substring(0, 120));
                // ★ 提取视频 URL 和封面
                var result = DALY_DOUYIN_VIDEO._findVideoAndCoverInResponse(resp);
                console.log('[DALY] XHR 提取结果:', result.videoUrl ? result.videoUrl.substring(0, 80) : 'NO_VIDEO', result.coverUrl ? result.coverUrl.substring(0, 80) : 'NO_COVER');
                if (result.videoUrl && !window._daly_douyin_video_urls.some(function(u) { return u === result.videoUrl; })) {
                  window._daly_douyin_video_urls.push(result.videoUrl);
                }
                if (result.coverUrl) {
                  window._daly_douyin_cover_url = result.coverUrl;
                }
              } catch(e) {}
            });
          }
          return origSend.apply(this, arguments);
        };
      }

      // === 拦截 Fetch ===
      if (!window._daly_fetch_intercepted) {
        window._daly_fetch_intercepted = true;
        var origFetch = window.fetch;
        window.fetch = function() {
          var url = (typeof arguments[0] === 'string') ? arguments[0] :
                    (arguments[0] && arguments[0].url) || '';
          var promise = origFetch.apply(this, arguments);

          // ★ 更激进：拦截抖音域名的所有 Fetch 响应
          if (/douyin\.com/.test(url) || /aweme/.test(url) || /video/.test(url)) {
            promise.then(function(resp) {
              var cloned = resp.clone();
              cloned.json().then(function(data) {
                console.log('[DALY] Fetch 响应 URL:', url.substring(0, 120));
                var result = DALY_DOUYIN_VIDEO._findVideoAndCoverInResponse(data);
                console.log('[DALY] Fetch 提取结果:', result.videoUrl ? result.videoUrl.substring(0, 80) : 'NO_VIDEO', result.coverUrl ? result.coverUrl.substring(0, 80) : 'NO_COVER');
                if (result.videoUrl && !window._daly_douyin_video_urls.some(function(u) { return u === result.videoUrl; })) {
                  window._daly_douyin_video_urls.push(result.videoUrl);
                }
                if (result.coverUrl) {
                  window._daly_douyin_cover_url = result.coverUrl;
                }
              }).catch(function() {});
            }).catch(function() {});
          }
          return promise;
        };
      }

      // 初始化视频 URL 缓存
      if (!window._daly_douyin_video_urls) {
        window._daly_douyin_video_urls = [];
      }
    },

    // ★ 从 API 响应中递归查找视频 URL + 封面 URL
    _findVideoAndCoverInResponse: function(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 10) return { videoUrl: null, coverUrl: null };
      depth = depth || 0;
      var result = { videoUrl: null, coverUrl: null };

      // ★ 新版抖音数据结构：play_addr 可能包含 url_list 或直接有 uri
      // 1. play_addr.url_list（旧版）
      if (obj.play_addr && obj.play_addr.url_list && obj.play_addr.url_list.length > 0) {
        result.videoUrl = obj.play_addr.url_list[0];
      }
      // 2. play_addr.uri（新版：uri 可能是 video_id，需要拼接 CDN URL）
      if (obj.play_addr && obj.play_addr.uri && !result.videoUrl) {
        var uri = obj.play_addr.uri;
        if (uri.indexOf('http') === 0) result.videoUrl = uri;
        else console.log('[DALY] play_addr.uri (非HTTP):', uri);
      }
      // 3. download_addr
      if (obj.download_addr && obj.download_addr.url_list && obj.download_addr.url_list.length > 0 && !result.videoUrl) {
        result.videoUrl = obj.download_addr.url_list[0];
      }
      // 4. play_addr_h264 / play_addr_h265
      if (obj.play_addr_h264 && obj.play_addr_h264.url_list && obj.play_addr_h264.url_list.length > 0 && !result.videoUrl) {
        result.videoUrl = obj.play_addr_h264.url_list[0];
      }
      if (obj.play_addr_h265 && obj.play_addr_h265.url_list && obj.play_addr_h265.url_list.length > 0 && !result.videoUrl) {
        result.videoUrl = obj.play_addr_h265.url_list[0];
      }
      // 5. bitrate 数组（新版：多个质量等级）
      if (Array.isArray(obj.bitrate) && !result.videoUrl) {
        for (var bi = 0; bi < obj.bitrate.length; bi++) {
          var br = obj.bitrate[bi];
          if (br.play_addr && br.play_addr.url_list && br.play_addr.url_list.length > 0) {
            result.videoUrl = br.play_addr.url_list[0];
            break;
          }
          if (br.download_addr && br.download_addr.url_list && br.download_addr.url_list.length > 0) {
            result.videoUrl = br.download_addr.url_list[0];
            break;
          }
        }
      }

      // 提取封面
      if (obj.cover && obj.cover.url_list && obj.cover.url_list.length > 0 && !result.coverUrl) {
        result.coverUrl = obj.cover.url_list[0];
      }
      if (obj.origin_cover && obj.origin_cover.url_list && obj.origin_cover.url_list.length > 0 && !result.coverUrl) {
        result.coverUrl = obj.origin_cover.url_list[0];
      }
      if (obj.dynamic_cover && obj.dynamic_cover.url_list && obj.dynamic_cover.url_list.length > 0 && !result.coverUrl) {
        result.coverUrl = obj.dynamic_cover.url_list[0];
      }
      // 封面也可能是字符串
      if (typeof obj.cover === 'string' && !result.coverUrl && (obj.cover.indexOf('douyinpic') !== -1 || obj.cover.indexOf('byteimg') !== -1)) {
        result.coverUrl = obj.cover;
      }

      // 如果在当前层级找到了 videoUrl，直接返回
      if (result.videoUrl) return result;

      // video 对象
      if (obj.video && typeof obj.video === 'object') {
        var v = DALY_DOUYIN_VIDEO._findVideoAndCoverInResponse(obj.video, depth + 1);
        if (v.videoUrl) return v;
        if (v.coverUrl && !result.coverUrl) result.coverUrl = v.coverUrl;
      }
      // aweme_detail
      if (obj.aweme_detail && typeof obj.aweme_detail === 'object') {
        var d = DALY_DOUYIN_VIDEO._findVideoAndCoverInResponse(obj.aweme_detail, depth + 1);
        if (d.videoUrl) return d;
        if (d.coverUrl && !result.coverUrl) result.coverUrl = d.coverUrl;
      }
      // data 列表
      if (Array.isArray(obj.data)) {
        for (var di = 0; di < obj.data.length; di++) {
          if (typeof obj.data[di] === 'object') {
            var dd = DALY_DOUYIN_VIDEO._findVideoAndCoverInResponse(obj.data[di], depth + 1);
            if (dd.videoUrl) return dd;
            if (dd.coverUrl && !result.coverUrl) result.coverUrl = dd.coverUrl;
          }
        }
      }
      // 递归搜索
      for (var key in obj) {
        if (typeof obj[key] === 'string' &&
            (obj[key].indexOf('douyinvod') !== -1 || obj[key].indexOf('bytevcloud') !== -1 || obj[key].indexOf('ibytedtos') !== -1 || obj[key].indexOf('bytecdn') !== -1) &&
            (obj[key].indexOf('.mp4') !== -1 || obj[key].indexOf('/video/') !== -1 || obj[key].indexOf('/tos/') !== -1)) {
          return { videoUrl: obj[key], coverUrl: result.coverUrl };
        }
        if (typeof obj[key] === 'object' && depth < 8) {
          var found = DALY_DOUYIN_VIDEO._findVideoAndCoverInResponse(obj[key], depth + 1);
          if (found.videoUrl) return found;
          if (found.coverUrl && !result.coverUrl) result.coverUrl = found.coverUrl;
        }
      }
      return result;
    },

    // ★ 监听 SPA 路由切换（抖音切换视频不刷新页面）
    _watchSPA: function() {
      var self = this;
      var lastUrl = location.href;

      // 方式1：popstate
      window.addEventListener('popstate', function() {
        var newUrl = location.href;
        if (newUrl !== lastUrl) {
          lastUrl = newUrl;
          self._onRouteChange();
        }
      });

      // 方式2：pushState/replaceState
      var origPushState = history.pushState;
      var origReplaceState = history.replaceState;
      history.pushState = function() {
        origPushState.apply(this, arguments);
        var newUrl = location.href;
        if (newUrl !== lastUrl) {
          lastUrl = newUrl;
          self._onRouteChange();
        }
      };
      history.replaceState = function() {
        origReplaceState.apply(this, arguments);
        var newUrl = location.href;
        if (newUrl !== lastUrl) {
          lastUrl = newUrl;
          self._onRouteChange();
        }
      };
    },

    _onRouteChange: function() {
      var self = this;
      // 重置缓存，重新采集当前视频
      window._daly_douyin_video_urls = [];
      delete window._daly_douyin_video_url;
      window._daly_bg_douyin_videos = [];
      delete window._daly_douyin_cover_url;
      // 通知 background 清空该 tab 的缓存
      window.postMessage({ _daly_bridge: true, type: 'DALY_CLEAR_DOUYIN_VIDEOS' }, '*');
      self.loadData();
    },

    createSuspension: function() {
      if (document.getElementById('daly-dy-video-container')) return;

      var container = document.createElement('div');
      container.id = 'daly-dy-video-container';
      container.className = 'daly-suspension';
      container.setAttribute('data-platform', 'dy_video');

      container.innerHTML =
        '<div class="daly-suspension-header">' +
          '<h3>🛠 DALY工具箱 - 抖音</h3>' +
        '</div>' +
        '<div class="daly-suspension-body">' +
          '<div class="daly-section">' +
            '<button class="daly-tool-btn" id="daly-btn-download"><span class="icon">⬇</span> 下载视频</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(container);

      // 添加拖拽功能
      this.initDrag(container);

      document.getElementById('daly-btn-download').addEventListener('click', function() {
        if (global.DALY_SelfMediaPanel) DALY_SelfMediaPanel.open();
      });
    },

    initDrag: function(container) {
      var header = container.querySelector('.daly-suspension-header');
      var isDragging = false;
      var startX, startY, initialX, initialY;

      header.addEventListener('mousedown', function(e) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = container.offsetLeft;
        initialY = container.offsetTop;
        container.style.transition = 'none';
      });

      document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        e.preventDefault();
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        container.style.right = 'auto';
        container.style.left = (initialX + dx) + 'px';
        container.style.top = (initialY + dy) + 'px';
        container.style.transform = 'none';
      });

      document.addEventListener('mouseup', function() {
        isDragging = false;
        container.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    },

    loadData: function() {
      var self = this;
      var maxAttempts = 10; // ★ 增加到 10 次
      var intervalMs = 1500;

      (function attempt(n) {
        if (n >= maxAttempts) {
          // 不显示错误，悬浮窗保持静默
          return;
        }
        var info = self.extract();
        if (info && (info.title || info.author || info.likes)) {
          // ★ 有数据就行，不再强依赖 render
          return;
        }
        sleep(intervalMs).then(function() { attempt(n + 1); });
      })(0);
    },

    extract: function() {
      var clean = (global.DALY_Utils && DALY_Utils.cleanTitle) || function(t) { return t; };
      var info = { title: '', author: '', likes: '', comments: '', collects: '', shares: '', url: window.location.href };

      var titleEl = document.querySelector('.video-desc, .desc, [class*="videoDesc"]');
      if (titleEl && titleEl.textContent) info.title = clean(titleEl.textContent.trim());
      if (!info.title) info.title = clean(document.title || '');

      var authorEl = document.querySelector('.author-name, .nickname, [class*="authorName"]');
      if (authorEl && authorEl.textContent) info.author = authorEl.textContent.trim();

      return info;
    },

    _escapeHtml: function(text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  global.DALY_DOUYIN_VIDEO = DALY_DOUYIN_VIDEO;
})(window);

// 自动初始化
(function() {
  var u = window.location.href;
  if (/douyin\.com/.test(u)) {
    if (typeof DALY_DOUYIN_VIDEO !== 'undefined') DALY_DOUYIN_VIDEO.init();
  }
})();
