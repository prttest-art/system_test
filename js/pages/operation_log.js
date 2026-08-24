// ============================================================
// 12. 操作纪录（审计日志）- 完整版 + 權限控制
// ============================================================

// 初始化操作日志存储
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
    
    // 限制日志数量，保留最近2000笔
    if (logs.length > 2000) {
        logs.splice(0, logs.length - 2000);
    }
    
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

/**
 * 获取操作日志（支持筛选）
 */
function getOperationLogs(filters) {
    initOperationLog();
    let logs = DB.get('operation_logs', []);
    
    if (filters) {
        // 按模块筛选
        if (filters.module) {
            logs = logs.filter(l => l.module === filters.module);
        }
        // 按操作类型筛选
        if (filters.action) {
            logs = logs.filter(l => l.action === filters.action);
        }
        // 按管理员筛选
        if (filters.admin_id) {
            logs = logs.filter(l => l.admin_id === filters.admin_id);
        }
        // 按日期筛选
        if (filters.date) {
            logs = logs.filter(l => l.created_at && l.created_at.startsWith(filters.date));
        }
        // 按時段查詢
        if (filters.date_start && filters.date_end) {
            logs = logs.filter(l => {
                if (!l.created_at) return false;
                const dateStr = l.created_at.split(' ')[0];
                return dateStr >= filters.date_start && dateStr <= filters.date_end;
            });
        }
        // 按关键词搜索
        if (filters.keyword) {
            const keyword = filters.keyword.toLowerCase();
            logs = logs.filter(l => 
                (l.target && l.target.toLowerCase().includes(keyword)) ||
                (l.detail && l.detail.toLowerCase().includes(keyword)) ||
                (l.module && l.module.toLowerCase().includes(keyword)) ||
                (l.action && l.action.toLowerCase().includes(keyword))
            );
        }
        // 按目标ID搜索
        if (filters.target_id) {
            logs = logs.filter(l => l.target_id === filters.target_id);
        }
    }
    
    // 按时间倒序排列
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return logs;
}

/**
 * 获取模块列表
 */
function getOperationModules() {
    initOperationLog();
    const logs = DB.get('operation_logs', []);
    const modules = [...new Set(logs.map(l => l.module))];
    return modules.sort();
}

/**
 * 获取操作类型列表
 */
function getOperationActions() {
    initOperationLog();
    const logs = DB.get('operation_logs', []);
    const actions = [...new Set(logs.map(l => l.action))];
    return actions.sort();
}

/**
 * 获取管理员操作统计
 */
function getAdminOperationStats(adminId) {
    initOperationLog();
    const logs = DB.get('operation_logs', []);
    const filtered = adminId ? logs.filter(l => l.admin_id === adminId) : logs;
    
    const stats = {
        total: filtered.length,
        by_module: {},
        by_action: {},
        today: filtered.filter(l => l.created_at && l.created_at.startsWith(today())).length,
        this_week: 0,
        this_month: 0
    };
    
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    
    filtered.forEach(l => {
        // 按模块统计
        if (!stats.by_module[l.module]) stats.by_module[l.module] = 0;
        stats.by_module[l.module]++;
        
        // 按操作类型统计
        if (!stats.by_action[l.action]) stats.by_action[l.action] = 0;
        stats.by_action[l.action]++;
        
        // 本周统计
        if (l.created_at && l.created_at.startsWith(weekStartStr)) {
            stats.this_week++;
        }
        
        // 本月统计
        if (l.created_at && l.created_at.startsWith(monthStart)) {
            stats.this_month++;
        }
    });
    
    return stats;
}

/**
 * 獲取操作紀錄統計摘要
 */
function getOperationLogSummary() {
    initOperationLog();
    const logs = DB.get('operation_logs', []);
    
    const todayStr = today();
    const monthStr = todayStr.substring(0, 7);
    
    return {
        total: logs.length,
        today: logs.filter(l => l.created_at && l.created_at.startsWith(todayStr)).length,
        this_month: logs.filter(l => l.created_at && l.created_at.startsWith(monthStr)).length,
        by_module: getOperationModules().length,
        by_action: getOperationActions().length
    };
}

// ============================================================
// 渲染操作紀錄頁面 - 含權限檢查
// ============================================================

