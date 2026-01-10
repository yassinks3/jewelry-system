const STORAGE_KEY = 'jewelry_inventory';
const LANG_KEY = 'jewelry_lang';
const MARKET_KEY = 'jewelry_market';
const SETTINGS_KEY = 'jewelry_settings';
const SYSTEM_PASS = '1981';

// Robust System Configuration (Embedded Fallback)
const SYSTEM_CONFIG = {
    initialData: {
        diamonds: [
            { id: 1, sku: 'D-1001', type: 'Round', carat: 1.2, color: 'D', clarity: 'VVS1', cut: 'Excellent', price: 125000, image: null },
            { id: 2, sku: 'D-1002', type: 'Emerald', carat: 2.0, color: 'F', clarity: 'VS2', cut: 'Very Good', price: 180000, image: null }
        ],
        gold: [
            { id: 3, sku: 'G-1001', name: 'Cuban Link Chain', type: 'Chain', karat: '14k', weight: 45.2, price: 32000, image: null },
            { id: 4, sku: 'G-1002', name: 'Love Knot Necklace', type: 'Necklace', karat: '18k', weight: 12.5, price: 18500, image: null }
        ],
        sold: [],
        repairs: []
    },
    translations: {
        en: {
            dashboard: 'Dashboard', overview: 'Business Overview', diamonds: 'Diamonds', gold: 'Gold Items', inventory: 'Inventory', value: 'Inventory Value', recent: 'Recent Items', add_diamond: 'Add New Diamond', add_gold: 'Add Gold Item', edit_diamond: 'Edit Diamond', edit_gold: 'Edit Gold Item', export_excel: 'Export to Excel', backup: 'Download Full System Backup (Excel)', search: 'Search by SKU, Name, or Type...', total_diamonds: 'Total Diamonds', total_gold: 'Gold Items', sku: 'SKU', carat: 'Carat', price: 'Price', price_egp: 'Price (EGP)', weight_g: 'Weight (Grams)', name: 'Item Name', type: 'Type', karat: 'Karat', save: 'Save Changes', add: 'Save to Inventory', cancel: 'Cancel', delete_confirm: 'Are you sure you want to remove this item?', no_items: 'No items found.', diamond_form: 'Diamond Details', gold_form: 'Gold Item Details', image: 'Item Image', shape: 'Shape', color: 'Color', clarity: 'Clarity', cut: 'Cut Grade', all: 'All', chain: 'Chain', necklace: 'Necklace', bracelet: 'Bracelet', ring: 'Ring', earrings: 'Earrings', other: 'Other', enter_pass: 'Enter Password (1981):', wrong_pass: 'Incorrect Password!', market_rates: 'Live Market Rates', update_rates: 'Update Prices', live_val: 'Current Valuation', total_cost: 'Original Cost', price_24k: 'Price per gram (24k)', per_gram: 'per gram', sync_live: 'Sync Live Market', sync_success: 'Prices updated successfully!', sync_error: 'Failed to fetch live prices.', offset: 'Market Offset (EGP)', official_site: 'Check iSagha', duplicate_warn: 'An identical item already exists in your inventory. Are you sure you want to add it again?', sold_archive: 'Sales Archive', sell_item: 'Sell Item', sale_price: 'Final Sale Price (EGP)', sale_date: 'Sale Date', confirm_sale: 'Confirm Sale', sold_on: 'Sold on', total_sales: 'Total Sales Revenue', qr_code: 'QR Code', view_qr: 'View QR Code', download_receipt: 'Download Receipt', download_receipt_prompt: 'Sale successful! Would you like to download the receipt?', suggested_price: 'Suggested Price', profit_margin: 'Profit Margin (%)', stock_threshold: 'Low Stock Threshold', stock_alerts: 'Inventory Alerts', low_stock_on: 'Low stock on', items_left: 'items left', settings: 'System Settings', print_tag: 'Print Tag', workshop: 'Workshop', repair_jobs: 'Repair Jobs', add_job: 'New Repair Job', customer: 'Customer Name', phone: 'Phone Number', service_type: 'Service Type', status: 'Status', due_date: 'Expected Date', received: 'Received', goldsmith: 'With Goldsmith', ready: 'Ready for Pickup', delivered: 'Delivered', source: 'Item Origin', idar_item: 'Idar Jewelry', other_store: 'Another Store', job_no: 'Job', origin_sku: 'Barcode/SKU', json_backup: 'Export JSON Backup', json_restore: 'Restore from JSON', confirm_restore: 'WARNING: Restoring will overwrite all current data. Proceed?'
        },
        ar: {
            dashboard: 'لوحة التحكم', overview: 'نظرة عامة على العمل', diamonds: 'الألماس', gold: 'الذهب', inventory: 'المخزون', value: 'قيمة المخزون', recent: 'العناصر الأخيرة', add_diamond: 'إضافة ألماسة جديدة', add_gold: 'إضافة قطعة ذهب', edit_diamond: 'تعديل الألماسة', edit_gold: 'تعديل قطعة الذهب', export_excel: 'تصدير إلى إكسل', backup: 'تحميل نسخة احتياطية كاملة (إكسل)', search: 'البحث عن طريق الكود، الاسم، أو النوع...', total_diamonds: 'إجمالي الألماس', total_gold: 'قطع الذهب', sku: 'الكود', carat: 'قيراط', price: 'السعر', price_egp: 'السعر (ج.م)', weight_g: 'الوزن (جرام)', name: 'اسم القطعة', type: 'النوع', karat: 'العيار', save: 'حفظ التعديلات', add: 'حفظ في المخزون', cancel: 'إلغاء', delete_confirm: 'هل أنت متأكد من حذف هذا العنصر؟', no_items: 'لم يتم العثور على عناصر.', diamond_form: 'تفاصيل الألماسة', gold_form: 'تفاصيل قطعة الذهب', image: 'صورة القطعة', shape: 'الشكل', color: 'اللون', clarity: 'النقاء', cut: 'درجة القص', all: 'الكل', chain: 'سلسلة', necklace: 'عقد', bracelet: 'أسورة', ring: 'خاتم', earrings: 'حلق', other: 'أخرى', enter_pass: 'أدخل كلمة المرور (1981):', wrong_pass: 'كلمة المرور غير صحيحة!', market_rates: 'أسعار السوق الحالية', update_rates: 'تحديث الأسعار', live_val: 'التقييم الحالي', total_cost: 'التكلفة الأصلية', price_24k: 'سعر الجرام (عيار 24)', per_gram: 'للجرام الواحد', sync_live: 'مزامنة مع السوق', sync_success: 'تم تحديث الأسعار بنجاح!', sync_error: 'فشل في جلب الأسعار المباشرة.', offset: 'فرق السعر (زيادة/نقص)', official_site: 'تحقق من آي صاغة', duplicate_warn: 'هذا العنصر موجود بالفعل في مخزونك. هل أنت متأكد من إضافته مرة أخرى؟', sold_archive: 'أرشيف المبيعات', sell_item: 'بيع القطعة', sale_price: 'سعر البيع النهائي (ج.م)', sale_date: 'تاريخ البيع', confirm_sale: 'تأكيد البيع', sold_on: 'تم البيع في', total_sales: 'إجمالي المبيعات', qr_code: 'رمز QR', view_qr: 'عرض رمز QR', download_receipt: 'تحميل الفاتورة', download_receipt_prompt: 'تمت البيع بنجاح! هل ترغب في تحميل الفاتورة؟', suggested_price: 'السعر المقترح', profit_margin: 'هامش الربح (%)', stock_threshold: 'حد المخزون المنخفض', stock_alerts: 'تنبيهات المخزون', low_stock_on: 'مخزون منخفض في', items_left: 'قطع متبقية', settings: 'إعدادات النظام', print_tag: 'طباعة التيكيت', workshop: 'الورشة', repair_jobs: 'طلبات الإصلاح', add_job: 'طلب إصلاح جديد', customer: 'اسم العميل', phone: 'رقم الهاتف', service_type: 'نوع الخدمة', status: 'الحالة', due_date: 'التاريخ المتوقع', received: 'تم الاستلام', goldsmith: 'عند الصائغ', ready: 'جاهز للاستلام', delivered: 'تم التسليم', source: 'مصدر القطعة', idar_item: 'مجوهرات إيدار', other_store: 'محل آخر', job_no: 'رقم الطلب', origin_sku: 'الباركود/الكود', json_backup: 'تصدير نسخة JSON', json_restore: 'استعادة من JSON', confirm_restore: 'تحذير: الاستعادة ستقوم بمسح جميع البيانات الحالية. هل تريد الاستمرار؟'
        }
    }
};

