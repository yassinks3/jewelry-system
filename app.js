const STORAGE_KEY = 'jewelry_inventory';
const LANG_KEY = 'jewelry_lang';
const MARKET_KEY = 'jewelry_market_v1';
const SETTINGS_KEY = 'jewelry_settings_v1';
const SHOP_INFO_KEY = 'jewelry_shop_info_v1';
const SYSTEM_PASS = '1981';

// Supabase Configuration
const SUPABASE_URL = 'https://ogynambeenorrlejuvee.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XwA9sF1JnYmKI6SeGnfN_Q_0XQB_aVf';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let inventory = { diamonds: [], gold: [], sold: [], repairs: [], customers: [] };
let currentUser = null;
let userRole = 'junior';
let currentView = 'dashboard';
let currentSearch = '';
let currentLang = localStorage.getItem(LANG_KEY) || 'en';
let dismissedAlerts = JSON.parse(localStorage.getItem('dismissed_alerts')) || [];
let currentInventoryRanges = { diamonds: 'All', gold: 'All' };
let appSettings = { profitMargin: 20, stockThreshold: 2 };
let marketPrices = { base24k: 3000, offset: 0 };
let privacyMode_dashboard = JSON.parse(localStorage.getItem('privacy_mode_dashboard')) || false;
let privacyMode_sales = JSON.parse(localStorage.getItem('privacy_mode_sales')) || false;
let shopInfo = JSON.parse(localStorage.getItem(SHOP_INFO_KEY)) || {
    name: 'Idar Jewelry',
    address: 'Cairo, Egypt',
    phone: '+20 123 456 789'
};
let voidSelectionMode = false;
let selectedVoidIds = new Set();

// Config placeholders (loaded in initApp)
let translations = {};
let initialData = { diamonds: [], gold: [], sold: [], repairs: [], customers: [] };

const t = (key) => {
    if (!translations[currentLang]) return key;
    return translations[currentLang][key] || key;
};

