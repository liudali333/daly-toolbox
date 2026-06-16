// DALY工具箱 Background Service Worker
// 主动向商家后台页面注入 content script（解决 Chrome content_scripts 自动注入失效问题）

const TARGET_DOMAINS = [
  'pinduoduo.com',
  'yangkeduo.com',
  'taobao.com',
  'tmall.com',
  'jd.com',
  '1688.com',
  'jinritemai.com',
  'douyin.com',
  'haohuo.jinritemai.com'
];

// ===== MMS 后台数据静默刷新闹钟 =====
const MMS_ALARM_NAME = 'daly_mms_stats_refresh';
var _mmsAlarmRegistered = false;

function registerMmsAlarm() {
  if (_mmsAlarmRegistered) return;
  _mmsAlarmRegistered = true;

  // 检查是否已存在, 避免重复
  try {
    chrome.alarms.get(MMS_ALARM_NAME, function(existing) {
      if (!existing) {
        chrome.alarms.create(MMS_ALARM_NAME, {
          delayInMinutes: 0.5,  // 首次 30 秒后触发
          periodInMinutes: 0.5  // 之后每 30 秒触发
        });
      }
    });
  } catch (e) {
    // chrome.alarms 在 Manifest V3 service worker 可能不可用, 静默忽略
  }
}

function onMmsAlarm() {
  // 向所有 MMS 相关 tab 发送刷新指令
  chrome.tabs && chrome.tabs.query({}, function(tabs) {
    if (!tabs) return;
    tabs.forEach(function(tab) {
      if (!tab.url) return;
      var isMms = TARGET_DOMAINS.some(function(d) { return tab.url.indexOf(d) !== -1; }) &&
                  (tab.url.indexOf('mms') !== -1 || tab.url.indexOf('pinduoduo') !== -1);
      if (isMms) {
        chrome.tabs.sendMessage(tab.id, { type: 'DALY_MMS_REFRESH' }, function() {
          // 静默忽略错误 (tab 可能未加载 content script)
        });
      }
    });
  });
}

function shouldInject(url) {
  if (!url) return false;
  return TARGET_DOMAINS.some(function(domain) {
    return url.indexOf(domain) !== -1;
  });
}

function injectContentScript(tabId) {
  console.log('[DALY BG] 开始注入 tab', tabId);

  // ★ bridge.js 必须在 ISOLATED world 注入（它需要 chrome.runtime API）
  chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: false },
    files: ['content/bridge.js']
  }).then(function() {
    console.log('[DALY BG] 桥梁脚本注入成功 tab', tabId);
  }).catch(function(err) {
    console.log('[DALY BG] 桥梁脚本注入失败 tab', tabId, err.message || String(err));
  });

  // 分两批注入：基础库 → 主要业务，避免单次文件过多导致超时
  var baseFiles = [
    'content/config.js', 'content/logger.js', 'platforms/utils.js', 'platforms/detect.js'
  ];
  var mainFiles = [
    'suspension/douyin-video.js', 'suspension/xiaohongshu.js', 'suspension/kuaishou.js',
    'content/ui/self-media-panel.js', 'content/ui/media-panel.js',
    'media/douyin.js', 'media/pdd.js', 'media/tmall.js', 'media/jd.js', 'media/1688.js',
    'suspension/pdd.js', 'suspension/taobao.js', 'suspension/jd.js', 'suspension/1688.js',
    'suspension/douyin-shop.js', 'review-fetcher.js', 'content/ui/review-panel.js', 'content.js'
  ];

  chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: false },
    files: baseFiles,
    world: 'MAIN_WORLD'
  }).then(function() {
    console.log('[DALY BG] 基础库注入成功 tab', tabId);
    // 基础库完成后立即注入主业务
    return chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: false },
      files: mainFiles,
      world: 'MAIN_WORLD'
    });
  }).then(function() {
    console.log('[DALY BG] ✅ 全部注入成功 tab', tabId);
    chrome.storage.local.set({ daly_inject_done: { tabId: tabId, time: Date.now() } });
  }).catch(function(err) {
    console.log('[DALY BG] ❌ 注入失败 tab', tabId, err.message || String(err));
    chrome.storage.local.set({ daly_inject_error: { tabId: tabId, time: Date.now(), err: err.message || String(err) } });
  });

  chrome.scripting.insertCSS({
    target: { tabId: tabId, allFrames: false },
    files: ['content.css']
  }).then(function() {
    console.log('[DALY BG] CSS 注入成功 tab', tabId);
  }).catch(function(err) {
    console.log('[DALY BG] CSS 注入失败 tab', tabId, err.message || String(err));
  });
}