let translations = SYSTEM_CONFIG.translations;
let initialData = SYSTEM_CONFIG.initialData;
let inventory = {};
let currentLang = localStorage.getItem(LANG_KEY) || 'en';
let privacyMode_dashboard = JSON.parse(localStorage.getItem('privacy_mode_dashboard')) || false;
let privacyMode_sales = JSON.parse(localStorage.getItem('privacy_mode_sales')) || false;
let currentView = 'dashboard';
let currentSearch = '';
let dismissedAlerts = JSON.parse(localStorage.getItem('dismissed_alerts')) || [];
let currentInventoryRanges = { diamonds: 'All', gold: 'All' };
let appSettings = { profitMargin: 20, stockThreshold: 2 };
let marketPrices = { base24k: 3000, offset: 0 };

const t = (key) => {
    if (!translations[currentLang]) return key;
    return translations[currentLang][key] || key;
};

// Initialization Sequence
async function initApp() {
    try {
        const response = await fetch('config.json');
        if (response.ok) {
            const config = await response.json();
            translations = config.translations;
            initialData = config.initialData;
            console.log("System config loaded from external JSON.");
        }
    } catch (error) {
        console.warn('External config load failed. Using embedded fallback.');
    } finally {
        inventory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialData;
        if (!inventory.repairs) inventory.repairs = [];
        if (!inventory.lastJobNo) inventory.lastJobNo = 0;

        appSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { profitMargin: 20, stockThreshold: 2 };
        marketPrices = JSON.parse(localStorage.getItem(MARKET_KEY)) || { base24k: 3000, offset: 0 };

        if (typeof marketPrices.offset !== 'number') marketPrices.offset = 0;
        if (typeof marketPrices.base24k !== 'number') marketPrices.base24k = 3000;

        migrateData();
        renderApp();
    }
}

const getKaratPrice = (karat) => {
    const numeric = parseInt(karat);
    if (isNaN(numeric)) return 0;
    return (marketPrices.base24k / 24) * numeric;
};

async function fetchLivePrices() {
    try {
        const goldRes = await fetch('https://api.gold-api.com/price/XAU');
        const goldData = await goldRes.json();

        const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
        const rateData = await rateRes.json();

        const usdPerOunce = goldData.price || 0;
        const egpPerUsd = (rateData.rates && rateData.rates.EGP) ? rateData.rates.EGP : 0;
        const currentOffset = marketPrices.offset || 0;

        if (usdPerOunce === 0 || egpPerUsd === 0) throw new Error('Invalid API data');

        const raw24k = (usdPerOunce / 31.1035) * egpPerUsd;
        marketPrices.base24k = Math.round(raw24k + currentOffset);

        localStorage.setItem(MARKET_KEY, JSON.stringify(marketPrices));
        alert(t('sync_success'));
        showView('dashboard');
    } catch (err) {
        console.error(err);
        alert(t('sync_error'));
    }
}

function updateLayout() {
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
}
updateLayout();

function dismissAlert(label) {
    label.split(',').forEach(l => {
        if (!dismissedAlerts.includes(l)) dismissedAlerts.push(l);
    });
    localStorage.setItem('dismissed_alerts', JSON.stringify(dismissedAlerts));
    renderApp();
}

