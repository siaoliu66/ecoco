(() => {
  const LS_HISTORY = 'ecoco_quote_history';
  const LS_SETTINGS = 'ecoco_brand_settings';

  const $ = (id) => document.getElementById(id);

  let itemSeq = 0;
  let state = {
    items: [],
  };

  // ---------- 工具 ----------
  function uid() { return 'it' + (++itemSeq) + '_' + Date.now().toString(36); }

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function genQuoteNo() {
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const history = loadHistory();
    const seq = String(history.length + 1).padStart(3, '0');
    return `Q-${ymd}-${seq}`;
  }

  function currencyFormat(value, currency) {
    const symbol = currency === 'USD' ? 'US$' : 'NT$';
    const decimals = currency === 'USD' ? 2 : 0;
    const n = Number(value) || 0;
    return symbol + n.toLocaleString('zh-TW', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY)) || []; }
    catch (e) { return []; }
  }
  function saveHistory(list) {
    localStorage.setItem(LS_HISTORY, JSON.stringify(list));
  }
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
    catch (e) { return {}; }
  }
  function saveSettings(s) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  }

  // ---------- 產品項目 ----------
  function addItem(data) {
    const item = Object.assign({ id: uid(), name: '', qty: 1, price: 0 }, data || {});
    state.items.push(item);
    renderItems();
    renderPreview();
  }

  function removeItem(id) {
    state.items = state.items.filter(i => i.id !== id);
    renderItems();
    renderPreview();
  }

  function renderItems() {
    const wrap = $('itemsList');
    wrap.innerHTML = '';
    state.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <input type="text" placeholder="品名" value="${escapeAttr(item.name)}" data-field="name" data-id="${item.id}">
        <input type="number" min="0" step="1" placeholder="數量" value="${item.qty}" data-field="qty" data-id="${item.id}">
        <input type="number" min="0" step="0.01" placeholder="單價" value="${item.price}" data-field="price" data-id="${item.id}">
        <button type="button" class="item-remove" data-id="${item.id}">✕</button>
      `;
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        if (field === 'qty' || field === 'price') {
          item[field] = parseFloat(e.target.value) || 0;
        } else {
          item[field] = e.target.value;
        }
        renderPreview();
      });
    });
    wrap.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => removeItem(e.target.dataset.id));
    });
  }

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- 計算 ----------
  function computeTotals() {
    const subtotal = state.items.reduce((sum, i) => sum + (i.qty * i.price), 0);
    const discountType = $('discountType').value;
    const discountValueRaw = parseFloat($('discountValue').value) || 0;
    let discountAmount = 0;
    if (discountType === 'percent') discountAmount = subtotal * discountValueRaw / 100;
    else if (discountType === 'fixed') discountAmount = discountValueRaw;
    discountAmount = Math.min(discountAmount, subtotal);

    const afterDiscount = subtotal - discountAmount;
    const taxRate = getActiveTaxRate();
    const taxAmount = afterDiscount * taxRate / 100;
    const total = afterDiscount + taxAmount;

    return { subtotal, discountType, discountAmount, afterDiscount, taxRate, taxAmount, total };
  }

  function getActiveTaxRate() {
    const activeBtn = document.querySelector('#taxToggle .toggle-btn.active');
    return activeBtn ? Number(activeBtn.dataset.tax) : 5;
  }

  // ---------- 預覽渲染 ----------
  function renderPreview() {
    const currency = $('currency').value;
    const totals = computeTotals();

    $('pvQuoteNo').textContent = $('quoteNo').value || '-';
    $('pvQuoteDate').textContent = $('quoteDate').value || '-';
    $('pvCurrency').textContent = currency;

    $('pvCustName').textContent = $('custName').value || '（未填寫客戶名稱）';
    $('pvCustContact').textContent = $('custContact').value ? '聯絡人：' + $('custContact').value : '';
    $('pvCustPhone').textContent = $('custPhone').value ? '電話：' + $('custPhone').value : '';
    $('pvCustEmail').textContent = $('custEmail').value ? 'Email：' + $('custEmail').value : '';
    $('pvCustAddress').textContent = $('custAddress').value ? '地址：' + $('custAddress').value : '';

    const body = $('pvItemsBody');
    body.innerHTML = '';
    if (state.items.length === 0) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">尚未新增產品項目</td></tr>`;
    } else {
      state.items.forEach((item, idx) => {
        const amount = item.qty * item.price;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="col-idx">${idx + 1}</td>
          <td class="col-name">${escapeHtml(item.name) || '（未命名產品）'}</td>
          <td class="col-qty">${item.qty}</td>
          <td class="col-price">${currencyFormat(item.price, currency)}</td>
          <td class="col-amount">${currencyFormat(amount, currency)}</td>
        `;
        body.appendChild(tr);
      });
    }

    $('pvSubtotal').textContent = currencyFormat(totals.subtotal, currency);

    if (totals.discountType !== 'none' && totals.discountAmount > 0) {
      $('pvDiscountRow').style.display = 'flex';
      const label = totals.discountType === 'percent'
        ? `折扣 (${$('discountValue').value}%)`
        : '折扣';
      $('pvDiscountLabel').textContent = label;
      $('pvDiscountAmount').textContent = '-' + currencyFormat(totals.discountAmount, currency);
    } else {
      $('pvDiscountRow').style.display = 'none';
    }

    if (totals.taxRate > 0) {
      $('pvTaxRow').style.display = 'flex';
      $('pvTaxLabel').textContent = `稅金 (${totals.taxRate}%)`;
      $('pvTaxAmount').textContent = currencyFormat(totals.taxAmount, currency);
    } else {
      $('pvTaxRow').style.display = 'none';
    }

    $('pvTotal').textContent = currencyFormat(totals.total, currency);

    const notes = $('notes').value;
    if (notes.trim()) {
      $('pvNotesSection').style.display = 'block';
      $('pvNotes').textContent = notes;
    } else {
      $('pvNotesSection').style.display = 'none';
    }
  }

  // ---------- 品牌設定 ----------
  function applyBrand(settings) {
    if (settings.logo) {
      $('previewLogo').src = settings.logo;
      $('previewLogo').style.display = 'block';
    } else {
      $('previewLogo').style.display = 'none';
    }
    if (settings.companyName) {
      $('previewCompanyName').textContent = settings.companyName;
    }
    const color = settings.themeColor || '#2563eb';
    document.documentElement.style.setProperty('--accent', color);
    $('themeColor').value = color;
  }

  function currentSettings() {
    return {
      logo: $('previewLogo').style.display !== 'none' ? $('previewLogo').src : null,
      themeColor: $('themeColor').value,
      companyName: $('previewCompanyName').textContent,
    };
  }

  // ---------- 歷史報價 ----------
  function collectQuoteData() {
    return {
      quoteNo: $('quoteNo').value,
      quoteDate: $('quoteDate').value,
      currency: $('currency').value,
      customer: {
        name: $('custName').value,
        contact: $('custContact').value,
        phone: $('custPhone').value,
        email: $('custEmail').value,
        address: $('custAddress').value,
      },
      items: state.items.map(i => ({ ...i })),
      discountType: $('discountType').value,
      discountValue: $('discountValue').value,
      taxRate: getActiveTaxRate(),
      notes: $('notes').value,
      total: computeTotals().total,
      savedAt: new Date().toISOString(),
    };
  }

  function saveCurrentQuote() {
    if (!$('custName').value.trim()) {
      alert('請先填寫客戶名稱再儲存報價單');
      return;
    }
    const data = collectQuoteData();
    const history = loadHistory();
    const existingIdx = history.findIndex(h => h.quoteNo === data.quoteNo);
    if (existingIdx >= 0) history[existingIdx] = data;
    else history.unshift(data);
    saveHistory(history);
    renderHistory();
    alert('已儲存報價單：' + data.quoteNo);
  }

  function renderHistory() {
    const history = loadHistory();
    $('historyCount').textContent = history.length;
    const wrap = $('historyList');
    if (history.length === 0) {
      wrap.innerHTML = '<p class="empty-hint">尚無儲存的報價單</p>';
      return;
    }
    wrap.innerHTML = '';
    history.forEach(h => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="hi-main" data-no="${escapeAttr(h.quoteNo)}">
          <span class="hi-no">${escapeHtml(h.quoteNo)}</span>
          <span class="hi-sub">${escapeHtml(h.customer.name)} · ${currencyFormat(h.total, h.currency)}</span>
        </div>
        <button type="button" class="hi-del" data-no="${escapeAttr(h.quoteNo)}">刪除</button>
      `;
      wrap.appendChild(div);
    });
    wrap.querySelectorAll('.hi-main').forEach(el => {
      el.addEventListener('click', () => loadQuoteByNo(el.dataset.no));
    });
    wrap.querySelectorAll('.hi-del').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteQuoteByNo(el.dataset.no);
      });
    });
  }

  function loadQuoteByNo(no) {
    const history = loadHistory();
    const data = history.find(h => h.quoteNo === no);
    if (!data) return;
    $('quoteNo').value = data.quoteNo;
    $('quoteDate').value = data.quoteDate;
    $('currency').value = data.currency;
    $('custName').value = data.customer.name;
    $('custContact').value = data.customer.contact;
    $('custPhone').value = data.customer.phone;
    $('custEmail').value = data.customer.email;
    $('custAddress').value = data.customer.address;
    state.items = data.items.map(i => ({ ...i }));
    renderItems();
    $('discountType').value = data.discountType;
    $('discountValue').value = data.discountValue;
    $('discountValueField').style.display = data.discountType === 'none' ? 'none' : 'block';
    document.querySelectorAll('#taxToggle .toggle-btn').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.tax) === Number(data.taxRate));
    });
    $('notes').value = data.notes || '';
    renderPreview();
  }

  function deleteQuoteByNo(no) {
    if (!confirm('確定要刪除這筆歷史報價嗎？')) return;
    let history = loadHistory();
    history = history.filter(h => h.quoteNo !== no);
    saveHistory(history);
    renderHistory();
  }

  // ---------- 新報價單 ----------
  function resetForNewQuote() {
    state.items = [];
    $('quoteNo').value = genQuoteNo();
    $('quoteDate').value = todayStr();
    $('custName').value = '';
    $('custContact').value = '';
    $('custPhone').value = '';
    $('custEmail').value = '';
    $('custAddress').value = '';
    $('discountType').value = 'none';
    $('discountValue').value = 0;
    $('discountValueField').style.display = 'none';
    $('notes').value = '';
    document.querySelectorAll('#taxToggle .toggle-btn').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.tax) === 5);
    });
    addItem();
    renderItems();
    renderPreview();
  }

  // ---------- PDF ----------
  function downloadPdf() {
    const el = $('quotePreview');
    const quoteNo = $('quoteNo').value || 'quote';
    const opt = {
      margin: 0,
      filename: `${quoteNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
    };
    html2pdf().set(opt).from(el).save();
  }

  // ---------- 事件綁定 ----------
  function bindEvents() {
    $('addItem').addEventListener('click', () => addItem());

    ['quoteNo', 'quoteDate', 'currency', 'custName', 'custContact', 'custPhone',
      'custEmail', 'custAddress', 'discountValue', 'notes'].forEach(id => {
      $(id).addEventListener('input', renderPreview);
      $(id).addEventListener('change', renderPreview);
    });

    $('discountType').addEventListener('change', () => {
      $('discountValueField').style.display = $('discountType').value === 'none' ? 'none' : 'block';
      renderPreview();
    });

    document.querySelectorAll('#taxToggle .toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#taxToggle .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPreview();
      });
    });

    $('logoInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        $('previewLogo').src = reader.result;
        $('previewLogo').style.display = 'block';
        saveSettings(Object.assign(loadSettings(), { logo: reader.result }));
      };
      reader.readAsDataURL(file);
    });
    $('logoClear').addEventListener('click', () => {
      $('previewLogo').style.display = 'none';
      $('previewLogo').src = '';
      $('logoInput').value = '';
      saveSettings(Object.assign(loadSettings(), { logo: null }));
    });

    $('themeColor').addEventListener('input', () => {
      document.documentElement.style.setProperty('--accent', $('themeColor').value);
      saveSettings(Object.assign(loadSettings(), { themeColor: $('themeColor').value }));
    });

    $('previewCompanyName').addEventListener('blur', () => {
      saveSettings(Object.assign(loadSettings(), { companyName: $('previewCompanyName').textContent }));
    });
    $('previewCompanyName').setAttribute('contenteditable', 'true');

    $('saveQuote').addEventListener('click', saveCurrentQuote);
    $('downloadPdf').addEventListener('click', downloadPdf);
    $('newQuote').addEventListener('click', () => {
      if (confirm('確定要開新報價單嗎？未儲存的內容將會遺失。')) resetForNewQuote();
    });
  }

  // ---------- 初始化 ----------
  function init() {
    bindEvents();
    applyBrand(loadSettings());
    renderHistory();
    resetForNewQuote();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
