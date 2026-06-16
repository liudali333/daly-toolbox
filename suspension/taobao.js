// DALY工具箱 - 淘宝/天猫商品页悬浮窗
// 域名: chaoshi.detail.tmall.com/*、detail.tmall.com/*、*.detail.tmall.com/*、item.taobao.com/*、detail.tmall.hk/*

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function tryExtractFromPageData(cleanTitleFn) {
    var info = null;
    try {
      if (global.__INITIAL_STATE__) {
        var state = global.__INITIAL_STATE__;
        var data = state.item || state.detail || state.itemDetail || state.data || state;
        if (data) {
          info = { title: '', sales: '-', reviews: '-', url: window.location.href };
          if (data.title) info.title = cleanTitleFn ? cleanTitleFn(data.title) : data.title;
          if (data.soldQuantity != null) info.sales = data.soldQuantity;
          else if (data.quantity != null) info.sales = data.quantity;
          else if (data.monthSales != null) info.sales = data.monthSales;
          else if (data.totalSoldQuantity != null) info.sales = data.totalSoldQuantity;
          if (state.rateModule) {
            if (state.rateModule.totalRateCount != null) info.reviews = state.rateModule.totalRateCount + '条评价';
            else if (state.rateModule.rateCount != null) info.reviews = state.rateModule.rateCount + '条评价';
          }
          if (info.reviews === '-') {
            var rateData = state.rate || state.rateInfo || state.comment || state.review;
            if (rateData) {
              if (rateData.totalRateCount != null) info.reviews = rateData.totalRateCount + '条评价';
              else if (rateData.count != null) info.reviews = rateData.count + '条评价';
            }
          }
          if (info.title) return info;
        }
      }
      var scriptEl = document.getElementById('__NEXT_DATA__') ||
                     document.querySelector('script[data-target="INIT_STATE"], script[data-target="init_state"]');
      if (scriptEl) {
        try {
          var parsed = JSON.parse(scriptEl.textContent);
          var pd = parsed.props && parsed.props.pageProps || parsed;
          if (pd) {
            if (!info) info = { title: '', sales: '-', reviews: '-', url: window.location.href };
            if (pd.title && !info.title) info.title = cleanTitleFn ? cleanTitleFn(pd.title) : pd.title;
            if (pd.soldQuantity != null && info.sales === '-') info.sales = pd.soldQuantity;
            if (pd.totalRateCount != null && info.reviews === '-') info.reviews = pd.totalRateCount + '条评价';
          }
        } catch(e) {}
      }
    } catch (e) {}
    return info;
  }

  var DALY_TB = {
    _currentTitle: '',

    init: function() {
      try {
        this.createSuspension();
        this.loadData();
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('TB init 异常:', e.message || e);
      }
    },

    createSuspension: function() {
      if (document.getElementById('daly-tb-container')) return;

      var container = document.createElement('div');
      container.id = 'daly-tb-container';
      container.className = 'daly-suspension';
      container.setAttribute('data-platform', 'tb');

      container.innerHTML =
        '<div class="daly-suspension-header">' +
          '<h3 id="daly-toolbar-title">🛠 DALY工具箱 · 淘宝</h3>' +
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
              '<button class="daly-tool-btn" id="daly-btn-review"><span class="icon">💬</span> 评论详情</button>' +
              '<button class="daly-tool-btn" id="daly-btn-copy-title"><span class="icon">📋</span> 复制标题</button>' +
              '<button class="daly-tool-btn" id="daly-btn-copy-link"><span class="icon">🔗</span> 复制链接</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(container);

      document.getElementById('daly-btn-download').addEventListener('click', function() {
        if (global.DALY_MediaPanel) DALY_MediaPanel.open();
      });
      document.getElementById('daly-btn-review').addEventListener('click', function() {
        if (global.DALY_ReviewPanel) DALY_ReviewPanel.open();
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
          if (container) container.innerHTML = '<div class="daly-loading">当前页面未识别到商品/内容信息</div>';
          return;
        }
        var info = self.extract();
        if (info && (info.title || info.sales || info.reviews)) {
          self.render(info);
          return;
        }
        sleep(intervalMs).then(function() { attempt(n + 1); });
      })(0);
    },

    extract: function() {
      var clean = (global.DALY_Utils && DALY_Utils.cleanTitle) || function(t) { return t; };
      var info = { title: '', sales: '-', reviews: '-', url: window.location.href };

      var jsonInfo = tryExtractFromPageData(clean);
      if (jsonInfo && jsonInfo.title) {
        info.title = jsonInfo.title;
        if (jsonInfo.sales !== '-') info.sales = jsonInfo.sales;
        if (jsonInfo.reviews !== '-') info.reviews = jsonInfo.reviews;
      }

      if (!info.title) {
        var h1 = document.querySelector('h1#J_DQueryItemTitle, h1.tb-detail-hd h1, #J_Title, .tb-detail-hd h1, h1.item-title-hd, h1[class*="title"]');
        if (h1 && h1.textContent) info.title = clean(h1.textContent.trim());
      }
      if (!info.title) {
        var h1Tmall = document.querySelector('h1, .productTitle, .product-info-title, [class*="product-title"], [class*="product-name"]');
        if (h1Tmall && h1Tmall.textContent) info.title = clean(h1Tmall.textContent.trim());
      }
      if (!info.title) info.title = clean(document.title || '');

      if (info.sales === '-') {
        var html = (global.DALY_Utils && DALY_Utils.getPageHtml) ? DALY_Utils.getPageHtml() : document.documentElement.outerHTML;
        var salePatterns = [
          /已售[\s\S]{0,8}?(\d[\d,]*万+\d*)/,
          /月销[\s\S]{0,8}?(\d[\d,]*万+\d*)/,
          /已售[\s\S]{0,8}?(\d[\d,]+)/,
          /月销[\s\S]{0,8}?(\d[\d,]+)/,
          /saleCount["\s:]+\s*(\d[\d,]*)/,
          /vagueSellCount["\s:]+\s*"([^"]+)"/,
          /payCount["\s:]+\s*(\d[\d,]*)/,
          /salesCount["\s:]+\s*(\d[\d,]*)/
        ];
        for (var i = 0; i < salePatterns.length; i++) {
          var m = html.match(salePatterns[i]);
          if (m) { info.sales = m[1]; break; }
        }
      }

      if (info.sales === '-') {
        try {
          var saleEl = document.querySelector('[class*="saleCounter"], [class*="saleCount"], [class*="sellCount"], .tm-sale-counter, [class*="tm-count"]');
          if (saleEl) {
            var saleTxt = saleEl.textContent.trim();
            var saleMatch = saleTxt.match(/(\d[\d,]+(?:\+)?)/);
            if (saleMatch) info.sales = saleMatch[1];
          }
        } catch (e) {}
      }

      if (info.reviews === '-') {
        var html2 = (global.DALY_Utils && DALY_Utils.getPageHtml) ? DALY_Utils.getPageHtml() : document.documentElement.outerHTML;
        var revPatterns = [
          /(\d[\d,]*万+\d*)[\s\S]{0,5}?条评价/,
          /(\d[\d,]*万+\d*)[\s\S]{0,5}?条评论/,
          /(\d[\d,]+)[\s\S]{0,5}?条评价/,
          /(\d[\d,]+)[\s\S]{0,5}?条评论/,
          /rateCount["\s:]+\s*(\d+)/,
          /reviewCount["\s:]+\s*(\d+)/,
          /evaluationCount["\s:]+\s*(\d+)/
        ];
        for (var j = 0; j < revPatterns.length; j++) {
          var rm = html2.match(revPatterns[j]);
          if (rm) { info.reviews = rm[1] + '条评价'; break; }
        }
      }

      if (info.reviews === '-') {
        try {
          var revEl = document.querySelector('[class*="reviewCount"], [class*="commentCount"], [class*="evalCount"], [class*="rateCount"], [class*="tabDetail"], [class*="evaluation"]');
          if (revEl) {
            var revTxt = revEl.textContent.trim();
            var revMatch = revTxt.match(/(\d[\d,]+(?:\+)?)/);
            if (revMatch) info.reviews = revMatch[1] + '条评价';
          }
        } catch (e) {}
      }

      if (info.reviews === '-') {
        try {
          var allTabs = document.querySelectorAll('[class*="tabTitleItem"], [class*="TabTitle"], [class*="tabItem"], [class*="tab"]');
          for (var t = 0; t < allTabs.length; t++) {
            var tabTxt = allTabs[t].textContent.trim();
            var revMatch2 = tabTxt.match(/评价\((\d[\d,]*)\)/);
            if (revMatch2) {
              info.reviews = revMatch2[1] + '条评价';
              break;
            }
          }
        } catch (e) {}
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
        ['销量', info.sales || '-'],
        ['评论数', info.reviews || '-']
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

  global.DALY_TB = DALY_TB;
})(window);

// 自动初始化
(function() {
  var u = window.location.href;
  if (/chaoshi\.detail\.tmall\.com|detail\.tmall\.com|\.detail\.tmall\.com|item\.taobao\.com|detail\.tmall\.hk/.test(u)) {
    if (typeof DALY_TB !== 'undefined') DALY_TB.init();
  }
})();