function saveSettings(event) {
    if (event) event.preventDefault();
    appSettings.profitMargin = parseFloat(document.getElementById('s-margin').value);
    appSettings.stockThreshold = parseInt(document.getElementById('s-threshold').value);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
    closeModal();
    renderApp();
}

function getSuggestedPrice(type, val1, val2 = null) {
    const margin = 1 + (appSettings.profitMargin / 100);
    if (type === 'gold') {
        const base = val1 * getKaratPrice(val2);
        return Math.round(base * margin);
    } else {
        return Math.round(val1 * margin);
    }
}

function checkStockLevels() {
    const alerts = [];
    const categories = { diamonds: {}, gold: {} };

    inventory.diamonds.forEach(d => {
        categories.diamonds[d.type] = (categories.diamonds[d.type] || 0) + 1;
    });

    inventory.gold.forEach(g => {
        const key = `${g.karat} ${g.type}`;
        categories.gold[key] = (categories.gold[key] || 0) + 1;
    });

    for (const [type, count] of Object.entries(categories.diamonds)) {
        if (count <= appSettings.stockThreshold && !dismissedAlerts.includes(type)) {
            alerts.push({ type: 'diamonds', label: type, count });
        }
    }
    for (const [key, count] of Object.entries(categories.gold)) {
        if (count <= appSettings.stockThreshold && !dismissedAlerts.includes(key)) {
            alerts.push({ type: 'gold', label: key, count });
        }
    }
    return alerts;
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem(LANG_KEY, currentLang);
    updateLayout();
    renderApp();
}

function renderApp() {
    const Sidebar = document.querySelector('.sidebar');
    Sidebar.innerHTML = `
        <div class="logo">
            <i data-lucide="gem"></i>
            <span>${currentLang === 'ar' ? 'مجوهرات إيدار' : 'Idar Jewelry'}</span>
        </div>
        <ul class="nav-links">
            <li id="nav-dashboard" onclick="showView('dashboard')">
                <i data-lucide="layout-dashboard"></i> ${t('dashboard')}
            </li>
            <li id="nav-diamonds" onclick="showView('diamonds')">
                <i data-lucide="diamond"></i> ${t('diamonds')}
            </li>
            <li id="nav-gold" onclick="showView('gold')">
                <i data-lucide="coins"></i> ${t('gold')}
            </li>
            <li id="nav-workshop" onclick="showView('workshop')">
                <i data-lucide="hammer"></i> ${t('workshop')}
            </li>
            <li id="nav-settings" onclick="openSettingsModal()">
                <i data-lucide="settings"></i> ${t('settings')}
            </li>
        </ul>
        <div class="sidebar-footer">
            <li id="nav-sales" onclick="requestSalesArchive()" style="list-style: none; margin-bottom: 1rem; color: var(--text-dim); transition: all 0.3s; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                <i data-lucide="archive"></i> ${t('sold_archive')}
            </li>
            <button class="lang-toggle" onclick="toggleLanguage()">
                <i data-lucide="languages"></i>
                ${currentLang === 'en' ? 'العربية' : 'English'}
            </button>
        </div>
    `;
    showView(currentView);
}

