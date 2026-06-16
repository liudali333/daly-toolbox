// DALY工具箱 - 千牛商家后台工具栏
(function(global) {
  'use strict';

  var LOG = (function() {
    try { return global.DALY_Log || { info: function(m) { console.log('[DALY-QN] ' + m); }, error: function(m) { console.error('[DALY-QN] ' + m); } }; } catch(e) { return { info: function(m) { console.log('[DALY-QN] ' + m); }, error: function(m) { console.error('[DALY-QN] ' + m); } }; }
  })();

  var DALY_Qianniu = {
    observer: null,
    checkInterval: null,

    init: function() {
      var host = window.location.hostname.toLowerCase();
      var supportedHosts = ['qianniu', 'qn.taobao.com', 'myseller.taobao.com', 'my.taobao.com', 'i.taobao.com', 'sell.taobao.com'];
      var isSupported = false;
      for (var i = 0; i < supportedHosts.length; i++) {
        if (host.indexOf(supportedHosts[i]) !== -1) { isSupported = true; break; }
      }
      if (!isSupported && !(host.indexOf('shop') !== -1 && host.indexOf('.taobao.com') !== -1)) return;
      LOG.info('初始化千牛商家后台工具栏');
      this.createToolbar();
      this.startObserver();
      this.startDataPolling();
    },

    createToolbar: function() {
      if (document.getElementById('daly-qianniu-toolbar')) return;
      var toolbar = document.createElement('div');
      toolbar.id = 'daly-qianniu-toolbar';
      toolbar.className = 'daly-qianniu-toolbar';
      toolbar.innerHTML = [
        '<div class="daly-mms-row daly-mms-stats-row">',
        '<span class="daly-qianniu-logo">🛠 DALY工具箱</span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">支付金额</span><span class="daly-mms-stat-value" id="daly-qn-deal">¥--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">访客数</span><span class="daly-mms-stat-value" id="daly-qn-visitors">--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">订单数</span><span class="daly-mms-stat-value" id="daly-qn-orders">--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">转化率</span><span class="daly-mms-stat-value" id="daly-qn-conversion">--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">待发货</span><span class="daly-mms-stat-value" id="daly-qn-pending">--</span></span>',
        '<span class="daly-mms-stat"><span class="daly-mms-stat-label">工单</span><span class="daly-mms-stat-value" id="daly-qn-ticket">--</span></span>',
        '</div>',
        '<div class="daly-mms-row daly-mms-btns-row">',
        '<a class="daly-qianniu-btn" data-url="https://trade.taobao.com/trade/itemlist/list_sold_items.htm">订单管理</a>',
        '<a class="daly-qianniu-btn" data-url="https://myseller.taobao.com/home.htm/SellManage/on_sale?current=1&pageSize=100">商品管理</a>',
        '<a class="daly-qianniu-btn" data-url="https://sycm.taobao.com/">数据中心</a>',
        '<a class="daly-qianniu-btn" data-url="https://im.taobao.com/">客服中心</a>',
        '<a class="daly-qianniu-btn" data-url="https://myseller.taobao.com/home.htm/starb/nebula/mkt-tools/mkt-tools-home/home">营销中心</a>',
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
          if (!document.getElementById('daly-qianniu-toolbar')) self.createToolbar();
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) { LOG.error('observer失败: ' + e.message); }
      this.checkInterval = setInterval(function() {
        if (!document.getElementById('daly-qianniu-toolbar')) self.createToolbar();
      }, 2000);
    },

    bindToolbarEvents: function() {
      var toolbar = document.getElementById('daly-qianniu-toolbar');
      if (!toolbar) return;
      toolbar.addEventListener('click', function(e) {
        var target = e.target;
        if (target && target.classList && target.classList.contains('daly-qianniu-btn')) {
          var url = target.getAttribute('data-url');
          if (url) window.open(url, '_blank');
        }
      });
    },

    // 提取千牛首页核心数据指标
    extractData: function() {
      try { this._extractMysellerData(); } catch(e) { LOG.error('数据提取失败: ' + e.message); }
    },

    _extractMysellerData: function() {
      // 1. 核心指标卡片（支付金额、访客数、订单数等）
      var items = document.querySelectorAll('.IndexGroup_OpSycmqnIndexGroupItem__hMszD');
      if (items.length > 0) {
        for (var i = 0; i < Math.min(items.length, 8); i++) {
          var text = items[i].textContent || '';
          var num = this._parseNumber(text);
          if (i === 0) this._updateStat('daly-qn-deal', '¥' + num);
          else if (i === 1) this._updateStat('daly-qn-visitors', num);
          else if (i === 2) this._updateStat('daly-qn-orders', num);
          else if (i === 3) this._updateStat('daly-qn-conversion', num);
          else if (i === 4) this._updateStat('daly-qn-pv', num);
          else if (i === 5) this._updateStat('daly-qn-cart', num);
          else if (i === 6) this._updateStat('daly-qn-atv', num);
          else if (i === 7) this._updateStat('daly-qn-buyers', num);
        }
      }

      // 2. 待发货
      var pending = document.querySelector('.TodoListRow_MerchantName__cOSm3k');
      if (pending) {
        var pNum = this._parseNumber(pending.textContent);
        this._updateStat('daly-qn-pending', pNum || '0');
      }

      // 3. 待处理工单
      var ticket = document.querySelector('.Tasks_tasks_showMoreVGFD__');
      if (ticket) {
        var tText = ticket.textContent.trim();
        var tNum = /\d+/.test(tText) ? this._parseNumber(tText) : '0';
        this._updateStat('daly-qn-ticket', tNum);
      }
    },

    _parseNumber: function(text) {
      if (!text) return '--';
      var m = text.match(/[\d,.]+/);
      return m ? m[0] : '--';
    },

    _updateStat: function(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    },

    startDataPolling: function() {
      var self = this;
      // 首次延迟1秒提取（等待DOM渲染）
      setTimeout(function() { self.extractData(); }, 1000);
      // 每5秒刷新数据
      setInterval(function() { self.extractData(); }, 5000);
    }
  };

  global.DALY_Qianniu = DALY_Qianniu;
})(window);
