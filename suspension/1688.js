// DALY工具箱 - 1688商品页悬浮窗
// 域名: detail.1688.com/*

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  var DALY_1688 = {
    _currentTitle: '',

    init: function() {
      try {
        this.createSuspension();
        this.loadData();
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('1688 init 异常:', e.message || e);
      }
    },

    createSuspension: function() {
      if (document.getElementById('daly-1688-container')) return;

      var container = document.createElement('div');
      container.id = 'daly-1688-container';
      container.className = 'daly-suspension';
      container.setAttribute('data-platform', '1688');

      container.innerHTML =
        '<div class="daly-suspension-header">' +
          '<h3 id="daly-toolbar-title">🛠 DALY工具箱 · 1688</h3>' +
        '</div>' +
        '<div class="daly-suspension-body">' +
          '<div class="daly-section">' +
            '<div class="daly-section-title">📦 商品信息</div>' +
            '<div class="daly-product-info" id="daly-product-info">' +
              '<div class="daly-loading">正在加载...</div>' +
            '</div>' +
          '</div>' +
          '<div class="daly-section">' +
            '<div class="daly-section-title">🔧 数据工具</div>' +
            '<div class="daly-tools">' +
              '<button class="daly-tool-btn" id="daly-btn-download"><span class="icon">⬇</span> 下载主图视频SKU</button>' +
              '<button class="daly-tool-btn" id="daly-btn-copy-title"><span class="icon">📋</span> 复制标题</button>' +
              '<button class="daly-tool-btn" id="daly-btn-copy-link"><span class="icon">🔗</span> 复制链接</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(container);

      document.getElementById('daly-btn-download').addEventListener('click', function() {
        if (global.DALY_MediaPanel) DALY_MediaPanel.open();
      });
      document.getElementById('daly-btn-copy-title').addEventListener('click', function() {
        self.copyText(self._currentTitle);
      });
      document.getElementById('daly-btn-copy-link').addEventListener('click', function() {
        self.copyText(window.location.href);
      });
    },

    copyText: function(text) {
      var message = text || '（无内容）';
      var fallback = function() {
        var ta = document.createElement('textarea');
        ta.value = message;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message).then(function() { self._toast('已复制'); }).catch(fallback);
      } else {
        fallback();
        self._toast('已复制');
      }
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

    loadData: function() {
      var self = this;
      var maxAttempts = DALY_Config ? DALY_Config.RETRY.MAX_ATTEMPTS : 5;
      var intervalMs = DALY_Config ? DALY_Config.RETRY.INTERVAL_MS : 1000;

      (function attempt(n) {
        if (n >= maxAttempts) {
          var container = document.getElementById('daly-product-info');
          if (container) container.innerHTML = '<div class="daly-loading">当前页面未识别到商品信息</div>';
          return;
        }
        var info = self.extract();
        if (info && (info.title || info.sales)) {
          self.render(info);
          return;
        }
        sleep(intervalMs).then(function() { attempt(n + 1); });
      })(0);
    },

    extract: function() {
      var clean = (global.DALY_Utils && DALY_Utils.cleanTitle) || function(t) { return t; };
      var info = { title: '', sales: '-', reviews: '-', url: window.location.href };

      var titleEl = document.querySelector('.product-title, .title h1, h1.product-title');
      if (titleEl && titleEl.textContent) info.title = clean(titleEl.textContent.trim());
      if (!info.title) info.title = clean(document.title || '');

      if (info.sales === '-') {
        var html = (global.DALY_Utils && DALY_Utils.getPageHtml) ? DALY_Utils.getPageHtml() : document.documentElement.outerHTML;
        var saleMatch = html.match(/成交[\s\S]{0,5}?(\d[\d,]*)/);
        if (saleMatch) info.sales = saleMatch[1];
      }

      return info;
    },

    render: function(info) {
      var container = document.getElementById('daly-product-info');
      if (!container) return;
      container.innerHTML = '';
      this._currentTitle = info.title || '';

      var rows = [
        ['商品名', info.title || '-'],
        ['销量', info.sales || '-']
      ];

      for (var i = 0; i < rows.length; i++) {
        var item = document.createElement('div');
        item.className = 'daly-stat-item';
        item.innerHTML =
          '<span class="daly-stat-label">' + rows[i][0] + '</span>' +
          '<span class="daly-stat-value" style="flex:1;text-align:right;max-width:150px;line-height:1.4;">' +
            this._escapeHtml(rows[i][1]) +
          '</span>';
        container.appendChild(item);
      }
    },

    _escapeHtml: function(text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  global.DALY_1688 = DALY_1688;
})(window);

// 自动初始化
(function() {
  var u = window.location.href;
  if (/detail\.1688\.com/.test(u)) {
    if (typeof DALY_1688 !== 'undefined') DALY_1688.init();
  }
})();
