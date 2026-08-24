// ============================================================
// 数据库（使用 localStorage）- 統一使用 GMT+7 時區
// ============================================================

const DB = {
    get(key, defaultVal) {
        try {
            const data = localStorage.getItem('rpt_' + key);
            return data ? JSON.parse(data) : defaultVal;
        } catch { return defaultVal; }
    },
    set(key, val) {
        localStorage.setItem('rpt_' + key, JSON.stringify(val));
    },
    getNextId(key) {
        const id = this.get(key + '_next', 1);
        this.set(key + '_next', id + 1);
        return id;
    }
};

// ============================================================
// GMT+7 時區工具函數
// ============================================================

/**
 * 獲取 GMT+7 時區的當前時間
 * @param {Date} date - 可選，指定日期
 * @returns {Date} GMT+7 時區的 Date 物件
 */
function getGMT7Date(date) {
    const d = date ? new Date(date) : new Date();
    // 獲取本地時間的 GMT+7 偏移
    // 注意：getTimezoneOffset() 返回分鐘數，本地時區與 UTC 的差值
    // 我們需要強制轉換為 GMT+7
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
        // 嘗試將輸入轉換為 GMT+7 時間
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
        // 嘗試直接解析
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return getGMT7Date(date);
        }
    } catch(e) {}
    return null;
}

// ============================================================
// 管理員相關函數
// ============================================================