function renderOperationLog(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('operation_log', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>📋 操作紀錄</h1>
                <p class="breadcrumb">系統設置 > 操作紀錄</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「操作紀錄」的权限</p>
            </div>
        `;
        return;
    }
    
    initOperationLog();
    
    const admins = getAdmins();
    const modules = getOperationModules();
    const actions = getOperationActions();
    
    // 獲取篩選參數
    const searchDate = document.getElementById('logDate')?.value || '';
    const searchDateStart = document.getElementById('logDateStart')?.value || '';
    const searchDateEnd = document.getElementById('logDateEnd')?.value || '';
    const searchModule = document.getElementById('logModule')?.value || '';
    const searchAction = document.getElementById('logAction')?.value || '';
    const searchAdmin = document.getElementById('logAdmin')?.value || '';
    const searchKeyword = document.getElementById('logKeyword')?.value?.trim() || '';
    
    // 構建篩選條件
    const filters = {};
    if (searchDateStart && searchDateEnd) {
        filters.date_start = searchDateStart;
        filters.date_end = searchDateEnd;
    } else if (searchDate) {
        filters.date = searchDate;
    }
    if (searchModule) filters.module = searchModule;
    if (searchAction) filters.action = searchAction;
    if (searchAdmin) filters.admin_id = parseInt(searchAdmin);
    if (searchKeyword) filters.keyword = searchKeyword;
    
    // 獲取日志
    const logs = getOperationLogs(Object.keys(filters).length > 0 ? filters : null);
    
    // 統計
    const totalLogs = logs.length;
    const todayLogs = logs.filter(l => l.created_at && l.created_at.startsWith(today())).length;
    const summary = getOperationLogSummary();
    
    // ✅ 檢查查看詳情權限
    const canViewDetail = checkActionPermission('operation_log', 'view_detail');
    
    // 構建管理員下拉選項
    const adminOptions = admins.map(a => 
        `<option value="${a.id}">${a.display_name || a.username}</option>`
    ).join('');
    
    // 構建模塊下拉選項
    const moduleOptions = modules.map(m => 
        `<option value="${m}">${m}</option>`
    ).join('');
    
    // 構建操作類型下拉選項
    const actionOptions = actions.map(a => 
        `<option value="${a}">${a}</option>`
    ).join('');
    
    // 操作類型顏色映射
    const actionColorMap = {
        '新增': '#4CAF50',
        '修改': '#2196F3',
        '刪除': '#ff6b6b',
        '到班': '#4CAF50',
        '签退': '#ffa726',
        '休假': '#26c6da',
        '请假': '#ffa726',
        '清除': '#ff6b6b',
        '充值': '#4CAF50',
        '出金': '#ff6b6b',
        '换币': '#2196F3',
        '上分': '#4CAF50',
        '下分': '#ff6b6b',
        '下桌': '#ff6b6b',
        '开桌': '#4CAF50',
        '结算': '#ff6b6b',
        '抽水': '#ffa726',
        '保险': '#2196F3',
        '小费': '#ffa726',
        '小费出金': '#ffa726',
        '登录': '#4CAF50',
        '登出': '#ff6b6b',
        '设定': '#2196F3',
        '清除纪录': '#ff6b6b',
        '初始化': '#ff6b6b',
        '核准': '#4CAF50',
        '付款': '#4CAF50',
        '發放': '#4CAF50',
        '刪除帳戶': '#ff6b6b',
        '新增帳戶': '#4CAF50',
        '修改帳戶': '#2196F3',
        '轉帳': '#2196F3',
        '兌匯': '#2196F3'
    };
    
    // 顯示時段標籤
    let timeRangeLabel = '';
    if (searchDateStart && searchDateEnd) {
        timeRangeLabel = `📅 ${searchDateStart} ~ ${searchDateEnd}`;
    } else if (searchDate) {
        timeRangeLabel = `📅 ${searchDate}`;
    } else {
        timeRangeLabel = '📅 全部時段';
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 構建日誌表格
    let tableRows = '';
    if (logs.length === 0) {
        tableRows = '<tr class="empty-row"><td colspan="7">暫無操作紀錄</td></tr>';
    } else {
        tableRows = logs.slice(0, 200).map(l => {
            const color = actionColorMap[l.action] || '#333';
            const actionBadge = `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:500;background:${color}20;color:${color};border:1px solid ${color}40;">${l.action}</span>`;
            
            // 判斷是否有詳細數據可查看
            const hasDetail = l.before_data || l.after_data;
            
            return `<tr>
                <td style="text-align:center;font-size:12px;white-space:nowrap;">${formatDate(l.created_at)}</td>
                <td style="text-align:center;"><strong>${l.module}</strong></td>
                <td style="text-align:center;">${actionBadge}</td>
                <td style="text-align:center;"><strong>${l.target || '-'}</strong></td>
                <td style="text-align:center;font-size:13px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.detail || ''}">${l.detail || '-'}</td>
                <td style="text-align:center;font-size:12px;color:#666;">${l.admin_name || '系统'}</td>
                <td style="text-align:center;">
                    ${hasDetail && canViewDetail ? `<button class="btn btn-info btn-sm" onclick="showLogDetail(${l.id})">📋 详情</button>` : 
                      hasDetail && !canViewDetail ? `<span style="color:#999;font-size:11px;">無權限</span>` :
                      '-'}
                </td>
            </tr>`;
        }).join('');
    }
    
    el.innerHTML = `
        <div class="page-header">
            <h1>📋 操作紀錄</h1>
            <p class="breadcrumb">系統設置 > 操作紀錄</p>
        </div>
        
        <!-- 統計卡片 -->
        <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);">
            <div class="stat-card" style="border-left:4px solid #2196F3;">
                <div class="stat-label">📊 總操作數</div>
                <div class="stat-value" style="color:#2196F3;">${summary.total}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #4CAF50;">
                <div class="stat-label">📅 今日操作</div>
                <div class="stat-value" style="color:#4CAF50;">${summary.today}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ffa726;">
                <div class="stat-label">📂 本月操作</div>
                <div class="stat-value" style="color:#ffa726;">${summary.this_month}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #26c6da;">
                <div class="stat-label">📁 模塊數</div>
                <div class="stat-value" style="color:#26c6da;">${summary.by_module}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ab47bc;">
                <div class="stat-label">🔄 操作類型</div>
                <div class="stat-value" style="color:#ab47bc;">${summary.by_action}</div>
            </div>
        </div>
        
        <!-- 篩選工具欄 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;">
            <!-- 第一排：時段查詢 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding-bottom:10px;border-bottom:1px solid #f0f0f0;margin-bottom:10px;">
                <span style="font-weight:500;font-size:13px;color:#555;">📅 時段查詢：</span>
                <input type="date" id="logDateStart" value="${searchDateStart}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <span style="color:#999;">～</span>
                <input type="date" id="logDateEnd" value="${searchDateEnd}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <button class="btn btn-primary" onclick="renderOperationLog(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('logDateStart').value='';document.getElementById('logDateEnd').value='';document.getElementById('logDate').value='';renderOperationLog(document.getElementById('mainContent'))">✕ 清除</button>
                <button class="btn" onclick="document.getElementById('logDateStart').value='${todayStr}';document.getElementById('logDateEnd').value='${todayStr}';document.getElementById('logDate').value='';renderOperationLog(document.getElementById('mainContent'))">📅 今天</button>
                <span style="font-size:12px;color:#999;margin-left:auto;">${timeRangeLabel}</span>
            </div>
            
            <!-- 第二排：篩選條件 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                <span style="font-weight:500;font-size:13px;color:#555;">📂 模塊：</span>
                <select id="logModule" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部</option>
                    ${moduleOptions}
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">🔄 操作：</span>
                <select id="logAction" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部</option>
                    ${actionOptions}
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">👤 管理員：</span>
                <select id="logAdmin" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部</option>
                    ${adminOptions}
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">🔍 搜尋：</span>
                <input type="text" id="logKeyword" placeholder="關鍵詞..." value="${searchKeyword}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:120px;" onkeydown="if(event.key==='Enter') renderOperationLog(document.getElementById('mainContent'))">
                
                <button class="btn btn-primary" onclick="renderOperationLog(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('logDateStart').value='';document.getElementById('logDateEnd').value='';document.getElementById('logDate').value='';document.getElementById('logModule').value='';document.getElementById('logAction').value='';document.getElementById('logAdmin').value='';document.getElementById('logKeyword').value='';renderOperationLog(document.getElementById('mainContent'))">✕ 清除全部</button>
                <button class="btn" onclick="renderOperationLog(document.getElementById('mainContent'))">🔄 刷新</button>
                
                <span style="font-size:13px;color:#999;margin-left:auto;">共 ${totalLogs} 筆記錄</span>
            </div>
        </div>
        
        <!-- 日誌表格 -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="min-width:150px;text-align:center;">時間</th>
                        <th style="min-width:100px;text-align:center;">模塊</th>
                        <th style="min-width:80px;text-align:center;">操作</th>
                        <th style="min-width:100px;text-align:center;">目標</th>
                        <th style="min-width:200px;text-align:center;">詳情</th>
                        <th style="min-width:80px;text-align:center;">操作人</th>
                        <th style="min-width:80px;text-align:center;">詳情</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
        ${logs.length > 200 ? `<div style="text-align:center;padding:10px;color:#999;font-size:13px;">僅顯示最近200筆記錄</div>` : ''}
    `;
}