// 页面加载完成时注入
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;
  if (!shouldInject(tab.url)) return;
  console.log('[DALY BG] 尝试注入 tab', tabId, tab.url.substring(0, 80));
  injectContentScript(tabId);
});

// MMS 数据刷新闹钟监听
try {
  chrome.alarms && chrome.alarms.onAlarm && chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm && alarm.name === MMS_ALARM_NAME) {
      onMmsAlarm();
    }
  });
} catch (e) {}

// 注册 MMS 闹钟 (如果有权限)
try {
  registerMmsAlarm();
} catch (e) {}

// 扩展安装时提示
chrome.runtime.onInstalled.addListener(function() {
  console.log('[DALY BG] 扩展已安装');
});

// ★ Service Worker 启动时，主动扫描已打开的抖音/快手等标签页并注入
function injectExistingTabs() {
  chrome.tabs.query({}, function(tabs) {
    if (!tabs) return;
    tabs.forEach(function(tab) {
      if (!tab.url) return;
      if (shouldInject(tab.url)) {
        console.log('[DALY BG] 扫描到已打开的标签页注入 tab', tab.id, tab.url.substring(0, 80));
        injectContentScript(tab.id);
      }
    });
  });
}
try {
  injectExistingTabs();
} catch(e) {
  console.log('[DALY BG] 扫描已有标签失败', e.message);
}

// 浏览器启动时也注入（MV3 service worker 不保证 onStartup 一定触发）
chrome.runtime.onStartup.addListener(function() {
  injectExistingTabs();
});

// ===== 抖音视频 webRequest 拦截（★ 核心方案）=====
// 在 background 层拦截抖音视频相关请求，提取视频 URL
// content script 的 XHR/Fetch 拦截无法捕获跨域 CDN 请求，必须在此层处理
var _daly_douyin_video_map = {}; // tabId -> [{url, type}]

// ★ 抖音视频 URL 持久化存储
function _saveVideoToStorage(tabId, url) {
  try {
    chrome.storage.local.get('daly_douyin_videos', function(data) {
      var map = data.daly_douyin_videos || {};
      if (!map[tabId]) map[tabId] = [];
      var exists = map[tabId].some(function(v) { return v.url === url; });
      if (!exists) {
        map[tabId].push({ url: url, time: Date.now() });
        chrome.storage.local.set({ daly_douyin_videos: map });
      }
    });
  } catch(e) {}
}

if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
  // 拦截所有 douyinvod.com 请求（调试用，打印实际 URL）
  chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      var url = details.url || '';
      var tabId = details.tabId;
      if (tabId < 0) return;

      // ★ 调试：打印所有 douyinvod.com 请求（无论什么文件类型）
      if (/douyinvod\.com/i.test(url)) {
        console.log('[DALY BG] 🌐 douyinvod 请求:', url.substring(0, 200));
      }

      // 检测视频 CDN 请求（修复正则：\.mp4 匹配点号，m3u8 正确识别）
      // douyinvod URL 格式多样：
      // - https://...douyinvod.com/uuid.mp4
      // - https://...douyinvod.com/playlist.m3u8
      // - https://...douyinvod.com/v1-.../xxx/playlist.m3u8
      // - https://...douyinvod.com/v1-gd.toutiao.../segment.mp4
      // ★ 只采集完整视频 URL（抖音新版 URL 格式：douyinvod.com/.../?a=6383&...，没有 .mp4 扩展名）
      // ★ 过滤掉 segment 碎片和 playlist.m3u8（MSE 分片流）
      var isVideoUrl = /douyinvod\.com/.test(url) || /bytevcloud\.com/.test(url) || /ibytedtos\.com/.test(url);
      var isSegment = /\/segment\d+\.mp4/i.test(url) || /\/playlist\.m3u8/i.test(url);
      var isJsCss = /\.(?:js|css|png|jpg|jpeg|gif|svg|woff2?|ico)(\?|$)/i.test(url);
      if (isVideoUrl && !isSegment && !isJsCss) {
        if (!_daly_douyin_video_map[tabId]) {
          _daly_douyin_video_map[tabId] = [];
        }
        // ★ 限制每个 tab 最多 4 个 URL（避免推荐页预加载大量无关视频）
        var exists = _daly_douyin_video_map[tabId].some(function(v) { return v.url === url; });
        if (!exists && _daly_douyin_video_map[tabId].length < 4) {
          _daly_douyin_video_map[tabId].push({ url: url, time: Date.now(), type: 'mp4' });
          console.log('[DALY BG] 🎬 拦截到抖音视频 tab', tabId, 'mp4', url.substring(0, 150));
          _notifyDouyinVideoFound(tabId, url);
          _saveVideoToStorage(tabId, url);
        }
      }
    },
    { urls: ['*://*.douyinvod.com/*', '*://*.bytevcloud.com/*', '*://*.ibytedtos.com/*', '*://*.bytecdn.cn/*'] },
    []
  );

  console.log('[DALY BG] ✅ 抖音视频 webRequest 拦截已启动');
} else {
  console.log('[DALY BG] ❌ webRequest API 不可用');
}