function migrateData() {
    let changed = false;
    if (!inventory.sold) { inventory.sold = []; changed = true; }
    inventory.diamonds.forEach((item, index) => {
        if (!item.sku) { item.sku = `D-${1001 + index}`; changed = true; }
    });
    inventory.gold.forEach((item, index) => {
        if (!item.sku) { item.sku = `G-${1001 + index}`; changed = true; }
    });
    if (changed) saveToStorage();
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

function generateSKU(category) {
    const prefix = category === 'diamonds' ? 'D' : 'G';
    const items = inventory[category];
    const lastId = items.length > 0 ? Math.max(...items.map(i => parseInt(i.sku.split('-')[1]) || 1000)) : 1000;
    return `${prefix}-${lastId + 1}`;
}

function isDuplicate(category, newItem) {
    return inventory[category].some(item => {
        if (item.id === newItem.id) return false;
        if (category === 'diamonds') {
            return item.type === newItem.type && item.carat === newItem.carat && item.color === newItem.color && item.clarity === newItem.clarity && item.cut === newItem.cut && item.price === newItem.price;
        } else {
            return item.name === newItem.name && item.type === newItem.type && item.karat === newItem.karat && item.weight === newItem.weight && item.price === newItem.price;
        }
    });
}

function getSKURanges(category) {
    const items = inventory[category];
    if (items.length === 0) return [];
    const numbers = items.map(i => parseInt(i.sku.split('-')[1])).filter(n => !isNaN(n));
    if (numbers.length === 0) return [];
    const min = Math.floor(Math.min(...numbers) / 1000) * 1000;
    const max = Math.floor(Math.max(...numbers) / 1000) * 1000;
    const ranges = [];
    for (let i = min; i <= max; i += 1000) {
        ranges.push({ start: i, end: i + 999, label: `${i} - ${i + 999}` });
    }
    return ranges;
}

function downloadCSV(data, filename, headers) {
    const csvContent = [headers.join(','), ...data.map(row => headers.map(header => {
        const val = row[header.toLowerCase().replace(/[^a-z]/g, '')] || row[header.toLowerCase()] || '';
        return `"${val.toString().replace(/"/g, '""')}"`;
    }).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", filename);
    link.click();
}

function showView(view) {
    currentView = view;
    const container = document.getElementById('view-container');
    const title = document.getElementById('view-title');
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    const navItem = document.getElementById(`nav-${view}`);
    if (navItem) navItem.classList.add('active');

    const searchHtml = `
        <div class="search-bar">
            <i data-lucide="search"></i>
            <input type="text" id="global-search" placeholder="${t('search')}" value="${currentSearch}" oninput="handleSearch(this.value)">
            <div id="search-suggestions" class="suggestions-dropdown hidden"></div>
        </div>
    `;

    switch (view) {
        case 'dashboard': title.innerText = t('overview'); renderDashboard(container); break;
        case 'diamonds': title.innerText = t('diamonds'); container.innerHTML = searchHtml + '<div id="inventory-list"></div>'; renderDiamonds(document.getElementById('inventory-list')); break;
        case 'gold': title.innerText = t('gold'); container.innerHTML = searchHtml + '<div id="inventory-list"></div>'; renderGold(document.getElementById('inventory-list')); break;
        case 'workshop': title.innerText = t('workshop'); renderWorkshop(container); break;
        case 'sales': title.innerText = t('sold_archive'); renderSales(container); break;
    }
    lucide.createIcons();
}

function handleSearch(val) {
    currentSearch = val.toLowerCase();
    const suggestionsContainer = document.getElementById('search-suggestions');
    const listContainer = document.getElementById('inventory-list');
    const activeView = document.querySelector('.nav-links li.active')?.id?.replace('nav-', '') || '';

    if (!val || val.length < 1) {
        suggestionsContainer.classList.add('hidden');
        if (activeView === 'diamonds') renderDiamonds(listContainer);
        else if (activeView === 'gold') renderGold(listContainer);
        return;
    }

    let matches = [];
    if (activeView === 'diamonds') {
        inventory.diamonds.forEach(d => {
            const label = `${d.carat}ct ${d.type} Diamond (${d.sku})`;
            if (label.toLowerCase().includes(currentSearch)) matches.push({ label, value: d.sku, type: 'diamond' });
        });
    } else if (activeView === 'gold') {
        inventory.gold.forEach(g => {
            const label = `${g.name} (${g.sku})`;
            if (label.toLowerCase().includes(currentSearch)) matches.push({ label, value: g.sku, type: 'gold' });
        });
    }

    if (matches.length > 0) {
        suggestionsContainer.innerHTML = matches.slice(0, 8).map(m => `<div class="suggestion-item" onclick="selectSuggestion('${m.value}', '${m.type}')"><span class="match-label">${m.label}</span><span class="match-type">${t(m.type === 'diamond' ? 'diamonds' : 'gold')}</span></div>`).join('');
        suggestionsContainer.classList.remove('hidden');
    } else suggestionsContainer.classList.add('hidden');

    if (activeView === 'diamonds') renderDiamonds(listContainer);
    else if (activeView === 'gold') renderGold(listContainer);
}

function selectSuggestion(value, type) {
    currentSearch = value.toLowerCase();
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = value;
    document.getElementById('search-suggestions').classList.add('hidden');
    showView(type === 'diamond' ? 'diamonds' : 'gold');
}

document.addEventListener('click', (e) => {
    const suggestions = document.getElementById('search-suggestions');
    const searchBar = document.querySelector('.search-bar');
    if (suggestions && searchBar && !searchBar.contains(e.target)) suggestions.classList.add('hidden');
});

function setInventoryRange(category, range) {
    currentInventoryRanges[category] = range;
    showView(category);
}

function renderDashboard(container) {
    const totalDiamonds = inventory.diamonds.length;
    const totalGold = inventory.gold.length;
    const alerts = checkStockLevels();
    const costValue = [...inventory.diamonds, ...inventory.gold].reduce((sum, item) => sum + item.price, 0);
    const liveGoldValue = inventory.gold.reduce((sum, g) => sum + (g.weight * getKaratPrice(g.karat)), 0);
    const liveValue = inventory.diamonds.reduce((sum, d) => sum + d.price, 0) + liveGoldValue;

    container.innerHTML = `
        ${alerts.length > 0 ? `
        <div class="card alert-banner" style="margin-bottom: 2rem; border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05);">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <i data-lucide="alert-triangle" style="color: #ef4444;"></i>
                <div style="flex: 1;">
                    <h4 style="margin: 0; color: #ef4444;">${t('stock_alerts')}</h4>
                    <div style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.25rem;">
                        ${alerts.map(a => `${t('low_stock_on')} <strong>${a.label}</strong> (${a.count} ${t('items_left')})`).join(' | ')}
                    </div>
                </div>
                <i data-lucide="x" onclick="dismissAlert('${alerts.map(a => a.label).join(',')}')" style="cursor: pointer; opacity: 0.5; width: 16px;"></i>
            </div>
        </div>
        ` : ''}

        <div class="stats-grid">
            <div class="card stat-card"><h3>${t('total_diamonds')}</h3><div class="value">${totalDiamonds}</div></div>
            <div class="card stat-card"><h3>${t('total_gold')}</h3><div class="value">${totalGold}</div></div>
            <div class="card stat-card destaque">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3>${t('value')}</h3>
                    <i data-lucide="${privacyMode_dashboard ? 'eye-off' : 'eye'}" class="privacy-toggle" onclick="togglePrivacy('dashboard')"></i>
                </div>
                <div class="value privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${liveValue.toLocaleString()} EGP</div>
                <div style="font-size: 0.8rem; opacity: 0.8; margin-top: 0.5rem;">
                    ${t('total_cost')}: <span class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${costValue.toLocaleString()} EGP</span>
                </div>
            </div>
        </div>

        <div class="card" style="margin-bottom: 2rem; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0;"><i data-lucide="line-chart" style="width: 18px; margin-right: 0.5rem; vertical-align: middle;"></i> ${t('market_rates')}</h3>
                <button class="btn-outline" onclick="openMarketModal()">${t('update_rates')}</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                <div style="text-align: center; border-right: 1px solid var(--border);">
                    <div style="font-size: 0.9rem; color: var(--text-dim);">24k</div>
                    <div style="font-weight: 700; color: var(--gold);" class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${marketPrices.base24k.toLocaleString()} EGP</div>
                </div>
                <div style="text-align: center; border-right: 1px solid var(--border);">
                    <div style="font-size: 0.9rem; color: var(--text-dim);">22k</div>
                    <div style="font-weight: 700; color: var(--gold);" class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${getKaratPrice('22k').toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.9rem; color: var(--text-dim);">18k</div>
                    <div style="font-weight: 700; color: var(--gold);" class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${getKaratPrice('18k').toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</div>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 2rem; display: flex; gap: 1rem;">
            <button onclick="fetchLivePrices()" class="btn-sync" style="flex: 1;"><i data-lucide="refresh-cw"></i> ${t('sync_live')}</button>
            <a href="https://isagha.com" target="_blank" class="btn-outline" style="flex: 1;"><i data-lucide="external-link"></i> ${t('official_site')}</a>
            <button onclick="exportAll()" class="btn-backup" style="flex: 1;"><i data-lucide="download-cloud"></i> ${t('backup')}</button>
        </div>
        
        <div class="card recent-activity">
            <h3>${t('recent')}</h3>
            <table style="width: 100%; margin-top: 1rem; border-collapse: collapse;">
                <thead><tr style="text-align: left; color: var(--text-dim); border-bottom: 1px solid var(--border);"><th>${t('inventory')}</th><th>${t('type')}</th><th>${t('price')}</th></tr></thead>
                <tbody>
                    ${[...inventory.diamonds, ...inventory.gold].sort((a, b) => b.id - a.id).slice(0, 5).map(item => `
                        <tr><td style="padding: 1rem 0;">${item.carat ? item.carat + 'ct ' + item.type : item.name}</td><td>${item.carat ? t('diamonds') : t('gold')}</td><td class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${item.price.toLocaleString()} EGP</td></tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
}

function renderDiamonds(container) {
    if (!container) return;
    const ranges = getSKURanges('diamonds');
    const activeRange = currentInventoryRanges.diamonds;
    const items = inventory.diamonds.filter(d => {
        const skuNumber = parseInt(d.sku.split('-')[1]);
        const inRange = activeRange === 'All' || (skuNumber >= activeRange.start && skuNumber <= activeRange.end);
        if (!inRange && !currentSearch) return false;
        return d.sku.toLowerCase().includes(currentSearch) || d.type.toLowerCase().includes(currentSearch) || d.carat.toString().includes(currentSearch);
    });

    container.innerHTML = `
        <div class="inventory-controls" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <button onclick="openDiamondModal()">+ ${t('add_diamond')}</button>
            <button class="btn-outline" onclick="exportDiamonds()"><i data-lucide="file-spreadsheet"></i> ${t('export_excel')}</button>
        </div>
        ${ranges.length > 1 ? `<div class="range-tabs">${ranges.map(r => `<button class="range-btn ${activeRange.start === r.start ? 'active' : ''}" onclick='setInventoryRange("diamonds", ${JSON.stringify(r)})'>${r.label}</button>`).join('')}</div>` : ''}
        <div class="grid">
            ${items.map(d => `
                <div class="card item-card">
                    <div class="card-image">${d.image ? `<img src="${d.image}">` : `<div class="image-placeholder"><i data-lucide="diamond"></i></div>`}</div>
                    <div class="card-body">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <span class="sku-tag">${d.sku}</span>
                            <div style="display: flex; gap: 0.6rem;">
                                <i data-lucide="tag" onclick="printTag('diamonds', ${d.id})" class="tag-btn"></i>
                                <i data-lucide="qr-code" onclick="viewQR('diamonds', ${d.id})" class="qr-btn"></i>
                                <i data-lucide="shopping-cart" onclick="openSellModal('diamonds', ${d.id})" class="sell-btn"></i>
                                <i data-lucide="edit-3" onclick="requestEdit('diamonds', ${d.id})" class="edit-btn"></i>
                                <i data-lucide="trash-2" onclick="deleteItem('diamonds', ${d.id})" class="delete-btn"></i>
                            </div>
                        </div>
                        <h4>${d.carat} ${t('carat')} ${d.type}</h4>
                        <p>${d.cut} | ${d.color} | ${d.clarity}</p>
                        <div class="price-tag">${d.price.toLocaleString()} EGP</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
}

function renderGold(container, filter = 'All') {
    if (!container) return;
    const ranges = getSKURanges('gold');
    const activeRange = currentInventoryRanges.gold;
    const items = inventory.gold.filter(g => (filter === 'All' || g.type === filter)).filter(g => {
        const skuNumber = parseInt(g.sku.split('-')[1]);
        const inRange = activeRange === 'All' || (skuNumber >= activeRange.start && skuNumber <= activeRange.end);
        if (!inRange && !currentSearch) return false;
        return g.sku.toLowerCase().includes(currentSearch) || g.name.toLowerCase().includes(currentSearch) || g.type.toLowerCase().includes(currentSearch);
    });

    const types = ['All', 'Chain', 'Necklace', 'Bracelet', 'Ring', 'Earrings'];
    container.innerHTML = `
        <div class="inventory-controls">
            <div class="filter-tabs">${types.map(t => `<button class="filter-btn ${filter === t ? 'active' : ''}" onclick="renderGold(document.getElementById('inventory-list'), '${t}')">${t}</button>`).join('')}</div>
            <div style="display: flex; gap: 1rem;">
                <button class="btn-outline" onclick="exportGold()">Export</button>
                <button onclick="openGoldModal()">+ Add Gold Item</button>
            </div>
        </div>
        ${ranges.length > 1 ? `<div class="range-tabs">${ranges.map(r => `<button class="range-btn ${activeRange.start === r.start ? 'active' : ''}" onclick='setInventoryRange("gold", ${JSON.stringify(r)})'>${r.label}</button>`).join('')}</div>` : ''}
        <div class="grid">
            ${items.map(g => `
                <div class="card item-card">
                    <div class="card-image">${g.image ? `<img src="${g.image}">` : `<div class="image-placeholder"><i data-lucide="${getIconForType(g.type)}"></i></div>`}</div>
                    <div class="card-body">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <span class="sku-tag">${g.sku}</span>
                            <div style="display: flex; gap: 0.6rem;">
                                <i data-lucide="tag" onclick="printTag('gold', ${g.id})" class="tag-btn"></i>
                                <i data-lucide="qr-code" onclick="viewQR('gold', ${g.id})" class="qr-btn"></i>
                                <i data-lucide="shopping-cart" onclick="openSellModal('gold', ${g.id})" class="sell-btn"></i>
                                <i data-lucide="edit-3" onclick="requestEdit('gold', ${g.id})" class="edit-btn"></i>
                                <i data-lucide="trash-2" onclick="deleteItem('gold', ${g.id})" class="delete-btn"></i>
                            </div>
                        </div>
                        <h4>${g.name}</h4>
                        <p>${g.karat} | ${g.weight}g ${g.type}</p>
                        <div class="price-tag">${g.price.toLocaleString()} EGP</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
}

function getIconForType(type) {
    switch (type) {
        case 'Chain': return 'link';
        case 'Necklace': return 'sparkles';
        case 'Bracelet': return 'circle';
        case 'Ring': return 'circle-dot';
        default: return 'coins';
    }
}

function requestEdit(category, id) {
    const pass = prompt(t('enter_pass'));
    if (pass === SYSTEM_PASS) {
        const item = inventory[category].find(i => i.id === id);
        category === 'diamonds' ? openDiamondModal(item) : openGoldModal(item);
    } else if (pass !== null) alert(t('wrong_pass'));
}

function deleteItem(category, id) {
    if (confirm(t('delete_confirm'))) {
        inventory[category] = inventory[category].filter(item => item.id !== id);
        saveToStorage();
        showView(category);
    }
}

function openDiamondModal(editItem = null) {
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="modal"><div class="modal-content card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>${editItem ? t('edit_diamond') : t('add_diamond')}</h2>
                <i data-lucide="x" class="close-btn" onclick="closeModal()"></i>
            </div>
            <form id="diamond-form" onsubmit="saveDiamond(event, ${editItem ? editItem.id : null})">
                <div class="form-grid">
                    <div class="form-group" style="grid-column: span 2;"><label>${t('image')}</label><input type="file" id="d-image" accept="image/*" class="file-input"></div>
                    <div class="form-group"><label>${t('shape')}</label><select id="d-shape" required>${['Round', 'Princess', 'Emerald', 'Asscher', 'Cushion', 'Marquise', 'Oval', 'Pear', 'Radiant', 'Heart'].map(s => `<option ${editItem && editItem.type === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('carat')}</label><input type="number" id="d-carat" step="0.01" value="${editItem ? editItem.carat : ''}" required></div>
                    <div class="form-group"><label>${t('color')}</label><select id="d-color" required>${['D', 'E', 'F', 'G', 'H', 'I', 'J'].map(c => `<option ${editItem && editItem.color === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('clarity')}</label><select id="d-clarity" required>${['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1'].map(cl => `<option ${editItem && editItem.clarity === cl ? 'selected' : ''}>${cl}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('cut')}</label><select id="d-cut" required>${['Excellent', 'Very Good', 'Good', 'Fair'].map(ct => `<option ${editItem && editItem.cut === ct ? 'selected' : ''}>${ct}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('price_egp')}</label><input type="number" id="d-price" value="${editItem ? editItem.price : ''}" required><div id="d-suggested" style="font-size: 0.75rem; color: var(--gold); margin-top: 0.25rem;"></div></div>
                </div>
                <div style="margin-top: 2rem; display: flex; gap: 1rem;"><button type="submit">${editItem ? t('save') : t('add')}</button><button type="button" class="btn-outline" onclick="closeModal()">${t('cancel')}</button></div>
            </form>
        </div></div>
    `;
    lucide.createIcons();
    const updateSuggestion = () => {
        const cost = parseFloat(document.getElementById('d-price').value) || 0;
        document.getElementById('d-suggested').innerText = cost > 0 ? `${t('suggested_price')}: ${getSuggestedPrice('diamond', cost)} EGP` : '';
    };
    document.getElementById('d-price').oninput = updateSuggestion;
    if (editItem) updateSuggestion();
}

function openGoldModal(editItem = null) {
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="modal"><div class="modal-content card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>${editItem ? t('edit_gold') : t('add_gold')}</h2>
                <i data-lucide="x" class="close-btn" onclick="closeModal()"></i>
            </div>
            <form id="gold-form" onsubmit="saveGold(event, ${editItem ? editItem.id : null})">
                <div class="form-grid">
                    <div class="form-group" style="grid-column: span 2;"><label>${t('image')}</label><input type="file" id="g-image" accept="image/*" class="file-input"></div>
                    <div class="form-group"><label>${t('name')}</label><input type="text" id="g-name" value="${editItem ? editItem.name : ''}" required></div>
                    <div class="form-group"><label>${t('type')}</label><select id="g-type" required>${['Chain', 'Necklace', 'Bracelet', 'Ring', 'Earrings', 'Other'].map(tg => `<option ${editItem && editItem.type === tg ? 'selected' : ''} value="${tg}">${t(tg.toLowerCase())}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('karat')}</label><select id="g-karat" required>${['10k', '14k', '18k', '22k', '24k'].map(k => `<option ${editItem && editItem.karat === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('weight_g')}</label><input type="number" id="g-weight" step="0.1" value="${editItem ? editItem.weight : ''}" required></div>
                    <div class="form-group" style="grid-column: span 2;"><label>${t('price_egp')}</label><input type="number" id="g-price" value="${editItem ? editItem.price : ''}" required><div id="g-suggested" style="font-size: 0.75rem; color: var(--gold); margin-top: 0.25rem;"></div></div>
                </div>
                <div style="margin-top: 2rem; display: flex; gap: 1rem;"><button type="submit">${editItem ? t('save') : t('add')}</button><button type="button" class="btn-outline" onclick="closeModal()">${t('cancel')}</button></div>
            </form>
        </div></div>
    `;
    lucide.createIcons();
    const updateSuggestionGold = () => {
        const weight = parseFloat(document.getElementById('g-weight').value) || 0;
        const karat = document.getElementById('g-karat').value;
        document.getElementById('g-suggested').innerText = weight > 0 ? `${t('suggested_price')}: ${getSuggestedPrice('gold', weight, karat)} EGP` : '';
    };
    document.getElementById('g-weight').oninput = updateSuggestionGold;
    document.getElementById('g-karat').onchange = updateSuggestionGold;
    if (editItem) updateSuggestionGold();
}

function openMarketModal() {
    if (prompt(t('enter_pass')) !== SYSTEM_PASS) return alert(t('wrong_pass'));
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="modal"><div class="modal-content card" style="max-width: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;"><h2>${t('update_rates')}</h2><i data-lucide="x" class="close-btn" onclick="closeModal()"></i></div>
            <form onsubmit="saveMarketRates(event)">
                <div class="form-group"><label>${t('price_24k')}</label><input type="number" id="m-24k" value="${marketPrices.base24k}" required></div>
                <div class="form-group" style="margin-top: 1rem;"><label>${t('offset')}</label><input type="number" id="m-offset" value="${marketPrices.offset || 0}" required></div>
                <div style="margin-top: 2rem; display: flex; gap: 1rem;"><button type="submit">${t('save')}</button><button type="button" class="btn-outline" onclick="closeModal()">${t('cancel')}</button></div>
            </form>
        </div></div>
    `;
    lucide.createIcons();
}

function saveMarketRates(event) {
    event.preventDefault();
    marketPrices.base24k = parseFloat(document.getElementById('m-24k').value);
    marketPrices.offset = parseFloat(document.getElementById('m-offset').value);
    localStorage.setItem(MARKET_KEY, JSON.stringify(marketPrices));
    closeModal();
    showView('dashboard');
}

function closeModal() { document.getElementById('modal-container').classList.add('hidden'); }

function saveDiamond(event, editId = null) {
    event.preventDefault();
    const diamond = {
        id: editId || Date.now(),
        sku: editId ? inventory.diamonds.find(i => i.id === editId).sku : generateSKU('diamonds'),
        type: document.getElementById('d-shape').value,
        carat: parseFloat(document.getElementById('d-carat').value),
        color: document.getElementById('d-color').value,
        clarity: document.getElementById('d-clarity').value,
        cut: document.getElementById('d-cut').value,
        price: parseFloat(document.getElementById('d-price').value),
        image: editId ? inventory.diamonds.find(i => i.id === editId).image : null
    };
    const finalize = () => {
        if (!editId && isDuplicate('diamonds', diamond) && !confirm(t('duplicate_warn'))) return;
        editId ? (inventory.diamonds[inventory.diamonds.findIndex(i => i.id === editId)] = diamond) : inventory.diamonds.unshift(diamond);
        saveToStorage(); closeModal(); showView('diamonds');
    };
    const imageInput = document.getElementById('d-image');
    if (imageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { diamond.image = e.target.result; finalize(); };
        reader.readAsDataURL(imageInput.files[0]);
    } else finalize();
}

function saveGold(event, editId = null) {
    event.preventDefault();
    const item = {
        id: editId || Date.now(),
        sku: editId ? inventory.gold.find(i => i.id === editId).sku : generateSKU('gold'),
        name: document.getElementById('g-name').value,
        type: document.getElementById('g-type').value,
        karat: document.getElementById('g-karat').value,
        weight: parseFloat(document.getElementById('g-weight').value),
        price: parseFloat(document.getElementById('g-price').value),
        image: editId ? inventory.gold.find(i => i.id === editId).image : null
    };
    const finalize = () => {
        if (!editId && isDuplicate('gold', item) && !confirm(t('duplicate_warn'))) return;
        editId ? (inventory.gold[inventory.gold.findIndex(i => i.id === editId)] = item) : inventory.gold.unshift(item);
        saveToStorage(); closeModal(); showView('gold');
    };
    const imageInput = document.getElementById('g-image');
    if (imageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { item.image = e.target.result; finalize(); };
        reader.readAsDataURL(imageInput.files[0]);
    } else finalize();
}

function exportDiamonds() { downloadCSV(inventory.diamonds, 'diamonds.csv', ['Type', 'Carat', 'Color', 'Clarity', 'Cut', 'Price']); }
function exportGold() { downloadCSV(inventory.gold, 'gold.csv', ['Name', 'Type', 'Karat', 'Weight', 'Price']); }
function exportAll() { downloadCSV([...inventory.diamonds, ...inventory.gold], 'inventory_backup.csv', ['SKU', 'Type', 'Price']); }

function requestSalesArchive() { if (prompt(t('enter_pass')) === SYSTEM_PASS) showView('sales'); else alert(t('wrong_pass')); }

function openSellModal(category, id) {
    const item = inventory[category].find(i => i.id === id);
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="modal"><div class="modal-content card" style="max-width: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;"><h2>${t('sell_item')}</h2><i data-lucide="x" class="close-btn" onclick="closeModal()"></i></div>
            <form onsubmit="sellItem(event, '${category}', ${id})">
                <div class="form-group"><label>${t('sale_price')}</label><input type="number" id="s-price" value="${item.price}" required></div>
                <div class="form-group" style="margin-top: 1rem;"><label>${t('sale_date')}</label><input type="date" id="s-date" value="${new Date().toISOString().split('T')[0]}" required></div>
                <div style="margin-top: 2rem; display: flex; gap: 1rem;"><button type="submit">${t('confirm_sale')}</button><button type="button" class="btn-outline" onclick="closeModal()">${t('cancel')}</button></div>
            </form>
        </div></div>
    `;
    lucide.createIcons();
}

function sellItem(event, category, id) {
    event.preventDefault();
    const itemIndex = inventory[category].findIndex(i => i.id === id);
    const item = inventory[category][itemIndex];
    inventory.sold.unshift({ ...item, price: parseFloat(document.getElementById('s-price').value), soldDate: document.getElementById('s-date').value, category });
    inventory[category].splice(itemIndex, 1);
    saveToStorage(); closeModal(); showView(category);
    if (confirm(t('download_receipt_prompt'))) generateReceipt(inventory.sold[0]);
}

function viewQR(category, id) {
    const item = inventory[category].find(i => i.id === id);
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `<div class="modal"><div class="modal-content card" style="max-width: 400px; text-align: center;"><div id="qr-output"></div><h3>${item.sku}</h3></div></div>`;
    new QRCode(document.getElementById("qr-output"), { text: item.sku, width: 200, height: 200 });
}

function generateReceipt(item) {
    const doc = new jspdf.jsPDF();
    doc.text("IDAR JEWELRY - RECEIPT", 10, 10);
    doc.text(`SKU: ${item.sku}`, 10, 20);
    doc.text(`Price: ${item.price} EGP`, 10, 30);
    doc.save(`receipt_${item.sku}.pdf`);
}

function renderSales(container) {
    const totalRevenue = inventory.sold.reduce((sum, item) => sum + item.price, 0);
    container.innerHTML = `
        <div class="stats-grid"><div class="card stat-card destaque">
            <div style="display: flex; justify-content: space-between;"><h3>${t('total_sales')}</h3><i data-lucide="${privacyMode_sales ? 'eye-off' : 'eye'}" onclick="togglePrivacy('sales')"></i></div>
            <div class="value ${privacyMode_sales ? 'blurred' : ''}">${totalRevenue.toLocaleString()} EGP</div>
        </div></div>
        <div class="card"><table><thead><tr><th>${t('sku')}</th><th>${t('sale_date')}</th><th>${t('price')}</th></tr></thead><tbody>
            ${inventory.sold.map(item => `<tr><td>${item.sku}</td><td>${item.soldDate}</td><td class="${privacyMode_sales ? 'blurred' : ''}">${item.price.toLocaleString()} EGP</td></tr>`).join('')}
        </tbody></table></div>
    `;
    lucide.createIcons();
}

function printTag(category, id) {
    const item = inventory[category].find(i => i.id === id);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><body><h1>${item.sku}</h1><p>${item.price} EGP</p></body></html>`);
    printWindow.print();
}

function renderWorkshop(container) {
    container.innerHTML = `<button onclick="openRepairModal()">+ ${t('add_job')}</button><div class="workshop-board">` + ['received', 'goldsmith', 'ready', 'delivered'].map(s => `
        <div class="workshop-column"><h3>${t(s)}</h3>${inventory.repairs.filter(j => j.status === s).map(j => `<div class="card job-card" onclick="openRepairModal(${j.id})">${j.customer} - ${j.service}</div>`).join('')}</div>
    `).join('') + `</div>`;
}

function openRepairModal(editId = null) {
    const job = editId ? inventory.repairs.find(j => j.id === editId) : null;
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="modal"><div class="modal-content card">
            <form onsubmit="saveRepair(event, ${editId})">
                <input type="text" id="r-customer" value="${job ? job.customer : ''}" placeholder="Customer" required>
                <input type="text" id="r-service" value="${job ? job.service : ''}" placeholder="Service" required>
                <select id="r-status">${['received', 'goldsmith', 'ready', 'delivered'].map(s => `<option value="${s}" ${job && job.status === s ? 'selected' : ''}>${t(s)}</option>`).join('')}</select>
                <input type="date" id="r-date" value="${job ? job.dueDate : ''}" required>
                <button type="submit">${t('save')}</button>
            </form>
        </div></div>
    `;
}

function saveRepair(event, editId = null) {
    event.preventDefault();
    const job = { id: editId || Date.now(), customer: document.getElementById('r-customer').value, service: document.getElementById('r-service').value, status: document.getElementById('r-status').value, dueDate: document.getElementById('r-date').value };
    editId ? (inventory.repairs[inventory.repairs.findIndex(j => j.id === editId)] = job) : inventory.repairs.unshift(job);
    saveToStorage(); closeModal(); showView('workshop');
}

function togglePrivacy(type) {
    type === 'dashboard' ? (privacyMode_dashboard = !privacyMode_dashboard) : (privacyMode_sales = !privacyMode_sales);
    localStorage.setItem(`privacy_mode_${type}`, JSON.stringify(type === 'dashboard' ? privacyMode_dashboard : privacyMode_sales));
    showView(currentView);
}

// Special JSON Export/Import for Advanced Data Management
function exportJSON() {
    const dataStr = JSON.stringify(inventory, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `idar_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.diamonds && data.gold) {
                    if (confirm(t('confirm_restore'))) {
                        inventory = data;
                        saveToStorage();
                        renderApp();
                    }
                } else throw new Error();
            } catch (err) { alert('Invalid Backup File!'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

function openSettingsModal() {
    if (prompt(t('enter_pass')) !== SYSTEM_PASS) return alert(t('wrong_pass'));
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="modal"><div class="modal-content card" style="max-width: 400px;">
            <h2>${t('settings')}</h2>
            <form onsubmit="saveSettings(event)">
                <label>${t('profit_margin')}</label><input type="number" id="s-margin" value="${appSettings.profitMargin}" required>
                <label>${t('stock_threshold')}</label><input type="number" id="s-threshold" value="${appSettings.stockThreshold}" required>
                <div style="margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                    <h4>Data Management</h4>
                    <button type="button" onclick="exportJSON()" style="width: 100%; margin-bottom: 0.5rem; background: var(--gold); color: #000;">${t('json_backup')}</button>
                    <button type="button" onclick="importJSON()" style="width: 100%; background: #ef4444; color: #fff; border: none;">${t('json_restore')}</button>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;"><button type="submit">${t('save')}</button><button type="button" class="btn-outline" onclick="closeModal()">${t('cancel')}</button></div>
            </form>
        </div></div>
    `;
}

initApp();
