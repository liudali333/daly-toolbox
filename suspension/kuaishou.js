// DALY工具箱 - 快手悬浮窗
// 域名: kuaishou.com/*

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  var DALY_KS = {
    init: function() {
      try {
        this.createSuspension();
        this.loadData();
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('KS init 异常:', e.message || e);
      }
    },

    createSuspension: function() {
      if (document.getElementById('daly-ks-container')) return;

      var container = document.createElement('div');
      container.id = 'daly-ks-container';
      container.className = 'daly-suspension';
      container.setAttribute('data-platform', 'ks');

      container.innerHTML =
        '<div class="daly-suspension-header">' +
          '<h3>🛠 DALY工具箱 - 快手</h3>' +
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
      var maxAttempts = 10;
      var intervalMs = 1500;

      (function attempt(n) {
        if (n >= maxAttempts) return;
        var info = self.extract();
        if (info && (info.title || info.likes || info.comments)) return;
        sleep(intervalMs).then(function() { attempt(n + 1); });
      })(0);
    },

    extract: function() {
      var clean = (global.DALY_Utils && DALY_Utils.cleanTitle) || function(t) { return t; };
      var info = { title: '', likes: '', comments: '', collects: '', url: window.location.href };

      var titleEl = document.querySelector('.video-title, .title h1, [class*="videoTitle"]');
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

  global.DALY_KS = DALY_KS;
})(window);

// 自动初始化
(function() {
  var u = window.location.href;
  if (/kuaishou\.com/.test(u)) {
    if (typeof DALY_KS !== 'undefined') {
      DALY_KS.init();
    }
  }
})();
