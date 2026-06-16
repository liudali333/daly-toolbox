// DALY工具箱 - Popup脚本（无Tab版本，单页平铺 + 子面板切换）
(function() {
  'use strict';

  // ===== 面板切换（主内容 ↔ 无痕单 / 关于作者）=====
  var mainContent = document.querySelector('.content');
  var subPanels = document.querySelectorAll('.panel-hidden');

  function showPanel(panelId) {
    // 隐藏所有子面板
    subPanels.forEach(function(p) { p.style.display = 'none'; });
    // 显示主内容
    mainContent.style.display = '';
    if (panelId) {
      // 显示指定子面板，隐藏主内容
      mainContent.style.display = 'none';
      var target = document.getElementById(panelId);
      if (target) target.style.display = 'block';
    }
  }

  // QRCode 生成器
  var QRGenerator = {
    BASE_URL: 'https://mobile.yangkeduo.com/order_checkout.html',

    generate: function() {
      var sku = document.getElementById('skuId').value.trim();
      var goods = document.getElementById('goodsId').value.trim();
      var qty = document.getElementById('quantity').value.trim() || '1';
      var container = document.getElementById('qrcode');

      if (!sku || !goods) {
        container.innerHTML = '<div style="color:#991b1b;font-size:12px;">❌ 请输入商品SKU ID和商品ID</div>';
        return;
      }

      var params = new URLSearchParams({
        sku_id: sku,
        group_id: '94206003123',
        goods_id: goods,
        goods_number: qty,
        page_from: 35,
        order_extra_type: 1
      });
      var fullUrl = this.BASE_URL + '?' + params.toString();

      container.innerHTML = '<div style="color:#666;font-size:12px;">生成中...</div>';

      var self = this;
      setTimeout(function() {
        container.innerHTML = '';
        try {
          new QRCode(container, {
            text: fullUrl,
            width: 180,
            height: 180,
            colorDark: '#1A237E',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
        } catch (e) {
          console.error('QRCode生成失败:', e);
          container.innerHTML = '<div style="color:red;font-size:12px;">QR生成失败: ' + e.message + '</div>';
        }
      }, 100);
    }
  };

  // 初始化
  document.addEventListener('DOMContentLoaded', function() {

    // 无痕单按钮 → 切换到无痕单面板
    var wuhenBtn = document.getElementById('wuhenBtn');
    if (wuhenBtn) {
      wuhenBtn.addEventListener('click', function() { showPanel('wuhen'); });
    }

    // 关于作者按钮 → 切换到关于面板
    var aboutBtn = document.getElementById('aboutBtn');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', function() { showPanel('about'); });
    }

    // 返回按钮 → 回到主内容
    var backFromWuhen = document.getElementById('backFromWuhen');
    if (backFromWuhen) {
      backFromWuhen.addEventListener('click', function() { showPanel(null); });
    }
    var backFromAbout = document.getElementById('backFromAbout');
    if (backFromAbout) {
      backFromAbout.addEventListener('click', function() { showPanel(null); });
    }

    // 生成二维码
    var generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', function() { QRGenerator.generate(); });
    }

  });
})();
