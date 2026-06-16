// DALY工具箱 - 小红书悬浮窗
// 域名: xiaohongshu.com/*

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  var DALY_XHS = {
    init: function() {
      try {
        this.createSuspension();
        this.loadData();
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('XHS init 异常:', e.message || e);
      }
    },

    createSuspension: function() {
      if (document.getElementById('daly-xhs-container')) return;

      var container = document.createElement('div');
      container.id = 'daly-xhs-container';
      container.className = 'daly-suspension';
      container.setAttribute('data-platform', 'xhs');

      container.innerHTML =
        '<div class="daly-suspension-header">' +
          '<h3>🛠 DALY工具箱 - 小红书</h3>' +
        '</div>' +
        '<div class="daly-suspension-body">' +
          '<div class="daly-section">' +
            '<button class="daly-tool-btn" id="daly-btn-download"><span class="icon">⬇</span> 下载图文</button>' +
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
      var maxAttempts = DALY_Config ? DALY_Config.RETRY.MAX_ATTEMPTS : 5;
      var intervalMs = DALY_Config ? DALY_Config.RETRY.INTERVAL_MS : 1000;

      (function attempt(n) {
        if (n >= maxAttempts) {
          var container = document.getElementById('daly-product-info');
          if (container) container.innerHTML = '<div class="daly-loading">当前页面未识别到内容信息</div>';
          return;
        }
        var info = self.extract();
        if (info && (info.title || info.likes || info.collects)) {
          self.render(info);
          return;
        }
        sleep(intervalMs).then(function() { attempt(n + 1); });
      })(0);
    },

    extract: function() {
      var clean = (global.DALY_Utils && DALY_Utils.cleanTitle) || function(t) { return t; };
      var info = { title: '', likes: '', comments: '', collects: '', url: window.location.href };

      var titleEl = document.querySelector('.note-content, .title h1, [class*="noteTitle"]');
      if (titleEl && titleEl.textContent) info.title = clean(titleEl.textContent.trim());
      if (!info.title) info.title = clean(document.title || '');

      return info;
    },

    _escapeHtml: function(text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  global.DALY_XHS = DALY_XHS;
})(window);

// 自动初始化
(function() {
  var u = window.location.href;
  if (/xiaohongshu\.com/.test(u)) {
    if (typeof DALY_XHS !== 'undefined') DALY_XHS.init();
  }
})();
