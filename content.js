// DALY工具箱 - 内容脚本入口

(function() {
  'use strict';

  // 1. 自媒体平台下载面板（抖音/小红书/快手）
  if (window.DALY_SelfMediaPanel) {
    // 由各平台 suspension 文件自行调用 DALY_SelfMediaPanel.open()
  }

  // 2. 电商平台媒体下载面板（拼多多/淘宝/京东/1688/抖音小店）
  if (window.DALY_MediaPanel) {
    // 由各平台 suspension 文件自行调用 DALY_MediaPanel.open()
  }

  // 3. 商家后台工具栏
  if (window.DALY_Qianniu) DALY_Qianniu.init();
  if (window.DALY_Doudian) DALY_Doudian.init();

  if (window.DALY_Log) DALY_Log.info('DALY 工具箱 content script 已加载');
  else console.log('[DALY] content script 已加载（DALY_Log 不可用）');

  // 4. 响应 Side Panel 数据请求
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request && request.type === 'DALY_GET_DATA') {
      var data = {};
      // 从工具栏 DOM 获取数据（如果已渲染）
      try {
        data.deal = _getText('daly-qn-deal');
        data.visitors = _getText('daly-qn-visitors');
        data.orders = _getText('daly-qn-orders');
        data.conversion = _getText('daly-qn-conversion');
        data.pending = _getText('daly-qn-pending');
        data.ticket = _getText('daly-qn-ticket');
        // MMS 数据
        data.mmsDeal = _getText('daly-mms-deal');
        data.mmsCost = _getText('daly-mms-cost');
        data.mmsRoi = _getText('daly-mms-roi');
        data.mmsPending = _getText('daly-mms-pending');
        // 抖店数据
        data.ddOrders = _getText('daly-dd-orders');
        data.ddRefund = _getText('daly-dd-refund');
        data.ddMoney = _getText('daly-dd-money');
      } catch(e) { /* ignore */ }
      sendResponse(data);
    }
    return true;
  });

  function _getText(id) {
    var el = document.getElementById(id);
    return el ? el.textContent.trim() : null;
  }
})();