// 通知 content script 发现了视频 URL
function _notifyDouyinVideoFound(tabId, videoUrl) {
  try {
    chrome.tabs.sendMessage(tabId, {
      type: 'DALY_DOUYIN_VIDEO_FOUND',
      url: videoUrl
    }, function() {
      if (chrome.runtime.lastError) {
        // tab 可能没有 content script，静默忽略
      }
    });
  } catch(e) {}
}

// content script 查询已拦截的视频 URL
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // ★ 新增：查询抖音视频拦截缓存
  if (request && request.type === 'DALY_GET_DOUYIN_VIDEOS') {
    var tabId = sender.tab ? sender.tab.id : -1;
    var videos = _daly_douyin_video_map[tabId] || [];
    // 过滤掉 5 分钟前的旧记录
    var now = Date.now();
    var recent = videos.filter(function(v) { return now - v.time < 300000; });
    // ★ 只返回最近 1 个 mp4 URL（当前播放的视频）
    // ★ 过滤掉 segment 碎片
    var filtered = recent.filter(function(v) {
      return v.type === 'mp4' && !/\/segment\d+\.mp4/i.test(v.url);
    });
    _daly_douyin_video_map[tabId] = filtered;
    // 只返回最新的 2 个 URL
    var result = filtered.slice(-2).map(function(v) { return v.url; });
    sendResponse({ videos: result });
    return;
  }

  // ★ 抖音路由切换时清空旧缓存
  if (request && request.type === 'DALY_CLEAR_DOUYIN_VIDEOS') {
    var clearTabId = sender.tab ? sender.tab.id : -1;
    if (clearTabId >= 0) {
      _daly_douyin_video_map[clearTabId] = []; // 清空该 tab 的缓存
      console.log('[DALY BG] 清空抖音视频缓存 tab', clearTabId);
    }
    sendResponse({ cleared: true });
    return;
  }
});

