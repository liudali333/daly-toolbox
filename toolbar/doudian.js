// DALY工具箱 - 抖店商家后台悬浮工具栏
// 域名: fxg.jinritemai.com/*

(function(global) {
  'use strict';

  var LOG = (function() {
    try { return global.DALY_Log || { info: function(m) { console.log('[DALY-DOUDIAN] ' + m); }, error: function(m) { console.error('[DALY-DOUDIAN] ' + m); } }; } catch(e) { return { info: function(m) { console.log('[DALY-DOUDIAN] ' + m); }, error: function(m) { console.error('[DALY-DOUDIAN] ' + m); } }; }
  })();

  var DALY_Doudian = {
    observer: null,
    checkInterval: null,

    init: function() {
      var host = window.location.hostname.toLowerCase();
      if (host.indexOf('jinritemai.com') === -1) return;
      
      LOG.info('初始化抖店商家后台工具栏');
      this.createToolbar();
      this.startObserver();
    },

    createToolbar: function() {
      if (document.getElementById('daly-doudian-toolbar')) return;
      
      var toolbar = document.createElement('div');
      toolbar.id = 'daly-doudian-toolbar';
      toolbar.className = 'daly-qianniu-toolbar';
      toolbar.innerHTML = [
        '<div class="daly-mms-row daly-mms-stats-row">',
        '<span class="daly-qianniu-logo">🛠 DALY工具箱</span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">成交金额</span><span class="daly-mms-stat-value" id="daly-dd-deal">¥--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">推广花费</span><span class="daly-mms-stat-value" id="daly-dd-cost">¥--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">投产比</span><span class="daly-mms-stat-value" id="daly-dd-roi">--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">待发货</span><span class="daly-mms-stat-value" id="daly-dd-pending">--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">待处理工单</span><span class="daly-mms-stat-value" id="daly-dd-ticket">--</span></span>',
        '</div>',
        '<div class="daly-mms-row daly-mms-btns-row">',
        '<a class="daly-qianniu-btn" data-url="https://fxg.jinritemai.com/work/order/list">订单管理</a>',
        '<a class="daly-qianniu-btn" data-url="https://fxg.jinritemai.com/work/product/list">商品管理</a>',
        '<a class="daly-qianniu-btn" data-url="https://fxg.jinritemai.com/work/data/overview">数据中心</a>',
        '<a class="daly-qianniu-btn" data-url="https://fxg.jinritemai.com/work/after-sale/list">售后管理</a>',
        '<a class="daly-qianniu-btn" data-url="https://fxg.jinritemai.com/work/customer-service/workbench">客服会话</a>',
        '</div>'
      ].join('');
      document.body.appendChild(toolbar);
      this.bindToolbarEvents();
    },

    startObserver: function() {
      var self = this;
      if (this.observer) return;
      try {
        this.observer = new MutationObserver(function() {
          if (!document.getElementById('daly-doudian-toolbar')) self.createToolbar();
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) { LOG.error('observer失败: ' + e.message); }
      
      this.checkInterval = setInterval(function() {
        if (!document.getElementById('daly-doudian-toolbar')) self.createToolbar();
      }, 2000);
    },

    bindToolbarEvents: function() {
      var toolbar = document.getElementById('daly-doudian-toolbar');
      if (!toolbar) return;
      toolbar.addEventListener('click', function(e) {
        var target = e.target;
        if (target && target.classList && target.classList.contains('daly-qianniu-btn')) {
          var url = target.getAttribute('data-url');
          if (url) window.open(url, '_blank');
        }
      });
    }
  };

  global.DALY_Doudian = DALY_Doudian;
})(window);
