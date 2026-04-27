(function () {
  if (document.getElementById('otoquest-btn')) return;

  const host = location.hostname;

  // 商品詳細ページのみ対象（一覧・トップページは除外）
  const path = location.pathname;
  if (host.includes('rakuten.co.jp')) {
    if (!path.match(/^\/(shop\/|[^/]+\/[^/]+)/)) return;
  }
  let productName = '';
  let price = '';

  if (host.includes('rakuten.co.jp')) {
    // 楽天商品ページ
    const titleEl = document.querySelector('h1, h2, .item_name, .itemName, [class*="item_name"], [class*="ItemName"]');
    const priceEl = document.querySelector('.price2, .price--number, span[itemprop="price"]');
    productName = titleEl?.textContent?.trim() || '';
    price = priceEl?.textContent?.trim() || '';
  } else if (host.includes('yahoo.co.jp')) {
    // Yahoo!ショッピング商品ページ
    const titleEl = document.querySelector('h1.elTitle, h1[class*="Title"], h1[class*="name"]');
    const priceEl = document.querySelector('span[class*="Price--emphasis"], span[class*="price"]');
    productName = titleEl?.textContent?.trim() || '';
    price = priceEl?.textContent?.trim() || '';
  }

  if (!productName) return;

  // ボタン生成
  const btn = document.createElement('a');
  btn.id = 'otoquest-btn';
  const query = encodeURIComponent(productName.slice(0, 50));
  btn.href = `https://otoquest-uiov.vercel.app/search?q=${query}`;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.textContent = '⚔️ OtoQuestで最安値比較';
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
    background: #6366f1;
    color: #fff;
    padding: 12px 20px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: bold;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: sans-serif;
    transition: opacity 0.2s;
  `;
  btn.onmouseenter = () => { btn.style.opacity = '0.85'; };
  btn.onmouseleave = () => { btn.style.opacity = '1'; };

  document.body.appendChild(btn);
})();