// ===== 下载消息处理（content script → background） =====
// 使用 fetch + blob → data URL 绕过防盗链
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request && request.type === 'DALY_DOWNLOAD') {
    var url = request.url;
    var filename = request.filename || 'download.mp4';
    if (!url) { sendResponse({ success: false, error: '缺少 URL' }); return; }

    console.log('[DALY BG] 收到下载请求:', filename, 'URL:', url.substring(0, 100));

    // 确保文件名有正确扩展名 - 根据 URL 类型判断
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
      // 视频文件
      if (filename.indexOf('.') === -1 || /\.txt$/.test(filename)) {
        filename = filename.replace(/\.txt$/, '') + '.mp4';
      } else if (!/\.(mp4|webm|ogg|mov)$/i.test(filename)) {
        filename = filename.replace(/\.[^.]+$/, '') + '.mp4';
      }
    } else if (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url)) {
      // 图片文件
      if (filename.indexOf('.') === -1 || /\.txt$/.test(filename)) {
        var extMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
        filename = filename.replace(/\.txt$/, '') + '.' + (extMatch[1] || 'jpg');
      } else if (!/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename)) {
        filename = filename.replace(/\.[^.]+$/, '') + '.jpg';
      }
    } else {
      // 默认：尝试从 URL 推断，否则用 .mp4
      var urlExtMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      if (urlExtMatch) {
        var ext = urlExtMatch[1].toLowerCase();
        if (filename.indexOf('.') === -1 || /\.txt$/.test(filename)) {
          filename = filename.replace(/\.txt$/, '') + '.' + ext;
        } else if (!new RegExp('\\.' + ext + '$', 'i').test(filename)) {
          filename = filename.replace(/\.[^.]+$/, '') + '.' + ext;
        }
      } else if (filename.indexOf('.') === -1 || /\.txt$/.test(filename)) {
        // URL 没有扩展名，默认用 .mp4（视频下载场景）
        filename = filename.replace(/\.txt$/, '') + '.mp4';
      }
    }

    // 清理文件名中的非法字符
    filename = filename.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200);

    // 方案1：fetch → blob → FileReader → data URL → download
    fetch(url, {
      headers: { 'Referer': '' },
      mode: 'cors'
    })
      .then(function(response) {
        console.log('[DALY BG] fetch 状态:', response.status, response.type);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.blob();
      })
      .then(function(blob) {
        console.log('[DALY BG] blob 大小:', blob.size, 'type:', blob.type);
        var reader = new FileReader();
        reader.onloadend = function() {
          var dataUrl = reader.result;
          chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false
          }, function(downloadId) {
            if (chrome.runtime.lastError) {
              console.error('[DALY BG] ❌ 下载失败:', chrome.runtime.lastError.message);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('[DALY BG] ✅ 下载成功 ID:', downloadId, filename);
              sendResponse({ success: true, downloadId: downloadId });
            }
          });
        };
        reader.readAsDataURL(blob);
      })
      .catch(function(err) {
        console.error('[DALY BG] fetch 失败:', err.message, '尝试直接下载...');
        // 方案2：直接传原始 URL 下载
        chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: false
        }, function(downloadId) {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: err.message });
          } else {
            console.log('[DALY BG] ✅ 直接下载成功 ID:', downloadId, filename);
            sendResponse({ success: true, downloadId: downloadId });
          }
        });
      });

    return true; }

  // ===== Side Panel 消息处理 =====
  if (request && request.type === 'GET_CURRENT_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.url) {
        sendResponse({ siteName: '未知页面', platform: null });
        return;
      }
      var url = tab.url.toLowerCase();
      var info = { siteName: '未知页面', platform: null };

      // 平台识别
      if (url.indexOf('myseller.taobao.com') !== -1 || url.indexOf('qianniu') !== -1 || url.indexOf('qn.taobao.com') !== -1) {
        info.siteName = '千牛卖家中心';
        info.platform = 'qianniu';
      } else if (url.indexOf('mms.pinduoduo.com') !== -1) {
        info.siteName = '拼多多MMS后台';
        info.platform = 'mms';
      } else if (url.indexOf('fxg.jinritemai.com') !== -1) {
        info.siteName = '抖店后台';
        info.platform = 'doudian';
      } else if (url.indexOf('item.taobao.com') !== -1 || url.indexOf('detail.tmall.com') !== -1) {
        info.siteName = '淘宝/天猫商品页';
      } else if (url.indexOf('item.jd.com') !== -1) {
        info.siteName = '京东商品页';
      } else if (url.indexOf('detail.1688.com') !== -1) {
        info.siteName = '1688商品页';
      } else if (url.indexOf('douyin.com') !== -1) {
        info.siteName = '抖音';
      } else if (url.indexOf('xiaohongshu.com') !== -1) {
        info.siteName = '小红书';
      } else if (url.indexOf('kuaishou.com') !== -1) {
        info.siteName = '快手';
      } else {
        try {
          var u = new URL(tab.url);
          info.siteName = u.hostname;
        } catch(e) {
          info.siteName = '当前页面';
        }
      }

      sendResponse(info);
    });
    return true;
  }

  if (request && request.type === 'GET_PLATFORM_DATA') {
    var platform = request.platform;
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        sendResponse({ data: null });
        return;
      }
      // 向 content script 请求数据
      chrome.tabs.sendMessage(tab.id, { type: 'DALY_GET_DATA' }, function(response) {
        if (chrome.runtime.lastError || !response) {
          sendResponse({ data: null });
        } else {
          sendResponse({ data: response });
        }
      });
    });
    return true;
  }
});
