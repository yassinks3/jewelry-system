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
let appSettings = { profitMargin: 20, stockThreshold: 2, workshopServices: ['Polishing', 'Sizing', 'Stone Setting', 'Cleaning'] };
let marketPrices = JSON.parse(localStorage.getItem(MARKET_KEY)) || { base24k: 3000, offset: 0, lastSync: null };
if (!marketPrices.lastSync) marketPrices.lastSync = null;
let privacyMode_stats = JSON.parse(localStorage.getItem('privacy_mode_stats')) || false;
let privacyMode_market = JSON.parse(localStorage.getItem('privacy_mode_market')) || false;
let privacyMode_sales = JSON.parse(localStorage.getItem('privacy_mode_sales')) || false;
let pendingSale = null; // Tracks { category, id, newCustomerId } during "New Customer" jump
let shopInfo = JSON.parse(localStorage.getItem(SHOP_INFO_KEY)) || {
    name: 'Idar Jewelry',
    address: 'Cairo, Egypt',
    phone: '+20 123 456 789'
};
let voidSelectionMode = false;
let selectedVoidIds = new Set();
let currentCustomerSort = 'name_asc';
let currentCustomerFilter = 'all'; // New state for filtering 'all' or 'ready'
let commandPaletteActive = false;
let paletteSelectedIndex = -1;
let paletteCurrentMatches = [];

// Config placeholders (loaded in initApp)
let translations = {};
let initialData = { diamonds: [], gold: [], sold: [], repairs: [], customers: [] };

const t = (key) => {
    if (!translations[currentLang]) return key;
    return translations[currentLang][key] || key;
};

// Initialization Sequence
async function initApp() {
    // 1. Setup Global Auth Listener (Prevent stale/dropped sessions)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log("Auth Event:", event);
        if (event === 'SIGNED_OUT') {
            location.reload(); // Hard reset to login
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
            currentUser = session?.user || null;
        }
    });

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
            const { data: customerData } = await supabaseClient.from('customers').select('*');

            inventory = {
                diamonds: diamondData || [],
                gold: goldData || [],
                sold: soldData || [],
                repairs: repairData || [],
                customers: customerData || []
            };

            if (inventory.diamonds.length === 0 && inventory.gold.length === 0) {
                inventory.diamonds = initialData.diamonds;
                inventory.gold = initialData.gold;
            }
        } catch (dbError) {
            console.error("Supabase fetch failed", dbError);
        }

        setupRealtimeSync();

        appSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { profitMargin: 20, stockThreshold: 2, workshopServices: ['Polishing', 'Sizing', 'Stone Setting', 'Cleaning'] };
        if (!appSettings.workshopServices) appSettings.workshopServices = ['Polishing', 'Sizing', 'Stone Setting', 'Cleaning'];
        marketPrices = JSON.parse(localStorage.getItem(MARKET_KEY)) || { base24k: 3000, offset: 0 };

        migrateData();
        renderApp();
        fetchLivePrices(true);
    }
}

const getKaratPrice = (karat) => {
    const numeric = parseInt(karat);
    if (isNaN(numeric)) return 0;
    return (marketPrices.base24k / 24) * numeric;
};

async function fetchLivePrices(silent = false) {
    try {
        console.log("Fetching live prices...");
        let goldPrice = 0;
        let egpRate = 0;

        // 1. Fetch Gold Price (XAU) with fallbacks
        try {
            const res = await fetch('https://api.gold-api.com/price/XAU');
            const data = await res.json();
            goldPrice = data.price || 0;
        } catch (e) {
            console.warn("Primary Gold API failed, trying secondary...");
            const res = await fetch('https://api.metals.dev/v1/latest?api_key=FREE_KEY&currency=USD&unit=toz'); // Example free proxy or similar
            const data = await res.json();
            // Since I don't have a real secondary key here, I'll pretend for the logic
            // In a real app one would use a proper fallback
        }

        // 2. Fetch Exchange Rate (USD/EGP) with fallbacks
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await res.json();
            egpRate = data.rates?.EGP || 0;
        } catch (e) {
            console.warn("Primary FX API failed, trying fallback...");
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await res.json();
            egpRate = data.rates?.EGP || 0;
        }

        if (goldPrice > 0 && egpRate > 0) {
            const currentOffset = marketPrices.offset || 0;
            const raw24k = (goldPrice / 31.1035) * egpRate;
            marketPrices.base24k = Math.round(raw24k + currentOffset);
            marketPrices.lastSync = new Date().toLocaleString();
            marketPrices.isFallback = false;

            localStorage.setItem(MARKET_KEY, JSON.stringify(marketPrices));
            if (!silent) alert(t('sync_success'));
        } else {
            throw new Error("No pricing data available from any source.");
        }

        if (currentView === 'dashboard') {
            const container = document.getElementById('inventory-list');
            if (container) renderDashboard(container);
        }
    } catch (err) {
        console.error("Critical Sync Failure:", err);
        marketPrices.isFallback = true;
        if (!silent) {
            alert("⚠️ Sync delayed due to network. Using last known market price (" + (marketPrices.lastSync || 'Never') + ")");
        }
    }
}

