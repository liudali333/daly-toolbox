// DALY工具箱 - Side Panel 逻辑
(function() {
  'use strict';

  // ===== Tab 切换 =====
  var tabs = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');

  function switchTab(tabId) {
    tabs.forEach(function(t) { t.classList.toggle('active', t.dataset.tab === tabId); });
    panels.forEach(function(p) { p.classList.toggle('active', p.id === 'panel-' + tabId); });
  }

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
  });

  // ===== 子面板导航（无痕单等）=====
  document.addEventListener('click', function(e) {
    // 返回按钮
    if (e.target.classList.contains('back-btn') && e.target.dataset.goto) {
      switchTab(e.target.dataset.goto);
    }
  });

  // ===== 检测当前页面并显示信息 =====
  function detectCurrentPage() {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_INFO' }, function(response) {
      if (chrome.runtime.lastError || !response) {
        document.getElementById('pageInfo').textContent = '无法获取页面信息';
        return;
      }

      var info = response;
      var siteName = info.siteName || '未知页面';
      document.getElementById('pageInfo').textContent = '当前：' + siteName;
      document.getElementById('currentSiteName').textContent = siteName;

      // 根据平台显示数据区
      if (info.platform === 'qianniu' || info.platform === 'mms' || info.platform === 'doudian') {
        document.getElementById('currentPageInfo').style.display = 'block';
        document.getElementById('platformData').style.display = 'block';
        loadPlatformData(info.platform);
      } else if (siteName && siteName !== '未知页面') {
        document.getElementById('currentPageInfo').style.display = 'block';
        document.getElementById('platformData').style.display = 'none';
      }
    });
  }

  // ===== 加载平台数据 =====
  function loadPlatformData(platform) {
    chrome.runtime.sendMessage({ type: 'GET_PLATFORM_DATA', platform: platform }, function(response) {
      if (!response || !response.data) return;
      var d = response.data;
      setVal('sp-deal', d.deal);
      setVal('sp-visitors', d.visitors);
      setVal('sp-orders', d.orders);
      setVal('sp-conversion', d.conversion);
      setVal('sp-pending', d.pending);
      setVal('sp-ticket', d.ticket);
    });
  }

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val || '--';
  }

  // ===== 刷新数据按钮 =====
  var btnRefresh = document.getElementById('btn-refresh-data');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', function() {
      btnRefresh.textContent = '⏳ 刷新中...';
      setTimeout(function() {
        detectCurrentPage();
        btnRefresh.textContent = '🔄 刷新页面数据';
      }, 500);
    });
  }

  // ===== 快捷操作按钮 - 在新标签页打开 =====
  var quickLinks = {
    'btn-open-pdd-mms': 'https://mms.pinduoduo.com/',
    'btn-open-orders': 'https://myseller.taobao.com/home.htm/SellManage/on_sale?current=1&pageSize=100',
    'btn-open-products': 'https://myseller.taobao.com/home.htm/SellManage/on_sale?current=1&pageSize=100',
    'btn-open-datacenter': 'https://sycm.taobao.com/',
    'btn-open-cs': 'https://im.taobao.com/',
    'btn-open-marketing': 'https://myseller.taobao.com/home.htm/starb/nebula/mkt-tools/mkt-tools-home/home'
  };

  Object.keys(quickLinks).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', function() {
        window.open(quickLinks[id], '_blank');
      });
    }
  });

  // ===== 无痕单功能 =====
  var wuhenBtn = document.getElementById('sp-wuhenBtn');
  if (wuhenBtn) {
    wuhenBtn.addEventListener('click', function(e) {
      e.preventDefault();
      switchTab('wuhen');
    });
  }

  var generateBtn = document.getElementById('generateBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', function() {
      var skuId = document.getElementById('skuId').value.trim();
      var goodsId = document.getElementById('goodsId').value.trim();
      var quantity = document.getElementById('quantity').value || 1;

      if (!skuId && !goodsId) {
        alert('请输入商品SKU ID 或 商品ID');
        return;
      }

      // 生成拼多多链接
      var url = 'https://mobile.yangkeduo.com/goods.html?goods_id=' + (goodsId || skuId);
      if (skuId) url += '&sku_id=' + skuId;
      url += '&pdd_bapp_no=1000&pdd_bapp_share_channel=copy_link&share_uid=&expose_request_id=' + Date.now();

      var qrContainer = document.getElementById('qrcode');
      qrContainer.innerHTML = '';
      try {
        new QRCode(qrContainer, {
          text: url,
          width: 160,
          height: 160,
          colorDark: '#333333',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch(err) {
        console.error('QR生成失败:', err);
        qrContainer.innerHTML = '<p style="color:#999;font-size:12px;">二维码生成失败</p>';
      }
    });
  }

  // ===== AI主图设计 =====
  var aiBtn = document.getElementById('sp-aiBtn');
  if (aiBtn) {
    aiBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.open('https://chatgpt.com/', '_blank');
    });
  }

  // ===== 初始化 =====
  detectCurrentPage();

  // 每10秒自动刷新数据
  setInterval(detectCurrentPage, 10000);

})();