// ============================================================
// 顯示日誌詳情 - 含權限檢查
// ============================================================

function showLogDetail(logId) {
    // ✅ 檢查查看詳情權限
    if (!checkActionPermission('operation_log', 'view_detail')) {
        showPermissionDenied('查看操作詳情');
        return;
    }
    
    initOperationLog();
    const logs = DB.get('operation_logs', []);
    const log = logs.find(l => l.id === logId);
    if (!log) {
        alert('找不到該記錄');
        return;
    }
    
    let beforeHtml = '<div style="color:#999;">無</div>';
    let afterHtml = '<div style="color:#999;">無</div>';
    
    if (log.before_data) {
        try {
            const data = JSON.parse(log.before_data);
            beforeHtml = formatDataForDisplay(data);
        } catch(e) {
            beforeHtml = `<div style="color:#666;font-size:12px;">${log.before_data}</div>`;
        }
    }
    
    if (log.after_data) {
        try {
            const data = JSON.parse(log.after_data);
            afterHtml = formatDataForDisplay(data);
        } catch(e) {
            afterHtml = `<div style="color:#666;font-size:12px;">${log.after_data}</div>`;
        }
    }
    
    // 操作類型顏色
    const actionColorMap = {
        '新增': '#4CAF50',
        '修改': '#2196F3',
        '刪除': '#ff6b6b',
        '到班': '#4CAF50',
        '签退': '#ffa726',
        '休假': '#26c6da',
        '请假': '#ffa726',
        '清除': '#ff6b6b',
        '充值': '#4CAF50',
        '出金': '#ff6b6b',
        '换币': '#2196F3',
        '上分': '#4CAF50',
        '下分': '#ff6b6b',
        '下桌': '#ff6b6b',
        '开桌': '#4CAF50',
        '结算': '#ff6b6b',
        '抽水': '#ffa726',
        '保险': '#2196F3',
        '小费': '#ffa726',
        '小费出金': '#ffa726',
        '设定': '#2196F3',
        '清除纪录': '#ff6b6b',
        '初始化': '#ff6b6b',
        '核准': '#4CAF50',
        '付款': '#4CAF50',
        '發放': '#4CAF50',
        '登录': '#4CAF50',
        '登出': '#ff6b6b'
    };
    const color = actionColorMap[log.action] || '#333';
    
    const html = `
        <div class="modal-title" style="font-size:20px;">📋 操作詳情</div>
        
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:14px;">
            <div><strong>模塊：</strong>${log.module}</div>
            <div><strong>操作：</strong><span style="color:${color};font-weight:bold;">${log.action}</span></div>
            <div><strong>目標：</strong>${log.target || '-'}</div>
            <div><strong>操作人：</strong>${log.admin_name || '系统'}</div>
            <div><strong>時間：</strong>${formatDate(log.created_at)}</div>
            <div><strong>詳情：</strong>${log.detail || '-'}</div>
        </div>
        
        ${log.before_data ? `
            <h4 style="margin-bottom:10px;color:#ff6b6b;">📌 修改前數據</h4>
            <div style="margin-bottom:15px;padding:12px;background:#ffebee;border-radius:6px;border:1px solid #ef9a9a;max-height:200px;overflow-y:auto;">
                ${beforeHtml}
            </div>
        ` : ''}
        
        ${log.after_data ? `
            <h4 style="margin-bottom:10px;color:#4CAF50;">📌 修改後數據</h4>
            <div style="margin-bottom:15px;padding:12px;background:#e8f5e9;border-radius:6px;border:1px solid #a5d6a7;max-height:200px;overflow-y:auto;">
                ${afterHtml}
            </div>
        ` : ''}
        
        ${!log.before_data && !log.after_data ? `
            <div style="padding:20px;text-align:center;color:#999;">該操作無詳細數據</div>
        ` : ''}
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
        </div>
    `;
    showModalWide(html);
}