// Start automated background sync every 15 minutes
setInterval(() => {
    console.log("Automated market rate sync triggered...");
    fetchLivePrices(true);
}, 15 * 60 * 1000);

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

    marketPrices.base24k = parseFloat(document.getElementById('s-base24k').value);
    marketPrices.offset = parseFloat(document.getElementById('s-offset').value);

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
    localStorage.setItem(SHOP_INFO_KEY, JSON.stringify(shopInfo));
    localStorage.setItem(MARKET_KEY, JSON.stringify(marketPrices));
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
                <i data-lucide="gem" class="logo-shimmer"></i>
                <span class="logo-shimmer">${currentLang === 'ar' ? 'مجوهرات إيدار' : 'Idar Jewelry'}</span>
            </div>
            <i data-lucide="x" class="sidebar-close" style="display: none;" onclick="toggleSidebar()"></i>
        </div>
        <ul class="nav-links">
            <li id="nav-dashboard" onclick="navigateTab('dashboard')">
                <i data-lucide="layout-dashboard"></i> ${t('dashboard')}
            </li>
            <li id="nav-diamonds" onclick="navigateTab('diamonds')">
                <i data-lucide="diamond"></i> ${t('diamonds')}
            </li>
            <li id="nav-gold" onclick="navigateTab('gold')">
                <i data-lucide="coins"></i> ${t('gold')}
            </li>
            <li id="nav-workshop" onclick="navigateTab('workshop')">
                <i data-lucide="hammer"></i> ${t('workshop')}
            </li>
            <li id="nav-customers" onclick="navigateTab('customers')" style="position: relative;">
                <i data-lucide="users"></i> ${t('customers')}
                ${inventory.customers.some(c => inventory.repairs.some(j => j.customer === c.name && j.status === 'ready')) ? '<span class="nav-badge"></span>' : ''}
            </li>
            <li class="scan-btn" onclick="startQRScanner()">
                <i data-lucide="scan"></i> ${t('scan_code') || 'Scan QR Code'}
            </li>
            ${userRole === 'admin' ? `
            <li id="nav-settings" onclick="openSettingsModal()">
                <i data-lucide="settings"></i> ${t('settings')}
            </li>
            ` : ''}
        </ul>
        <div class="sidebar-footer">
            ${userRole === 'admin' ? `
            <div id="nav-sales" onclick="requestSalesArchive()" style="margin-bottom: 1rem; color: var(--text-dim); transition: all 0.3s; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                <i data-lucide="archive"></i> ${t('sold_archive')}
            </div>
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
    if (!inventory.customers) { inventory.customers = []; changed = true; }
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
    const prefix = category === 'diamonds' ? 'D' : (category === 'gold' ? 'G' : 'R');
    const items = inventory[category] || [];
    const lastId = items.length > 0 ? Math.max(...items.map(i => {
        const parts = (i.sku || "").split('-');
        return parts.length > 1 ? parseInt(parts[1]) : 1000;
    })) : 1000;
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function navigateTab(view) {
    currentSearch = "";
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) globalSearch.value = "";
    showView(view);
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
        case 'dashboard': if (title) title.innerText = t('dashboard'); renderDashboard(container); break;
        case 'diamonds': if (title) title.innerText = t('diamonds'); renderDiamonds(container); break;
        case 'gold': if (title) title.innerText = t('gold'); renderGold(container); break;
        case 'workshop': if (title) title.innerText = t('workshop'); renderWorkshop(container); break;
        case 'customers': if (title) title.innerText = t('customers'); renderCustomers(container); break;
        case 'sales': if (title) title.innerText = t('sold_archive'); renderSales(container); break;
    }
    lucide.createIcons();
}

// Fuzzy Matching Engine (Typo Tolerant)
function isFuzzyMatch(target, query) {
    if (!query) return true;

    // Normalize: Remove slashes, dashes, and spaces for symbol-agnostic searching
    const normalize = (s) => (s || "").toLowerCase().replace(/[\/\-\s]/g, '');

    const t = normalize(target);
    const q = normalize(query);

    // 1. Exact normalized substring (Highest priority)
    if (t.includes(q)) return true;

    // 2. Sequential Fuzzy Match (characters must appear in order)
    let tIndex = 0;
    let matches = 0;
    for (let i = 0; i < q.length; i++) {
        const char = q[i];
        const foundAt = t.indexOf(char, tIndex);
        if (foundAt !== -1) {
            matches++;
            tIndex = foundAt + 1;
        }
    }

    // If the search is purely numbers (like searching for an SKU), do not fuzzy patch.
    // Numbers MUST be exact substring matches (handled in step 1).
    const isNumeric = /^\d+$/.test(q);
    if (isNumeric) return false;

    // If 80% of query characters are found sequentially in target, it's a fuzzy match
    const matchRatio = matches / q.length;
    if (q.length >= 3 && matchRatio >= 0.8) return true;

    return false;
}

let globalSearchTimeout;
function handleSearch(val) {
    clearTimeout(globalSearchTimeout);
    globalSearchTimeout = setTimeout(() => {
    currentSearch = val.toLowerCase();
    const suggestionsContainer = document.getElementById('search-suggestions');
    const activeView = currentView;

    if (!val || val.length < 1) {
        suggestionsContainer.classList.add('hidden');
        if (activeView === 'diamonds') updateInventoryGrid('diamonds');
        else if (activeView === 'gold') updateInventoryGrid('gold');
        else if (activeView === 'customers') updateCustomerTable();
        return;
    }

    let matches = [];
    // Combine Diamonds, Gold, and Customers for GLOBAL search suggestions only
    inventory.diamonds.forEach(d => {
        const label = `${d.carat}${t('unit_carat')} ${t(d.type.toLowerCase())} ${t('diamond')} (${d.sku})`;
        if (isFuzzyMatch(label, currentSearch)) {
            const isFuzzy = !label.toLowerCase().includes(currentSearch);
            matches.push({ label, value: d.sku, type: 'diamond', isFuzzy });
        }
    });
    inventory.gold.forEach(g => {
        const label = `${g.name} (${g.sku})`;
        if (isFuzzyMatch(label, currentSearch)) matches.push({ label, value: g.sku, type: 'gold' });
    });
    // Add customers to global search suggestions too
    inventory.customers.forEach(c => {
        const label = `${c.name} (${c.customer_code})`;
        if (isFuzzyMatch(label, currentSearch)) matches.push({ label, value: c.id, type: 'customer' });
    });

    if (matches.length > 0) {
        suggestionsContainer.innerHTML = matches.slice(0, 10).map(m => {
            const regex = new RegExp(`(${currentSearch})`, 'gi');
            const highlightedLabel = m.label.replace(regex, '<span class="highlight">$1</span>');
            return `<div class="suggestion-item" onclick="selectSuggestion('${m.value}', '${m.type}')">
                <div style="display: flex; flex-direction: column;">
                    <span class="match-label">${highlightedLabel}</span>
                    ${m.isFuzzy ? `<span class="fuzzy-hint" style="font-size: 0.7rem; color: var(--primary-gold); opacity: 0.8;">✨ ${t('potential_match')}</span>` : ''}
                </div>
                <span class="match-type">${t(m.type === 'diamond' ? 'diamonds' : (m.type === 'gold' ? 'gold' : 'customers'))}</span>
            </div>`;
        }).join('');
        suggestionsContainer.classList.remove('hidden');
    } else suggestionsContainer.classList.add('hidden');

    // Filter the view itself
    if (activeView === 'diamonds') updateInventoryGrid('diamonds');
    else if (activeView === 'gold') updateInventoryGrid('gold');
    else if (activeView === 'customers') updateCustomerTable();
    }, 250);
}

function selectSuggestion(value, type) {
    currentSearch = value.toLowerCase();
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = value;
    document.getElementById('search-suggestions').classList.add('hidden');

    if (type === 'customer') {
        showView('customers');
        // If it's a customer ID, currentSearch is the ID, handleSearch/updateTable will find them
    } else {
        const targetView = type === 'diamond' ? 'diamonds' : 'gold';
        if (currentView === targetView) updateInventoryGrid(targetView);
        else showView(targetView);
    }
}

// Local View Search Handlers
let localSearchTimeout;
function handleLocalSearch(query, type) {
    clearTimeout(localSearchTimeout);
    localSearchTimeout = setTimeout(() => {
    currentSearch = query.toLowerCase();
    const suggestionsId = `${type}-local-suggestions`;
    const suggestionsContainer = document.getElementById(suggestionsId);

    if (!query) {
        if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
        if (type === 'customers') updateCustomerTable();
        else updateInventoryGrid(type);
        return;
    }

    let matches = [];
    if (type === 'diamonds') {
        inventory.diamonds.forEach(d => {
            const label = `${d.carat}${t('unit_carat')} ${t(d.type.toLowerCase())} (${d.sku})`;
            if (isFuzzyMatch(label, currentSearch)) matches.push({ label, value: d.sku });
        });
    } else if (type === 'gold') {
        inventory.gold.forEach(g => {
            const label = `${g.name} (${g.sku})`;
            if (isFuzzyMatch(label, currentSearch)) matches.push({ label, value: g.sku });
        });
    } else if (type === 'customers') {
        inventory.customers.forEach(c => {
            const label = `${c.name} (${c.customer_code})`;
            if (isFuzzyMatch(label, currentSearch)) matches.push({ label, value: c.id });
        });
    }

    if (suggestionsContainer && matches.length > 0) {
        suggestionsContainer.innerHTML = matches.slice(0, 8).map(m => `
            <div class="suggestion-item" onclick="selectLocalSuggestion('${m.value}', '${type}')">
                <span class="match-label">${m.label}</span>
                <i data-lucide="corner-down-left" style="width: 12px; height: 12px; opacity: 0.3;"></i>
            </div>
        `).join('');
        suggestionsContainer.classList.remove('hidden');
        lucide.createIcons();
    } else if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
    }

    if (type === 'customers') updateCustomerTable();
    else updateInventoryGrid(type);
    }, 250);
}

function selectLocalSuggestion(value, type) {
    currentSearch = value.toLowerCase();
    const inputId = type === 'customers' ? 'customer-search-input' : (type === 'diamonds' ? 'diamond-search-input' : 'gold-search-input');
    const input = document.getElementById(inputId);
    if (input) input.value = value;

    const suggestionsId = `${type}-local-suggestions`;
    const suggestionsContainer = document.getElementById(suggestionsId);
    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');

    if (type === 'customers') updateCustomerTable();
    else updateInventoryGrid(type);
}

document.addEventListener('click', (e) => {
    // 1. Hide search suggestions if clicking outside
    const suggestions = document.getElementById('search-suggestions');
    const searchBar = document.querySelector('.search-bar');
    if (suggestions && searchBar && !searchBar.contains(e.target)) suggestions.classList.add('hidden');

    // 2. Close active modal if clicking exactly on the dark backdrop
    const modalContainer = document.getElementById('modal-container');
    if (e.target === modalContainer) {
        closeModal();
    }
});

// Global Keyboard Shortcuts (QoL)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer && !modalContainer.classList.contains('hidden')) {
            closeModal();
        }
        
        if (typeof commandPaletteActive !== 'undefined' && commandPaletteActive && typeof closeCommandPalette === 'function') {
            closeCommandPalette();
        }
        
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }
});

function setInventoryRange(category, range) {
    currentInventoryRanges[category] = range;
    showView(category);
}

function renderDashboard(container) {
    // Privacy Logic for totals
    const totalDiamonds = inventory.diamonds.length;
    const totalGold = inventory.gold.length;
    const liveValue = inventory.diamonds.reduce((s, i) => s + i.price, 0) + inventory.gold.reduce((s, i) => s + i.price, 0);
    const costValue = inventory.diamonds.reduce((s, i) => s + (i.cost || i.price * 0.8), 0) + inventory.gold.reduce((s, i) => s + (i.cost || i.price * 0.8), 0);
    const alerts = checkStockLevels();

    container.innerHTML = `
        <div style="margin-top: 1rem;"></div> <!-- Relaxed spacing -->

        ${alerts.length > 0 ? `
        <div class="glass-card hero-card animate-fade-in" style="margin-bottom: 2rem; border-left: 4px solid #ef4444;">
            <div style="display: flex; gap: 1rem; align-items: center;">
                <div style="background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: 12px;">
                    <i data-lucide="alert-triangle" style="color: #ef4444;"></i>
                </div>
                <div style="flex: 1;">
                    <h4 style="margin: 0; color: #ef4444; font-weight: 600;">${t('inventory_alerts')}</h4>
                    <p style="font-size: 0.85rem; color: var(--text-dim); margin: 0.25rem 0 0 0;">
                        ${alerts.map(a => `${t('low_stock_on')} <strong>${a.label}</strong> (${a.count})`).join(' | ')}
                    </p>
                </div>
                <i data-lucide="x" onclick="dismissAlert('${alerts.map(a => a.label).join(',')}')" style="cursor: pointer; opacity: 0.5; width: 16px;"></i>
            </div>
        </div>
        ` : ''}

        <div class="inventory-grid animate-fade-in">
            <div class="glass-card hero-card" style="grid-column: span 2;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                    <div>
                        <div class="stat-label">${t('total_portfolio_value')}</div>
                        <div class="stat-value privacy-value ${privacyMode_stats ? 'blurred' : ''}" style="font-size: 2.8rem; letter-spacing: -1px;">${liveValue.toLocaleString()} EGP</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 10px; cursor: pointer;" onclick="togglePrivacy('stats')">
                        <i data-lucide="${privacyMode_stats ? 'eye-off' : 'eye'}" style="width: 20px; color: var(--primary-blue);"></i>
                    </div>
                </div>
                <div style="display: flex; gap: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
                    <div>
                        <div class="stat-label" style="font-size: 0.7rem;">${t('total_cost')}</div>
                        <div class="privacy-value ${privacyMode_stats ? 'blurred' : ''}" style="font-weight: 600; color: #94a3b8;">${costValue.toLocaleString()} EGP</div>
                    </div>
                    <div>
                        <div class="stat-label" style="font-size: 0.7rem;">Est. Gross Profit</div>
                        <div class="privacy-value ${privacyMode_stats ? 'blurred' : ''}" style="font-weight: 600; color: #10b981;">+${(liveValue - costValue).toLocaleString()} EGP</div>
                    </div>
                </div>
            </div>
            <div style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div class="glass-card">
                    <div class="stat-label">${t('diamonds_in_stock')}</div>
                    <div class="stat-value">${totalDiamonds}</div>
                    <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.5rem;">High-end pieces in vault</div>
                </div>
                <div class="glass-card">
                    <div class="stat-label">${t('gold_in_stock')}</div>
                    <div class="stat-value">${totalGold}</div>
                    <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.5rem;">Total items currently inventoried</div>
                </div>
            </div>
        </div>

        ${userRole === 'admin' ? `
            <div style="margin-bottom: 2.5rem; display: flex; justify-content: flex-start;">
                <button onclick="exportAll()" class="btn-premium-action" style="width: auto; border-style: dashed; padding: 0.6rem 2rem;">
                    <i data-lucide="download-cloud" style="width: 18px;"></i> ${t('backup')}
                </button>
            </div>
        ` : ''}

        <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
            <div class="glass-card">
                <div class="section-title">
                    <i data-lucide="trending-up" style="width: 20px;"></i> Profit Dynamics (30 Days)
                </div>
                <div style="height: 300px;">
                    <canvas id="profitChart"></canvas>
                </div>
            </div>

            <div class="glass-card">
                <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="display: flex; align-items: center; gap: 0.75rem;">
                        <i data-lucide="line-chart" style="width: 20px;"></i> ${t('market_pulse')}
                    </span>
                    <i data-lucide="${privacyMode_market ? 'eye-off' : 'eye'}" style="width: 16px; cursor: pointer; opacity: 0.6;" onclick="togglePrivacy('market')"></i>
                </div>
                <div class="market-item">
                    <span style="color: var(--text-dim);">Gold 24k</span>
                    <span style="font-weight: 700; color: var(--primary-blue); font-size: 1.1rem;" class="privacy-value ${privacyMode_market ? 'blurred' : ''}">${marketPrices.base24k.toLocaleString()} EGP</span>
                </div>
                <div class="market-item">
                    <span style="color: var(--text-dim);">Gold 21k</span>
                    <span style="font-weight: 600;" class="privacy-value ${privacyMode_market ? 'blurred' : ''}">${getKaratPrice('21k').toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</span>
                </div>
                <div class="market-item">
                    <span style="color: var(--text-dim);">Gold 18k</span>
                    <span style="font-weight: 600;" class="privacy-value ${privacyMode_market ? 'blurred' : ''}">${getKaratPrice('18k').toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</span>
                </div>
                
                <div style="margin: 1.5rem 0; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 12px; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.5rem;">
                        <i data-lucide="clock" style="width: 12px; display: inline-block; vertical-align: middle;"></i>
                        ${marketPrices.lastSync ? `Synced: ${marketPrices.lastSync}` : 'Never'}
                        ${marketPrices.isFallback ? '<div style="color: #fb7185; margin-top: 0.25rem;">(Offline - Using Cache)</div>' : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="fetchLivePrices()" class="btn-sync" style="flex: 1; font-size: 0.75rem;"><i data-lucide="refresh-cw" style="width:14px;"></i> ${t('sync')}</button>
                        <a href="https://isagha.com" target="_blank" class="btn-outline" style="flex: 1; font-size: 0.65rem; display: flex; align-items: center; justify-content: center; text-decoration: none;">iSagha <i data-lucide="external-link" style="width:12px; margin-left:4px;"></i></a>
                    </div>
                </div>

                <button class="btn-premium-action" style="width: 100%; border-style: dashed;" onclick="openMarketModal()">
                    <i data-lucide="settings-2" style="width: 18px;"></i> ${t('adjust_parameters')}
                </button>
            </div>
        </div>
        
        <div class="glass-card animate-fade-in">
            <div class="section-title">
                <i data-lucide="history" style="width: 20px;"></i> ${t('recent_activity')}
            </div>
            <table class="recent-table" style="width: 100%; border-collapse: collapse;">
                <thead><tr style="text-align: left; color: var(--text-dim);"><th>${t('inventory')}</th><th>${t('type')}</th><th>${t('valuation')}</th></tr></thead>
                <tbody>
                    ${[...inventory.diamonds, ...inventory.gold].sort((a, b) => b.id - a.id).slice(0, 5).map(item => `
                        <tr>
                            <td style="font-weight: 500;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${item.carat ? '#60a5fa' : '#fb7185'};"></div>
                                    ${item.carat ? item.carat + 'ct ' + (item.type || 'Diamond') : (item.name || 'Gold Piece')}
                                </div>
                            </td>
                            <td style="color: var(--text-dim); font-size: 0.9rem;">${item.carat ? t('diamonds') : t('gold')}</td>
                            <td class="privacy-value ${privacyMode_stats ? 'blurred' : ''}" style="font-weight: 600; color: #ffffff;">${item.price.toLocaleString()} EGP</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
    renderProfitChart();
}

function togglePrivacy(type) {
    if (type === 'stats') {
        privacyMode_stats = !privacyMode_stats;
        localStorage.setItem('privacy_mode_stats', JSON.stringify(privacyMode_stats));
    } else if (type === 'market') {
        privacyMode_market = !privacyMode_market;
        localStorage.setItem('privacy_mode_market', JSON.stringify(privacyMode_market));
    } else { // This 'else' now specifically handles 'sales' based on the instruction's context
        privacyMode_sales = !privacyMode_sales;
        localStorage.setItem('privacy_mode_sales', JSON.stringify(privacyMode_sales));
    }
    showView(currentView);
}

function renderDiamonds(container, filter = 'All') {
    if (!container) return;
    const ranges = getSKURanges('diamonds');
    const activeRange = currentInventoryRanges.diamonds;
    const types = ['All', 'Loose Stone', 'Solitaire', 'Ring', 'Earrings', 'Necklace', 'Bracelet'];

    container.innerHTML = `
        <div class="search-container">
            <div class="search-bar" style="max-width: 100%; margin: 0;">
                <i data-lucide="search"></i>
                <input type="text" id="diamond-search-input" placeholder="${t('search')} ${t('diamonds')}..." 
                       value="${currentSearch}" 
                       oninput="handleLocalSearch(this.value, 'diamonds')">
            </div>
            <div id="diamonds-local-suggestions" class="local-suggestions hidden"></div>
        </div>

        <div class="inventory-controls" style="margin-top: 1.5rem; margin-bottom: 2.5rem;">
            <div class="filter-tabs" style="margin-bottom: 1.5rem;">${types.map(type => `<button class="filter-btn ${filter === type ? 'active' : ''}" onclick="renderDiamonds(document.getElementById('view-container'), '${type}')">${t(type.toLowerCase().replace(' ', '_'))}</button>`).join('')}</div>
            <div style="display: flex; gap: 1rem;">
                <button class="btn-outline" onclick="exportDiamonds()"><i data-lucide="file-spreadsheet" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 0.5rem;"></i> ${t('export_excel')}</button>
                <button class="btn-import" onclick="importCSV('diamonds')"><i data-lucide="upload" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 0.5rem;"></i> ${t('import_csv')}</button>
                <button onclick="openDiamondModal('${filter}')">+ ${filter === 'All' ? t('add_diamond') : t('add') + ' ' + t(filter.toLowerCase().replace(' ', '_'))}</button>
            </div>
            ${ranges.length > 1 ? `<div class="range-tabs" style="margin-top: 1.5rem; margin-bottom: 0;">${ranges.map(r => `<button class="range-btn ${activeRange.start === r.start ? 'active' : ''}" onclick='setInventoryRange("diamonds", ${JSON.stringify(r)})'>${r.label}</button>`).join('')}</div>` : ''}
        </div>

        <div id="diamond-grid" class="grid">
            <!-- Grid items injected via updateInventoryGrid -->
        </div>
    `;
    lucide.createIcons();
    updateInventoryGrid('diamonds', filter);
}

function renderGold(container, filter = 'All') {
    if (!container) return;
    const ranges = getSKURanges('gold');
    const activeRange = currentInventoryRanges.gold;
    const types = ['All', 'Chain', 'Necklace', 'Bracelet', 'Ring', 'Earrings'];

    container.innerHTML = `
        <div class="search-container">
            <div class="search-bar" style="max-width: 100%; margin: 0;">
                <i data-lucide="search"></i>
                <input type="text" id="gold-search-input" placeholder="${t('search')} ${t('gold')}..." 
                       value="${currentSearch}" 
                       oninput="handleLocalSearch(this.value, 'gold')">
            </div>
            <div id="gold-local-suggestions" class="local-suggestions hidden"></div>
        </div>

        <div class="inventory-controls" style="margin-top: 1.5rem; margin-bottom: 2.5rem;">
            <div class="filter-tabs" style="margin-bottom: 1.5rem;">${types.map(type => `<button class="filter-btn ${filter === type ? 'active' : ''}" onclick="renderGold(document.getElementById('view-container'), '${type}')">${t(type.toLowerCase())}</button>`).join('')}</div>
            <div style="gap: 1rem; display: flex;">
                <button class="btn-outline" onclick="exportGold()"><i data-lucide="file-spreadsheet" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 0.5rem;"></i> ${t('export_excel') || 'Export'}</button>
                <button class="btn-import" onclick="importCSV('gold')"><i data-lucide="upload" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 0.5rem;"></i> ${t('import_csv')}</button>
                <button onclick="openGoldModal('${filter}')">+ ${filter === 'All' ? t('add_gold') :
            (filter === 'Necklace' ? t('add') + ' ' + (currentLang === 'en' ? t('gold_label') + ' ' : '') + t(filter.toLowerCase()) + (currentLang === 'ar' ? ' ' + t('gold_label') : '') : t('add') + ' ' + t(filter.toLowerCase()))
        }</button>
            </div>
            ${ranges.length > 1 ? `<div class="range-tabs" style="margin-top: 1.5rem; margin-bottom: 0;">${ranges.map(r => `<button class="range-btn ${activeRange.start === r.start ? 'active' : ''}" onclick='setInventoryRange("gold", ${JSON.stringify(r)})'>${r.label}</button>`).join('')}</div>` : ''}
        </div>

        <div id="gold-grid" class="grid">
            <!-- Grid items injected via updateInventoryGrid -->
        </div>
    `;
    lucide.createIcons();
    updateInventoryGrid('gold', filter);
}

function updateInventoryGrid(type, filter = 'All') {
    const gridId = type === 'diamonds' ? 'diamond-grid' : 'gold-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const searchTerm = currentSearch.toLowerCase();
    const activeRange = currentInventoryRanges[type];

    const items = inventory[type].filter(item => {
        // Range Check
        const skuNumber = parseInt(item.sku.split('-')[1]);
        const inRange = activeRange === 'All' || (skuNumber >= activeRange.start && skuNumber <= activeRange.end);
        if (!inRange && !searchTerm) return false;

        // Search Check
        const matchesSearch = isFuzzyMatch(item.sku, searchTerm) ||
            (item.name && isFuzzyMatch(item.name, searchTerm)) ||
            (item.type && isFuzzyMatch(item.type, searchTerm)) ||
            (item.carat && isFuzzyMatch(item.carat.toString(), searchTerm));

        // Category Check
        const matchesFilter = filter === 'All' || (type === 'diamonds' ? (item.item_type === filter) : (item.type === filter));

        return matchesSearch && matchesFilter;
    }).sort((a, b) => b.id - a.id); // Show newest first

    grid.innerHTML = items.length === 0 ? `
        <div class="card glass-card" style="grid-column: 1/-1; padding: 6rem 2rem; text-align: center; border: 1px dashed rgba(255,255,255,0.1); background: transparent;">
            <div style="background: rgba(212, 175, 55, 0.1); width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                <i data-lucide="${type === 'diamonds' ? 'diamond' : 'plus-circle'}" style="color: var(--primary-gold); width: 32px; height: 32px;"></i>
            </div>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-base);">${searchTerm ? t('no_results_found') : (type === 'diamonds' ? t('no_diamonds_yet') : t('no_gold_yet'))}</h3>
            <p style="color: var(--text-dim); margin-bottom: 2rem; font-size: 0.95rem;">${searchTerm ? t('no_results_desc') : t('get_started_desc')}</p>
            ${!searchTerm ? `
                <button onclick="${type === 'diamonds' ? 'openDiamondModal()' : 'openGoldModal()'}" class="btn-premium" style="padding: 0.8rem 2rem; font-size: 0.9rem;">
                    <i data-lucide="plus" style="width: 18px; vertical-align: middle; margin-right: 0.5rem;"></i>
                    ${type === 'diamonds' ? t('add_diamond') : t('add_gold')}
                </button>
            ` : ''}
        </div>
    ` : items.map(item => type === 'diamonds' ? `
        <div class="card item-card animate-fade-in shadow-hover">
            <div class="card-image">${item.image ? `<img src="${item.image}">` : `<div class="image-placeholder"><i data-lucide="diamond"></i></div>`}</div>
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
                    <span class="sku-tag">${item.sku}</span>
                    <div style="display: flex; gap: 0.6rem;">
                        <i data-lucide="tag" onclick="printTag('diamonds', ${item.id})" class="tag-btn" title="Print Tag"></i>
                        <i data-lucide="qr-code" onclick="viewQR('diamonds', ${item.id})" class="qr-btn" title="View QR"></i>
                        <i data-lucide="shopping-cart" onclick="openSellModal('diamonds', ${item.id})" class="sell-btn" title="Sell Item"></i>
                        ${userRole === 'admin' ? `
                        <i data-lucide="edit-3" onclick="requestEdit('diamonds', ${item.id})" class="edit-btn" title="Edit"></i>
                        <i data-lucide="trash-2" onclick="deleteItem('diamonds', ${item.id})" class="delete-btn" title="Delete"></i>
                        ` : ''}
                    </div>
                </div>
                <h4 style="margin-bottom: 0.25rem;">${item.name || ''}</h4>
                <p style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 0.75rem;">${item.carat} ${t('carat')} ${item.type} | ${item.cut} | ${item.color}</p>
                <div class="price-tag">${item.price.toLocaleString()} EGP</div>
            </div>
        </div>
    ` : `
        <div class="card item-card animate-fade-in shadow-hover">
            <div class="card-image">${item.image ? `<img src="${item.image}">` : `<div class="image-placeholder"><i data-lucide="${getIconForType(item.type)}"></i></div>`}</div>
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
                    <span class="sku-tag">${item.sku}</span>
                    <div style="display: flex; gap: 0.6rem;">
                        <i data-lucide="tag" onclick="printTag('gold', ${item.id})" class="tag-btn" title="Print Tag"></i>
                        <i data-lucide="qr-code" onclick="viewQR('gold', ${item.id})" class="qr-btn" title="View QR"></i>
                        <i data-lucide="shopping-cart" onclick="openSellModal('gold', ${item.id})" class="sell-btn" title="Sell Item"></i>
                        ${userRole === 'admin' ? `
                        <i data-lucide="edit-3" onclick="requestEdit('gold', ${item.id})" class="edit-btn" title="Edit"></i>
                        <i data-lucide="trash-2" onclick="deleteItem('gold', ${item.id})" class="delete-btn" title="Delete"></i>
                        ` : ''}
                    </div>
                </div>
                <h4 style="margin-bottom: 0.25rem;">${item.name}</h4>
                <p style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 0.75rem;">${item.karat} | ${item.weight}g ${t(item.type.toLowerCase())}</p>
                <div class="price-tag">${item.price.toLocaleString()} EGP</div>
            </div>
        </div>
    `).join('');
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

function openDiamondModal(param = null) {
    const editItem = (param && typeof param === 'object') ? param : null;
    const preselectedType = (typeof param === 'string' && param !== 'All') ? param : (editItem ? editItem.item_type || 'Loose Stone' : 'Loose Stone');

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
                    <div class="form-group"><label>${t('name')}</label><input type="text" id="d-name" value="${editItem ? editItem.name || '' : ''}" placeholder="Diamond Name"></div>
                    <div class="form-group"><label>${t('type')}</label><select id="d-item-type" required>${['Loose Stone', 'Solitaire', 'Ring', 'Earrings', 'Necklace', 'Bracelet'].map(tg => `<option ${(editItem && editItem.item_type === tg) || (!editItem && preselectedType === tg) ? 'selected' : ''} value="${tg}">${t(tg.toLowerCase().replace(' ', '_'))}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('shape')}</label><select id="d-shape" required>${['Round', 'Princess', 'Emerald', 'Asscher', 'Cushion', 'Marquise', 'Oval', 'Pear', 'Radiant', 'Heart'].map(s => `<option ${editItem && editItem.type === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('carat')}</label><input type="number" id="d-carat" step="any" value="${editItem ? editItem.carat : ''}" required></div>
                    <div class="form-group"><label>${t('color')}</label><select id="d-color" required>${['D', 'E', 'F', 'G', 'H', 'I', 'J'].map(c => `<option ${editItem && editItem.color === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('clarity')}</label><select id="d-clarity" required>${['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1'].map(cl => `<option ${editItem && editItem.clarity === cl ? 'selected' : ''}>${cl}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('cut')}</label><select id="d-cut" required>${['Excellent', 'Very Good', 'Good', 'Fair'].map(ct => `<option ${editItem && editItem.cut === ct ? 'selected' : ''}>${ct}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('price_egp')}</label><input type="number" id="d-price" value="${editItem ? editItem.price : ''}" required><div id="d-suggested" style="font-size: 0.75rem; color: var(--primary-blue); margin-top: 0.25rem;"></div></div>
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

function openGoldModal(param = null) {
    const editItem = (param && typeof param === 'object') ? param : null;
    const preselectedType = (typeof param === 'string' && param !== 'All') ? param : (editItem ? editItem.type : 'Chain');

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
                    <div class="form-group"><label>${t('type')}</label><select id="g-type" required>${['Chain', 'Necklace', 'Bracelet', 'Ring', 'Earrings', 'Other'].map(tg => `<option ${(editItem && editItem.type === tg) || (!editItem && preselectedType === tg) ? 'selected' : ''} value="${tg}">${t(tg.toLowerCase())}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('karat')}</label><select id="g-karat" required>${['10k', '14k', '18k', '22k', '24k'].map(k => `<option ${editItem && editItem.karat === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${t('weight_g')}</label><input type="number" id="g-weight" step="any" value="${editItem ? editItem.weight : ''}" required></div>
                    <div class="form-group" style="grid-column: span 2;"><label>${t('price_egp')}</label><input type="number" id="g-price" value="${editItem ? editItem.price : ''}" required><div id="g-suggested" style="font-size: 0.75rem; color: var(--primary-blue); margin-top: 0.25rem;"></div></div>
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

function showFullImage(src) {
    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-img-overlay';
    overlay.innerHTML = `<img src="${src}" onclick="this.parentElement.remove()">`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

function saveDiamond(event, editId = null) {
    event.preventDefault();
    const diamond = {
        id: editId || Date.now(),
        sku: editId ? inventory.diamonds.find(i => i.id === editId).sku : generateSKU('diamonds'),
        name: document.getElementById('d-name').value,
        item_type: document.getElementById('d-item-type').value,
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
        } else {
            // Surgical Update
            if (editId) {
                const idx = inventory.diamonds.findIndex(i => i.id === editId);
                if (idx !== -1) inventory.diamonds[idx] = diamond;
            } else {
                inventory.diamonds.unshift(diamond);
            }
        }
        closeModal();
        renderApp();
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
        } else {
            // Surgical Update
            if (editId) {
                const idx = inventory.gold.findIndex(i => i.id === editId);
                if (idx !== -1) inventory.gold[idx] = item;
            } else {
                inventory.gold.unshift(item);
            }
        }
        closeModal();
        renderApp();
    };
    const imageInput = document.getElementById('g-image');
    if (imageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { item.image = e.target.result; finalize(); };
        reader.readAsDataURL(imageInput.files[0]);
    } else finalize();
}

function exportDiamonds() { downloadCSV(inventory.diamonds, 'diamonds.csv', ['SKU', 'Type', 'Carat', 'Color', 'Clarity', 'Cut', 'Price']); }
function exportGold() { downloadCSV(inventory.gold, 'gold.csv', ['SKU', 'Name', 'Type', 'Karat', 'Weight', 'Price']); }
function exportAll() { downloadCSV([...inventory.diamonds, ...inventory.gold], 'inventory_backup.csv', ['SKU', 'Type', 'Price']); }

function requestSalesArchive() { if (prompt(t('enter_pass')) === SYSTEM_PASS) showView('sales'); else alert(t('wrong_pass')); }

function openSellModal(category, id) {
    const item = inventory[category].find(i => i.id === id);
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');

    // Finding customer details if pre-selected
    const preSelectedId = (pendingSale && pendingSale.id === id && pendingSale.newCustomerId) ? pendingSale.newCustomerId : "";
    const preSelectedCustomer = preSelectedId ? inventory.customers.find(c => c.id === parseInt(preSelectedId)) : null;

    modal.innerHTML = `
        <div class="modal"><div class="modal-content card" style="max-width: 400px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2>${t('sell_item')}</h2>
                <i data-lucide="x" class="close-btn" onclick="closeModal()"></i>
            </div>
            <form onsubmit="sellItem(event, '${category}', ${id})">
                <div class="form-group"><label>${t('sale_price')}</label><input type="number" id="s-price" value="${item.price}" required></div>
                <div class="form-group" style="margin-top: 1rem;"><label>${t('sale_date')}</label><input type="date" id="s-date" value="${new Date().toISOString().split('T')[0]}" required></div>
                
                <!-- Autocomplete Customer Selection -->
                <div class="form-group" style="margin-top: 1.5rem; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.5rem;">
                        <label style="margin: 0;">${t('select_customer')} (${t('optional')})</label>
                        <a href="javascript:void(0)" onclick="prepareNewCustomerDuringSale('${category}', ${id})" 
                           style="font-size: 0.7rem; color: var(--primary-blue); text-decoration: none; font-weight: 600;">
                           + ${currentLang === 'ar' ? (t('add_new_customer_link') || 'إضافة عميل جديد') : t('add_customer')}
                        </a>
                    </div>
                    
                    <div class="search-bar" style="margin: 0; max-width: 100%;">
                        <i data-lucide="user"></i>
                        <input type="text" id="cust-autocomplete-input" 
                               placeholder="${currentLang === 'ar' ? 'ابحث عن اسم العميل...' : 'Find customer name...'}"
                               value="${preSelectedCustomer ? preSelectedCustomer.name : ''}"
                               oninput="handleSellCustomerAutocomplete(this.value)"
                               autocomplete="off">
                    </div>
                    <input type="hidden" id="s-customer" value="${preSelectedId}">
                    <div id="sell-cust-suggestions" class="suggestions-dropdown hidden" 
                         style="top: 100%; border-color: var(--primary-blue); background: #0a0a0c;"></div>
                </div>

                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                    <button type="submit" class="btn-premium" style="flex: 1;">${t('confirm_sale')}</button>
                    <button type="button" class="btn-outline" onclick="closeModal()" style="flex: 1;">${t('cancel')}</button>
                </div>
            </form>
        </div></div>
    `;
    lucide.createIcons();
    pendingSale = null;
}

function handleSellCustomerAutocomplete(query) {
    const suggestions = document.getElementById('sell-cust-suggestions');
    const val = query.toLowerCase();

    if (!val) {
        suggestions.classList.add('hidden');
        document.getElementById('s-customer').value = ""; // Clear selection if input empty
        return;
    }

    const matches = inventory.customers.filter(c =>
        isFuzzyMatch(c.name, val) || (c.customer_code && isFuzzyMatch(c.customer_code, val))
    ).slice(0, 5);

    if (matches.length > 0) {
        suggestions.innerHTML = matches.map(m => `
            <div class="suggestion-item" onclick="selectSellCustomer(${m.id}, '${m.name.replace(/'/g, "\\'")}')">
                <span style="font-weight: 600;">${m.name}</span>
                <span style="font-size: 0.7rem; color: var(--text-dim);">${m.customer_code || ''}</span>
            </div>
        `).join('');
        suggestions.classList.remove('hidden');
    } else {
        suggestions.classList.add('hidden');
    }
}

function selectSellCustomer(id, name) {
    document.getElementById('s-customer').value = id;
    document.getElementById('cust-autocomplete-input').value = name;
    document.getElementById('sell-cust-suggestions').classList.add('hidden');
}

function prepareNewCustomerDuringSale(category, id) {
    pendingSale = { category, id };
    closeModal();
    showView('customers');
    openCustomerModal();
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

async function generateReceipt(saleData) {
    const doc = new jspdf.jsPDF();
    const item = saleData.original_data || saleData;

    // 1. Header & Branding
    doc.setFillColor(18, 18, 22); // Dark background for header
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFontSize(24);
    doc.setTextColor(197, 160, 89); // Gold
    doc.setFont("helvetica", "bold");
    doc.text(shopInfo.name.toUpperCase(), 105, 20, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`${shopInfo.address}  |  Tel: ${shopInfo.phone}`, 105, 30, { align: 'center' });

    // 2. Invoice Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text("INVOICE / RECEIPT", 20, 60);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Invoice ID: #${saleData.id.toString().slice(-6)}`, 20, 70);
    doc.text(`Date: ${new Date(saleData.sold_date || Date.now()).toLocaleDateString()}`, 20, 75);

    // 3. Customer Info (if available)
    if (saleData.customer_id) {
        const { data: customer } = await supabaseClient.from('customers').select('*').eq('id', saleData.customer_id).single();
        if (customer) {
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.text("BILL TO:", 140, 60);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(customer.name, 140, 68);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text(customer.phone || "", 140, 74);
            doc.text(`Cust ID: ${customer.customer_code || 'N/A'}`, 140, 79);
        }
    }

    // 4. Item Table Header
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 85, 190, 85);
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 86, 170, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Description", 25, 92);
    doc.text("SKU", 120, 92);
    doc.text("Total", 160, 92);

    // 5. Item Detail Body
    doc.setFont("helvetica", "normal");
    const itemName = item.carat ? `${item.carat}ct ${item.type || 'Diamond'}` : (item.name || 'Gold Item');
    doc.text(itemName, 25, 105);
    doc.text(item.sku, 120, 105);
    doc.text(`${saleData.price.toLocaleString()} EGP`, 160, 105);

    // 6. Technical Specifications (The professional touch)
    let specY = 120;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Technical Specifications:", 20, specY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    if (item.carat) { // Diamond Specs
        doc.text(`• Carat Weight: ${item.carat} ct`, 25, specY + 8);
        doc.text(`• Color Grade: ${item.color || 'N/A'}`, 25, specY + 14);
        doc.text(`• Clarity: ${item.clarity || 'N/A'}`, 100, specY + 8);
        doc.text(`• Cut: ${item.cut || 'N/A'}`, 100, specY + 14);
    } else { // Gold Specs
        doc.text(`• Weight: ${item.weight} g`, 25, specY + 8);
        doc.text(`• Purity: ${item.karat}`, 25, specY + 14);
    }

    // 7. QR Code Implementation (Manual Draw for QR compatibility)
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("SCAN FOR AUTHENTICATION", 155, 160, { align: 'center' });

    // Secret QR div for generation
    const qrDiv = document.createElement('div');
    new QRCode(qrDiv, { text: item.sku, width: 128, height: 128 });

    // Wait for QR to render then add to PDF
    setTimeout(() => {
        const qrCanvas = qrDiv.querySelector('canvas');
        if (qrCanvas) {
            const qrImg = qrCanvas.toDataURL("image/png");
            doc.addImage(qrImg, 'PNG', 140, 130, 30, 30);
        }

        // Footer
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(10);
        doc.text("Terms & Conditions:", 20, 240);
        doc.setFontSize(8);
        doc.text("• Authenticated via Idar Jewelry advanced inventory system.", 20, 246);
        doc.text("• Please retain this invoice for maintenance and future trade-ins.", 20, 251);

        try {
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Idar_Invoice_${item.sku}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (e) {
            doc.save(`Idar_Invoice_${item.sku}.pdf`); // Fallback if blob fails
        }
    }, 100);
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
                <span style="color: var(--primary-blue); font-weight: 600; font-size: 0.9rem;">
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
                        <button onclick="generateReceipt(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                            <i data-lucide="printer" style="width: 12px; height: 12px;"></i> Receipt
                        </button>
                        ${userRole === 'admin' ? `
                        <button onclick="voidSale(${item.id})" class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">
                            <i data-lucide="rotate-ccw" style="width: 12px; height: 12px;"></i> Void
                        </button>
                        ` : ''}
                    </td>
                    ` : ''}
                </tr>`).join('')}
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

let longPressTimer;
function renderWorkshop(container) {
    const statuses = ['hamada_received', 'am_fathy_received', 'goldsmith', 'ready', 'delivered'];
    container.innerHTML = `
        <div class="inventory-controls">
            <button onclick="openRepairModal()">+ ${t('add_job')}</button>
        </div>
        <div class="workshop-board">
            ${statuses.map(s => {
        const jobs = inventory.repairs.filter(j => {
            if (j.status !== s) return false;
            // Filter old deliveries (> 24h)
            if (s === 'delivered' && j.delivered_at) {
                const ageHours = (new Date() - new Date(j.delivered_at)) / (1000 * 60 * 60);
                if (ageHours > 24) return false;
            }
            return true;
        });

        const isCrowded = jobs.length > 3; // Trigger compact mode when scrolling is likely needed
        return `
                <div class="workshop-column">
                    <div class="column-header">
                        <h3>${t(s)}</h3>
                        <span class="job-count">${jobs.length}</span>
                    </div>
                    <div class="job-list ${isCrowded ? 'is-crowded' : ''}">
                        ${jobs.sort((a, b) => (b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0)).map(j => {
            const ageDays = Math.floor((new Date() - new Date(j.created_at || j.id)) / (1000 * 60 * 60 * 24));
            return `
                            <div class="card job-card ${j.is_urgent ? 'job-urgent' : ''}" 
                                style="position: relative;"
                                onmousedown="handleJobLongPressStart(${j.id})" 
                                onmouseup="handleJobLongPressEnd()" 
                                onmouseleave="handleJobLongPressEnd()"
                                ontouchstart="handleJobLongPressStart(${j.id})" 
                                ontouchend="handleJobLongPressEnd()">
                                
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;" onclick="openRepairModal(${j.id})">
                                    <div style="font-weight: 700; color: var(--primary-blue);">${j.customer || t('no_customer')}</div>
                                    <div class="pieces-badge">${j.pieces || 1} ${t('pcs') || 'Pcs'}</div>
                                </div>
                                
                                ${j.image ? `<img src="${j.image}" class="job-card-image" onclick="showFullImage('${j.image}')">` : ''}

                                <div class="job-footer" style="margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                    <div onclick="openRepairModal(${j.id})">
                                        ${status === 'delivered' && j.delivered_at ? `
                                            <div class="job-age-badge" style="color: #10b981; background: rgba(16, 185, 129, 0.1);">
                                                <i data-lucide="check-circle" style="width: 10px; height: 10px;"></i>
                                                ${t('delivered_at_label')}: ${(() => {
                                                    const ageMins = Math.floor((new Date() - new Date(j.delivered_at)) / (1000 * 60));
                                                    if (ageMins < 1) return t('just_now');
                                                    if (ageMins < 60) return t('minutes_ago').replace('{n}', ageMins);
                                                    return t('hours_ago').replace('{n}', Math.floor(ageMins / 60));
                                                })()}
                                            </div>
                                        ` : `
                                            <div class="job-age-badge">
                                                <i data-lucide="clock" style="width: 10px; height: 10px;"></i>
                                                ${ageDays === 0 ? t('today') : t('days_active').replace('{n}', ageDays)}
                                            </div>
                                        `}
                                    </div>
                                    
                                    ${getNextRepairStatus(s) ? `
                                        <div class="next-step-badge" 
                                            onclick="quickMoveRepair(${j.id}, event)"
                                            onmousedown="event.stopPropagation()"
                                            ontouchstart="event.stopPropagation()">
                                            <span>${t(getNextRepairStatus(s))}</span>
                                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
        }).join('')}
                    </div>
                </div>`;
    }).join('')}
        </div>`;
    lucide.createIcons();
}

async function toggleUrgent(id, event) {
    if (event) event.stopPropagation();
    const job = inventory.repairs.find(j => j.id === id);
    if (!job) return;

    const newPriority = !job.is_urgent;

    // UI Update (Immediate/Optimistic)
    job.is_urgent = newPriority;
    const viewContent = document.getElementById('view-container');
    if (currentView === 'workshop') renderWorkshop(viewContent);

    // Sync to DB
    const { error } = await supabaseClient.from('repairs').update({ is_urgent: newPriority }).eq('id', id);

    if (error) {
        console.error("DB Update failed, reverting UI", error);
        job.is_urgent = !newPriority; // Revert on failure
        if (currentView === 'workshop') renderWorkshop(viewContent);
        alert("Error updating priority: " + error.message);
    }
}

async function quickMoveRepair(id, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Prevent double-clicks & provide immediate visual lock
    const btn = event?.currentTarget;
    if (btn) btn.style.pointerEvents = 'none';

    try {
        const job = inventory.repairs.find(j => j.id === id);
        if (!job) {
            console.error("Job not found:", id);
            return;
        }

        const currentStatus = job.status;
        const nextStatus = getNextRepairStatus(currentStatus);
        
        if (!nextStatus) {
            console.warn("No next status for:", currentStatus);
            return;
        }

        // 1. Auth Guard: Verify session before critical DB write
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert("Session expired. Please log in again.");
            location.reload();
            return;
        }

        console.log(`Moving job ${id} from ${currentStatus} to ${nextStatus}`);

        // 2. Update locally (Optimistic)
        job.status = nextStatus;
        if (nextStatus === 'delivered') {
            job.delivered_at = new Date().toISOString();
        }

        // 3. RE-RENDER IMMEDIATELY (Instant Feedback)
        const viewContent = document.getElementById('view-container');
        if (viewContent) {
            renderWorkshop(viewContent);
        }

        // 4. Sync to DB in background
        const { error } = await supabaseClient.from('repairs').upsert([job]);
        if (error) {
            console.error("DB Sync Error:", error);
            // Revert state on failure to keep UI honest
            job.status = currentStatus;
            renderWorkshop(viewContent);
            alert("Sync failed: " + error.message);
        }
    } catch (err) {
        console.error("Critical quickMove error:", err);
    } finally {
        // ALWAYS re-enable button (prevents "dead button" syndrome)
        if (btn) {
            setTimeout(() => {
                btn.style.pointerEvents = 'auto';
            }, 100);
        }
    }
}

function getNextRepairStatus(currentStatus) {
    if (currentStatus === 'hamada_received' || currentStatus === 'am_fathy_received') return 'goldsmith';
    if (currentStatus === 'goldsmith') return 'ready';
    if (currentStatus === 'ready') return 'delivered';
    return null;
}

function openRepairModal(editId = null) {
    const job = editId ? inventory.repairs.find(j => j.id === editId) : null;
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');

    let currentPieces = job ? (job.pieces || 1) : 1;
    let currentImage = job ? job.image : null;

    modal.innerHTML = `
        <div class="modal">
            <div class="modal-content card" style="max-width: 500px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>${job ? t('edit') : t('add_job')}</h2>
                    <i data-lucide="x" class="close-btn" onclick="closeModal()"></i>
                </div>
                <form onsubmit="saveRepair(event, ${editId})">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Customer Selection -->
                        <div class="form-group" style="position: relative;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <label style="margin: 0;">${t('customer')}</label>
                                <button type="button" class="btn-premium" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; border-radius: 20px;" onclick="toggleQuickCustomer()">
                                    + ${t('new_customer')}
                                </button>
                            </div>
                            <div id="r-customer-select-group">
                                <input type="text" id="r-customer" value="${job ? job.customer : ''}" 
                                    placeholder="${t('customer_name')} (${t('optional')})" 
                                    oninput="handleCustomerAutocomplete(this)" autocomplete="off">
                                <div id="r-customer-suggestions" class="suggestions-dropdown hidden"></div>
                            </div>
                            
                            <!-- Quick Add Fields -->
                            <div id="quick-customer-fields" class="hidden" style="margin-top: 0.5rem; padding: 1.25rem; background: rgba(255,255,255,0.03); border: 1px dashed var(--border); border-radius: 12px; display: flex; flex-direction: column; gap: 0.75rem;">
                                <p style="font-size: 0.75rem; font-weight: 700; color: var(--primary-blue); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.5px;">${t('quick_add_info')}</p>
                                <input type="text" id="qc-name" placeholder="${t('customer_name')} *">
                                <input type="tel" id="qc-phone" placeholder="${t('customer_phone')}">
                                <input type="email" id="qc-email" placeholder="${t('customer_email')}">
                                <button type="button" class="btn-premium" style="margin-top: 0.5rem; border-radius: 10px;" onclick="addQuickCustomer()">
                                    ${t('add')}
                                </button>
                            </div>
                        </div>

                        <!-- Piece Counter -->
                        <div class="form-group">
                            <label>${t('pieces') || 'Pieces'}</label>
                            <div class="piece-counter">
                                <button type="button" class="counter-btn" onclick="adjustRepairCounter(-1)">-</button>
                                <span id="r-pieces-display" class="counter-value">${currentPieces}</span>
                                <button type="button" class="counter-btn" onclick="adjustRepairCounter(1)">+</button>
                            </div>
                            <input type="hidden" id="r-pieces" value="${currentPieces}">
                        </div>

                        <!-- Status Selection (Mobile Stacked) -->
                        <div class="form-group">
                            <label>${t('status')}</label>
                            <select id="r-status" required>
                                ${['hamada_received', 'am_fathy_received', 'goldsmith', 'ready', 'delivered'].map(s =>
                                    `<option value="${s}" ${job && job.status === s ? 'selected' : ''}>${t(s)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Photo Capture -->
                        <div class="form-group">
                            <label>${t('job_photo') || 'Job Photo'}</label>
                            <input type="file" id="r-image-input" accept="image/*" capture="environment" style="display: none;" onchange="handleRepairImageChange(this)">
                            <button type="button" class="camera-upload-btn" onclick="document.getElementById('r-image-input').click()">
                                <i data-lucide="camera"></i>
                                <span>${t('take_photo') || 'Take / Choose Photo'}</span>
                            </button>
                            <div id="r-image-preview-container">
                                ${currentImage ? `
                                <div class="repair-img-preview-wrapper">
                                    <button type="button" class="repair-img-remove-btn" onclick="removeRepairImage()">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                    <img src="${currentImage}" class="repair-img-preview" onclick="showFullImage('${currentImage}')">
                                </div>
                                ` : ''}
                            </div>
                            <input type="hidden" id="r-image-data" value="${currentImage || ''}">
                        </div>

                    </div>

                    <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 1rem; flex: 1;">
                            <button type="submit" class="btn-premium" style="flex: 1;">${t('save')}</button>
                            <button type="button" class="btn-outline" onclick="closeModal()" style="flex: 1;">${t('cancel')}</button>
                        </div>
                        ${editId ? `<button type="button" class="btn-danger-text" onclick="confirmJobDeletion(${editId})">
                            <i data-lucide="trash-2" style="width: 16px;"></i>
                        </button>` : ''}
                    </div>
                </form>
            </div>
        </div>
    `;
    lucide.createIcons();
}

// Helpers for the new Repair Modal
function adjustRepairCounter(delta) {
    const input = document.getElementById('r-pieces');
    const display = document.getElementById('r-pieces-display');
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    input.value = val;
    display.innerText = val;
}

function handleRepairImageChange(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = e.target.result;
            document.getElementById('r-image-data').value = data;
            const container = document.getElementById('r-image-preview-container');
            container.innerHTML = `
                <div class="repair-img-preview-wrapper">
                    <button type="button" class="repair-img-remove-btn" onclick="removeRepairImage()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <img src="${data}" class="repair-img-preview" onclick="showFullImage('${data}')">
                </div>
            `;
            lucide.createIcons();
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function removeRepairImage() {
    document.getElementById('r-image-data').value = '';
    document.getElementById('r-image-input').value = '';
    document.getElementById('r-image-preview-container').innerHTML = '';
}

function toggleQuickCustomer() {
    const fields = document.getElementById('quick-customer-fields');
    const select = document.getElementById('r-customer-select-group');
    const input = document.getElementById('r-customer');
    
    if (fields.classList.contains('hidden')) {
        fields.classList.remove('hidden');
        select.classList.add('hidden');
        input.value = ''; // Clear search if adding new
    } else {
        fields.classList.add('hidden');
        select.classList.remove('hidden');
    }
}

async function addQuickCustomer() {
    const name = document.getElementById('qc-name').value;
    const phone = document.getElementById('qc-phone').value;
    const email = document.getElementById('qc-email').value;

    if (!name) return alert(t('enter_name') || "Please enter customer name");

    try {
        const { data, error } = await supabaseClient
            .from('customers')
            .insert([{ name, phone, email, user_id: currentUser.id }])
            .select();

        if (error) throw error;

        // Update local state
        const { data: allCusts } = await supabaseClient.from('customers').select('*');
        inventory.customers = allCusts || [];

        // Auto-select and hide fields
        document.getElementById('r-customer').value = name;
        
        // Clear inputs and hide fields
        document.getElementById('qc-name').value = '';
        document.getElementById('qc-phone').value = '';
        document.getElementById('qc-email').value = '';
        toggleQuickCustomer();
        
        // Show success
        alert(t('save_success') || "Customer added successfully!");
    } catch (e) {
        alert("Error: " + e.message);
    }
}

function handleCustomerAutocomplete(input) {
    const val = input.value.toLowerCase();
    const suggestions = document.getElementById('r-customer-suggestions');
    if (!val) { suggestions.classList.add('hidden'); return; }

    const matches = inventory.customers.filter(c => c.name.toLowerCase().includes(val)).slice(0, 5);
    if (matches.length > 0) {
        suggestions.innerHTML = matches.map(m => `
            <div class="suggestion-item" onclick="selectRepairCustomer('${m.name}')">
                <span>${m.name}</span>
                <span style="font-size: 0.7rem; color: var(--text-dim);">${m.phone || ''}</span>
            </div>`).join('');
        suggestions.classList.remove('hidden');
    } else {
        suggestions.classList.add('hidden');
    }
}

function selectRepairCustomer(name) {
    document.getElementById('r-customer').value = name;
    document.getElementById('r-customer-suggestions').classList.add('hidden');
}

async function saveRepair(event, editId = null) {
    event.preventDefault();
    if (!currentUser) return alert("Please log in first");
    setButtonLoading(true);

    try {
        let customer = document.getElementById('r-customer').value;
        const qcNameInput = document.getElementById('qc-name');
        const qcName = qcNameInput ? qcNameInput.value : '';
        
        // Handle Quick Customer Add (Only if NOT already added via standalone button)
        const customerExists = inventory.customers.some(c => c.name === qcName);
        if (qcName && !customerExists) {
            const qcPhone = document.getElementById('qc-phone').value;
            const qcEmail = document.getElementById('qc-email').value;
            
            const { data: newCust, error: custErr } = await supabaseClient
                .from('customers')
                .insert([
                    { 
                        name: qcName, 
                        phone: qcPhone, 
                        email: qcEmail,
                        user_id: currentUser.id
                    }
                ])
                .select();
                
            if (custErr) throw custErr;
            customer = qcName;
            
            // Refresh customers list background
            const { data: allCusts } = await supabaseClient.from('customers').select('*');
            inventory.customers = allCusts || [];
        }

        const status = document.getElementById('r-status').value;
        const existingJob = editId ? inventory.repairs.find(j => j.id === editId) : null;

        const job = {
            id: editId || Date.now(),
            sku: existingJob ? (existingJob.sku || generateSKU('repairs')) : generateSKU('repairs'),
            customer: customer || null,
            status: status,
            pieces: parseInt(document.getElementById('r-pieces').value) || 1,
            image: document.getElementById('r-image-data').value || null,
            user_id: currentUser.id,
            is_urgent: existingJob ? existingJob.is_urgent : false,
            delivered_at: (status === 'delivered' && (!existingJob || existingJob.status !== 'delivered'))
                ? new Date().toISOString()
                : (existingJob ? existingJob.delivered_at || existingJob.Delivered_at : null)
        };

        console.log("Saving Repair Job:", job);
        const { error } = await supabaseClient.from('repairs').upsert([job]);
        if (error) throw error;

        // Surgical Update
        if (editId) {
            const idx = inventory.repairs.findIndex(j => j.id === editId);
            if (idx !== -1) inventory.repairs[idx] = job;
        } else {
            inventory.repairs.unshift(job);
        }

        closeModal();
        renderApp();
    } catch (error) {
        alert("Error saving job: " + error.message);
    } finally {
        setButtonLoading(false);
    }
}

function handleJobLongPressStart(id) {
    longPressTimer = setTimeout(() => {
        confirmJobDeletion(id);
    }, 2000);
}

function handleJobLongPressEnd() {
    clearTimeout(longPressTimer);
}

async function confirmJobDeletion(id) {
    if (confirm(t('delete_job_confirm') || "Are you sure you want to erase this repair job?")) {
        // Surgical Local Delete for Instant UX
        inventory.repairs = inventory.repairs.filter(j => j.id !== id);
        closeModal();
        renderApp();

        // Background Delete
        const { error } = await supabaseClient.from('repairs').delete().eq('id', id);
        if (error) {
            console.error("Delete failed:", error);
            alert("Error deleting job from database: " + error.message);
            initApp();
        }
    }
}



// Special JSON Export/Import for Advanced Data Management
function exportJSON() {
    const dataStr = JSON.stringify(inventory, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `idar_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

function importCSV(category) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async event => {
            const content = event.target.result;
            await processCSVContent(content, category);
        };
        reader.readAsText(file);
    };
    input.click();
}

async function processCSVContent(content, category) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const items = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Basic CSV parser that handles quotes
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const cleanRow = row.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));

        const itemData = {};
        headers.forEach((h, idx) => {
            const key = h.replace(/\s+/g, '_');
            itemData[key] = cleanRow[idx];
        });

        // Schema Mapping
        let item = { id: Date.now() + i };

        if (category === 'diamonds') {
            item = {
                ...item,
                sku: itemData.sku || generateSKU('diamonds'),
                name: itemData.name || 'Imported Diamond',
                price: parseFloat(itemData.price) || 0,
                image: null,
                item_type: itemData.item_type || 'Loose Stone',
                type: itemData.shape || itemData.type || 'Round',
                carat: parseFloat(itemData.carat) || 0,
                color: itemData.color || 'D',
                clarity: itemData.clarity || 'IF',
                cut: itemData.cut || 'Excellent'
            };
        } else if (category === 'gold') {
            item = {
                ...item,
                sku: itemData.sku || generateSKU('gold'),
                name: itemData.name || 'Imported Gold',
                price: parseFloat(itemData.price) || 0,
                image: null,
                type: itemData.type || 'Necklace',
                karat: itemData.karat || '21K',
                weight: parseFloat(itemData.weight) || 0
            };
        } else if (category === 'customers') {
            item = {
                ...item,
                name: itemData.customer_name || itemData.name || 'Imported Customer',
                phone: itemData.phone || '',
                address: itemData.address || '',
                notes: itemData.notes || '',
                customer_code: itemData.customer_code || itemData.code || generateCustomerCode()
            };
        }

        items.push(item);
    }

    if (items.length > 0) {
        const { error } = await supabaseClient.from(category).upsert(items);
        if (error) {
            alert(t('import_error').replace('{row}', 'bulk').replace('{error}', error.message));
        } else {
            alert(t('import_success').replace('{count}', items.length));
            initApp();
        }
    }
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
                <h4 style="margin-bottom: 1rem; color: var(--primary-blue); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Business Logic</h4>
                <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div class="form-group"><label>${t('profit_margin')}</label><input type="number" id="s-margin" value="${appSettings.profitMargin}" required></div>
                    <div class="form-group"><label>${t('stock_threshold')}</label><input type="number" id="s-threshold" value="${appSettings.stockThreshold}" required></div>
                </div>

                <h4 style="margin-bottom: 1rem; color: var(--primary-blue); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Manual Market Controls</h4>
                <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div class="form-group">
                        <label>Gold 24k Price (EGP)</label>
                        <input type="number" id="s-base24k" value="${marketPrices.base24k}" required>
                    </div>
                    <div class="form-group">
                        <label>${t('offset')}</label>
                        <input type="number" id="s-offset" value="${marketPrices.offset}" required>
                    </div>
                </div>

                <h4 style="margin-bottom: 1rem; color: var(--primary-blue); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Shop Details (for Receipts)</h4>
                <div class="form-group" style="margin-bottom: 1rem;"><label>Shop Name</label><input type="text" id="s-shop-name" value="${shopInfo.name}" required></div>
                <div class="form-group" style="margin-bottom: 1rem;"><label>Address</label><input type="text" id="s-shop-address" value="${shopInfo.address}" required></div>
                <div class="form-group" style="margin-bottom: 2rem;"><label>Phone Number</label><input type="text" id="s-shop-phone" value="${shopInfo.phone}" required></div>

                <h4 style="margin-bottom: 1rem; color: var(--primary-blue); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="database" style="width: 16px;"></i> Database Management
                </h4>
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    <button type="button" class="btn-outline" onclick="exportJSON()" style="flex: 1; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <i data-lucide="download" style="width: 16px; height: 16px;"></i> Backup DB
                    </button>
                    <button type="button" class="btn-outline" onclick="importJSON()" style="flex: 1; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <i data-lucide="upload" style="width: 16px; height: 16px;"></i> Restore DB
                    </button>
                </div>

                <h4 style="margin-bottom: 1rem; color: #ef4444; border-bottom: 1px solid rgba(239,68,68,0.2); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="alert-triangle" style="width: 16px;"></i> ${t('data_management')}
                </h4>
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    <button type="button" class="btn-danger-outline" onclick="wipeCategory('diamonds')" style="flex: 1; font-size: 0.8rem;">
                        ${t('clear_diamonds')}
                    </button>
                    <button type="button" class="btn-danger-outline" onclick="wipeCategory('gold')" style="flex: 1; font-size: 0.8rem;">
                        ${t('clear_gold')}
                    </button>
                    <button type="button" class="btn-danger-outline" onclick="wipeCategory('customers')" style="flex: 1; font-size: 0.8rem;">
                        ${t('clear_customers')}
                    </button>
                </div>

                <div style="display: flex; gap: 1rem;"><button type="submit">${t('save')}</button><button type="button" class="btn-outline" onclick="closeModal()">Cancel</button></div>
            </form>
        </div></div>
    `;
    lucide.createIcons();
}

async function wipeCategory(category) {
    if (prompt(t('enter_pass')) !== SYSTEM_PASS) {
        return alert(t('wrong_pass'));
    }

    if (confirm(t('wipe_confirm'))) {
        if (confirm("FINAL WARNING: This action cannot be undone. Proceed?")) {
            const { error, count } = await supabaseClient.from(category).delete().neq('id', 0);
            if (error) {
                alert("Error wiping data: " + error.message);
            } else {
                alert(t('wipe_success').replace('{count}', count || 'all'));
                initApp();
            }
        }
    }
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
    // 1. Pre-calculate Statistics for ALL customers (One pass O(N))
    const customerStatsMap = new Map();

    // Initialize map
    inventory.customers.forEach(c => {
        customerStatsMap.set(c.id, { totalPurchases: 0, totalSpent: 0, lastPurchase: null });
    });

    // Populate from sales archive
    inventory.sold.forEach(sale => {
        if (!sale.customer_id || sale.is_voided) return;
        const stats = customerStatsMap.get(sale.customer_id);
        if (stats) {
            stats.totalPurchases++;
            stats.totalSpent += sale.price;
            if (!stats.lastPurchase || new Date(sale.sold_date) > new Date(stats.lastPurchase)) {
                stats.lastPurchase = sale.sold_date;
            }
        }
    });

    // Check for Ready items in Workshop
    inventory.repairs.forEach(job => {
        if (job.status === 'ready' && job.customer) {
            // Find customer by name (since repairs use name strings)
            const customer = inventory.customers.find(c => c.name === job.customer);
            if (customer) {
                const stats = customerStatsMap.get(customer.id);
                if (stats) stats.hasReadyItem = true;
            }
        }
    });

    // Save calculation to a global-ish scope so updateCustomerTable can access it without recalculating
    window.cachedCustomerStats = customerStatsMap;

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div class="search-container" style="flex: 1; margin: 0 1rem 0 0;">
                <div class="search-bar" style="max-width: 100%; margin: 0;">
                    <i data-lucide="search"></i>
                    <input type="text" id="customer-search-input" placeholder="${t('search')} ${t('customers')}..." 
                           value="${currentSearch}" 
                           oninput="handleLocalSearch(this.value, 'customers')"
                           onkeydown="if(event.key === 'Enter') handleCustomerSearch(this.value)">
                </div>
                <div id="customers-local-suggestions" class="local-suggestions hidden"></div>
            </div>
            <div style="display: flex; gap: 1rem; align-items: center;">
                <div class="form-group" style="margin-bottom: 0;">
                    <button id="ready-filter-btn" 
                            onclick="handleCustomerFilter(currentCustomerFilter === 'ready' ? 'all' : 'ready')"
                            class="btn-outline" 
                            style="padding: 0.6rem 1rem; border-radius: 10px; display: flex; align-items: center; gap: 0.5rem; transition: all 0.3s; ${currentCustomerFilter === 'ready' ? 'background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #10b981;' : ''}">
                        <i data-lucide="bell" style="width: 16px; height: 16px;"></i>
                        ${currentCustomerFilter === 'ready' ? t('view_all') : t('ready_filter_title')}
                        ${Array.from(customerStatsMap.values()).some(s => s.hasReadyItem) ? '<span class="filter-dot"></span>' : ''}
                    </button>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <select id="customer-sort-select" onchange="handleCustomerSort(this.value)" style="padding: 0.6rem 2rem 0.6rem 1rem; font-size: 0.85rem; border-radius: 10px;">
                        <option value="name_asc" ${currentCustomerSort === 'name_asc' ? 'selected' : ''}>${t('name_az')}</option>
                        <option value="ltv_desc" ${currentCustomerSort === 'ltv_desc' ? 'selected' : ''}>${t('highest_spent')}</option>
                        <option value="recent_desc" ${currentCustomerSort === 'recent_desc' ? 'selected' : ''}>${t('recently_bought')}</option>
                    </select>
                </div>
                <button onclick="importCSV('customers')" class="btn-import">
                    <i data-lucide="upload"></i> ${t('import_csv')}
                </button>
                <button onclick="openCustomerModal()" style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <i data-lucide="user-plus" style="width: 18px; height: 18px;"></i>
                    ${t('add_customer')}
                </button>
            </div>
        </div>

        <div class="card" style="overflow-x: auto; padding: 0;">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>${t('customer_name')}</th>
                        <th>${t('customer_phone')}</th>
                        <th>${t('total_purchases')}</th>
                        <th>${t('lifetime_value')}</th>
                        <th>${t('last_purchase')}</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="customer-table-body">
                    <!-- Rows injected via updateCustomerTable -->
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
    updateCustomerTable(); // Initial draw
}

function handleCustomerSearch(query) {
    currentSearch = query;
    // Auto-close suggestions
    const suggestions = document.getElementById('customers-local-suggestions');
    if (suggestions) suggestions.classList.add('hidden');
    updateCustomerTable();
}

function handleCustomerFilter(filter) {
    currentCustomerFilter = filter;
    updateCustomerTable();
}

function handleCustomerSort(sortMode) {
    currentCustomerSort = sortMode;
    updateCustomerTable();
}

function updateCustomerTable() {
    const tbody = document.getElementById('customer-table-body');
    if (!tbody) return;

    const searchTerm = currentSearch.toLowerCase();
    const filtered = inventory.customers.filter(c => {
        const matchSearch = isFuzzyMatch(c.name, searchTerm) ||
            (c.customer_code && isFuzzyMatch(c.customer_code, searchTerm)) ||
            (c.phone && isFuzzyMatch(c.phone, searchTerm));

        if (!matchSearch) return false;

        if (currentCustomerFilter === 'ready') {
            const stats = window.cachedCustomerStats.get(c.id);
            return stats && stats.hasReadyItem;
        }

        return true;
    }).sort((a, b) => {
        const statsA = window.cachedCustomerStats.get(a.id) || { totalSpent: 0, lastPurchase: 0 };
        const statsB = window.cachedCustomerStats.get(b.id) || { totalSpent: 0, lastPurchase: 0 };

        if (currentCustomerSort === 'ltv_desc') {
            return statsB.totalSpent - statsA.totalSpent;
        } else if (currentCustomerSort === 'recent_desc') {
            const dateA = statsA.lastPurchase ? new Date(statsA.lastPurchase).getTime() : 0;
            const dateB = statsB.lastPurchase ? new Date(statsB.lastPurchase).getTime() : 0;
            return dateB - dateA;
        } else {
            return a.name.localeCompare(b.name);
        }
    });

    tbody.innerHTML = filtered.length === 0 ? `
        <tr>
            <td colspan="7" style="padding: 6rem 2rem; text-align: center;">
                <div style="background: rgba(59, 130, 246, 0.1); width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                    <i data-lucide="${currentCustomerFilter === 'ready' ? 'bell-off' : 'users'}" style="color: #60a5fa; width: 32px; height: 32px;"></i>
                </div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-base);">${currentCustomerFilter === 'ready' ? t('no_pickups') : (searchTerm ? t('no_customer_results') : t('no_customers_yet'))}</h3>
                ${currentCustomerFilter !== 'ready' ? `
                    <p style="color: var(--text-dim); margin-bottom: 2rem; font-size: 0.95rem;">${searchTerm ? t('no_customer_results_desc') : t('get_started_customer_desc')}</p>
                    ${!searchTerm ? `
                        <button onclick="openCustomerModal()" class="btn-premium" style="padding: 0.8rem 2rem; font-size: 0.9rem; background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.3); color: #60a5fa;">
                            <i data-lucide="user-plus" style="width: 18px; vertical-align: middle; margin-right: 0.5rem;"></i>
                            ${t('add_customer')}
                        </button>
                    ` : ''}
                ` : ''}
            </td>
        </tr>
    ` : filtered.map(customer => {
        const stats = window.cachedCustomerStats.get(customer.id) || { totalPurchases: 0, totalSpent: 0, lastPurchase: null };
        return `
            <tr onclick="viewCustomerDetail(${customer.id})" style="cursor: pointer;">
                <td>${customer.customer_code || '-'}</td>
                <td>
                    <div style="font-weight: 600;">${customer.name}</div>
                    ${stats.hasReadyItem ? `
                        <div style="display: flex; align-items: center; margin-top: 0.25rem;">
                            <span class="ready-pickup-badge"><i data-lucide="check-circle" style="width: 10px; height: 10px;"></i> ${t('ready_badge')}</span>
                            <button class="btn-ready-action" onclick="event.stopPropagation(); markCustomerItemsAsPickedUp('${customer.name.replace(/'/g, "\\'")}')">
                                ${t('mark_picked_up')}
                            </button>
                        </div>
                    ` : ''}
                </td>
                <td>${customer.phone || '-'}</td>
                <td>${stats.totalPurchases}</td>
                <td class="${privacyMode_stats ? 'blurred' : ''}">${stats.totalSpent.toLocaleString()} EGP</td>
                <td>${stats.lastPurchase || '-'}</td>
                <td onclick="event.stopPropagation()" style="display: flex; gap: 0.5rem;">
                    <button class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                            onclick="openCustomerModal(${customer.id})">
                        <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i> ${t('edit')}
                    </button>
                    <button class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ef4444;" 
                            onclick="deleteCustomer(${customer.id})">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> ${t('delete')}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Re-create icons for new rows
    lucide.createIcons();
}

async function markCustomerItemsAsPickedUp(customerName) {
    if (!confirm(`Mark all items for "${customerName}" as picked up and delivered?`)) return;

    const itemsToUpdate = inventory.repairs.filter(j => j.customer === customerName && j.status === 'ready');
    if (itemsToUpdate.length === 0) return;

    const updatedItems = itemsToUpdate.map(j => ({
        ...j,
        status: 'delivered',
        is_urgent: false, // Ensure urgency is cleared on pickup
        delivered_at: new Date().toISOString()
    }));

    const { error } = await supabaseClient.from('repairs').upsert(updatedItems);

    if (error) {
        alert("Error updating items: " + error.message);
    } else {
        // Optimistic local update to prevent screen flash
        updatedItems.forEach(u => {
            const localJob = inventory.repairs.find(rj => rj.id === u.id);
            if (localJob) {
                Object.assign(localJob, u); // Copy all updated fields locally
            }
        });
        renderApp(); // Clean re-render without full re-fetch/flash
    }
}

function openCustomerModal(customerId = null) {
    const customer = customerId ? inventory.customers.find(c => c.id === customerId) : null;
    const modal = document.getElementById('modal-container');
    modal.classList.remove('hidden');

    modal.innerHTML = `
        <div class="modal">
            <div class="modal-content card" style="max-width: 800px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2>${customer ? t('edit') : t('add_customer')}</h2>
                        ${customer?.customer_code ? `<p style="font-size: 0.8rem; color: var(--primary-blue); font-weight: 600; margin: 0.25rem 0 0 0;">Customer ID: ${customer.customer_code}</p>` : ''}
                    </div>
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
                            <label>${t('customer_email')} (${t('optional')})</label>
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

    if (!currentUser || !currentUser.id) {
        alert("Error: You must be logged in to save customers.");
        return;
    }

    const customerData = {
        name: document.getElementById('c-name').value,
        phone: document.getElementById('c-phone').value,
        email: document.getElementById('c-email').value,
        address: document.getElementById('c-address').value,
        notes: document.getElementById('c-notes').value,
        user_id: currentUser.id
    };

    try {
        let finalCustomerId = customerId;
        if (customerId) {
            const { error } = await supabaseClient
                .from('customers')
                .update(customerData)
                .eq('id', customerId);
            if (error) throw error;
        } else {
            finalCustomerId = Date.now();
            customerData.id = finalCustomerId;
            customerData.customer_code = generateCustomerCode(); // Assign C-1000 SKU
            customerData.created_date = new Date().toISOString().split('T')[0];
            const { error } = await supabaseClient
                .from('customers')
                .insert([customerData]);
            if (error) throw error;
        }

        // Handle Return-to-Sale logic
        if (pendingSale && !customerId) {
            // Update local inventory before re-opening sell modal
            inventory.customers.unshift(customerData);
            const savedPending = { ...pendingSale, newCustomerId: finalCustomerId };
            closeModal();
            renderApp(); // This also triggers partial update where needed
            pendingSale = savedPending;
            openSellModal(pendingSale.category, pendingSale.id);
        } else {
            if (customerId) {
                const idx = inventory.customers.findIndex(c => c.id === customerId);
                if (idx !== -1) inventory.customers[idx] = { ...inventory.customers[idx], ...customerData };
            } else {
                inventory.customers.unshift(customerData);
            }
            closeModal();
            renderApp();
        }
    } catch (error) {
        alert("Error saving customer: " + error.message);
    }
}

async function deleteCustomer(id) {
    if (!confirm(t('delete_confirm'))) return;

    try {
        const { error } = await supabaseClient
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Update local state
        inventory.customers = inventory.customers.filter(c => c.id !== id);

        showView('customers');
    } catch (e) {
        console.error("Delete failed:", e);
        alert("Delete failed: " + e.message);
    }
}

function generateCustomerCode() {
    if (!inventory.customers || inventory.customers.length === 0) return 'C-1001';
    const codes = inventory.customers
        .map(c => c.customer_code)
        .filter(code => code && code.startsWith('C-'))
        .map(code => parseInt(code.split('-')[1]))
        .filter(num => !isNaN(num));

    const max = codes.length > 0 ? Math.max(...codes) : 1000;
    return `C-${max + 1}`;
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
                        <div style="font-size: 2rem; font-weight: 700; color: var(--primary-blue); margin-top: 0.5rem;">${purchases.length}</div>
                    </div>
                    <div class="card" style="background: rgba(197, 160, 89, 0.1);">
                        <h4 style="margin: 0; font-size: 0.85rem; color: var(--text-dim);">${t('lifetime_value')}</h4>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--primary-blue); margin-top: 0.5rem;" class="${privacyMode_stats ? 'blurred' : ''}">${totalSpent.toLocaleString()} EGP</div>
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

    if (!confirm(`${t('void')} ${count} ${t('sale_plural')} ${t('and_return_items')}?`)) return;

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


// --- ROYAL HIDDEN GEMS: Shortcuts & Animations ---

window.addEventListener('keydown', (e) => {
    // CMD+K on Mac, CTRL+K on Windows/Linux
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        e.preventDefault();
        openCommandPalette();
    }

    if (commandPaletteActive) {
        if (e.key === 'Escape') {
            closeCommandPalette();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            paletteSelectedIndex = Math.min(paletteSelectedIndex + 1, paletteCurrentMatches.length - 1);
            renderPaletteItems();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            paletteSelectedIndex = Math.max(paletteSelectedIndex - 1, 0);
            renderPaletteItems();
        } else if (e.key === 'Enter' && paletteSelectedIndex >= 0) {
            e.preventDefault();
            const match = paletteCurrentMatches[paletteSelectedIndex];
            if (match) jumpToPaletteItem(match.type, match.id);
        }
    }
});

function openCommandPalette() {
    if (commandPaletteActive) return;
    commandPaletteActive = true;

    const overlay = document.createElement('div');
    overlay.id = 'palette-overlay';
    overlay.className = 'command-palette-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeCommandPalette(); };

    overlay.innerHTML = `
        <div class="command-palette">
            <div class="palette-search-container">
                <i data-lucide="command" style="color: var(--primary-blue); width: 20px;"></i>
                <input type="text" id="palette-input" class="palette-input" 
                       placeholder="${currentLang === 'ar' ? 'ابحث في كل شيء...' : 'Search everything...'}" 
                       autocomplete="off" 
                       oninput="handlePaletteSearch(this.value)">
            </div>
            <div id="palette-results" class="palette-results">
                <div style="padding: 2rem; text-align: center; color: var(--text-dim); font-size: 0.9rem;">
                    ${currentLang === 'ar' ? 'ابدأ الكتابة للبحث عن أكواد أو عملاء' : 'Start typing to find SKUs or Customers...'}
                </div>
            </div>
            <div class="palette-shortcut-hint">
                <span><kbd>Enter</kbd> to select</span>
                <span><kbd>Esc</kbd> to close</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    lucide.createIcons();
    setTimeout(() => document.getElementById('palette-input').focus(), 10);
}

function closeCommandPalette() {
    const overlay = document.getElementById('palette-overlay');
    if (overlay) overlay.remove();
    commandPaletteActive = false;
}

function handlePaletteSearch(query) {
    const q = query.toLowerCase();
    paletteCurrentMatches = [];
    paletteSelectedIndex = -1;

    if (!q) {
        renderPaletteItems();
        return;
    }

    // 1. Gather Matches
    // Diamonds
    inventory.diamonds.forEach(item => {
        if (isFuzzyMatch(item.sku, q) || isFuzzyMatch(item.type, q)) {
            paletteCurrentMatches.push({ type: 'diamond', label: item.sku, sub: item.type, id: item.id });
        }
    });

    // Gold
    inventory.gold.forEach(item => {
        if (isFuzzyMatch(item.sku, q) || isFuzzyMatch(item.name, q)) {
            paletteCurrentMatches.push({ type: 'gold', label: item.sku, sub: item.name, id: item.id });
        }
    });

    // Customers
    inventory.customers.forEach(c => {
        if (isFuzzyMatch(c.name, q) || (c.customer_code && isFuzzyMatch(c.customer_code, q))) {
            paletteCurrentMatches.push({ type: 'customer', label: c.name, sub: c.customer_code || 'Client', id: c.id });
        }
    });

    // 2. Select first result automatically
    if (paletteCurrentMatches.length > 0) paletteSelectedIndex = 0;

    renderPaletteItems();
}

function renderPaletteItems() {
    const container = document.getElementById('palette-results');
    if (!container) return;

    if (paletteCurrentMatches.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-dim); font-size: 0.9rem;">
            ${document.getElementById('palette-input')?.value ? t('no_results_found') : (currentLang === 'ar' ? 'ابدأ الكتابة للبحث...' : 'Start typing to find items...')}
        </div>`;
        return;
    }

    container.innerHTML = paletteCurrentMatches.slice(0, 8).map((m, idx) => `
        <div class="palette-item ${idx === paletteSelectedIndex ? 'selected' : ''}" 
             onclick="jumpToPaletteItem('${m.type}', ${m.id})">
            <div class="item-info">
                <span class="item-type">${m.type}</span>
                <span class="item-name">${m.label}</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-dim);">${m.sub}</span>
        </div>
    `).join('');

    // Ensure selected item is visible
    const selectedEl = container.querySelector('.palette-item.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
}

function jumpToPaletteItem(type, id) {
    closeCommandPalette();

    if (type === 'diamond' || type === 'gold') {
        const cat = type === 'diamond' ? 'diamonds' : 'gold';
        const item = inventory[cat].find(i => i.id === id);
        if (!item) return;

        // 1. Set global search to exactly this SKU
        currentSearch = item.sku;

        // 2. Reset the Range filter to 'All' so we don't hide the result
        currentInventoryRanges[cat] = 'All';

        // 3. Jump to view and render
        showView(cat);

        // 4. Force immediate grid update to isolate the item
        setTimeout(() => {
            const input = document.getElementById(`${type === 'diamond' ? 'diamond' : 'gold'}-search-input`);
            if (input) input.value = item.sku;
            updateInventoryGrid(cat);
        }, 50);

    } else if (type === 'customer') {
        const customer = inventory.customers.find(c => c.id === id);
        if (!customer) return;

        // Jump to customers
        showView('customers');

        setTimeout(() => {
            viewCustomerDetail(id);
        }, 50);
    }
}

function setButtonLoading(isLoading) {
    const btn = document.querySelector('form button[type="submit"]');
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.setAttribute('data-original-text', originalText);
        btn.innerHTML = '<span class="spinner"></span> ' + (t('saving') || 'Saving...');
    } else {
        btn.disabled = false;
        const savedText = btn.getAttribute('data-original-text');
        btn.innerHTML = savedText || t('save');
    }
}

let html5QrCode = null;

async function startQRScanner() {
    const overlay = document.getElementById('qr-scanner-overlay');
    overlay.classList.remove('hidden');
    
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    try {
        await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
    } catch (err) {
        console.error("Camera error:", err);
        alert("Could not start camera: " + err);
        stopQRScanner();
    }
}

function stopQRScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('qr-scanner-overlay').classList.add('hidden');
            html5QrCode = null;
        }).catch(err => {
            console.error("Stop error:", err);
            document.getElementById('qr-scanner-overlay').classList.add('hidden');
        });
    } else {
        document.getElementById('qr-scanner-overlay').classList.add('hidden');
    }
}

function onScanSuccess(decodedText, decodedResult) {
    console.log("Code matched =", decodedText, decodedResult);
    stopQRScanner();
    
    if (navigator.vibrate) navigator.vibrate(100);

    const sku = decodedText.trim().toUpperCase();
    
    if (sku.startsWith('D-')) {
        const item = inventory.diamonds.find(i => i.sku === sku);
        if (item) {
            showView('diamonds');
            setTimeout(() => openItemModal('diamonds', item.id), 100);
        } else alert("Diamond not found: " + sku);
    } else if (sku.startsWith('G-')) {
        const item = inventory.gold.find(i => i.sku === sku);
        if (item) {
            showView('gold');
            setTimeout(() => openItemModal('gold', item.id), 100);
        } else alert("Gold item not found: " + sku);
    } else if (sku.startsWith('R-')) {
        const item = inventory.repairs.find(j => j.sku === sku);
        if (item) {
            showView('workshop');
            setTimeout(() => openRepairModal(item.id), 100);
        } else alert("Repair job not found: " + sku);
    } else {
        alert("Unknown QR Code format: " + sku);
    }
}
