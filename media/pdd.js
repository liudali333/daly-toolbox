// DALY工具箱 - 媒体提取：拼多多
// 提取主图、SKU图、详情图（支持 background-image 样式）

(function(global) {
  'use strict';

  // 从 style 中提取 background-image URL
  function getBgUrl(el) {
    var style = el.getAttribute('style') || '';
    var match = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
    return match ? match[1] : '';
  }

  var MediaPdd = {
    extract: function(data, toOriginalUrl) {
      try {
        // ========== 主图 ==========
        // 移动端：div[class^="PFu"] 里的 data-uniqid div，背景图
        document.querySelectorAll('div[class^="PFu"] div[data-uniqid]').forEach(function(el) {
          var bgUrl = getBgUrl(el);
          if (bgUrl) {
            var s = toOriginalUrl(bgUrl);
            if (s && data.mainImages.indexOf(s) === -1) data.mainImages.push(s);
          }
        });
        // 兜底：img 标签
        var mainImgSelectors = [
          'img[aria-label="商品大图"]',
          'div[class^="PFu"] img',
          '[class*="thumbnail"] img',
          '[class*="thumb"] img'
        ];
        mainImgSelectors.forEach(function(sel) {
          document.querySelectorAll(sel).forEach(function(img) {
            var s = toOriginalUrl(img.src || img.getAttribute('data-src') || '');
            if (s && data.mainImages.indexOf(s) === -1) data.mainImages.push(s);
          });
        });

        // ========== 视频 ==========
        document.querySelectorAll('img.live-video-cover, video[src], video source[src]').forEach(function(el) {
          var src = el.src || el.getAttribute('src') || '';
          if (src && data.videos.indexOf(src) === -1) data.videos.push(src);
        });

        // ========== SKU 图 ==========
        // 方法1: 新版结构 - 从规格按钮 aria-label 提取规格名
        // 先收集所有规格名
        var skuLabels = [];
        document.querySelectorAll('div[role="dialog"] div[class^="i1zfKfmF"] div[role="button"][aria-label]').forEach(function(btn, idx) {
          var label = btn.getAttribute('aria-label') || '';
          if (label) skuLabels.push(label);
        });
        // 再收集所有 SKU 图
        document.querySelectorAll('div[class^="O7pEFvHX"] img').forEach(function(img, idx) {
          var s = toOriginalUrl(img.getAttribute('data-src') || img.src || '');
          if (!s || !s.startsWith('http')) return;
          var label = skuLabels[idx] || ('SKU_' + (idx + 1));
          label = label.replace(/[\\/:*?"<>|]/g, '_');
          var exists = data.skuImages.some(function(item) { return item.url === s; });
          if (!exists) data.skuImages.push({url: s, label: label});
        });
        // 方法2: 兜底 - 旧版选择器
        if (data.skuImages.length === 0) {
          var skuImgSelectors = [
            'img[aria-label="点击查看大图"]',
            'div[role="dialog"] img',
            '[class*="color"] img',
            '[class*="size"] img',
            '[class*="sku"] img'
          ];
          skuImgSelectors.forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(skuImg) {
              var s = toOriginalUrl(skuImg.src || skuImg.getAttribute('data-src') || '');
              if (!s || !s.startsWith('http')) return;
              var label = '';
              var parent = skuImg.closest ? skuImg.closest('[class*="color"], [class*="size"], [class*="sku"], [class*="spec"], div[role="dialog"]') : null;
              if (parent) {
                var textEl = parent.querySelector('[class*="text"], [class*="name"], [class*="label"], span');
                if (textEl) label = textEl.textContent.trim();
                else label = parent.textContent.trim().replace(/\s+/g, ' ').substring(0, 30);
              }
              label = label.replace(/[\\/:*?"<>|]/g, '_');
              var exists = data.skuImages.some(function(item) { return item.url === s; });
              if (!exists) data.skuImages.push({url: s, label: label || ('SKU_' + (data.skuImages.length + 1))});
            });
          });
        }

        // ========== 详情图 ==========
        var detailUrls = {};
        // 方法1: 详情区域 div[class^="BImqu2TV"] 里的 img 标签
        var detailContainer = document.querySelector('div[class^="BImqu2TV"]');
        if (detailContainer) {
          detailContainer.querySelectorAll('div[data-uniqid] img').forEach(function(img) {
            var s = toOriginalUrl(img.getAttribute('data-src') || img.src || '');
            if (s && !detailUrls[s]) detailUrls[s] = true;
          });
        }
        // 方法2: 兜底 - 尝试其他详情区域选择器
        if (Object.keys(detailUrls).length === 0) {
          document.querySelectorAll('div[class^="UhRmiWLO"] div[data-uniqid] img').forEach(function(img) {
            var s = toOriginalUrl(img.getAttribute('data-src') || img.src || '');
            if (s && !detailUrls[s]) detailUrls[s] = true;
          });
        }
        // 方法3: 兜底 - 找所有大图（排除推荐商品区域）
        if (Object.keys(detailUrls).length === 0) {
          document.querySelectorAll('div[data-uniqid] img[class*="pdd-lazy-image"]').forEach(function(img) {
            // 检查是否在推荐商品区域
            var inRecommend = img.closest('div[class*="recommend"], div[aria-label="推荐商品"], div[aria-label="相似商品"]');
            if (inRecommend) return;
            var s = toOriginalUrl(img.getAttribute('data-src') || img.src || '');
            if (s && !detailUrls[s]) detailUrls[s] = true;
          });
        }
        Object.keys(detailUrls).forEach(function(url) {
          if (data.detailImages.indexOf(url) === -1) data.detailImages.push(url);
        });

      } catch(e) { console.warn('DALY - 拼多多媒体提取失败:', e); }
      return data;
    }
  };

  global.MediaPdd = MediaPdd;
})(window);
