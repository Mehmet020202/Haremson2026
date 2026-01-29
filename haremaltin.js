/**
 * Canlı Döviz Has Altın Scraper v3.1 (BUG FİX)
 * DEMO amaçlıdır – üretimde backend kullanın
 */

(function (window) {
  'use strict';

  const CONFIG = {
    TARGET_URL: 'https://canlidoviz.com/altin-fiyatlari/kapali-carsi/has-altin',
    PROXY_BASE: 'https://api.allorigins.win/get?url=',
    UPDATE_INTERVAL: 60000,
    RETRY_DELAY: 5000,
    MAX_RETRIES: 3
  };

  const state = {
    prices: {
      alis: null,
      satis: null,
      tarih: null,
      durum: 'baslangic'
    },
    fetching: false,
    retry: 0,
    timer: null
  };

  /* ===== Utils ===== */

  function parsePrice(text) {
    if (!text) return null;
    // Türk formatı: "3.456,78" → 3456.78
    return parseFloat(
      text.replace(/\./g, '').replace(',', '.')
    );
  }

  function valid(price) {
    return !isNaN(price) && price > 0 && price < 100000;
  }

  function extract(doc) {
    const selectors = [
      {
        alis: 'span[cid="1186"][dt="bA"]',
        satis: 'span[cid="1186"][dt="amount"]'
      },
      // Fallback selector'lar
      {
        alis: '.gold-price-buy',
        satis: '.gold-price-sell'
      }
    ];

    for (const s of selectors) {
      const a = doc.querySelector(s.alis);
      const sEl = doc.querySelector(s.satis);
      if (a && sEl) {
        const alis = parsePrice(a.textContent.trim());
        const satis = parsePrice(sEl.textContent.trim());
        if (valid(alis) && valid(satis)) {
          return { alis, satis };
        }
      }
    }
    return null;
  }

  /* ===== Core ===== */

  async function fetchPrices() {
    if (state.fetching) {
      console.log('[HasAltin] ⏳ Zaten işlemde...');
      return;
    }
    
    state.fetching = true;
    state.prices.durum = 'yukleniyor';

    try {
      const url = CONFIG.PROXY_BASE + encodeURIComponent(CONFIG.TARGET_URL);
      
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const json = await res.json();
      if (!json?.contents) throw new Error('Proxy boş içerik döndü');

      const doc = new DOMParser().parseFromString(json.contents, 'text/html');
      const prices = extract(doc);
      
      if (!prices) throw new Error('Fiyat elementleri bulunamadı');

      state.prices = {
        ...prices,
        tarih: new Date().toISOString(),
        durum: 'basarili'
      };
      state.retry = 0;

      console.log('[HasAltin] ✅ Güncellendi:', {
        alis: state.prices.alis.toFixed(2),
        satis: state.prices.satis.toFixed(2),
        zaman: new Date(state.prices.tarih).toLocaleString('tr-TR')
      });

      window.CanliDovizOnUpdate?.(state.prices);

    } catch (err) {
      console.error('[HasAltin] ❌', err.message);
      state.prices.durum = 'hata';

      if (state.retry < CONFIG.MAX_RETRIES) {
        state.retry++;
        console.log(`[HasAltin] 🔄 Tekrar deneniyor... (${state.retry}/${CONFIG.MAX_RETRIES})`);
        
        // ✅ DÜZELTME: Sadece tekrar fetch et, yeni interval başlatma!
        setTimeout(() => {
          state.fetching = false;
          fetchPrices();
        }, CONFIG.RETRY_DELAY);
        return; // finally bloğuna düşmesin
      }

      console.error('[HasAltin] ⛔ Maksimum deneme aşıldı');
      state.retry = 0;
      window.CanliDovizOnError?.(err);

    } finally {
      // Retry durumunda finally çalışmayacak (return var)
      state.fetching = false;
    }
  }

  function start() {
    if (state.timer) {
      console.warn('[HasAltin] ⚠️ Zaten çalışıyor');
      return;
    }
    console.log('[HasAltin] 🚀 Başlatıldı');
    fetchPrices();
    state.timer = setInterval(fetchPrices, CONFIG.UPDATE_INTERVAL);
  }

  function stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
      console.log('[HasAltin] ⏹️ Durduruldu');
    }
  }

  /* ===== Public API ===== */

  window.CanliDoviz = {
    getPrices: () => ({ ...state.prices }),
    refresh: fetchPrices,
    start,
    stop,
    status: () => ({
      calisiyor: !!state.timer,
      yukleniyor: state.fetching,
      son: state.prices.tarih,
      durum: state.prices.durum,
      retryCount: state.retry
    }),
    // ✅ YENİ: Debug için
    debug: () => ({ ...state })
  };

  // Otomatik başlat
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start)
    : start();

  console.log('[HasAltin] 📦 v3.1 yüklendi');

})(window);
