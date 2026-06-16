// DALY工具箱 - 媒体提取：1688
// 提取主图、SKU图（带规格名）、详情图、视频

(function(global) {
  'use strict';

  var Media1688 = {
    extract: function(data, toOriginalUrl) {
      try {
        // 主图：od-scroller-list-wrap > od-scroller-item > v-image-cover > v-image-img
        document.querySelectorAll('.od-scroller-list-wrap .od-scroller-item img, .od-scroller-item img, .v-image-cover img, .v-image-img').forEach(function(img) {
          var s = toOriginalUrl(img.src || img.getAttribute('data-src') || '');
          if (s && data.mainImages.indexOf(s) === -1) data.mainImages.push(s);
        });

        // SKU 图 — expand-view-item / sku-filter-button 下的 ant-image-img，带规格名
        document.querySelectorAll('.expand-view-item .ant-image-img, .sku-filter-button.v-flex .ant-image-img').forEach(function(imgWrap) {
          var img = imgWrap.querySelector ? imgWrap.querySelector('img') : imgWrap;
          if (!img) img = imgWrap;
          var s = toOriginalUrl(img.src || '');
          if (!s) return;
          var parent = imgWrap.closest ? imgWrap.closest('.expand-view-item') : null;
          if (!parent) parent = imgWrap.parentElement;
          var labelEl = parent ? parent.querySelector('.item-label, .label-name') : null;
          var label = labelEl ? labelEl.textContent.trim().replace(/[\\/:*?"<>|]/g, '_') : '';
          var exists = data.skuImages.some(function(item) { return item.url === s; });
          if (!exists) data.skuImages.push({url: s, label: label || ('SKU_' + (data.skuImages.length + 1))});
        });

        // 详情图：productDetail 区域
        document.querySelectorAll('[class*="productDetail"] img, [class*="detail"] img').forEach(function(img) {
          var s = toOriginalUrl(img.src || img.getAttribute('data-src') || '');
          if (s && data.detailImages.indexOf(s) === -1) data.detailImages.push(s);
        });

        // 视频
        document.querySelectorAll('video source, video').forEach(function(v) {
          var vs = v.src || v.currentSrc || '';
          if (vs && data.videos.indexOf(vs) === -1) data.videos.push(vs);
        });
      } catch(e) { console.warn('DALY - 1688媒体提取失败:', e); }
      return data;
    }
  };

  global.Media1688 = Media1688;
})(window);