// Initialization Sequence
async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
        lucide.createIcons();
        return;
    }

    currentUser = session.user;

    // Fetch User Role
    try {
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();
        userRole = profile ? profile.role : 'junior';
    } catch (e) {
        userRole = 'junior';
    }

    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    try {
        const response = await fetch('config.json');
        if (response.ok) {
            const config = await response.json();
            translations = config.translations;
            initialData = config.initialData;
        }
    } catch (error) {
        console.warn('External config load failed.');
    } finally {
        // Fetch from Supabase
        try {
            const { data: diamondData } = await supabaseClient.from('diamonds').select('*');
            const { data: goldData } = await supabaseClient.from('gold').select('*');
            const { data: soldData } = await supabaseClient.from('sales').select('*');
            const { data: repairData } = await supabaseClient.from('repairs').select('*');

            inventory = {
                diamonds: diamondData || [],
                gold: goldData || [],
                sold: soldData || [],
                repairs: repairData || []
            };

            if (inventory.diamonds.length === 0 && inventory.gold.length === 0) {
                inventory.diamonds = initialData.diamonds;
                inventory.gold = initialData.gold;
            }
        } catch (dbError) {
            console.error("Supabase fetch failed", dbError);
        }

        setupRealtimeSync();

        appSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { profitMargin: 20, stockThreshold: 2 };
        marketPrices = JSON.parse(localStorage.getItem(MARKET_KEY)) || { base24k: 3000, offset: 0 };

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

    shopInfo = {
        name: document.getElementById('s-shop-name').value,
        address: document.getElementById('s-shop-address').value,
        phone: document.getElementById('s-shop-phone').value
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
    localStorage.setItem(SHOP_INFO_KEY, JSON.stringify(shopInfo));
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
    if (!Sidebar) return;

    Sidebar.innerHTML = `
        <div class="logo">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="gem"></i>
                <span>${currentLang === 'ar' ? 'مجوهرات إيدار' : 'Idar Jewelry'}</span>
            </div>
            <i data-lucide="x" class="sidebar-close" style="display: none;" onclick="toggleSidebar()"></i>
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
            <li id="nav-customers" onclick="showView('customers')">
                <i data-lucide="users"></i> ${t('customers')}
            </li>
            ${userRole === 'admin' ? `
            <li id="nav-settings" onclick="openSettingsModal()">
                <i data-lucide="settings"></i> ${t('settings')}
            </li>
            ` : ''}
        </ul>
        <div class="sidebar-footer">
            ${userRole === 'admin' ? `
            <li id="nav-sales" onclick="requestSalesArchive()" style="list-style: none; margin-bottom: 1rem; color: var(--text-dim); transition: all 0.3s; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                <i data-lucide="archive"></i> ${t('sold_archive')}
            </li>
            ` : ''}
            <button class="lang-toggle" onclick="toggleLanguage()" style="margin-bottom: 1rem;">
                <i data-lucide="languages"></i>
                ${currentLang === 'en' ? 'العربية' : 'English'}
            </button>
            <button class="logout-btn" onclick="handleLogout()">
                <i data-lucide="log-out"></i> ${currentLang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </button>
        </div>
    `;

    // On mobile, close sidebar after clicking a link
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.querySelectorAll('li').forEach(li => {
        const originalClick = li.onclick;
        li.onclick = (e) => {
            if (window.innerWidth <= 768) toggleSidebar();
            if (originalClick) originalClick.call(li, e);
        };
    });

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
        case 'customers': title.innerText = t('customers'); renderCustomers(container); break;
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

        <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
            <div class="card" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0;"><i data-lucide="trending-up" style="width: 18px; margin-right: 0.5rem; vertical-align: middle;"></i> Profit Trends (30 Days)</h3>
                </div>
                <div style="height: 250px;">
                    <canvas id="profitChart"></canvas>
                </div>
            </div>

            <div class="card" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0;"><i data-lucide="line-chart" style="width: 18px; margin-right: 0.5rem; vertical-align: middle;"></i> ${t('market_rates')}</h3>
                </div>
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
                        <span style="color: var(--text-dim);">Au 24k</span>
                        <span style="font-weight: 700; color: var(--gold);" class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${marketPrices.base24k.toLocaleString()} EGP</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
                        <span style="color: var(--text-dim);">Au 22k</span>
                        <span style="font-weight: 700; color: var(--gold);" class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${getKaratPrice('22k').toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-dim);">Au 18k</span>
                        <span style="font-weight: 700; color: var(--gold);" class="privacy-value ${privacyMode_dashboard ? 'blurred' : ''}">${getKaratPrice('18k').toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</span>
                    </div>
                    <button class="btn-outline" style="width: 100%; margin-top: 1rem;" onclick="openMarketModal()">${t('update_rates')}</button>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 2rem; display: flex; gap: 1rem;">
            <button onclick="fetchLivePrices()" class="btn-sync" style="flex: 1;"><i data-lucide="refresh-cw"></i> ${t('sync_live')}</button>
            <a href="https://isagha.com" target="_blank" class="btn-outline" style="flex: 1;"><i data-lucide="external-link"></i> ${t('official_site')}</a>
            ${userRole === 'admin' ? `<button onclick="exportAll()" class="btn-backup" style="flex: 1;"><i data-lucide="download-cloud"></i> ${t('backup')}</button>` : ''}
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
    renderProfitChart();
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
                                ${userRole === 'admin' ? `
                                <i data-lucide="edit-3" onclick="requestEdit('diamonds', ${d.id})" class="edit-btn"></i>
                                <i data-lucide="trash-2" onclick="deleteItem('diamonds', ${d.id})" class="delete-btn"></i>
                                ` : ''}
                            </div>
                        </div>
                        <h4>${d.name || ''} ${d.carat} ${t('carat')} ${d.type}</h4>
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
                                ${userRole === 'admin' ? `
                                <i data-lucide="edit-3" onclick="requestEdit('gold', ${g.id})" class="edit-btn"></i>
                                <i data-lucide="trash-2" onclick="deleteItem('gold', ${g.id})" class="delete-btn"></i>
                                ` : ''}
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
                    <div class="form-group" style="grid-column: span 2;"><label>${t('name')}</label><input type="text" id="d-name" value="${editItem ? editItem.name || '' : ''}" placeholder="Diamond Name"></div>
                    <div class="form-group"><label>${t('shape')}</label><select id="d-shape" required>${['Round', 'Princess', 'Emerald', 'Asscher', 'Cushion', 'Marquise', 'Oval', 'Pear', 'Radiant', 'Heart'].map(s => `<option ${editItem && editItem.type === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('carat')}</label><input type="number" id="d-carat" step="any" value="${editItem ? editItem.carat : ''}" required></div>
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
                    <div class="form-group"><label>${t('weight_g')}</label><input type="number" id="g-weight" step="any" value="${editItem ? editItem.weight : ''}" required></div>
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
        name: document.getElementById('d-name').value,
        type: document.getElementById('d-shape').value,
        carat: parseFloat(document.getElementById('d-carat').value),
        color: document.getElementById('d-color').value,
        clarity: document.getElementById('d-clarity').value,
        cut: document.getElementById('d-cut').value,
        price: parseFloat(document.getElementById('d-price').value),
        image: editId ? inventory.diamonds.find(i => i.id === editId).image : null
    };
    const finalize = async () => {
        if (!editId && isDuplicate('diamonds', diamond) && !confirm(t('duplicate_warn'))) return;

        // Save to Supabase
        const { error } = await supabaseClient.from('diamonds').upsert([diamond]);

        if (error) {
            alert("Error saving to cloud: " + error.message);
            // Fallback to local
            editId ? (inventory.diamonds[inventory.diamonds.findIndex(i => i.id === editId)] = diamond) : inventory.diamonds.unshift(diamond);
            saveToStorage();
        }

        closeModal();
        initApp(); // Refresh from cloud
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
    const finalize = async () => {
        if (!editId && isDuplicate('gold', item) && !confirm(t('duplicate_warn'))) return;

        // Save to Supabase
        const { error } = await supabaseClient.from('gold').upsert([item]);

        if (error) {
            alert("Error saving to cloud: " + error.message);
            // Fallback to local
            editId ? (inventory.gold[inventory.gold.findIndex(i => i.id === editId)] = item) : inventory.gold.unshift(item);
            saveToStorage();
        }

        closeModal();
        initApp(); // Refresh from cloud
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
                <div class="form-group" style="margin-top: 1rem;">
                    <label>${t('select_customer')} (${t('optional')})</label>
                    <select id="s-customer">
                        <option value="">${t('no_customer')}</option>
                        ${inventory.customers.sort((a, b) => a.name.localeCompare(b.name)).map(c => `
                            <option value="${c.id}">${c.name}${c.phone ? ' - ' + c.phone : ''}</option>
                        `).join('')}
                    </select>
                </div>
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
    const customerId = document.getElementById('s-customer')?.value || null;
    const saleData = {
        id: Date.now(),
        sku: item.sku,
        price: parseFloat(document.getElementById('s-price').value),
        sold_date: document.getElementById('s-date').value,
        is_voided: false,
        original_category: category,
        original_data: item,
        customer_id: customerId ? parseInt(customerId) : null
    };

    const finalizeSale = async () => {
        // Save to sales table
        const { error: sError } = await supabaseClient.from('sales').insert([saleData]);
        // Remove from original table
        const { error: dError } = await supabaseClient.from(category).delete().eq('id', id);

        if (sError || dError) {
            alert("Error syncing sale: " + (sError?.message || dError?.message));
            return;
        }

        closeModal();
        initApp();
        if (confirm(t('download_receipt_prompt'))) generateReceipt(saleData);
    };

    finalizeSale();
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

    // Header
    doc.setFontSize(22);
    doc.setTextColor(197, 160, 89); // Gold
    doc.text(shopInfo.name.toUpperCase(), 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(shopInfo.address, 105, 28, { align: 'center' });
    doc.text(`Tel: ${shopInfo.phone}`, 105, 33, { align: 'center' });

    doc.setDrawColor(197, 160, 89);
    doc.line(20, 40, 190, 40);

    // Content
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("SALES RECEIPT", 20, 55);

    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 55);

    doc.setFontSize(14);
    doc.text(`Item Detail:`, 20, 75);
    doc.text(`SKU: ${item.sku}`, 30, 85);
    doc.text(`Type: ${item.type || 'Jewelry'}`, 30, 95);

    doc.setFontSize(18);
    doc.text(`Total Amount: ${item.price.toLocaleString()} EGP`, 20, 120);

    doc.setFontSize(10);
    doc.text("Thank you for your business!", 105, 200, { align: 'center' });

    doc.save(`receipt_${item.sku}.pdf`);
}

function renderSales(container) {
    const activeSales = inventory.sold.filter(s => !s.is_voided);
    const totalRevenue = activeSales.reduce((sum, item) => sum + item.price, 0);
    const selectedCount = selectedVoidIds.size;

    container.innerHTML = `
        <div class="stats-grid"><div class="card stat-card destaque">
            <div style="display: flex; justify-content: space-between;"><h3>${t('total_sales')}</h3><i data-lucide="${privacyMode_sales ? 'eye-off' : 'eye'}" onclick="togglePrivacy('sales')"></i></div>
            <div class="value ${privacyMode_sales ? 'blurred' : ''}">${totalRevenue.toLocaleString()} EGP</div>
        </div></div>
        
        ${userRole === 'admin' ? `
        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; align-items: center;">
            ${!voidSelectionMode ? `
                <button class="btn-outline" onclick="toggleVoidMode()" style="background: rgba(239, 68, 68, 0.1); border-color: #ef4444; color: #ef4444;">
                    <i data-lucide="check-square" style="width: 16px; height: 16px;"></i> Enable Void Mode
                </button>
            ` : `
                <button class="btn-outline" onclick="toggleVoidMode()" style="background: rgba(100, 100, 100, 0.2);">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i> Cancel
                </button>
                <button class="btn-outline" onclick="confirmBulkVoid()" style="background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #ef4444;" ${selectedCount === 0 ? 'disabled' : ''}>
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i> Void Selected (${selectedCount})
                </button>
                <span style="color: var(--gold); font-weight: 600; font-size: 0.9rem;">
                    ${selectedCount} item${selectedCount !== 1 ? 's' : ''} selected
                </span>
            `}
        </div>
        ` : ''}
        
        <div class="card"><table><thead><tr>
            ${voidSelectionMode ? '<th style="width: 50px;"></th>' : ''}
            <th>${t('sku')}</th><th>${t('sale_date')}</th><th>${t('price')}</th>
            ${!voidSelectionMode ? '<th>Actions</th>' : ''}
        </tr></thead><tbody>
            ${inventory.sold.sort((a, b) => b.id - a.id).map(item => `
                <tr style="${item.is_voided ? 'opacity: 0.5; text-decoration: line-through; background: rgba(239, 68, 68, 0.05);' : ''}">
                    ${voidSelectionMode && !item.is_voided ? `
                    <td>
                        <input type="checkbox" 
                               ${selectedVoidIds.has(item.id) ? 'checked' : ''}
                               onchange="toggleVoidSelection(${item.id})"
                               style="width: 18px; height: 18px; cursor: pointer;">
                    </td>
                    ` : (voidSelectionMode ? '<td></td>' : '')}
                    <td>${item.sku} ${item.is_voided ? '<span style="color: #ef4444; text-decoration: none; font-size: 0.7rem; font-weight: bold; margin-left: 0.5rem;">[VOIDED]</span>' : ''}</td>
                    <td>${item.sold_date || item.soldDate}</td>
                    <td class="${privacyMode_sales ? 'blurred' : ''}">${item.price.toLocaleString()} EGP</td>
                    ${!voidSelectionMode ? `
                    <td style="display: flex; gap: 0.5rem;">
                        <button class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="downloadArchiveReceipt('${item.sku}')">
                            <i data-lucide="download" style="width: 12px; height: 12px;"></i> Receipt
                        </button>
                    </td>
                    ` : ''}
                </tr>`).join('')}
        </tbody></table></div>
    `;
    lucide.createIcons();
}

function downloadArchiveReceipt(sku) {
    const item = inventory.sold.find(s => s.sku === sku);
    if (item) generateReceipt(item);
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

async function saveRepair(event, editId = null) {
    event.preventDefault();
    const job = {
        id: editId || undefined, // Supabase will generate if null
        customer: document.getElementById('r-customer').value,
        service: document.getElementById('r-service').value,
        status: document.getElementById('r-status').value,
        due_date: document.getElementById('r-date').value
    };

    const { error } = await supabaseClient.from('repairs').upsert([job]);

    if (error) {
        alert("Error saving job: " + error.message);
        return;
    }

    closeModal();
    initApp();
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
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="modal"><div class="modal-content card" style="max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>${t('settings')}</h2>
                <i data-lucide="x" class="close-btn" onclick="closeModal()"></i>
            </div>
            <form onsubmit="saveSettings(event)">
                <h4 style="margin-bottom: 1rem; color: var(--gold); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Business Logic</h4>
                <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div class="form-group"><label>${t('profit_margin')}</label><input type="number" id="s-margin" value="${appSettings.profitMargin}" required></div>
                    <div class="form-group"><label>${t('stock_threshold')}</label><input type="number" id="s-threshold" value="${appSettings.stockThreshold}" required></div>
                </div>

                <h4 style="margin-bottom: 1rem; color: var(--gold); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Shop Details (for Receipts)</h4>
                <div class="form-group" style="margin-bottom: 1rem;"><label>Shop Name</label><input type="text" id="s-shop-name" value="${shopInfo.name}" required></div>
                <div class="form-group" style="margin-bottom: 1rem;"><label>Address</label><input type="text" id="s-shop-address" value="${shopInfo.address}" required></div>
                <div class="form-group" style="margin-bottom: 2rem;"><label>Phone Number</label><input type="text" id="s-shop-phone" value="${shopInfo.phone}" required></div>

                <div style="display: flex; gap: 1rem;"><button type="submit">${t('save')}</button><button type="button" class="btn-outline" onclick="closeModal()">Cancel</button></div>
            </form>
        </div></div>
    `;
    lucide.createIcons();
}

// Mobile Sidebar Logic
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    let overlay = document.querySelector('.sidebar-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Real-time Sync Logic
function setupRealtimeSync() {
    supabaseClient
        .channel('any')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
            console.log("Change detected in cloud! Refreshing...");
            refreshDataOnly();
        })
        .subscribe();
}

async function refreshDataOnly() {
    try {
        const { data: d } = await supabaseClient.from('diamonds').select('*');
        const { data: g } = await supabaseClient.from('gold').select('*');
        const { data: s } = await supabaseClient.from('sales').select('*');
        const { data: r } = await supabaseClient.from('repairs').select('*');
        const { data: c } = await supabaseClient.from('customers').select('*');

        inventory.diamonds = d || [];
        inventory.gold = g || [];
        inventory.sold = s || [];
        inventory.customers = c || [];
        inventory.repairs = r || [];

        showView(currentView); // Rerender current view
    } catch (e) {
        console.error("Real-time refresh failed", e);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "Signing In...";
    errorDiv.innerText = "";

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        initApp();
    } catch (error) {
        errorDiv.innerText = error.message;
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function handleLogout() {
    if (!confirm("Confirm Logout?")) return;
    await supabaseClient.auth.signOut();
    location.reload();
}

initApp();

function renderProfitChart() {
    const ctx = document.getElementById('profitChart');
    if (!ctx) return;

    // Last 30 days labels
    const labels = [];
    const data = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' }));

        const dailySales = inventory.sold.filter(s => !s.is_voided && (s.sold_date || s.soldDate) === dateStr);
        const dayProfit = dailySales.reduce((sum, s) => {
            const cost = s.originalPrice || (s.price / (1 + (appSettings.profitMargin / 100)));
            return sum + (s.price - cost);
        }, 0);
        data.push(Math.round(dayProfit));
    }

    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: currentLang === 'ar' ? 'الأرباح (ج.م)' : 'Profit (EGP)',
                data,
                borderColor: '#c5a059',
                backgroundColor: 'rgba(197, 160, 89, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#c5a059',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.5)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', maxRotation: 45, minRotation: 45 }
                }
            }
        }
    });
}

