// DALY工具箱 - 媒体下载面板 UI 模块
// 功能：滚动页面懒加载 → 提取主图/详情图/视频/SKU图 → 打包下载 / 单个下载
// 依赖: MediaPdd, MediaTmall, MediaJd, Media1688, MediaDouyin, JSZip, DALY_Utils

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  var DALY_MediaPanel = {

    _mediaData: null,

    open: async function() {
      var self = this;
      var existing = document.getElementById('daly-media-panel');
      if (existing) {
        existing.style.display = 'flex';
        return;
      }

      var panel = document.createElement('div');
      panel.id = 'daly-media-panel';
      panel.className = 'daly-media-overlay';
      panel.innerHTML =
        '<div class="daly-media-panel">' +
          '<div class="daly-media-header">' +
            '<h2>📦 媒体资源 - 主图 / 视频 / SKU图</h2>' +
            '<div class="daly-media-actions">' +
              '<button id="daly-dl-all" class="daly-btn daly-btn-primary">⬇ 一键打包下载</button>' +
              '<button id="daly-media-close" class="daly-btn daly-btn-close">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="daly-media-body">' +
            '<div class="daly-media-sidebar">' +
              '<button class="daly-tab-btn active" data-tab="main">🖼 主图</button>' +
              '<button class="daly-tab-btn" data-tab="detail">📄 详情图</button>' +
              '<button class="daly-tab-btn" data-tab="video">🎬 视频</button>' +
              '<button class="daly-tab-btn" data-tab="sku">🏷 SKU图</button>' +
              '<div id="daly-media-stats" class="daly-media-stats"></div>' +
            '</div>' +
            '<div id="daly-media-grid" class="daly-media-grid">' +
              '<div class="daly-media-placeholder">正在提取媒体资源...</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(panel);

      // 关闭按钮
      document.getElementById('daly-media-close').addEventListener('click', function() { panel.remove(); });
      panel.addEventListener('click', function(e) {
        if (e.target === panel) panel.remove();
      });

      // Tab 切换
      var tabs = panel.querySelectorAll('.daly-tab-btn');
      tabs.forEach(function(t) {
        t.addEventListener('click', function() {
          tabs.forEach(function(x) { x.classList.remove('active'); x.style.borderColor = ''; });
          t.classList.add('active');
          self.renderMediaTab(t.dataset.tab);
        });
      });

      // 下载全部
      document.getElementById('daly-dl-all').addEventListener('click', function() { self._downloadAll(); });

      // 滚动加载 + 提取数据
      await this._scrollAndExtract();
    },

    _scrollAndExtract: async function() {
      var self = this;
      var grid = document.getElementById('daly-media-grid');
      if (!grid) return;
      grid.innerHTML = '<div class="daly-media-placeholder">⏳ 正在滚动页面加载详情图...</div>';

      var scrollStep = DALY_Config ? DALY_Config.SCROLL.STEP_PX : 800;
      var scrollWait = DALY_Config ? DALY_Config.SCROLL.WAIT_MS : 300;
      var originalScrollY = window.scrollY || 0;
      var maxHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
      var currentY = 0;

      var isTmall = window.location.hostname.indexOf('tmall.com') > -1 || window.location.hostname.indexOf('taobao.com') > -1;

      if (isTmall) {
        // 天猫/淘宝：按 descV8 区域加载状态判断
        var lastDescCount = 0;
        var descStableCount = 0;
        var maxDescStable = 5;
        var maxScrolls = 50;
        var scrollCount = 0;

        while (scrollCount < maxScrolls) {
          var descContainers = document.querySelectorAll('.descV8-singleImage, .deseVB-singleImage');
          var currentDescCount = descContainers.length;

          if (currentDescCount > lastDescCount) {
            // 发现新的详情图容器，说明还在加载
            descStableCount = 0;
            lastDescCount = currentDescCount;
          } else {
            descStableCount++;
          }

          currentY = Math.min(currentY + scrollStep, 50000);
          window.scrollTo(0, currentY);
          await sleep(scrollWait);

          var newHeight = document.documentElement.scrollHeight || 0;
          if (newHeight > maxHeight) {
            maxHeight = newHeight;
            descStableCount = 0;
          }

          // 连续多次没有新的详情图容器，且页面高度不再增长，说明加载完毕
          if (descStableCount >= maxDescStable) break;
          scrollCount++;
        }
      } else {
        // 其他平台：按页面高度判断
        var stableCount = 0;
        var maxStable = 3;
        var maxScrolls = 10;
        var scrollCount = 0;

        while (scrollCount < maxScrolls) {
          currentY = Math.min(currentY + scrollStep, 30000);
          window.scrollTo(0, currentY);
          await sleep(scrollWait);

          var newHeight = document.documentElement.scrollHeight || 0;
          if (newHeight > maxHeight) {
            maxHeight = newHeight;
            stableCount = 0;
          } else {
            stableCount++;
          }

          if (stableCount >= maxStable) break;
          scrollCount++;
        }
      }

      // 回到原位置
      window.scrollTo(0, originalScrollY);
      await sleep(500);

      this._mediaData = this._extractAll();
      this._updateStats();
      this.renderMediaTab('main');
    },

    _extractAll: function() {
      var data = { mainImages: [], detailImages: [], videos: [], skuImages: [] };
      var host = window.location.hostname.toLowerCase();
      var toOriginal = (global.DALY_Utils && DALY_Utils.toOriginalUrl) ? DALY_Utils.toOriginalUrl : function(u) { return u; };

      // 天猫 / 淘宝
      if (host.indexOf('tmall.com') > -1 || host.indexOf('taobao.com') > -1) {
        if (global.MediaTmall) MediaTmall.extract(data, toOriginal);
      }
      // 京东
      else if (host.indexOf('jd.com') > -1) {
        if (global.MediaJd) MediaJd.extract(data, toOriginal);
      }
      // 拼多多
      else if (host.indexOf('pinduoduo.com') > -1 || host.indexOf('yangkeduo.com') > -1) {
        if (global.MediaPdd) MediaPdd.extract(data, toOriginal);
      }
      // 1688
      else if (host.indexOf('1688.com') > -1) {
        if (global.Media1688) Media1688.extract(data, toOriginal);
      }
      // 抖店 / 抖音
      else if (host.indexOf('jinritemai.com') > -1 || host.indexOf('douyin.com') > -1) {
        if (global.MediaDouyin) MediaDouyin.extract(data, toOriginal);
      }

      if (global.DALY_Log) {
        DALY_Log.info('媒体提取完成 - 主图:' + data.mainImages.length +
          ', 详情图:' + data.detailImages.length +
          ', 视频:' + data.videos.length +
          ', SKU:' + data.skuImages.length);
      }
      return data;
    },

    _updateStats: function() {
      var d = this._mediaData;
      var el = document.getElementById('daly-media-stats');
      if (!el || !d) return;
      el.innerHTML =
        '<div><b>📊 统计</b></div>' +
        '<div>🖼 主图: ' + d.mainImages.length + '</div>' +
        '<div>📄 详情图: ' + d.detailImages.length + '</div>' +
        '<div>🎬 视频: ' + d.videos.length + '</div>' +
        '<div>🏷 SKU图: ' + d.skuImages.length + '</div>' +
        '<div><b>总计: ' + (d.mainImages.length + d.detailImages.length + d.videos.length + d.skuImages.length) + '</b></div>';
    },

    renderMediaTab: function(tab) {
      var grid = document.getElementById('daly-media-grid');
      if (!grid || !this._mediaData) return;

      var items = [];
      var typeLabel = '';
      switch (tab) {
        case 'main':   items = this._mediaData.mainImages;  typeLabel = '主图'; break;
        case 'detail': items = this._mediaData.detailImages; typeLabel = '详情图'; break;
        case 'video':  items = this._mediaData.videos;       typeLabel = '视频'; break;
        case 'sku':    items = this._mediaData.skuImages;    typeLabel = 'SKU图'; break;
      }

      if (items.length === 0) {
        grid.innerHTML = '<div class="daly-media-placeholder">😢 暂无' + typeLabel + '资源</div>';
        return;
      }

      var html = '';
      var self = this;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var url = typeof item === 'string' ? item : item.url;
        var label = (typeof item === 'object' && item.label) ? item.label : '';
        var isVideo = tab === 'video';
        var ext = isVideo ? 'mp4' : (url.indexOf('.png') > -1 ? 'png' : (url.indexOf('.webp') > -1 ? 'webp' : 'jpg'));
        var displayName = label || (typeLabel + '_' + (i + 1));

        html +=
          '<div class="daly-media-card" data-url="' + this._escapeAttr(url) + '" data-name="' + this._escapeAttr(displayName + '.' + ext) + '">' +
            (isVideo
              ? '<video src="' + this._escapeAttr(url) + '" muted preload="metadata" controls class="daly-media-thumb"></video>'
              : '<img src="' + this._escapeAttr(url) + '" class="daly-media-thumb" loading="lazy" />') +
            '<div class="daly-media-info"><span title="' + this._escapeAttr(displayName) + '">#' + (i + 1) + (label ? ' ' + this._escapeHtml(label) : '') + '</span>' +
            '<button class="daly-btn daly-btn-primary daly-btn-small">⬇</button></div>' +
          '</div>';
      }
      grid.innerHTML = html;

      // 绑定单个下载按钮
      var btns = grid.querySelectorAll('.daly-btn-small');
      for (var j = 0; j < btns.length; j++) {
        (function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var card = btn.closest ? btn.closest('.daly-media-card') : btn.parentElement.parentElement;
            if (card) self._downloadSingle(card.getAttribute('data-url'), card.getAttribute('data-name'));
          });
        })(btns[j]);
      }
    },

    // ---------- 打包下载全部 ----------
    _downloadAll: async function() {
      var self = this;
      var d = this._mediaData;
      if (!d) return;

      var all = [];
      d.mainImages.forEach(function(u, i) { all.push({ url: u, name: '主图_' + (i + 1) }); });
      d.detailImages.forEach(function(u, i) { all.push({ url: u, name: '详情图_' + (i + 1) }); });
      d.videos.forEach(function(u, i) { all.push({ url: u, name: '视频_' + (i + 1) }); });
      d.skuImages.forEach(function(item, i) {
        all.push({
          url: typeof item === 'string' ? item : item.url,
          name: (typeof item === 'object' && item.label) ? item.label : ('SKU图_' + (i + 1))
        });
      });

      if (all.length === 0) {
        this._toast('没有可下载资源');
        return;
      }

      var btn = document.getElementById('daly-dl-all');
      if (btn) {
        btn.textContent = '📦 打包中 0/' + all.length + '...';
        btn.disabled = true;
      }

      try {
        if (!global.JSZip) {
          throw new Error('JSZip 未加载, 无法打包下载');
        }
        var zip = new JSZip();
        var zipName = 'Daly-' + ((global.DALY_Suspension && DALY_Suspension._currentTitle) || '商品').replace(/[\\/:*?"<>|]/g, '_').substring(0, 30) + '.zip';

        var doneCount = 0;
        var hasAnyFailure = false;

        // 并行抓取（限制并发，避免阻塞）
        var concurrency = 8;
        for (var start = 0; start < all.length; start += concurrency) {
          var chunk = all.slice(start, start + concurrency);
          var promises = chunk.map(function(item) {
            return self._fetchImage(item.url).then(function(blob) {
              return self._convertWebpToJpg(blob);
            }).then(function(blob) {
              var ext = blob.type.indexOf('mp4') > -1 ? 'mp4' :
                blob.type.indexOf('png') > -1 ? 'png' :
                blob.type.indexOf('jpeg') > -1 ? 'jpg' :
                (blob.type.split('/')[1] || 'jpg');
              zip.file(item.name + '.' + ext, blob);
              doneCount++;
              if (btn) btn.textContent = '📦 打包中 ' + doneCount + '/' + all.length + '...';
            }).catch(function(err) {
              hasAnyFailure = true;
              doneCount++;
              if (global.DALY_Log) DALY_Log.warn('资源下载失败:', item.name, err && err.message);
            });
          });
          await Promise.all(promises);
        }

        var content = await zip.generateAsync({ type: 'blob' }, function(meta) {
          if (btn && meta) btn.textContent = '📦 压缩中 ' + Math.round(meta.percent) + '%...';
        });

        var a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 10000);

        if (btn) {
          btn.textContent = hasAnyFailure ? '✅ 下载完成 (部分缺失)' : '✅ 下载完成';
          btn.style.background = hasAnyFailure ? '#f59e0b' : '#22c55e';
          setTimeout(function() {
            btn.textContent = '⬇ 一键打包下载';
            btn.disabled = false;
            btn.style.background = '';
          }, 3000);
        }
      } catch (e) {
        if (global.DALY_Log) DALY_Log.error('打包下载异常:', e.message);
        if (btn) {
          btn.textContent = '❌ 失败: ' + e.message;
          btn.disabled = false;
          btn.style.background = '#ef4444';
          setTimeout(function() {
            btn.textContent = '⬇ 一键打包下载';
            btn.style.background = '';
          }, 3000);
        }
      }
    },

    _downloadSingle: function(url, filename) {
      var self = this;
      this._fetchImage(url).then(function(blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 5000);
        self._toast('已下载: ' + filename);
      }).catch(function(err) {
        if (global.DALY_Log) DALY_Log.warn('单文件下载失败:', err.message, url);
        // 兜底: 浏览器直接打开
        window.open(url, '_blank');
      });
    },

    // ---------- 工具函数 ----------
    _fetchImage: function(url) {
      // 优先尝试替换 webp → jpg，降低兼容问题
      var tryUrl = String(url).replace(/\.webp(\?|$)/i, '.jpg$1');
      return fetch(tryUrl, { mode: 'cors' }).then(function(resp) {
        if (!resp.ok) return fetch(url, { mode: 'cors' }).then(function(r) { return r.blob(); });
        return resp.blob();
      }).catch(function() {
        return fetch(url, { mode: 'cors' }).then(function(r) { return r.blob(); });
      });
    },

    _convertWebpToJpg: function(blob) {
      return new Promise(function(resolve) {
        if (!blob || !blob.type || (blob.type !== 'image/webp' && blob.type !== 'image/avif')) {
          resolve(blob); return;
        }
        var img = new Image();
        var objUrl = URL.createObjectURL(blob);
        img.onload = function() {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) { URL.revokeObjectURL(objUrl); resolve(blob); return; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(function(jpgBlob) {
            URL.revokeObjectURL(objUrl);
            resolve(jpgBlob && jpgBlob.size > 0 ? jpgBlob : blob);
          }, 'image/jpeg', 0.95);
        };
        img.onerror = function() { URL.revokeObjectURL(objUrl); resolve(blob); };
        img.src = objUrl;
      });
    },

    _toast: function(msg) {
      var tooltip = document.createElement('div');
      tooltip.textContent = msg;
      tooltip.className = 'daly-toast';
      document.body.appendChild(tooltip);
      setTimeout(function() {
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 1500);
    },

    _escapeHtml: function(text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    _escapeAttr: function(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  };

  global.DALY_MediaPanel = DALY_MediaPanel;
})(window);