function getCurrentAdmin() {
    try {
        const session = sessionStorage.getItem('rpt_current_admin');
        if (!session) {
            console.warn('⚠️ 沒有找到管理員 session');
            return null;
        }
        
        const parsed = JSON.parse(session);
        if (parsed && parsed.id && parsed.username) {
            if (!parsed.display_name) {
                parsed.display_name = parsed.username;
            }
            console.log('✅ 當前管理員:', parsed.username, '角色:', parsed.role);
            return parsed;
        }
        
        console.warn('⚠️ 管理員資料不完整，清除 session');
        sessionStorage.removeItem('rpt_current_admin');
        return null;
    } catch(e) {
        console.warn('⚠️ 解析管理員資料失敗:', e.message);
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

function setCurrentAdmin(admin) {
    try {
        const adminData = {
            id: admin.id,
            username: admin.username,
            password: admin.password || '',
            display_name: admin.display_name || admin.username,
            role: admin.role || 'admin',
            permissions: admin.permissions || {},
            created_at: admin.created_at || now()
        };
        sessionStorage.setItem('rpt_current_admin', JSON.stringify(adminData));
        console.log('✅ 管理員已儲存到 session:', adminData.username);
    } catch(e) {
        console.error('儲存管理員資料失敗:', e);
    }
}

function clearCurrentAdmin() {
    sessionStorage.removeItem('rpt_current_admin');
    console.log('✅ 管理員已從 session 清除');
}

// ============================================================
// 操作日志功能
// ============================================================

function initOperationLog() {
    if (!localStorage.getItem('rpt_operation_logs')) {
        DB.set('operation_logs', []);
        DB.set('operation_logs_next', 1);
    }
}

/**
 * 记录操作日志
 * @param {string} module - 模块名称
 * @param {string} action - 操作类型
 * @param {string} target - 操作目标
 * @param {string} detail - 详细描述
 * @param {number} targetId - 目标ID（可选）
 * @param {object} beforeData - 修改前的数据（可选）
 * @param {object} afterData - 修改后的数据（可选）
 */
function addOperationLog(module, action, target, detail, targetId, beforeData, afterData) {
    initOperationLog();
    const logs = DB.get('operation_logs', []);
    const admin = getCurrentAdmin();
    const adminName = admin ? (admin.display_name || admin.username) : '系统';
    const adminId = admin ? admin.id : null;
    
    logs.push({
        id: DB.getNextId('operation_logs'),
        module: module,
        action: action,
        target: target,
        detail: detail || '',
        target_id: targetId || null,
        admin_id: adminId,
        admin_name: adminName,
        before_data: beforeData ? JSON.stringify(beforeData) : null,
        after_data: afterData ? JSON.stringify(afterData) : null,
        created_at: now()
    });
    DB.set('operation_logs', logs);
    return true;
}

// ============================================================
// 汇率相关函数（买入价 / 卖出价）- 所有换汇都无条件舍去到整数位
// ============================================================

/**
 * 获取币种的买入价（银行买入外币，即外币→泰铢）
 * 买入价通常较低
 */
function getBuyRate(currency) {
    if (currency === 'THB') return 1;
    const currencies = DB.get('currencies', []);
    const found = currencies.find(c => c.currency === currency);
    return found ? (found.buy_rate || found.rate || 1) : 1;
}

/**
 * 获取币种的卖出价（银行卖出外币，即泰铢→外币）
 * 卖出价通常较高
 */
function getSellRate(currency) {
    if (currency === 'THB') return 1;
    const currencies = DB.get('currencies', []);
    const found = currencies.find(c => c.currency === currency);
    return found ? (found.sell_rate || found.rate || 1) : 1;
}

/**
 * 获取币种的中间汇率（用于显示参考）
 */
function getMidRate(currency) {
    if (currency === 'THB') return 1;
    const buy = getBuyRate(currency);
    const sell = getSellRate(currency);
    return (buy + sell) / 2;
}

/**
 * ★ 外币转换为泰铢（使用买入价），无条件舍去到整数位
 */
function convertToTHB(amount, currency) {
    if (currency === 'THB') return Math.floor(amount);
    return Math.floor(amount * getBuyRate(currency));
}

/**
 * ★ 泰铢转换为外币（使用卖出价），无条件舍去到整数位
 */
function convertFromTHB(thbAmount, currency) {
    if (currency === 'THB') return Math.floor(thbAmount);
    const sellRate = getSellRate(currency);
    if (sellRate <= 0) return 0;
    return Math.floor(thbAmount / sellRate);
}

/**
 * ★ 外币→外币换算（先买入价转泰铢，再卖出价转目标币种）
 */
function convertCrossCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return Math.floor(amount);
    const thbAmount = convertToTHB(amount, fromCurrency);
    return convertFromTHB(thbAmount, toCurrency);
}

/**
 * 获取币种汇率显示信息
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

function getCurrencyRate(currency) {
    return getMidRate(currency);
}

// ============================================================
// 初始化数据
// ============================================================

function initData() {
    // 币种汇率
    if (!localStorage.getItem('rpt_currencies')) {
        DB.set('currencies', [
            { currency: 'THB', name: '泰铢', buy_rate: 1, sell_rate: 1, rate: 1 },
            { currency: 'CNY', name: '人民币', buy_rate: 4.75, sell_rate: 5.25, rate: 5 },
            { currency: 'USD', name: '美金', buy_rate: 33, sell_rate: 37, rate: 35 },
            { currency: 'LAK', name: '老币', buy_rate: 0.0015, sell_rate: 0.0017, rate: 0.0016 },
            { currency: 'USDT', name: 'USDT', buy_rate: 33, sell_rate: 37, rate: 35 }
        ]);
    }
    
    // 介绍人等级
    if (!localStorage.getItem('rpt_agent_levels')) {
        DB.set('agent_levels', [
            { id: 1, name: '一般', rate: 5 },
            { id: 2, name: '铜牌', rate: 8 },
            { id: 3, name: '银牌', rate: 12 },
            { id: 4, name: '金牌', rate: 18 },
            { id: 5, name: '钻石', rate: 25 }
        ]);
        DB.set('agent_levels_next', 6);
    }
    
    // 管理员账号
    if (!localStorage.getItem('rpt_admins')) {
        DB.set('admins', [
            { 
                id: 1, 
                username: 'admin', 
                password: 'admin123', 
                display_name: '总管理员',
                role: 'super_admin',
                permissions: {
                    members: true,
                    agents: true,
                    tables: true,
                    transactions: true,
                    flow: true,
                    accounts: true,
                    currency: true,
                    permissions: true
                },
                created_at: now()
            }
        ]);
        DB.set('admins_next', 2);
    }
    
    // ★ 会员 - 空
    if (!localStorage.getItem('rpt_members')) {
        DB.set('members', []);
        DB.set('members_next', 1);
    }
    
    // ★ 介绍人 - 空
    if (!localStorage.getItem('rpt_agents')) {
        DB.set('agents', []);
        DB.set('agents_next', 1);
    }
    
    // ★ 员工 - 空（不建立預設員工）
    if (!localStorage.getItem('rpt_employees')) {
        DB.set('employees', []);
        DB.set('employees_next', 1);
    }
    
    // ★ 部門 - 空
    if (!localStorage.getItem('rpt_departments')) {
        DB.set('departments', []);
    }
    
    // ★ 職位 - 空
    if (!localStorage.getItem('rpt_positions')) {
        DB.set('positions', []);
    }
    
    // 账户（往來帳款）
    if (!localStorage.getItem('rpt_accounts')) {
        DB.set('accounts', [
            { id: 1, name: '默认账户', description: '系统默认账户', balances: { THB: 0, CNY: 0, USD: 0, LAK: 0, USDT: 0 } }
        ]);
        DB.set('accounts_next', 2);
        DB.set('account_transactions', []);
    }
    
    // 会员账户
    if (!localStorage.getItem('rpt_member_accounts')) {
        DB.set('member_accounts', []);
    }
    
    // 会员账户交易记录
    if (!localStorage.getItem('rpt_member_account_transactions')) {
        DB.set('member_account_transactions', []);
        DB.set('member_account_transactions_next', 1);
    }
    
    // 保险记录
    if (!localStorage.getItem('rpt_insurance_records')) {
        DB.set('insurance_records', []);
        DB.set('insurance_records_next', 1);
    }
    
    // 台桌会话
    if (!localStorage.getItem('rpt_sessions')) {
        DB.set('sessions', []);
        DB.set('sessions_next', 1);
    }
    
    // 交易记录
    if (!localStorage.getItem('rpt_transactions')) {
        DB.set('transactions', []);
        DB.set('transactions_next', 1);
    }
    
    // 抽水记录
    if (!localStorage.getItem('rpt_water_records')) {
        DB.set('water_records', []);
        DB.set('water_records_next', 1);
    }
    
    // 每日台帐
    if (!localStorage.getItem('rpt_daily_settlements')) {
        DB.set('daily_settlements', []);
        DB.set('daily_settlements_next', 1);
    }
    
    // 上分记录
    if (!localStorage.getItem('rpt_up_records')) {
        DB.set('up_records', []);
        DB.set('up_records_next', 1);
    }
    
    // 下分记录
    if (!localStorage.getItem('rpt_down_records')) {
        DB.set('down_records', []);
        DB.set('down_records_next', 1);
    }
    
    // 充值记录
    if (!localStorage.getItem('rpt_recharge_records')) {
        DB.set('recharge_records', []);
        DB.set('recharge_records_next', 1);
    }
    
    // 出金记录
    if (!localStorage.getItem('rpt_withdraw_records')) {
        DB.set('withdraw_records', []);
        DB.set('withdraw_records_next', 1);
    }
    
    // 账户交易记录
    if (!localStorage.getItem('rpt_account_transactions')) {
        DB.set('account_transactions', []);
        DB.set('account_transactions_next', 1);
    }
    
    // 兑汇记录
    if (!localStorage.getItem('rpt_exchange_records')) {
        DB.set('exchange_records', []);
        DB.set('exchange_records_next', 1);
    }
    
    // 小费记录
    if (!localStorage.getItem('rpt_tips_records')) {
        DB.set('tips_records', []);
        DB.set('tips_records_next', 1);
    }
    
    // 出勤记录
    if (!localStorage.getItem('rpt_attendance_records')) {
        DB.set('attendance_records', []);
        DB.set('attendance_records_next', 1);
    }
    
    // 出勤设定
    if (!localStorage.getItem('rpt_attendance_settings')) {
        DB.set('attendance_settings', {
            work_start_time: '09:00',
            work_end_time: '18:00',
            late_threshold: 15
        });
    }
    
    // 操作日志
    if (!localStorage.getItem('rpt_operation_logs')) {
        DB.set('operation_logs', []);
        DB.set('operation_logs_next', 1);
    }
    
    // 数据迁移
    migrateData();
}
// ============================================================
// 数据迁移
// ============================================================

function migrateData() {
    // 修正 CNY 汇率为正确值
    const currencies = DB.get('currencies', []);
    let needUpdateCurrency = false;
    
    currencies.forEach(c => {
        if (c.rate !== undefined && (c.buy_rate === undefined || c.sell_rate === undefined)) {
            const rate = c.rate;
            if (c.currency === 'THB') {
                c.buy_rate = 1;
                c.sell_rate = 1;
            } else if (c.currency === 'CNY') {
                c.buy_rate = 4.75;
                c.sell_rate = 5.25;
                c.rate = (4.75 + 5.25) / 2;
            } else {
                c.buy_rate = Math.round(rate * 0.95 * 10000) / 10000;
                c.sell_rate = Math.round(rate * 1.05 * 10000) / 10000;
                if (c.buy_rate >= c.sell_rate) {
                    c.buy_rate = rate * 0.97;
                    c.sell_rate = rate * 1.03;
                }
            }
            needUpdateCurrency = true;
        }
        
        if (c.currency === 'CNY') {
            if (c.buy_rate !== 4.75 || c.sell_rate !== 5.25) {
                console.log('⚠️ 检测到 CNY 汇率不正确，强制修正为：买入 4.75，卖出 5.25');
                c.buy_rate = 4.75;
                c.sell_rate = 5.25;
                c.rate = (4.75 + 5.25) / 2;
                needUpdateCurrency = true;
            }
        }
    });
    
    if (needUpdateCurrency) {
        DB.set('currencies', currencies);
    }
    
    // 迁移交易记录
    let transactions = DB.get('transactions', []);
    let needUpdate = false;
    transactions.forEach(t => {
        if (!t.admin_id) {
            t.admin_id = 1;
            t.admin_name = '系统';
            needUpdate = true;
        }
    });
    if (needUpdate) {
        DB.set('transactions', transactions);
    }
    
    // 迁移上分记录
    let upRecords = DB.get('up_records', []);
    let needUpdateUp = false;
    upRecords.forEach(r => {
        if (!r.admin_id) {
            r.admin_id = 1;
            r.admin_name = '系统';
            needUpdateUp = true;
        }
    });
    if (needUpdateUp) {
        DB.set('up_records', upRecords);
    }
    
    // 迁移下分记录
    let downRecords = DB.get('down_records', []);
    let needUpdateDown = false;
    downRecords.forEach(r => {
        if (!r.admin_id) {
            r.admin_id = 1;
            r.admin_name = '系统';
            needUpdateDown = true;
        }
    });
    if (needUpdateDown) {
        DB.set('down_records', downRecords);
    }
    
    // 迁移充值记录
    let rechargeRecords = DB.get('recharge_records', []);
    let needUpdateRecharge = false;
    rechargeRecords.forEach(r => {
        if (!r.admin_id) {
            r.admin_id = 1;
            r.admin_name = '系统';
            needUpdateRecharge = true;
        }
    });
    if (needUpdateRecharge) {
        DB.set('recharge_records', rechargeRecords);
    }
    
    // 迁移出金记录
    let withdrawRecords = DB.get('withdraw_records', []);
    let needUpdateWithdraw = false;
    withdrawRecords.forEach(r => {
        if (!r.admin_id) {
            r.admin_id = 1;
            r.admin_name = '系统';
            needUpdateWithdraw = true;
        }
    });
    if (needUpdateWithdraw) {
        DB.set('withdraw_records', withdrawRecords);
    }
    
    // 迁移保险记录
    let insuranceRecords = DB.get('insurance_records', []);
    let needUpdateInsurance = false;
    insuranceRecords.forEach(r => {
        if (!r.admin_id) {
            r.admin_id = 1;
            r.admin_name = '系统';
            needUpdateInsurance = true;
        }
    });
    if (needUpdateInsurance) {
        DB.set('insurance_records', insuranceRecords);
    }
}

// ============================================================
// 管理员相关函数
// ============================================================

function getAdmins() {
    return DB.get('admins', []);
}

function getAdmin(id) {
    const admins = DB.get('admins', []);
    return admins.find(a => a.id === id);
}

function getAdminByUsername(username) {
    const admins = DB.get('admins', []);
    return admins.find(a => a.username === username);
}

function verifyAdmin(username, password) {
    const admins = DB.get('admins', []);
    return admins.find(a => a.username === username && a.password === password);
}

function addAdmin(username, password, display_name, role, permissions) {
    const admins = DB.get('admins', []);
    if (admins.find(a => a.username === username)) {
        return false;
    }
    
    const cleanPassword = password.replace(/["'\\]/g, '');
    
    const newAdmin = {
        id: DB.getNextId('admins'),
        username: username,
        password: cleanPassword,
        display_name: display_name || username,
        role: role || 'admin',
        permissions: permissions || {
            members: true,
            agents: true,
            tables: true,
            transactions: true,
            flow: true,
            accounts: true,
            currency: true,
            permissions: false
        },
        created_at: now()
    };
    admins.push(newAdmin);
    DB.set('admins', admins);
    
    addOperationLog('权限管理', '新增', username, `新增管理员：${username} (${display_name || username})`);
    
    return true;
}

function updateAdmin(id, data) {
    const admins = DB.get('admins', []);
    const admin = admins.find(a => a.id === id);
    if (!admin) return false;
    
    const beforeData = { ...admin };
    
    if (data.username !== undefined) admin.username = data.username;
    if (data.password) {
        admin.password = data.password.replace(/["'\\]/g, '');
    }
    if (data.display_name !== undefined) admin.display_name = data.display_name;
    if (data.role) admin.role = data.role;
    if (data.permissions) admin.permissions = data.permissions;
    
    DB.set('admins', admins);
    
    addOperationLog('权限管理', '修改', admin.username || '', `修改管理员：${admin.username || ''}`, admin.id, beforeData, admin);
    
    return true;
}

function deleteAdmin(id) {
    const admins = DB.get('admins', []);
    const admin = admins.find(a => a.id === id);
    if (!admin) return false;
    if (admin.role === 'super_admin') return false;
    
    const adminName = admin.username || '';
    const displayName = admin.display_name || adminName;
    
    const newAdmins = admins.filter(a => a.id !== id);
    DB.set('admins', newAdmins);
    
    addOperationLog('权限管理', '删除', displayName, `删除管理员：${displayName} (${adminName})`, id);
    
    return true;
}

// ============================================================
// 币种汇率相关函数
// ============================================================

function get_all_currencies() {
    return DB.get('currencies', []);
}

function get_currency_rate_info(currency) {
    const currencies = DB.get('currencies', []);
    return currencies.find(c => c.currency === currency);
}

function update_currency_rate(currency, buy_rate, sell_rate) {
    const currencies = DB.get('currencies', []);
    const c = currencies.find(x => x.currency === currency);
    if (c) {
        const beforeData = { ...c };
        c.buy_rate = buy_rate;
        c.sell_rate = sell_rate;
        c.rate = (buy_rate + sell_rate) / 2;
        DB.set('currencies', currencies);
        
        addOperationLog('币种汇率', '修改', currency, `更新 ${currency} 汇率：买入 ${buy_rate}，卖出 ${sell_rate}`, null, beforeData, c);
        
        return true;
    }
    return false;
}

function add_currency(currency, buy_rate, sell_rate) {
    const currencies = DB.get('currencies', []);
    if (currencies.find(c => c.currency === currency)) {
        return false;
    }
    const newCurrency = { 
        currency: currency, 
        name: currency, 
        buy_rate: buy_rate, 
        sell_rate: sell_rate,
        rate: (buy_rate + sell_rate) / 2
    };
    currencies.push(newCurrency);
    DB.set('currencies', currencies);
    
    addOperationLog('币种汇率', '新增', currency, `新增币种：${currency} (买入 ${buy_rate}，卖出 ${sell_rate})`);
    
    return true;
}

function delete_currency(currency) {
    if (currency === 'THB') return false;
    const currencies = DB.get('currencies', []).filter(c => c.currency !== currency);
    DB.set('currencies', currencies);
    
    addOperationLog('币种汇率', '删除', currency, `删除币种：${currency}`);
    
    return true;
}

// ============================================================
// 会员相关函数
// ============================================================

function getMember(id) {
    const members = DB.get('members', []);
    return members.find(m => m.id === id);
}

function get_all_members() {
    return DB.get('members', []);
}

function get_members_by_intermediary(intermediary_id) {
    const members = DB.get('members', []);
    return members.filter(m => m.intermediary_id === intermediary_id);
}

function get_member_by_name(name) {
    const members = DB.get('members', []);
    return members.filter(m => m.name.includes(name));
}

function add_member(name, phone, source, intermediary_id, remark) {
    const members = DB.get('members', []);
    const newMember = {
        id: DB.getNextId('members'),
        name: name,
        phone: phone || '',
        source: source || '',
        intermediary_id: intermediary_id || null,
        balance: 0,
        unpaid_loan: 0,
        remark: remark || '',
        created_at: now(),
        updated_at: now()
    };
    members.push(newMember);
    DB.set('members', members);
    
    addOperationLog('会员管理', '新增', name, `新增会员：${name} (ID: ${newMember.id})`, newMember.id);
    
    return newMember.id;
}

function update_member(id, data) {
    const members = DB.get('members', []);
    const m = members.find(x => x.id === id);
    if (!m) return false;
    
    const beforeData = { ...m };
    let changes = [];
    
    if (data.name !== undefined) { m.name = data.name; changes.push('姓名'); }
    if (data.phone !== undefined) { m.phone = data.phone; changes.push('手机'); }
    if (data.source !== undefined) { m.source = data.source; changes.push('来源'); }
    if (data.intermediary_id !== undefined) { m.intermediary_id = data.intermediary_id; changes.push('介绍人'); }
    if (data.remark !== undefined) { m.remark = data.remark; changes.push('备注'); }
    if (data.balance !== undefined) { m.balance = data.balance; changes.push('余额'); }
    if (data.unpaid_loan !== undefined) { m.unpaid_loan = data.unpaid_loan; changes.push('借款'); }
    m.updated_at = now();
    
    DB.set('members', members);
    
    if (changes.length > 0) {
        addOperationLog('会员管理', '修改', m.name, `修改会员：${m.name} (ID: ${id}) - 修改字段：${changes.join('、')}`, id, beforeData, m);
    }
    
    return true;
}

function delete_member(id) {
    const members = DB.get('members', []);
    const m = members.find(x => x.id === id);
    if (!m) return false;
    
    const memberName = m.name;
    const newMembers = members.filter(m => m.id !== id);
    DB.set('members', newMembers);
    
    addOperationLog('会员管理', '删除', memberName, `删除会员：${memberName} (ID: ${id})`, id, m, null);
    
    return true;
}

// ============================================================
// 会员账户相关函数
// ============================================================

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
// 介绍人相关函数
// ============================================================

function getAgent(id) {
    const agents = DB.get('agents', []);
    return agents.find(a => a.id === id);
}

function get_all_agents() {
    return DB.get('agents', []);
}

function getAgentLevel(id) {
    const levels = DB.get('agent_levels', []);
    return levels.find(l => l.id === id);
}

function get_agent_levels() {
    return DB.get('agent_levels', []);
}

function add_agent(id, name, phone, rebate_rate, level_id, remark) {
    const agents = DB.get('agents', []);
    if (agents.find(a => a.id === id)) return false;
    
    const newAgent = {
        id: id,
        name: name,
        phone: phone || '',
        rebate_rate: rebate_rate || 0,
        level_id: level_id || null,
        remark: remark || '',
        created_at: now()
    };
    agents.push(newAgent);
    DB.set('agents', agents);
    
    addOperationLog('介绍人', '新增', name, `新增介绍人：${name} (ID: ${id})`, id);
    
    return true;
}

function update_agent(id, data) {
    const agents = DB.get('agents', []);
    const a = agents.find(x => x.id === id);
    if (!a) return false;
    
    const beforeData = { ...a };
    let changes = [];
    
    if (data.name !== undefined) { a.name = data.name; changes.push('姓名'); }
    if (data.phone !== undefined) { a.phone = data.phone; changes.push('手机'); }
    if (data.rebate_rate !== undefined) { a.rebate_rate = data.rebate_rate; changes.push('退水率'); }
    if (data.level_id !== undefined) { a.level_id = data.level_id; changes.push('等级'); }
    if (data.remark !== undefined) { a.remark = data.remark; changes.push('备注'); }
    
    DB.set('agents', agents);
    
    if (changes.length > 0) {
        addOperationLog('介绍人', '修改', a.name, `修改介绍人：${a.name} (ID: ${id}) - 修改字段：${changes.join('、')}`, id, beforeData, a);
    }
    
    return true;
}

function delete_agent(id) {
    const agents = DB.get('agents', []);
    const a = agents.find(x => x.id === id);
    if (!a) return false;
    
    const agentName = a.name;
    const newAgents = agents.filter(a => a.id !== id);
    DB.set('agents', newAgents);
    
    const members = DB.get('members', []);
    members.forEach(m => {
        if (m.intermediary_id === id) m.intermediary_id = null;
    });
    DB.set('members', members);
    
    addOperationLog('介绍人', '删除', agentName, `删除介绍人：${agentName} (ID: ${id})`, id);
    
    return true;
}

function get_agent_stats(id) {
    const members = DB.get('members', []).filter(m => m.intermediary_id === id);
    return {
        member_count: members.length,
        total_balance: members.reduce((sum, m) => sum + m.balance, 0),
        total_loan: members.reduce((sum, m) => sum + m.unpaid_loan, 0)
    };
}

function add_agent_level(name, rate) {
    const levels = DB.get('agent_levels', []);
    const newLevel = { id: DB.getNextId('agent_levels'), name: name, rate: rate };
    levels.push(newLevel);
    DB.set('agent_levels', levels);
    
    addOperationLog('介绍人等级', '新增', name, `新增介绍人等级：${name} (退水 ${rate}%)`);
    
    return true;
}

function update_agent_level(id, name, rate) {
    const levels = DB.get('agent_levels', []);
    const l = levels.find(x => x.id === id);
    if (!l) return false;
    
    const beforeData = { ...l };
    l.name = name;
    l.rate = rate;
    DB.set('agent_levels', levels);
    
    addOperationLog('介绍人等级', '修改', name, `修改介绍人等级：${name} (退水 ${rate}%)`, id, beforeData, l);
    
    return true;
}

function delete_agent_level(id) {
    const levels = DB.get('agent_levels', []);
    const l = levels.find(x => x.id === id);
    if (!l) return false;
    
    const levelName = l.name;
    const newLevels = levels.filter(l => l.id !== id);
    DB.set('agent_levels', newLevels);
    
    addOperationLog('介绍人等级', '删除', levelName, `删除介绍人等级：${levelName}`, id);
    
    return true;
}

// ============================================================
// 账户相关函数（往來帳款）
// ============================================================

function getAccount(id) {
    const accounts = DB.get('accounts', []);
    return accounts.find(a => a.id === id);
}

function get_all_accounts() {
    return DB.get('accounts', []);
}

function add_account(name, description) {
    const accounts = DB.get('accounts', []);
    const id = DB.getNextId('accounts');
    const newAccount = {
        id: id,
        name: name,
        description: description || '',
        balances: {},
        created_at: now(),
        updated_at: now()
    };
    accounts.push(newAccount);
    DB.set('accounts', accounts);
    
    addOperationLog('往来账款', '新增', name, `新增账户：${name}`, id);
    
    return id;
}

function update_account(id, name, description) {
    const accounts = DB.get('accounts', []);
    const a = accounts.find(x => x.id === id);
    if (!a) return false;
    
    const beforeData = { ...a };
    if (name !== undefined) a.name = name;
    if (description !== undefined) a.description = description;
    a.updated_at = now();
    DB.set('accounts', accounts);
    
    addOperationLog('往来账款', '修改', a.name, `修改账户：${a.name} (ID: ${id})`, id, beforeData, a);
    
    return true;
}

function delete_account(id) {
    const accounts = DB.get('accounts', []);
    const a = accounts.find(x => x.id === id);
    if (!a) return false;
    
    const accountName = a.name;
    const newAccounts = accounts.filter(a => a.id !== id);
    DB.set('accounts', newAccounts);
    
    addOperationLog('往来账款', '删除', accountName, `删除账户：${accountName} (ID: ${id})`, id);
    
    return true;
}

function get_account_balances(account_id) {
    const accounts = DB.get('accounts', []);
    const account = accounts.find(a => a.id === account_id);
    if (!account) return [];
    return Object.entries(account.balances || {}).map(([currency, balance]) => ({
        currency: currency,
        balance: balance,
        updated_at: account.updated_at || now()
    }));
}

function get_account_balance(account_id, currency) {
    const account = getAccount(account_id);
    if (account && account.balances) {
        return account.balances[currency] || 0;
    }
    return 0;
}

function add_account_currency(account_id, currency, initial_balance) {
    const accounts = DB.get('accounts', []);
    const account = accounts.find(a => a.id === account_id);
    if (!account) return false;
    if (account.balances[currency] !== undefined) return false;
    account.balances[currency] = initial_balance || 0;
    account.updated_at = now();
    DB.set('accounts', accounts);
    
    addOperationLog('往来账款', '修改', account.name, `账户 ${account.name} 新增币种：${currency} (余额 ${initial_balance})`, account_id);
    
    return true;
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

function delete_account_currency(account_id, currency) {
    const accounts = DB.get('accounts', []);
    const account = accounts.find(a => a.id === account_id);
    if (!account) return false;
    delete account.balances[currency];
    account.updated_at = now();
    DB.set('accounts', accounts);
    
    addOperationLog('往来账款', '修改', account.name, `账户 ${account.name} 删除币种：${currency}`, account_id);
    
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

function get_all_account_transactions(limit) {
    const tx = DB.get('account_transactions', []);
    tx.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return tx.slice(0, limit || 200);
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
// 台桌相关函数
// ============================================================

function add_table_session(member_id, table_no, table_type, up_amount, down_amount, agent_id) {
    const sessions = DB.get('sessions', []);
    const session = {
        id: DB.getNextId('sessions'),
        member_id: member_id,
        agent_id: agent_id || null,
        table_no: table_no || '1',
        table_type: table_type || '决赛桌',
        session_type: 'player',
        start_time: now(),
        end_time: null,
        duration_hours: 0,
        up_amount: up_amount || 0,
        down_amount: down_amount || 0,
        profit: (up_amount || 0) - (down_amount || 0),
        status: 'active'
    };
    sessions.push(session);
    DB.set('sessions', sessions);
    return session.id;
}

function get_active_table_session(table_type) {
    const sessions = DB.get('sessions', []);
    return sessions.find(s => s.table_type === table_type && s.status === 'active' && s.session_type === 'table_open');
}

function get_table_sessions_by_date(table_type, date_str) {
    const sessions = DB.get('sessions', []);
    return sessions.filter(s => {
        if (s.table_type !== table_type) return false;
        if (s.start_time && s.start_time.startsWith(date_str)) return true;
        return false;
    });
}

function get_all_sessions() {
    return DB.get('sessions', []);
}

function create_table_session_record(table_type) {
    const sessions = DB.get('sessions', []);
    const existing = sessions.find(s => s.table_type === table_type && s.status === 'active' && s.session_type === 'table_open');
    if (existing) return null;
    
    const session = {
        id: DB.getNextId('sessions'),
        member_id: 0,
        agent_id: 0,
        table_no: '0',
        table_type: table_type,
        session_type: 'table_open',
        start_time: now(),
        end_time: null,
        duration_hours: 0,
        up_amount: 0,
        down_amount: 0,
        profit: 0,
        status: 'active'
    };
    sessions.push(session);
    DB.set('sessions', sessions);
    return session.id;
}

function close_table_session(table_type) {
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.table_type === table_type && s.status === 'active' && s.session_type === 'table_open');
    if (!session) return false;
    session.status = 'settled';
    session.end_time = now();
    DB.set('sessions', sessions);
    return true;
}

function get_table_open_record(table_type) {
    const sessions = DB.get('sessions', []);
    return sessions.find(s => s.table_type === table_type && s.session_type === 'table_open');
}

function get_table_session_up_time(session_id) {
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === session_id);
    return session ? session.start_time : null;
}

function settle_session(session_id) {
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === session_id);
    if (!session) return false;
    session.status = 'settled';
    session.end_time = now();
    const duration = calculatePlayerDuration(session_id);
    session.duration_hours = duration;
    DB.set('sessions', sessions);
    return true;
}

// ============================================================
// 上分/下分相关函数
// ============================================================

function add_up_record_with_payment(session_id, amount, currency, payment_status, receiver) {
    const upRecords = DB.get('up_records', []);
    const thbAmount = convertToTHB(amount, currency);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    upRecords.push({
        id: DB.getNextId('up_records'),
        session_id: session_id,
        up_time: now(),
        amount: amount,
        currency: currency || 'THB',
        thb_amount: thbAmount,
        payment_status: payment_status || 'unpaid',
        receiver: receiver || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('up_records', upRecords);
    
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === session_id);
    if (session) {
        session.up_amount = (session.up_amount || 0) + thbAmount;
        session.profit = (session.up_amount || 0) - (session.down_amount || 0);
        DB.set('sessions', sessions);
    }
    
    return true;
}

function get_unpaid_amount(session_id) {
    const upRecords = DB.get('up_records', []);
    return upRecords.filter(r => r.session_id === session_id && r.payment_status === 'unpaid')
        .reduce((sum, r) => sum + (r.thb_amount || 0), 0);
}

function get_up_records_by_session(session_id) {
    const upRecords = DB.get('up_records', []);
    return upRecords.filter(r => r.session_id === session_id);
}

function add_table_down_record(session_id, amount, currency) {
    const downRecords = DB.get('down_records', []);
    const thbAmount = convertToTHB(amount, currency || 'THB');
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    downRecords.push({
        id: DB.getNextId('down_records'),
        session_id: session_id,
        down_time: now(),
        amount: thbAmount,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('down_records', downRecords);
    
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === session_id);
    if (session) {
        session.down_amount = (session.down_amount || 0) + thbAmount;
        session.profit = (session.up_amount || 0) - (session.down_amount || 0);
        session.end_time = now();
        DB.set('sessions', sessions);
    }
    
    return true;
}

// ============================================================
// 时长和退水计算
// ============================================================

function calculatePlayerDuration(session_id) {
    const upRecords = DB.get('up_records', []).filter(r => r.session_id === session_id);
    const downRecords = DB.get('down_records', []).filter(r => r.session_id === session_id);
    
    if (upRecords.length === 0 || downRecords.length === 0) return 0;
    
    upRecords.sort((a, b) => new Date(a.up_time) - new Date(b.up_time));
    downRecords.sort((a, b) => new Date(a.down_time) - new Date(b.down_time));
    
    let totalSeconds = 0;
    let upIndex = 0;
    
    for (const down of downRecords) {
        const downDt = new Date(down.down_time);
        let bestUp = null;
        let bestUpIndex = upIndex;
        
        for (let i = upIndex; i < upRecords.length; i++) {
            const upDt = new Date(upRecords[i].up_time);
            if (upDt <= downDt) {
                bestUp = upDt;
                bestUpIndex = i + 1;
            } else {
                break;
            }
        }
        
        if (bestUp === null && upRecords.length > 0) {
            bestUp = new Date(upRecords[0].up_time);
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

function calculatePlayerRebate(session_id, totalWater, totalHours) {
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === session_id);
    if (!session) return 0;
    
    const playerDuration = calculatePlayerDuration(session_id);
    if (playerDuration <= 0 || totalHours <= 0 || totalWater <= 0) return 0;
    
    const agent = getAgent(session.agent_id);
    let rebateRate = 0;
    if (agent) {
        const level = getAgentLevel(agent.level_id);
        if (level) rebateRate = level.rate;
    }
    
    const hourlyWater = totalWater / totalHours;
    return hourlyWater * (rebateRate / 100) * playerDuration;
}

function calculate_table_total_duration(table_type) {
    const sessions = DB.get('sessions', []);
    const playerSessions = sessions.filter(s => s.table_type === table_type && s.session_type === 'player');
    let totalHours = 0;
    playerSessions.forEach(s => {
        totalHours += calculatePlayerDuration(s.id);
    });
    return totalHours;
}

// ============================================================
// 充值/出金记录函数
// ============================================================

function add_recharge_record(member_id, amount, currency, thb_amount, receiver, note) {
    const recharges = DB.get('recharge_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    recharges.push({
        id: DB.getNextId('recharge_records'),
        member_id: member_id,
        amount: amount,
        currency: currency || 'THB',
        thb_amount: thb_amount || amount,
        receiver: receiver || '',
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('recharge_records', recharges);
    
    const member = getMember(member_id);
    addOperationLog('会员管理', '充值', member ? member.name : '未知', 
        `会员充值：${member ? member.name : '未知'} - ${amount} ${currency} (${thb_amount} 泰铢)`, member_id);
    
    return true;
}

function add_withdraw_record(member_id, amount, currency, thb_amount, sender, note) {
    const withdraws = DB.get('withdraw_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    withdraws.push({
        id: DB.getNextId('withdraw_records'),
        member_id: member_id,
        amount: amount,
        currency: currency || 'THB',
        thb_amount: thb_amount || amount,
        sender: sender || '',
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('withdraw_records', withdraws);
    
    const member = getMember(member_id);
    addOperationLog('会员管理', '出金', member ? member.name : '未知',
        `会员出金：${member ? member.name : '未知'} - ${amount} ${currency} (${thb_amount} 泰铢)`, member_id);
    
    return true;
}

// ============================================================
// 交易记录函数
// ============================================================

function add_transaction(member_id, type, amount, note) {
    const transactions = DB.get('transactions', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: member_id,
        type: type,
        amount: amount,
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('transactions', transactions);
    
    if (member_id > 0) {
        const members = DB.get('members', []);
        const member = members.find(m => m.id === member_id);
        if (member) {
            if (type === 'recharge') {
                member.balance = (member.balance || 0) + amount;
            } else if (type === 'refund') {
                member.balance = (member.balance || 0) - amount;
            } else if (type === 'loan') {
                member.unpaid_loan = (member.unpaid_loan || 0) + amount;
            } else if (type === 'repay') {
                member.unpaid_loan = (member.unpaid_loan || 0) - amount;
            }
            DB.set('members', members);
        }
    }
    return true;
}

function get_all_transactions() {
    return DB.get('transactions', []);
}

function get_member_transactions(member_id) {
    const transactions = DB.get('transactions', []);
    return transactions.filter(t => t.member_id === member_id);
}

// ============================================================
// 款项记录查询
// ============================================================

function get_all_payment_records() {
    const upRecords = DB.get('up_records', []);
    const rechargeRecords = DB.get('recharge_records', []);
    const withdrawRecords = DB.get('withdraw_records', []);
    const sessions = DB.get('sessions', []);
    const members = DB.get('members', []);
    
    const records = [];
    
    upRecords.forEach(r => {
        const session = sessions.find(s => s.id === r.session_id);
        const member = session ? members.find(m => m.id === session.member_id) : null;
        records.push({
            type: '上分',
            id: r.id,
            created_at: r.up_time || r.created_at,
            member_name: member ? member.name : '未知',
            amount: r.amount,
            currency: r.currency || 'THB',
            thb_amount: r.thb_amount || r.amount,
            payment_status: r.payment_status,
            receiver: r.receiver || '',
            sender: '',
            note: '',
            admin_name: r.admin_name || '系统'
        });
    });
    
    rechargeRecords.forEach(r => {
        const member = members.find(m => m.id === r.member_id);
        records.push({
            type: '充值',
            id: r.id,
            created_at: r.created_at,
            member_name: member ? member.name : '未知',
            amount: r.amount,
            currency: r.currency || 'THB',
            thb_amount: r.thb_amount || r.amount,
            payment_status: '',
            receiver: r.receiver || '',
            sender: '',
            note: r.note || '',
            admin_name: r.admin_name || '系统'
        });
    });
    
    withdrawRecords.forEach(r => {
        const member = members.find(m => m.id === r.member_id);
        records.push({
            type: '出金',
            id: r.id,
            created_at: r.created_at,
            member_name: member ? member.name : '未知',
            amount: r.amount,
            currency: r.currency || 'THB',
            thb_amount: r.thb_amount || r.amount,
            payment_status: '',
            receiver: '',
            sender: r.sender || '',
            note: r.note || '',
            admin_name: r.admin_name || '系统'
        });
    });
    
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return records.slice(0, 200);
}

function get_member_payment_records(member_id) {
    const allRecords = get_all_payment_records();
    return allRecords.filter(r => {
        const member = getMember(member_id);
        return r.member_name === (member ? member.name : '');
    });
}

// ============================================================
// 抽水记录
// ============================================================

function add_water_record(table_type, amount, note) {
    const waterRecords = DB.get('water_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    waterRecords.push({
        id: DB.getNextId('water_records'),
        table_type: table_type,
        amount: amount,
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('water_records', waterRecords);
    
    addOperationLog('台桌看板', '抽水', table_type, `${table_type} 抽水 ${amount} 泰铢`);
    
    return true;
}

function get_water_records(table_type) {
    const waterRecords = DB.get('water_records', []);
    if (table_type) {
        return waterRecords.filter(w => w.table_type === table_type);
    }
    return waterRecords;
}

// ============================================================
// 保险记录
// ============================================================

function add_insurance_record(table_type, amount, note) {
    const insuranceRecords = DB.get('insurance_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    insuranceRecords.push({
        id: DB.getNextId('insurance_records'),
        table_type: table_type,
        amount: amount,
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('insurance_records', insuranceRecords);
    
    addOperationLog('台桌看板', '保险', table_type, `${table_type} 保险 ${amount} 泰铢`);
    
    return true;
}

function get_insurance_records(table_type) {
    const insuranceRecords = DB.get('insurance_records', []);
    if (table_type) {
        return insuranceRecords.filter(r => r.table_type === table_type);
    }
    return insuranceRecords;
}

// ============================================================
// 每日台帐
// ============================================================

function get_daily_report(date_str) {
    const settlements = DB.get('daily_settlements', []);
    return settlements.filter(s => s.settle_time && s.settle_time.startsWith(date_str));
}

function get_daily_summary(date_str) {
    const settlements = DB.get('daily_settlements', []).filter(s => s.settle_time && s.settle_time.startsWith(date_str));
    return {
        total_tables: settlements.length,
        total_players: settlements.reduce((sum, s) => sum + (s.player_count || 0), 0),
        total_up: settlements.reduce((sum, s) => sum + (s.total_up || 0), 0),
        total_down: settlements.reduce((sum, s) => sum + (s.total_down || 0), 0),
        total_profit: settlements.reduce((sum, s) => sum + (s.total_profit || 0), 0),
        total_water: settlements.reduce((sum, s) => sum + (s.total_water || 0), 0)
    };
}

function get_daily_report_by_table(date_str, table_type) {
    const settlements = DB.get('daily_settlements', []);
    return settlements.find(s => s.table_type === table_type && s.settle_time && s.settle_time.startsWith(date_str));
}

// ============================================================
// 兑汇记录相关函数
// ============================================================

function initExchangeRecords() {
    if (!localStorage.getItem('rpt_exchange_records')) {
        DB.set('exchange_records', []);
        DB.set('exchange_records_next', 1);
    }
}

function addExchangeRecord(memberId, memberName, tableType, fromCurrency, fromAmount, toCurrency, toAmount, direction, buyRate, sellRate, sessionId, note) {
    initExchangeRecords();
    const records = DB.get('exchange_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    records.push({
        id: DB.getNextId('exchange_records'),
        member_id: memberId,
        member_name: memberName,
        table_type: tableType,
        session_id: sessionId || null,
        from_currency: fromCurrency,
        from_amount: fromAmount,
        to_currency: toCurrency,
        to_amount: toAmount,
        direction: direction,
        buy_rate: buyRate,
        sell_rate: sellRate,
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('exchange_records', records);
    
    const directionMap = {
        'buy': '外币→泰铢',
        'sell': '泰铢→外币',
        'cross': '外币→外币'
    };
    addOperationLog('兑汇纪录', '换币', memberName, 
        `${memberName} 换币：${fromAmount} ${fromCurrency} → ${toAmount} ${toCurrency} (${directionMap[direction] || direction})`, memberId);
    
    return true;
}

function getExchangeRecords(filters) {
    initExchangeRecords();
    let records = DB.get('exchange_records', []);
    
    if (filters) {
        if (filters.member_id) {
            records = records.filter(r => r.member_id === filters.member_id);
        }
        if (filters.table_type) {
            records = records.filter(r => r.table_type === filters.table_type);
        }
        if (filters.from_currency) {
            records = records.filter(r => r.from_currency === filters.from_currency);
        }
        if (filters.to_currency) {
            records = records.filter(r => r.to_currency === filters.to_currency);
        }
        if (filters.date) {
            records = records.filter(r => r.created_at && r.created_at.startsWith(filters.date));
        }
        if (filters.direction) {
            records = records.filter(r => r.direction === filters.direction);
        }
    }
    
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return records;
}

function getTableExchangeSummary(tableType, date) {
    const records = getExchangeRecords({ table_type: tableType, date: date });
    const summary = {
        total_count: records.length,
        total_from_amount: {},
        total_to_amount: {},
        by_member: {},
        by_currency: {}
    };
    
    records.forEach(r => {
        if (!summary.total_from_amount[r.from_currency]) {
            summary.total_from_amount[r.from_currency] = 0;
        }
        summary.total_from_amount[r.from_currency] += r.from_amount;
        
        if (!summary.total_to_amount[r.to_currency]) {
            summary.total_to_amount[r.to_currency] = 0;
        }
        summary.total_to_amount[r.to_currency] += r.to_amount;
        
        if (!summary.by_member[r.member_id]) {
            summary.by_member[r.member_id] = {
                member_name: r.member_name,
                count: 0,
                from: {},
                to: {}
            };
        }
        summary.by_member[r.member_id].count++;
        if (!summary.by_member[r.member_id].from[r.from_currency]) {
            summary.by_member[r.member_id].from[r.from_currency] = 0;
        }
        summary.by_member[r.member_id].from[r.from_currency] += r.from_amount;
        if (!summary.by_member[r.member_id].to[r.to_currency]) {
            summary.by_member[r.member_id].to[r.to_currency] = 0;
        }
        summary.by_member[r.member_id].to[r.to_currency] += r.to_amount;
    });
    
    return summary;
}

// ============================================================
// 小费相关函数
// ============================================================

function initTipsRecords() {
    if (!localStorage.getItem('rpt_tips_records')) {
        DB.set('tips_records', []);
        DB.set('tips_records_next', 1);
    }
}

function getTipsRecords(tableType) {
    const records = DB.get('tips_records', []);
    if (tableType) {
        return records.filter(r => r.table_type === tableType);
    }
    return records;
}

function getTotalTips(tableType) {
    const records = getTipsRecords(tableType);
    return records.reduce((sum, r) => sum + r.amount, 0);
}

function addTipsRecord(tableType, employeeId, employeeName, amount, note) {
    initTipsRecords();
    const records = DB.get('tips_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    records.push({
        id: DB.getNextId('tips_records'),
        table_type: tableType,
        employee_id: employeeId,
        employee_name: employeeName,
        amount: amount,
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('tips_records', records);
    
    addOperationLog('台桌看板', '小费', tableType, `${tableType} - ${employeeName} 小费 ${amount} 泰铢`, employeeId);
    
    return true;
}

function getEmployeeTipsSummary(tableType) {
    const records = getTipsRecords(tableType);
    const summary = {};
    records.forEach(r => {
        if (!summary[r.employee_id]) {
            summary[r.employee_id] = {
                employee_id: r.employee_id,
                employee_name: r.employee_name,
                total_amount: 0,
                count: 0,
                records: []
            };
        }
        summary[r.employee_id].total_amount += r.amount;
        summary[r.employee_id].count++;
        summary[r.employee_id].records.push(r);
    });
    return summary;
}

// ============================================================
// 员工出勤相关函数
// ============================================================

function initAttendanceRecords() {
    if (!localStorage.getItem('rpt_attendance_records')) {
        DB.set('attendance_records', []);
        DB.set('attendance_records_next', 1);
    }
    if (!localStorage.getItem('rpt_attendance_settings')) {
        DB.set('attendance_settings', {
            work_start_time: '09:00',
            work_end_time: '18:00',
            late_threshold: 15
        });
    }
}

function getAttendanceRecords(employeeId, date) {
    initAttendanceRecords();
    let records = DB.get('attendance_records', []);
    
    if (employeeId) {
        records = records.filter(r => r.employee_id === employeeId);
    }
    if (date) {
        records = records.filter(r => r.date === date);
    }
    
    records.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.check_in_time || '').localeCompare(a.check_in_time || '');
    });
    
    return records;
}

function employeeCheckIn(employeeId, date, time, note) {
    initAttendanceRecords();
    const records = DB.get('attendance_records', []);
    const settings = DB.get('attendance_settings', { work_start_time: '09:00', late_threshold: 15 });
    
    const existing = records.find(r => r.employee_id === employeeId && r.date === date);
    if (existing && existing.status !== '休假' && existing.status !== '请假') {
        return { success: false, message: '该员工今天已有出勤记录' };
    }
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) {
        return { success: false, message: '员工不存在' };
    }
    
    const workStart = settings.work_start_time || '09:00';
    const [startHour, startMinute] = workStart.split(':').map(Number);
    const [checkHour, checkMinute] = time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const checkMinutes = checkHour * 60 + checkMinute;
    const isLate = checkMinutes - startMinutes > (settings.late_threshold || 15);
    
    const record = {
        id: DB.getNextId('attendance_records'),
        employee_id: employeeId,
        employee_name: employee.name,
        date: date,
        check_in_time: time,
        check_out_time: null,
        status: isLate ? '迟到' : '已到班',
        is_late: isLate,
        work_duration: null,
        note: note || '',
        created_at: now(),
        updated_at: now()
    };
    
    if (existing) {
        const index = records.indexOf(existing);
        records[index] = { ...records[index], ...record, id: records[index].id };
        DB.set('attendance_records', records);
        addOperationLog('员工出勤', '到班', employee.name, `${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, employeeId);
        return { success: true, message: `✅ ${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, record: records[index] };
    } else {
        records.push(record);
        DB.set('attendance_records', records);
        addOperationLog('员工出勤', '到班', employee.name, `${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, employeeId);
        return { success: true, message: `✅ ${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, record: record };
    }
}

function employeeCheckOut(employeeId, date, time, note) {
    initAttendanceRecords();
    const records = DB.get('attendance_records', []);
    const settings = DB.get('attendance_settings', { work_end_time: '18:00' });
    
    const record = records.find(r => r.employee_id === employeeId && r.date === date);
    if (!record) {
        return { success: false, message: '该员工今天没有到班记录' };
    }
    if (record.check_out_time) {
        return { success: false, message: '该员工今天已签退' };
    }
    if (record.status === '休假' || record.status === '请假') {
        return { success: false, message: '该员工今天为休假/请假状态，无需签退' };
    }
    
    const [inHour, inMinute] = record.check_in_time.split(':').map(Number);
    const [outHour, outMinute] = time.split(':').map(Number);
    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;
    let durationMinutes = outMinutes - inMinutes;
    if (durationMinutes < 0) durationMinutes += 1440;
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const durationStr = `${hours}时${minutes}分`;
    
    const beforeData = { ...record };
    record.check_out_time = time;
    record.work_duration = durationStr;
    record.duration_minutes = durationMinutes;
    record.status = '已签退';
    record.updated_at = now();
    if (note) record.note = (record.note || '') + ' | 签退备注：' + note;
    
    DB.set('attendance_records', records);
    addOperationLog('员工出勤', '签退', record.employee_name, `${record.employee_name} 签退成功！工作时长：${durationStr}`, employeeId, beforeData, record);
    
    return { success: true, message: `✅ ${record.employee_name} 签退成功！工作时长：${durationStr}`, record: record };
}

function clearEmployeeStatus(employeeId, date) {
    initAttendanceRecords();
    const records = DB.get('attendance_records', []);
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) {
        return { success: false, message: '员工不存在' };
    }
    
    const existing = records.find(r => r.employee_id === employeeId && r.date === date);
    if (!existing) {
        return { success: false, message: '该员工当天没有记录' };
    }
    
    const beforeData = { ...existing };
    const filtered = records.filter(r => !(r.employee_id === employeeId && r.date === date));
    DB.set('attendance_records', filtered);
    addOperationLog('员工出勤', '清除', employee.name, `${employee.name} 已清除出勤状态`, employeeId, beforeData, null);
    
    return { success: true, message: `✅ ${employee.name} 已清除状态` };
}

// ============================================================
// 系统维护
// ============================================================

function clear_all_records() {
    DB.set('sessions', []);
    DB.set('transactions', []);
    DB.set('water_records', []);
    DB.set('daily_settlements', []);
    DB.set('up_records', []);
    DB.set('down_records', []);
    DB.set('recharge_records', []);
    DB.set('withdraw_records', []);
    DB.set('account_transactions', []);
    DB.set('insurance_records', []);
    DB.set('exchange_records', []);
    DB.set('tips_records', []);
    
    const members = DB.get('members', []);
    members.forEach(m => {
        m.balance = 0;
        m.unpaid_loan = 0;
    });
    DB.set('members', members);
    
    const accounts = DB.get('accounts', []);
    accounts.forEach(a => {
        if (a.balances) {
            Object.keys(a.balances).forEach(key => {
                a.balances[key] = 0;
            });
        }
    });
    DB.set('accounts', accounts);
    
    const memberAccounts = DB.get('member_accounts', []);
    memberAccounts.forEach(a => {
        if (a.balances) {
            Object.keys(a.balances).forEach(key => {
                a.balances[key] = 0;
            });
        }
    });
    DB.set('member_accounts', memberAccounts);
    
    addOperationLog('系统维护', '清除纪录', '全部', '清除所有纪录');
    
    return true;
}

function init_system_data() {
    const admins = DB.get('admins', []);
    const currencies = DB.get('currencies', []);
    const agentLevels = DB.get('agent_levels', []);
    
    localStorage.clear();
    
    DB.set('admins', admins);
    DB.set('currencies', currencies);
    DB.set('agent_levels', agentLevels);
    
    DB.set('members', []);
    DB.set('agents', []);
    DB.set('accounts', [{ id: 1, name: '默认账户', description: '系统默认账户', balances: { THB: 0, CNY: 0, USD: 0, LAK: 0, USDT: 0 } }]);
    DB.set('accounts_next', 2);
    DB.set('member_accounts', []);
    DB.set('member_account_transactions', []);
    DB.set('insurance_records', []);
    DB.set('sessions', []);
    DB.set('transactions', []);
    DB.set('water_records', []);
    DB.set('daily_settlements', []);
    DB.set('up_records', []);
    DB.set('down_records', []);
    DB.set('recharge_records', []);
    DB.set('withdraw_records', []);
    DB.set('account_transactions', []);
    DB.set('exchange_records', []);
    DB.set('tips_records', []);
    DB.set('attendance_records', []);
    DB.set('operation_logs', []);
    
    DB.set('members_next', 1);
    DB.set('agents_next', 1);
    DB.set('sessions_next', 1);
    DB.set('transactions_next', 1);
    DB.set('water_records_next', 1);
    DB.set('daily_settlements_next', 1);
    DB.set('up_records_next', 1);
    DB.set('down_records_next', 1);
    DB.set('recharge_records_next', 1);
    DB.set('withdraw_records_next', 1);
    DB.set('account_transactions_next', 1);
    DB.set('member_account_transactions_next', 1);
    DB.set('insurance_records_next', 1);
    DB.set('exchange_records_next', 1);
    DB.set('tips_records_next', 1);
    DB.set('attendance_records_next', 1);
    DB.set('operation_logs_next', 1);
    
    addOperationLog('系统维护', '初始化', '全部', '初始化系统数据');
    
    return true;
}

// ============================================================
// 统计报表
// ============================================================

function get_dashboard_stats() {
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
// 格式化函数
// ============================================================

function formatDate(dt) {
    if (!dt) return '-';
    return dt.substring(0, 16);
}

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

function today() {
    return new Date().toISOString().split('T')[0];
}