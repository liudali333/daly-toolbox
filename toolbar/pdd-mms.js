// DALY工具箱 - 拼多多商家后台悬浮工具栏
// 后台静默抓取策略：
//   1) 在所有 MMS 页面注入隐藏 iframe 指向首页
//   2) iframe 加载完成后从 DOM 读取数据, postMessage 给父页面
//   3) 父页面收到数据存入 chrome.storage.local (跨页缓存)
//   4) 所有页面从 storage.local 读取缓存渲染, 兼顾当页 DOM 抓取作为兜底
(function(global) {
  'use strict';

  var STATS_KEY = 'daly_mms_stats';
  var HOME_URL = 'https://mms.pinduoduo.com/home';
  var FETCH_INTERVAL = 30000; // 30 秒刷新一次
  var _iframe = null;
  var _fetchTimer = null;

  // ====== DOM 抓取逻辑 (与之前相同, 用于 iframe 内使用) ======

  function readCard(card, labelSelectorCandidates, valueSelectorCandidates) {
    var label = '', value = '';
    var i;
    for (i = 0; i < labelSelectorCandidates.length; i++) {
      var lEl = card.querySelector(labelSelectorCandidates[i]);
      if (lEl) { label = (lEl.innerText || lEl.textContent || '').trim(); if (label) break; }
    }
    if (!label) {
      var w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null); var n;
      while ((n = w.nextNode())) { var t = (n.nodeValue || '').trim(); if (t) { label = t; break; } }
    }
    for (i = 0; i < valueSelectorCandidates.length; i++) {
      var vEl = card.querySelector(valueSelectorCandidates[i]);
      if (vEl) { value = (vEl.innerText || vEl.textContent || '').trim(); if (value) break; }
    }
    if (!value) {
      var txt = (card.innerText || '').trim();
      var m = txt.match(/-?\d+(?:\.\d+)?/); if (m) value = m[0];
    }
    return { label: label, value: value };
  }

  // 在指定 document (可能是 iframe 的) 上抓取数据
  function scrapeStatsFromDoc(doc) {
    var result = { amount: '--', spend: '--', pendingShip: '--', pendingWorkOrder: '--', ratio: '--', _from: 'scrape' };

    try {
      var manageCards = doc.querySelectorAll('.manage-data-chart__panel__card');
      for (var i = 0; i < manageCards.length; i++) {
        var info = readCard(manageCards[i], ['.manage-data-chart__panel__card_has-tips', 'span'], ['.manage-data-chart__panel__card__content_val']);
        if (!info.label) continue;
        if (info.label.indexOf('成交金额') !== -1) result.amount = info.value;
        else if (info.label.indexOf('推广花费') !== -1) result.spend = info.value;
      }
    } catch (e) {}

    try {
      var topCards = doc.querySelectorAll('.top-data-panel__card');
      for (var j = 0; j < topCards.length; j++) {
        var tInfo = readCard(topCards[j], ['.top-data-panel__card__title-dotted', '.top-data-panel__card__title'], ['.top-data-panel__card__value']);
        if (!tInfo.label) continue;
        if (tInfo.label.indexOf('待发货') !== -1) result.pendingShip = tInfo.value;
        else if (tInfo.label.indexOf('待处理工单') !== -1) result.pendingWorkOrder = tInfo.value;
      }
    } catch (e) {}

    // 投产比
    try {
      var a = parseFloat(result.amount), s = parseFloat(result.spend);
      if (!isNaN(a) && !isNaN(s)) {
        if (s > 0) result.ratio = (a / s).toFixed(2);
        else if (a > 0) result.ratio = '∞';
        else result.ratio = '0.00';
      }
    } catch (e) {}

    return result;
  }

  // ====== 缓存读写 ======

  function saveToStorage(stats) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ STATS_KEY: stats }, function() {});
      }
    } catch (e) {}
  }

  function loadFromStorage(callback) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(STATS_KEY, function(data) {
          callback(data[STATS_KEY] || null);
        });
        return;
      }
    } catch (e) {}
    callback(null);
  }

  // ====== 渲染 ======

  function formatNum(v, decimals) {
    if (v === null || v === undefined || v === '' || v === '--') return '--';
    var n = parseFloat(v);
    if (isNaN(n)) return '--';
    if (v === '∞') return '∞';
    return n.toFixed(decimals === undefined ? 2 : decimals);
  }

  function renderStats(stats) {
    if (!stats) return;
    var amountEl = document.getElementById('daly-mms-amount');
    var spendEl = document.getElementById('daly-mms-spend');
    var ratioEl = document.getElementById('daly-mms-ratio');
    var pendingEl = document.getElementById('daly-mms-pending');
    var workorderEl = document.getElementById('daly-mms-workorder');
    if (amountEl) amountEl.textContent = '¥' + formatNum(stats.amount, 2);
    if (spendEl) spendEl.textContent = '¥' + formatNum(stats.spend, 2);
    if (ratioEl) ratioEl.textContent = formatNum(stats.ratio, 2);
    if (pendingEl) pendingEl.textContent = formatNum(stats.pendingShip, 0);
    if (workorderEl) workorderEl.textContent = formatNum(stats.pendingWorkOrder, 0);
  }

  // ====== 隐藏 iframe 静默抓取 ======

  // 父页面: 创建隐藏 iframe 指向首页, 等待其加载完成后读取数据
  function startIframeFetch() {
    if (_iframe) return;
    _iframe = document.createElement('iframe');
    _iframe.id = 'daly-mms-fetch-frame';
    _iframe.src = HOME_URL;
    _iframe.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;border:0;top:-9999px;left:-9999px;';
    _iframe.onload = function() {
      try {
        var doc = _iframe.contentDocument || (_iframe.contentWindow && _iframe.contentWindow.document);
        if (doc) {
          var stats = scrapeStatsFromDoc(doc);
          saveToStorage(stats);
          renderStats(stats);
        }
      } catch (e) {}
    };
    _iframe.onerror = function() {};
    document.body.appendChild(_iframe);
  }

  // 监听来自 iframe 内脚本的 postMessage
  function setupMessageListener() {
    window.addEventListener('message', function(e) {
      // 只接受来自同域 (mms.pinduoduo.com) 的消息
      try {
        if (!e.origin || e.origin.indexOf('pinduoduo.com') === -1) return;
      } catch (err) { return; }
      if (e.data && e.data.type === 'DALY_MMS_STATS') {
        saveToStorage(e.data.stats);
        renderStats(e.data.stats);
      }
    });
  }

  // 监听 background script 发来的刷新消息
  function setupBackgroundMessageListener() {
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'DALY_MMS_REFRESH') {
        if (_iframe && _iframe.contentWindow) {
          // 通知 iframe 内的脚本重新抓取
          try { _iframe.contentWindow.postMessage({ type: 'DALY_MMS_FETCH_NOW' }, '*'); } catch (err) {}
        }
      }
    });
  }

  // 监听 chrome.runtime 消息 (background script -> content script)
  function setupChromeRuntimeListener() {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
      if (msg && msg.type === 'DALY_MMS_REFRESH') {
        // 重新让 iframe 发起抓取
        if (_iframe && _iframe.contentWindow) {
          try { _iframe.contentWindow.postMessage({ type: 'DALY_MMS_FETCH_NOW' }, '*'); } catch (err) {}
        } else {
          // iframe 还没创建, 先加载
          startIframeFetch();
        }
        sendResponse({ ok: true });
      }
      if (msg && msg.type === 'DALY_MMS_GET_STATS') {
        loadFromStorage(function(stats) { sendResponse({ stats: stats }); });
        return true; // 异步响应
      }
    });
  }

  // ====== 申诉文案 & 工具 ======

  var APPEAL_TEXT = '本店高度重视，但经核实，该买家全程无任何沟通记录，评价内容无任何具体问题描述。\n特此申诉，恳请平台基于"无事实依据"与"未沟通即差评"的异常情况，审核处理此评价。';

  function showTip(text) {
    var tip = document.createElement('div');
    tip.className = 'daly-tip';
    tip.textContent = text;
    document.body.appendChild(tip);
    setTimeout(function() { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 2500);
  }

  function copyAppealText() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(APPEAL_TEXT).then(function() {
          showTip('默认申诉文案已复制，可直接粘贴申诉！');
        }).catch(function() { showTip('复制失败，请手动复制'); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = APPEAL_TEXT;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try {
          var ok = document.execCommand('copy');
          showTip(ok ? '默认申诉文案已复制，可直接粘贴申诉！' : '复制失败，请手动复制');
        } catch (ex) { showTip('复制失败，请手动复制'); }
        if (ta.parentNode) ta.parentNode.removeChild(ta);
      }
    } catch (err) { showTip('复制失败，请手动复制'); }
  }

  // ====== 主模块 ======

  var DALY_MMS = {
    observer: null,
    checkInterval: null,

    init: function() {
      var url = window.location.href.toLowerCase();
      var host = window.location.hostname.toLowerCase();
      console.log('[DALY MMS] init triggered URL:', url, 'Host:', host);
      console.log('[DALY MMS] URL match result:', /mms.*pinduoduo/.test(url), /yangkeduo.*mms/.test(url), host.indexOf('mms') !== -1);
      if (!(/mms.*pinduoduo/.test(url) || /yangkeduo.*mms/.test(url) || host.indexOf('mms') !== -1)) {
        console.log('[DALY MMS] URL not matched, skip init');
        return;
      }
      console.log('[DALY MMS] matched! Starting toolbar init');
      this.createToolbar();
      this.bindToolbarEvents();
      this.startObserver();

      // 设置消息监听
      setupMessageListener();
      setupBackgroundMessageListener();
      setupChromeRuntimeListener();

      // 启动 iframe 静默抓取
      startIframeFetch();

      // 从 storage 读取缓存立即渲染 (跨页)
      var self = this;
      loadFromStorage(function(stats) {
        if (stats) renderStats(stats);
      });

      // 每 8 秒用缓存渲染一次 (确保快速响应, 即使 iframe 还在加载)
      setInterval(function() {
        if (document.getElementById('daly-mms-toolbar')) {
          loadFromStorage(function(stats) {
            if (stats) renderStats(stats);
          });
        }
      }, 8000);

      // 延迟再试一次 (iframe 可能还没加载完)
      setTimeout(function() {
        if (_iframe && _iframe.contentDocument) {
          try {
            var stats = scrapeStatsFromDoc(_iframe.contentDocument);
            saveToStorage(stats);
            renderStats(stats);
          } catch (e) {}
        }
      }, 3000);
    },

    createToolbar: function() {
      if (document.getElementById('daly-mms-toolbar')) {
        console.log('[DALY MMS] Toolbar already exists');
        return;
      }
      var toolbar = document.createElement('div');
      toolbar.id = 'daly-mms-toolbar';
      toolbar.className = 'daly-mms-toolbar';
      toolbar.innerHTML = [
        '<div class="daly-mms-row daly-mms-stats-row">',
          '<span class="daly-mms-logo">🛠 DALY工具箱</span>',
          '<div class="daly-mms-stat">',
            '<span class="daly-mms-stat-label">成交金额</span>',
            '<span class="daly-mms-stat-value" id="daly-mms-amount">--</span>',
          '</div>',
          '<div class="daly-mms-stat">',
            '<span class="daly-mms-stat-label">推广花费</span>',
            '<span class="daly-mms-stat-value" id="daly-mms-spend">--</span>',
          '</div>',
          '<div class="daly-mms-stat">',
            '<span class="daly-mms-stat-label">投产比</span>',
            '<span class="daly-mms-stat-value" id="daly-mms-ratio">--</span>',
          '</div>',
          '<div class="daly-mms-stat">',
            '<span class="daly-mms-stat-label">待发货</span>',
            '<span class="daly-mms-stat-value" id="daly-mms-pending">--</span>',
          '</div>',
          '<div class="daly-mms-stat">',
            '<span class="daly-mms-stat-label">待处理工单</span>',
            '<span class="daly-mms-stat-value" id="daly-mms-workorder">--</span>',
          '</div>',
        '</div>',
        '<div class="daly-mms-row daly-mms-btns-row">',
          '<a class="daly-mms-btn" data-action="chat">客服会话</a>',
          '<a class="daly-mms-btn" data-action="complaint">差评申诉</a>',
          '<a class="daly-mms-btn" data-action="video">多多视频</a>',
          '<a class="daly-mms-btn" data-action="promo">大促作战室</a>',
          '<a class="daly-mms-btn" data-action="analysis">用户端</a>',
        '</div>'
      ].join('');
      document.body.appendChild(toolbar);
      console.log('[DALY MMS] Toolbar appended to page');
    },

    startObserver: function() {
      var self = this;
      if (this.observer) return;
      try {
        this.observer = new MutationObserver(function() {
          if (!document.getElementById('daly-mms-toolbar')) self.createToolbar();
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) {}
      this.checkInterval = setInterval(function() {
        if (!document.getElementById('daly-mms-toolbar')) self.createToolbar();
      }, 2000);
    },

    bindToolbarEvents: function() {
      document.body.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target !== document.body) {
          if (target.classList && target.classList.contains('daly-mms-btn')) {
            var action = target.getAttribute('data-action');
            var urls = {
              chat: 'https://mms.pinduoduo.com/chat-merchant/#/',
              complaint: 'https://mms.pinduoduo.com/goods/evaluation/index',
              video: 'https://live.pinduoduo.com/n-creator/video/anchor-goods-video?from=mms',
              promo: 'https://mms.pinduoduo.com/act/enroll/promotionEnroll?theme_activity_id=10128&SourceType=PROMO-Theme&SceneType=Theme',
              analysis: 'https://mobile.yangkeduo.com/'
            };
            if (action === 'complaint') {
              copyAppealText();
              window.open(urls[action], '_blank');
              return;
            }
            if (urls[action]) window.open(urls[action], '_blank');
            return;
          }
          target = target.parentElement;
        }
      });
    }
  };

  global.DALY_MMS = DALY_MMS;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { DALY_MMS.init(); });
  } else {
    DALY_MMS.init();
  }
})(window);
