// DALY工具箱 - 平台检测模块（严格按域名匹配）
(function(global) {
  'use strict';

  var PLATFORMS = {
    pdd: { label: '拼多多', type: 'product' },
    taobao: { label: '淘宝', type: 'product' },
    jd: { label: '京东', type: 'product' },
    '1688': { label: '1688', type: 'product' },
    'douyin-shop': { label: '抖音电商', type: 'product' },
    'douyin-video': { label: '抖音视频', type: 'video' },
    xiaohongshu: { label: '小红书', type: 'note' },
    kuaishou: { label: '快手', type: 'video' },
    'pdd_mms': { label: '拼多多商家', type: 'shop' },
    'qianniu': { label: '千牛商家', type: 'shop' },
    'douyin-store': { label: '抖店商家', type: 'shop' }
  };

  function _detectFromUrl(url) {
    var u = url || window.location.href;

    // 商家后台
    if (/mms\.pinduoduo\.com/.test(u)) return 'pdd_mms';
    if (/\.qianniu\.com|qn\.taobao\.com/.test(u)) return 'qianniu';
    if (/fxg\.jinritemai\.com/.test(u)) return 'douyin-store';

    // 商品页
    if (/mobile\.yangkeduo\.com/.test(u)) return 'pdd';
    if (/chaoshi\.detail\.tmall\.com|detail\.tmall\.com|\.detail\.tmall\.com|item\.taobao\.com|detail\.tmall\.hk/.test(u)) return 'taobao';
    if (/item\.jd\.com/.test(u)) return 'jd';
    if (/detail\.1688\.com/.test(u)) return '1688';
    if (/haohuo\.jinritemai\.com/.test(u)) return 'douyin-shop';

    // 图文视频类
    if (/douyin\.com/.test(u)) return 'douyin-video';
    if (/kuaishou\.com/.test(u)) return 'kuaishou';
    if (/xiaohongshu\.com/.test(u)) return 'xiaohongshu';

    return '';
  }

  var DALY_PlatformDetect = {
    detect: function(url) {
      var plat = _detectFromUrl(url);
      if (plat) return plat;
      if (global.DALY_Log) DALY_Log.warn('未识别到已知平台');
      return '';
    },
    isSupported: function(url) { return !!this.detect(url); },
    isShopBackend: function(platform) {
      return !!(platform && platform !== '' &&
        (platform === 'pdd_mms' || platform === 'qianniu' || platform === 'douyin-store'));
    },
    isVideoPlatform: function(platform) {
      return platform === 'douyin-video' || platform === 'kuaishou' || platform === 'xiaohongshu';
    },
    getPlatformName: function(platform) {
      return (PLATFORMS[platform] && PLATFORMS[platform].label) || '商品页';
    },
    getPlatforms: function() { return PLATFORMS; },
    getLabel: function(plat) {
      return (PLATFORMS[plat] && PLATFORMS[plat].label) || '未知';
    },
    getType: function(plat) {
      return (PLATFORMS[plat] && PLATFORMS[plat].type) || 'product';
    }
  };

  global.DALY_PlatformDetect = DALY_PlatformDetect;
})(window);