async function voidSale(saleId) {
    if (!confirm("Void this sale and return item to inventory?")) return;

    const sale = inventory.sold.find(s => s.id === saleId);
    if (!sale) return;

    try {
        // 1. Mark sale as voided in Supabase
        const { error: vError } = await supabaseClient
            .from('sales')
            .update({ is_voided: true })
            .eq('id', saleId);

        if (vError) throw vError;

        // 2. Restock item into original category
        if (sale.original_data && sale.original_category) {
            const { error: rError } = await supabaseClient
                .from(sale.original_category)
                .insert([sale.original_data]);

            if (rError) throw rError;
        }

        alert("Sale voided and item restocked!");
        initApp(); // Refresh everything
    } catch (e) {
        console.error("Void failed", e);
        alert("Void failed: " + e.message);
    }
}

function renderCustomers(container) {
    const searchTerm = currentSearch.toLowerCase();
    const filteredCustomers = inventory.customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.email && c.email.toLowerCase().includes(searchTerm))
    );

    // Calculate stats for each customer
    const customerStats = filteredCustomers.map(customer => {
        const purchases = inventory.sold.filter(s => s.customer_id === customer.id);
        const totalSpent = purchases.reduce((sum, s) => sum + (s.is_voided ? 0 : s.price), 0);
        const lastPurchase = purchases.length > 0
            ? purchases.sort((a, b) => new Date(b.sold_date) - new Date(a.sold_date))[0].sold_date
            : null;

        return {
            ...customer,
            totalPurchases: purchases.length,
            totalSpent,
            lastPurchase
        };
    });

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div class="search-bar" style="max-width: 400px; margin: 0;">
                <i data-lucide="search"></i>
                <input type="text" id="customer-search" placeholder="${t('search')} ${t('customers')}..." 
                       value="${currentSearch}" 
                       oninput="currentSearch = this.value; showView('customers')">
            </div>
            <button onclick="openCustomerModal()" style="display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="user-plus" style="width: 18px; height: 18px;"></i>
                ${t('add_customer')}
            </button>
        </div>

        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>${t('customer_name')}</th>
                        <th>${t('customer_phone')}</th>
                        <th>${t('customer_email')}</th>
                        <th>${t('total_purchases')}</th>
                        <th>${t('lifetime_value')}</th>
                        <th>${t('last_purchase')}</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${customerStats.length === 0 ? `
                        <tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-dim);">
                            ${t('no_items')}
                        </td></tr>
                    ` : customerStats.map(c => `
                        <tr onclick="viewCustomerDetail(${c.id})" style="cursor: pointer;">
                            <td><strong>${c.name}</strong></td>
                            <td>${c.phone || '-'}</td>
                            <td>${c.email || '-'}</td>
                            <td>${c.totalPurchases}</td>
                            <td class="${privacyMode_dashboard ? 'blurred' : ''}">${c.totalSpent.toLocaleString()} EGP</td>
                            <td>${c.lastPurchase || '-'}</td>
                            <td onclick="event.stopPropagation()">
                                <button class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                                        onclick="openCustomerModal(${c.id})">
                                    <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i> Edit
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
}

function openCustomerModal(customerId = null) {
    const customer = customerId ? inventory.customers.find(c => c.id === customerId) : null;
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');

    modal.innerHTML = `
        <div class="modal">
            <div class="modal-content card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>${customer ? t('edit') : t('add_customer')}</h2>
                    <i data-lucide="x" class="close-btn" onclick="closeModal()"></i>
                </div>
                <form onsubmit="saveCustomer(event, ${customerId})">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${t('customer_name')} *</label>
                            <input type="text" id="c-name" value="${customer?.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>${t('customer_phone')}</label>
                            <input type="tel" id="c-phone" value="${customer?.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label>${t('customer_email')}</label>
                            <input type="email" id="c-email" value="${customer?.email || ''}">
                        </div>
                        <div class="form-group">
                            <label>${t('customer_address')}</label>
                            <input type="text" id="c-address" value="${customer?.address || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>${t('customer_notes')}</label>
                        <textarea id="c-notes" rows="3">${customer?.notes || ''}</textarea>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="submit">${t('save')}</button>
                        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    lucide.createIcons();
}

async function saveCustomer(event, customerId) {
    event.preventDefault();

    const customerData = {
        name: document.getElementById('c-name').value,
        phone: document.getElementById('c-phone').value,
        email: document.getElementById('c-email').value,
        address: document.getElementById('c-address').value,
        notes: document.getElementById('c-notes').value,
        user_id: currentUser.id
    };

    try {
        if (customerId) {
            const { error } = await supabaseClient
                .from('customers')
                .update(customerData)
                .eq('id', customerId);
            if (error) throw error;
        } else {
            customerData.id = Date.now();
            customerData.created_date = new Date().toISOString().split('T')[0];
            const { error } = await supabaseClient
                .from('customers')
                .insert([customerData]);
            if (error) throw error;
        }

        closeModal();
        initApp();
    } catch (error) {
        alert("Error saving customer: " + error.message);
    }
}

function viewCustomerDetail(customerId) {
    const customer = inventory.customers.find(c => c.id === customerId);
    if (!customer) return;

    const purchases = inventory.sold.filter(s => s.customer_id === customerId);
    const totalSpent = purchases.reduce((sum, s) => sum + (s.is_voided ? 0 : s.price), 0);

    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');

    modal.innerHTML = `
        <div class="modal">
            <div class="modal-content card" style="max-width: 800px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2><i data-lucide="user" style="width: 24px; vertical-align: middle;"></i> ${customer.name}</h2>
                    <i data-lucide="x" class="close-btn" onclick="closeModal()"></i>
                </div>

                <div class="stats-grid" style="margin-bottom: 2rem;">
                    <div class="card" style="background: rgba(197, 160, 89, 0.1);">
                        <h4 style="margin: 0; font-size: 0.85rem; color: var(--text-dim);">${t('total_purchases')}</h4>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--gold); margin-top: 0.5rem;">${purchases.length}</div>
                    </div>
                    <div class="card" style="background: rgba(197, 160, 89, 0.1);">
                        <h4 style="margin: 0; font-size: 0.85rem; color: var(--text-dim);">${t('lifetime_value')}</h4>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--gold); margin-top: 0.5rem;" class="${privacyMode_dashboard ? 'blurred' : ''}">${totalSpent.toLocaleString()} EGP</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div><strong>${t('customer_phone')}:</strong> ${customer.phone || '-'}</div>
                    <div><strong>${t('customer_email')}:</strong> ${customer.email || '-'}</div>
                    <div style="grid-column: 1 / -1;"><strong>${t('customer_address')}:</strong> ${customer.address || '-'}</div>
                    ${customer.notes ? `<div style="grid-column: 1 / -1;"><strong>${t('customer_notes')}:</strong> ${customer.notes}</div>` : ''}
                </div>

                <h3 style="margin-bottom: 1rem;">${t('purchase_history')}</h3>
                ${purchases.length === 0 ? `
                    <p style="color: var(--text-dim); text-align: center; padding: 2rem;">${t('no_items')}</p>
                ` : `
                    <table>
                        <thead>
                            <tr>
                                <th>${t('sku')}</th>
                                <th>${t('sale_date')}</th>
                                <th>${t('price')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${purchases.sort((a, b) => new Date(b.sold_date) - new Date(a.sold_date)).map(p => `
                                <tr style="${p.is_voided ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
                                    <td>${p.sku} ${p.is_voided ? '<span style="color: #ef4444; font-size: 0.7rem;">[VOIDED]</span>' : ''}</td>
                                    <td>${p.sold_date}</td>
                                    <td class="${privacyMode_sales ? 'blurred' : ''}">${p.price.toLocaleString()} EGP</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button onclick="openCustomerModal(${customerId})">
                        <i data-lucide="edit-2" style="width: 16px; vertical-align: middle;"></i> ${t('edit')}
                    </button>
                    <button class="btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function toggleVoidMode() {
    voidSelectionMode = !voidSelectionMode;
    selectedVoidIds.clear();
    showView('sales');
}

function toggleVoidSelection(saleId) {
    if (selectedVoidIds.has(saleId)) {
        selectedVoidIds.delete(saleId);
    } else {
        selectedVoidIds.add(saleId);
    }
    showView('sales');
}

async function confirmBulkVoid() {
    const count = selectedVoidIds.size;
    if (count === 0) return;

    if (!confirm(`Void ${count} sale${count !== 1 ? 's' : ''} and return item${count !== 1 ? 's' : ''} to inventory?`)) return;

    try {
        for (const saleId of selectedVoidIds) {
            const sale = inventory.sold.find(s => s.id === saleId);
            if (!sale) continue;

            const { error: vError } = await supabaseClient
                .from('sales')
                .update({ is_voided: true })
                .eq('id', saleId);

            if (vError) throw vError;

            if (sale.original_data && sale.original_category) {
                const { error: rError } = await supabaseClient
                    .from(sale.original_category)
                    .insert([sale.original_data]);

                if (rError) throw rError;
            }
        }

        alert(`Successfully voided ${count} sale${count !== 1 ? 's' : ''} and restocked item${count !== 1 ? 's' : ''}!`);
        voidSelectionMode = false;
        selectedVoidIds.clear();
        initApp();
    } catch (e) {
        console.error("Bulk void failed", e);
        alert("Bulk void failed: " + e.message);
    }
}