/**
 * 格式化數據顯示
 */
function formatDataForDisplay(data) {
    if (!data || typeof data !== 'object') {
        return `<div style="font-size:12px;color:#666;">${data}</div>`;
    }
    
    let html = '<div style="font-size:13px;">';
    Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            html += `<div><strong>${key}：</strong><span style="color:#999;">null</span></div>`;
        } else if (typeof value === 'object') {
            html += `<div><strong>${key}：</strong>${JSON.stringify(value)}</div>`;
        } else {
            html += `<div><strong>${key}：</strong>${value}</div>`;
        }
    });
    html += '</div>';
    return html;
}

// ============================================================
// 輔助函數
// ============================================================

function showModal(html) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal">' + html + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    return overlay;
}

function showModalWide(html) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal modal-wide">' + html + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    return overlay;
}

function closeModal(overlay) {
    if (overlay) overlay.remove();
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(dt) {
    if (!dt) return '-';
    return dt.substring(0, 16);
}

// ============================================================
// 權限檢查函數暴露
// ============================================================

if (typeof checkActionPermission === 'undefined') {
    window.checkActionPermission = function(page, action) {
        try {
            if (typeof hasActionPermission === 'function') {
                return hasActionPermission(page, action);
            }
            return true;
        } catch(e) {
            return true;
        }
    };
}

if (typeof showPermissionDenied === 'undefined') {
    window.showPermissionDenied = function(actionName) {
        alert(`⛔ 权限不足！\n\n您没有「${actionName}」的操作权限，请联系系统管理员。`);
    };
}