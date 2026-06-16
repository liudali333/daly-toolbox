// DALY工具箱 - 跨平台共享工具函数
// 所有 extractor、media、content.js 共同使用的函数集中到这里

(function(global) {
  'use strict';

  var DALY_Utils = {

    // ========== 标题清洗 ==========
    // 移除各电商平台后缀、官方旗舰店、专卖店等字样
    cleanTitle: function(title) {
      if (!title) return '';
      return String(title)
        .replace(/\s*[—\-–]\s*(天猫|阿里巴巴|淘宝|抖音|京东|拼多多|1688|Tmall|Taobao|1688\.com)\b/gi, '')
        .replace(/\s*[—\-–]\s*官方旗舰店\b/gi, '')
        .replace(/\s*[—\-–]\s*官方旗舰\b/gi, '')
        .replace(/\s*[—\-–]\s*专卖店\b/gi, '')
        .replace(/\s*[—\-–]\s*专营店\b/gi, '')
        .trim();
    },

    // ========== URL 处理 ==========
    // 将带尺寸后缀的图片 URL 还原为原图
    toOriginalUrl: function(url) {
      if (!url || typeof url !== 'string') return '';
      if (!url.startsWith('http') && url.indexOf('//') !== 0) return '';
      return url
        .replace(/_\d+x\d+\.jpg/, '.jpg')
        .replace(/_\d+x\d+q\d+\.jpg/, '.jpg')
        .replace(/\.jpg_.*/, '.jpg')
        .replace(/\.jpeg_.*/, '.jpeg')
        .replace(/\.png_.*/, '.png')
        .replace(/\.webp_.*/, '.webp');
    },

    // ========== 括号匹配 ==========
    // 用于在 HTML/JS 源码里找到完整的 JSON 对象或数组
    findMatchingBracket: function(str, openPos) {
      var stack = ['{'];
      var i = openPos + 1;
      var inString = false;
      var escape = false;
      var length = str.length;
      while (i < length) {
        var c = str[i];
        if (escape) { escape = false; i++; continue; }
        if (c === '\\') { escape = true; i++; continue; }
        if (c === '"' || c === "'") { inString = !inString; i++; continue; }
        if (inString) { i++; continue; }
        if (c === '{' || c === '[') stack.push(c);
        if (c === '}' && stack[stack.length - 1] === '{') stack.pop();
        if (c === ']' && stack[stack.length - 1] === '[') stack.pop();
        if (stack.length === 0) return i;
        i++;
      }
      return -1;
    },

    // ========== outerHTML 缓存（性能优化）==============
    // 单次会话内只序列化一次完整 DOM，避免每次正则扫描都重跑一次 outerHTML
    _htmlCache: null,
    _htmlCacheTime: 0,
    _htmlCacheTTL: 10000, // 10 秒内复用

    getPageHtml: function() {
      var now = Date.now();
      if (this._htmlCache && (now - this._htmlCacheTime) < this._htmlCacheTTL) {
        return this._htmlCache;
      }
      try {
        this._htmlCache = document.documentElement.outerHTML;
        this._htmlCacheTime = now;
        return this._htmlCache;
      } catch (e) {
        return '';
      }
    },

    // 强制刷新缓存（例如用户切换页面时）
    refreshPageHtml: function() {
      this._htmlCache = null;
      return this.getPageHtml();
    },

    // ========== 通用 DOM 查询（带空保护）==============
    safeText: function(el) {
      return el && el.textContent ? el.textContent.trim() : '';
    },

    safeQuery: function(selector, parent) {
      try {
        var root = parent || document;
        return root.querySelector(selector);
      } catch (e) {
        return null;
      }
    },

    // ========== URL & Host ==========
    getHost: function() {
      return window.location.hostname.toLowerCase();
    },

    getUrl: function() {
      return window.location.href.toLowerCase();
    },

    // ========== 去重工具 ==========
    uniqueByUrl: function(items) {
      var seen = {};
      var result = [];
      for (var i = 0; i < items.length; i++) {
        var url = typeof items[i] === 'string' ? items[i] : (items[i].url || '');
        if (!seen[url]) {
          seen[url] = true;
          result.push(items[i]);
        }
      }
      return result;
    },

    // ========== 文件扩展名检测 ==========
    guessImageExt: function(url) {
      if (!url) return 'jpg';
      if (url.indexOf('.png') > -1) return 'png';
      if (url.indexOf('.webp') > -1) return 'webp';
      if (url.indexOf('.jpeg') > -1) return 'jpeg';
      return 'jpg';
    }
  };

  global.DALY_Utils = DALY_Utils;
})(window);
