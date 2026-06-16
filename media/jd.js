// DALY工具箱 - 媒体提取：京东
// 提取主图、视频、SKU图（带规格名）

(function(global) {
  'use strict';

  var MediaJd = {
    extract: function(data, toOriginalUrl) {
      try {
        // 主图
        document.querySelectorAll('#spec-list img, [class*="spec"] img, [class*="thumb"] img').forEach(function(img) {
          var s = toOriginalUrl(img.src || img.dataset.src || '');
          if (s && data.mainImages.indexOf(s) === -1) data.mainImages.push(s);
        });
        // 详情图：shop-editor-floor / shop-editor-zone 区域（通过 transform: scale 特征定位）
        document.querySelectorAll('[id*="shop-editor-floor"] img, [class*="shop-editor-zone"] img, div[style*="transform: scale(1)"] img').forEach(function(img) {
          var s = toOriginalUrl(img.src || img.getAttribute('data-src') || '');
          if (s && data.detailImages.indexOf(s) === -1) data.detailImages.push(s);
        });
        // 视频
        document.querySelectorAll('video source, video').forEach(function(v) {
          var vs = v.src || v.currentSrc || '';
          if (vs && data.videos.indexOf(vs) === -1) data.videos.push(vs);
        });
        // SKU 图：specification-item-sku-has-image，带规格名
        document.querySelectorAll('.specification-item-sku-has-image').forEach(function(skuEl) {
          var img = skuEl.querySelector('img');
          if (!img) return;
          var s = toOriginalUrl(img.src || '');
          if (!s) return;
          // 规格名：specification-item-sku-text 或 title 属性或 span
          var labelEl = skuEl.querySelector('[class*="sku-text"], [class*="text"]');
          var label = labelEl ? labelEl.textContent.trim() : (skuEl.getAttribute('title') || '');
          label = label.replace(/[\\/:*?"<>|]/g, '_');
          var exists = data.skuImages.some(function(item) { return item.url === s; });
          if (!exists) data.skuImages.push({url: s, label: label || ('SKU_' + (data.skuImages.length + 1))});
        });
      } catch(e) { console.warn('DALY - 京东媒体提取失败:', e); }
      return data;
    }
  };

  global.MediaJd = MediaJd;
})(window);
