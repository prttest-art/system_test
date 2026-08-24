// ============================================================
// 辅助函数 (utils.js - 統一使用 GMT+7)
// ============================================================

// ============================================================
// GMT+7 時區工具函數
// ============================================================

/**
 * 獲取 GMT+7 時區的當前時間
 * @param {Date|string} date - 可選，指定日期
 * @returns {Date} GMT+7 時區的 Date 物件
 */
function getGMT7Date(date) {
    const d = date ? new Date(date) : new Date();
    // 獲取本地時間的 GMT+7 偏移
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    const gmt7Time = utcTime + (7 * 60 * 60000);
    return new Date(gmt7Time);
}

/**
 * 獲取當前 GMT+7 時間 (YYYY-MM-DD HH:mm:ss)
 */
function now() {
    const d = getGMT7Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 獲取當前 GMT+7 日期 (YYYY-MM-DD)
 */
function today() {
    const d = getGMT7Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 獲取當前 GMT+7 時間 (HH:mm:ss)
 */
function getCurrentTime() {
    const d = getGMT7Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * 獲取當前 GMT+7 小時和分鐘 (HH:mm)
 */
function getCurrentHourMinute() {
    const d = getGMT7Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * 格式化日期顯示 (YYYY-MM-DD HH:mm)
 * 將任何格式的時間轉換為 GMT+7 顯示
 */
function formatDate(dt) {
    if (!dt) return '-';
    
    try {
        const date = getGMT7Date(dt);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
    } catch(e) {}
    
    // 如果解析失敗，嘗試直接顯示
    return dt.substring(0, 16);
}

/**
 * 格式化日期時間（完整顯示，含秒）
 */
function formatDateTime(dt) {
    if (!dt) return '-';
    
    try {
        const date = getGMT7Date(dt);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
    } catch(e) {}
    
    return dt;
}

/**
 * 格式化持續時間
 */
function formatDuration(hours) {
    if (!hours || hours <= 0) return '0分';
    const totalSeconds = Math.floor(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    let parts = [];
    if (h > 0) parts.push(h + '小时');
    if (m > 0) parts.push(m + '分');
    if (s > 0) parts.push(s + '秒');
    return parts.join('') || '0分';
}

/**
 * 將本地時間轉換為 GMT+7 時間字符串
 */
function toGMT7(dateStr) {
    if (!dateStr) return '';
    try {
        const date = getGMT7Date(dateStr);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
    } catch(e) {}
    return dateStr;
}

/**
 * 解析 GMT+7 時間字符串為 Date 物件
 */
function parseGMT7(dateStr) {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return getGMT7Date(date);
        }
    } catch(e) {}
    return null;
}

// ============================================================
// 匯率相關函數
// ============================================================

function getCurrencyRate(currency) {
    const currencies = DB.get('currencies', []);
    const found = currencies.find(c => c.currency === currency);
    return found ? found.rate : 1;
}

/**
 * 獲取幣種的買入價（銀行買入外幣，即外幣→泰銖）
 */
function getBuyRate(currency) {
    if (currency === 'THB') return 1;
    const currencies = DB.get('currencies', []);
    const found = currencies.find(c => c.currency === currency);
    return found ? (found.buy_rate || found.rate || 1) : 1;
}

/**
 * 獲取幣種的賣出價（銀行賣出外幣，即泰銖→外幣）
 */
function getSellRate(currency) {
    if (currency === 'THB') return 1;
    const currencies = DB.get('currencies', []);
    const found = currencies.find(c => c.currency === currency);
    return found ? (found.sell_rate || found.rate || 1) : 1;
}

/**
 * 獲取幣種的中间匯率（用於顯示參考）
 */
function getMidRate(currency) {
    if (currency === 'THB') return 1;
    const buy = getBuyRate(currency);
    const sell = getSellRate(currency);
    return (buy + sell) / 2;
}

/**
 * 外幣轉換為泰銖（使用買入價），無條件舍去到整數位
 */
function convertToTHB(amount, currency) {
    if (currency === 'THB') return Math.floor(amount);
    return Math.floor(amount * getBuyRate(currency));
}

/**
 * 泰銖轉換為外幣（使用賣出價），無條件舍去到整數位
 */
function convertFromTHB(thbAmount, currency) {
    if (currency === 'THB') return Math.floor(thbAmount);
    const sellRate = getSellRate(currency);
    if (sellRate <= 0) return 0;
    return Math.floor(thbAmount / sellRate);
}

/**
 * 外幣→外幣換算（先買入價轉泰銖，再賣出價轉目標幣種）
 */
function convertCrossCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return Math.floor(amount);
    const thbAmount = convertToTHB(amount, fromCurrency);
    return convertFromTHB(thbAmount, toCurrency);
}

/**
 * 獲取幣種匯率顯示信息
 */
function getCurrencyRateInfo(currency) {
    if (currency === 'THB') {
        return { buy: 1, sell: 1, mid: 1 };
    }
    const currencies = DB.get('currencies', []);
    const found = currencies.find(c => c.currency === currency);
    if (found) {
        return {
            buy: found.buy_rate || found.rate || 1,
            sell: found.sell_rate || found.rate || 1,
            mid: ((found.buy_rate || found.rate || 1) + (found.sell_rate || found.rate || 1)) / 2
        };
    }
    return { buy: 1, sell: 1, mid: 1 };
}

// ============================================================
// 會員相關函數
// ============================================================

function getMember(id) {
    const members = DB.get('members', []);
    return members.find(m => m.id === id);
}

function getMemberByName(name) {
    const members = DB.get('members', []);
    return members.find(m => m.name === name);
}

function getMemberAccount(memberId) {
    const memberAccounts = DB.get('member_accounts', []);
    let account = memberAccounts.find(ma => ma.member_id === memberId);
    if (!account) {
        account = {
            member_id: memberId,
            balances: {
                THB: 0,
                CNY: 0,
                USD: 0,
                LAK: 0,
                USDT: 0
            }
        };
        memberAccounts.push(account);
        DB.set('member_accounts', memberAccounts);
    }
    return account;
}

function getMemberAccountBalance(memberId, currency) {
    const account = getMemberAccount(memberId);
    return account.balances[currency] || 0;
}

function updateMemberAccountBalance(memberId, currency, amount) {
    const memberAccounts = DB.get('member_accounts', []);
    let account = memberAccounts.find(ma => ma.member_id === memberId);
    if (!account) {
        account = {
            member_id: memberId,
            balances: {
                THB: 0,
                CNY: 0,
                USD: 0,
                LAK: 0,
                USDT: 0
            }
        };
        memberAccounts.push(account);
    }
    account.balances[currency] = (account.balances[currency] || 0) + amount;
    DB.set('member_accounts', memberAccounts);
    return true;
}

function getMemberAccountTransactions(memberId, limit) {
    const tx = DB.get('member_account_transactions', []);
    const filtered = tx.filter(t => t.member_id === memberId);
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return filtered.slice(0, limit || 100);
}

// ============================================================
// 介紹人相關函數
// ============================================================

function getAgent(id) {
    const agents = DB.get('agents', []);
    return agents.find(a => a.id === id);
}

function getAgentLevel(id) {
    const levels = DB.get('agent_levels', []);
    return levels.find(l => l.id === id);
}

function getAgentStats(id) {
    const members = DB.get('members', []).filter(m => m.intermediary_id === id);
    return {
        member_count: members.length,
        total_balance: members.reduce((sum, m) => sum + m.balance, 0),
        total_loan: members.reduce((sum, m) => sum + m.unpaid_loan, 0)
    };
}

// ============================================================
// 帳戶相關函數（往來帳款）
// ============================================================

function getAccount(id) {
    const accounts = DB.get('accounts', []);
    return accounts.find(a => a.id === id);
}

function getAccountBalance(accountId, currency) {
    const account = getAccount(accountId);
    if (account && account.balances) {
        return account.balances[currency] || 0;
    }
    return 0;
}

function updateAccountBalance(accountId, currency, amount) {
    const accounts = DB.get('accounts', []);
    const account = accounts.find(a => a.id === accountId);
    if (account && account.balances) {
        account.balances[currency] = (account.balances[currency] || 0) + amount;
        DB.set('accounts', accounts);
        return true;
    }
    return false;
}

function add_account_currency(account_id, currency, initial_balance) {
    const accounts = DB.get('accounts', []);
    const account = accounts.find(a => a.id === account_id);
    if (!account) return false;
    if (account.balances[currency] !== undefined) return false;
    account.balances[currency] = initial_balance || 0;
    account.updated_at = now();
    DB.set('accounts', accounts);
    return true;
}

function get_account_balance(account_id, currency) {
    const account = getAccount(account_id);
    if (account && account.balances) {
        return account.balances[currency] || 0;
    }
    return 0;
}

function update_account_balance(account_id, currency, amount_change) {
    const accounts = DB.get('accounts', []);
    const account = accounts.find(a => a.id === account_id);
    if (!account) return false;
    if (account.balances[currency] === undefined) {
        account.balances[currency] = 0;
    }
    account.balances[currency] += amount_change;
    account.updated_at = now();
    DB.set('accounts', accounts);
    return true;
}

function add_account_transaction(account_id, currency, amount, type, reference_type, reference_id, note) {
    const accountTx = DB.get('account_transactions', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: account_id,
        currency: currency,
        amount: amount,
        type: type,
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    update_account_balance(account_id, currency, type === 'in' ? amount : -amount);
    return true;
}

function get_account_transactions(account_id, limit) {
    const tx = DB.get('account_transactions', []);
    const filtered = tx.filter(t => t.account_id === account_id);
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return filtered.slice(0, limit || 100);
}

function get_account_currency_options() {
    const accounts = DB.get('accounts', []);
    const options = [];
    accounts.forEach(a => {
        if (a.balances) {
            Object.keys(a.balances).forEach(currency => {
                options.push({
                    id: a.id,
                    name: a.name,
                    currency: currency,
                    balance: a.balances[currency] || 0
                });
            });
        }
    });
    return options;
}

// ============================================================
// 台桌相關函數
// ============================================================

function calculatePlayerDuration(sessionId) {
    const upRecords = DB.get('up_records', []).filter(r => r.session_id === sessionId);
    const downRecords = DB.get('down_records', []).filter(r => r.session_id === sessionId);
    
    if (upRecords.length === 0 || downRecords.length === 0) return 0;
    
    // 使用 GMT+7 時間排序
    upRecords.sort((a, b) => {
        const da = parseGMT7(a.up_time);
        const db = parseGMT7(b.up_time);
        return da - db;
    });
    downRecords.sort((a, b) => {
        const da = parseGMT7(a.down_time);
        const db = parseGMT7(b.down_time);
        return da - db;
    });
    
    let totalSeconds = 0;
    let upIndex = 0;
    
    for (const down of downRecords) {
        const downDt = parseGMT7(down.down_time);
        let bestUp = null;
        let bestUpIndex = upIndex;
        
        for (let i = upIndex; i < upRecords.length; i++) {
            const upDt = parseGMT7(upRecords[i].up_time);
            if (upDt <= downDt) {
                bestUp = upDt;
                bestUpIndex = i + 1;
            } else {
                break;
            }
        }
        
        if (bestUp === null && upRecords.length > 0) {
            bestUp = parseGMT7(upRecords[0].up_time);
            bestUpIndex = 1;
        }
        
        if (bestUp) {
            const segmentSeconds = (downDt - bestUp) / 1000;
            if (segmentSeconds > 0) {
                totalSeconds += segmentSeconds;
            }
        }
        upIndex = bestUpIndex;
    }
    
    return totalSeconds / 3600;
}

// ============================================================
// 计算玩家退水 - 四捨五入到百位
// ============================================================

function calculatePlayerRebate(sessionId, totalWater, totalHours) {
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return 0;
    
    const playerDuration = calculatePlayerDuration(sessionId);
    if (playerDuration <= 0 || totalHours <= 0 || totalWater <= 0) return 0;
    
    const agent = getAgent(session.agent_id);
    let rebateRate = 0;
    if (agent) {
        const level = getAgentLevel(agent.level_id);
        if (level) rebateRate = level.rate;
    }
    
    const hourlyWater = totalWater / totalHours;
    const rawRebate = hourlyWater * (rebateRate / 100) * playerDuration;
    
    // ★ 四捨五入到百位
    return Math.round(rawRebate / 100) * 100;
}

function get_table_open_record(tableType) {
    const sessions = DB.get('sessions', []);
    return sessions.find(s => s.table_type === tableType && s.session_type === 'table_open' && s.status === 'active');
}

function getTableSessionUpTime(sessionId) {
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    return session ? session.start_time : null;
}

// ============================================================
// 統計相關函數
// ============================================================

function getDashboardStats() {
    const members = DB.get('members', []);
    const transactions = DB.get('transactions', []);
    const sessions = DB.get('sessions', []);
    
    let totalRecharge = 0, totalRefund = 0, totalLoan = 0, totalRepay = 0, totalRebate = 0;
    transactions.forEach(t => {
        if (t.type === 'recharge') totalRecharge += t.amount;
        else if (t.type === 'refund') totalRefund += t.amount;
        else if (t.type === 'loan') totalLoan += t.amount;
        else if (t.type === 'repay') totalRepay += t.amount;
        else if (t.type === 'rebate') totalRebate += t.amount;
    });
    
    const activeSessions = sessions.filter(s => s.status === 'active' && s.session_type === 'player');
    const totalBalance = members.reduce((sum, m) => sum + m.balance, 0);
    const totalLoanAmount = members.reduce((sum, m) => sum + m.unpaid_loan, 0);
    const actualRevenue = totalRecharge - totalRefund + totalRepay - totalLoan - totalRebate;
    
    const tables = ['决赛桌', 'VIP包1', 'VIP包2', '大厅1', '大厅2'];
    const tableStats = {};
    tables.forEach(t => {
        tableStats[t] = sessions.filter(s => s.table_type === t && s.status === 'active' && s.session_type === 'player').length;
    });
    
    return {
        total_recharge: totalRecharge,
        total_refund: totalRefund,
        total_loan: totalLoan,
        total_repay: totalRepay,
        total_rebate: totalRebate,
        actual_revenue: actualRevenue,
        total_members: members.length,
        active_tables: activeSessions.length,
        total_balance: totalBalance,
        total_loan_amount: totalLoanAmount,
        table_stats: tableStats
    };
}

// ============================================================
// 格式化函數
// ============================================================

function formatNumber(num) {
    if (num === undefined || num === null) return '0.00';
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================
// 時間測試工具（用於調試）
// ============================================================

function testTime() {
    console.log('=== GMT+7 時間測試 ===');
    console.log('now():', now());
    console.log('today():', today());
    console.log('getCurrentTime():', getCurrentTime());
    console.log('getCurrentHourMinute():', getCurrentHourMinute());
    console.log('formatDate(now()):', formatDate(now()));
    console.log('formatDateTime(now()):', formatDateTime(now()));
    
    const isoDate = new Date().toISOString();
    console.log('ISO 格式:', isoDate);
    console.log('轉換為 GMT+7:', formatDateTime(isoDate));
    console.log('轉換為 GMT+7 (短):', formatDate(isoDate));
    
    const local = new Date();
    const gmt7 = getGMT7Date();
    console.log('本地時間:', local.toString());
    console.log('GMT+7 時間:', gmt7.toString());
    console.log('時差 (小時):', (gmt7 - local) / 3600000);
}

// ============================================================
// 管理員相關函數（從 database.js 引用）
// ============================================================

// 注意：以下函數在 database.js 中已定義，這裡只是為了確保可用性
// 如果 database.js 已加載，這些函數會被覆蓋

function getCurrentAdmin() {
    try {
        const session = sessionStorage.getItem('rpt_current_admin');
        if (!session) return null;
        const parsed = JSON.parse(session);
        if (parsed && parsed.id && parsed.username) {
            if (!parsed.display_name) {
                parsed.display_name = parsed.username;
            }
            return parsed;
        }
        sessionStorage.removeItem('rpt_current_admin');
        return null;
    } catch(e) {
        sessionStorage.removeItem('rpt_current_admin');
        return null;
    }
}

function getCurrentAdminName() {
    const admin = getCurrentAdmin();
    return admin ? (admin.display_name || admin.username) : '系统';
}

function getCurrentAdminId() {
    const admin = getCurrentAdmin();
    return admin ? admin.id : null;
}

// ============================================================
// 對外暴露全局函數
// ============================================================

// 時間函數
window.getGMT7Date = getGMT7Date;
window.now = now;
window.today = today;
window.getCurrentTime = getCurrentTime;
window.getCurrentHourMinute = getCurrentHourMinute;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatDuration = formatDuration;
window.toGMT7 = toGMT7;
window.parseGMT7 = parseGMT7;

// 匯率函數
window.getCurrencyRate = getCurrencyRate;
window.getBuyRate = getBuyRate;
window.getSellRate = getSellRate;
window.getMidRate = getMidRate;
window.convertToTHB = convertToTHB;
window.convertFromTHB = convertFromTHB;
window.convertCrossCurrency = convertCrossCurrency;
window.getCurrencyRateInfo = getCurrencyRateInfo;

// 會員函數
window.getMember = getMember;
window.getMemberByName = getMemberByName;
window.getMemberAccount = getMemberAccount;
window.getMemberAccountBalance = getMemberAccountBalance;
window.updateMemberAccountBalance = updateMemberAccountBalance;
window.getMemberAccountTransactions = getMemberAccountTransactions;

// 介紹人函數
window.getAgent = getAgent;
window.getAgentLevel = getAgentLevel;
window.getAgentStats = getAgentStats;

// 帳戶函數
window.getAccount = getAccount;
window.getAccountBalance = getAccountBalance;
window.updateAccountBalance = updateAccountBalance;
window.add_account_currency = add_account_currency;
window.get_account_balance = get_account_balance;
window.update_account_balance = update_account_balance;
window.add_account_transaction = add_account_transaction;
window.get_account_transactions = get_account_transactions;
window.get_account_currency_options = get_account_currency_options;

// 台桌函數
window.calculatePlayerDuration = calculatePlayerDuration;
window.calculatePlayerRebate = calculatePlayerRebate;
window.get_table_open_record = get_table_open_record;
window.getTableSessionUpTime = getTableSessionUpTime;

// 統計函數
window.getDashboardStats = getDashboardStats;

// 格式化函數
window.formatNumber = formatNumber;
window.formatFileSize = formatFileSize;

// 管理員函數
window.getCurrentAdmin = getCurrentAdmin;
window.getCurrentAdminName = getCurrentAdminName;
window.getCurrentAdminId = getCurrentAdminId;

// 測試函數
window.testTime = testTime;