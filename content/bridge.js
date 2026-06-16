// DALY工具箱 - MAIN_WORLD ↔ ISOLATED world 消息桥梁
// 在 MAIN_WORLD 中，chrome.runtime.sendMessage/onMessage 不可用
// 此脚本在 ISOLATED world 运行，双向转发消息

(function() {
  'use strict';

  // ===== MAIN_WORLD → ISOLATED → background =====
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || !event.data._daly_bridge) return;

    var msg = event.data;
    
    if (msg.type === 'DALY_DOWNLOAD') {
      chrome.runtime.sendMessage({
        type: 'DALY_DOWNLOAD',
        url: msg.url,
        filename: msg.filename
      }, function(response) {
        window.postMessage({
          _daly_bridge: true,
          type: 'DALY_DOWNLOAD_RESPONSE',
          requestId: msg.requestId,
          success: response && response.success,
          downloadId: response && response.downloadId,
          error: response && response.error
        }, '*');
      });
    } else if (msg.type === 'DALY_CLEAR_DOUYIN_VIDEOS') {
      chrome.runtime.sendMessage({
        type: 'DALY_CLEAR_DOUYIN_VIDEOS'
      });
    } else if (msg.type === 'DALY_GET_DOUYIN_VIDEOS') {
      chrome.runtime.sendMessage({
        type: 'DALY_GET_DOUYIN_VIDEOS'
      }, function(response) {
        window.postMessage({
          _daly_bridge: true,
          type: 'DALY_GET_DOUYIN_VIDEOS_RESPONSE',
          requestId: msg.requestId,
          videos: response && response.videos
        }, '*');
      });
    }
  });

  // ===== background → ISOLATED → MAIN_WORLD =====
  // background 用 chrome.tabs.sendMessage 推送视频 URL
  // 但 chrome.runtime.onMessage 只在 ISOLATED world 有效
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request && request.type === 'DALY_DOUYIN_VIDEO_FOUND') {
      // 转发给 MAIN_WORLD
      window.postMessage({
        _daly_bridge: true,
        type: 'DALY_DOUYIN_VIDEO_FOUND',
        url: request.url
      }, '*');
      sendResponse({ received: true });
    }
    return true;
  });

  console.log('[DALY Bridge] 消息桥梁已启动（双向）');
})();