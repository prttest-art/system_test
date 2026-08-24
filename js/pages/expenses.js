// ============================================================
// 费用报销（支持多幣種 + 時段各幣種報銷查詢 + 狀態查詢 + 權限控制 + 員工搜尋）
// ============================================================

// ============================================================
// 渲染費用報銷頁面 - 含權限檢查
// ============================================================

function renderExpenses(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('expenses', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>🧾 費用報銷</h1>
                <p class="breadcrumb">營運管理 > 費用報銷</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「費用報銷」的权限</p>
            </div>
        `;
        return;
    }
    
    // 初始化費用記錄（如果不存在）
    if (!localStorage.getItem('rpt_expense_records')) {
        DB.set('expense_records', []);
        DB.set('expense_records_next', 1);
    }
    
    const expenses = DB.get('expense_records', []);
    const employees = DB.get('employees', []);
    const accounts = DB.get('accounts', []);
    const currencies = DB.get('currencies', []);
    
    // 獲取查詢參數
    const searchDate = document.getElementById('expenseDate')?.value || '';
    const searchDateStart = document.getElementById('expenseDateStart')?.value || '';
    const searchDateEnd = document.getElementById('expenseDateEnd')?.value || '';
    const searchCurrency = document.getElementById('expenseCurrencyFilter')?.value || '';
    const searchStatus = document.getElementById('expenseStatusFilter')?.value || '';
    const viewMode = document.getElementById('expenseViewMode')?.value || 'detail';
    
    // ===== 過濾記錄 =====
    let filtered = [...expenses];
    
    if (searchDateStart && searchDateEnd) {
        filtered = filtered.filter(e => {
            if (!e.created_at) return false;
            const dateStr = e.created_at.split(' ')[0];
            return dateStr >= searchDateStart && dateStr <= searchDateEnd;
        });
    } else if (searchDateStart) {
        filtered = filtered.filter(e => {
            if (!e.created_at) return false;
            return e.created_at.startsWith(searchDateStart);
        });
    } else if (searchDate) {
        filtered = filtered.filter(e => {
            if (!e.created_at) return false;
            return e.created_at.startsWith(searchDate);
        });
    }
    
    if (searchCurrency) {
        filtered = filtered.filter(e => e.currency === searchCurrency);
    }
    
    if (searchStatus) {
        filtered = filtered.filter(e => e.status === searchStatus);
    }
    
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    filtered = filtered.slice(0, 200);
    
    // ===== 計算統計 =====
    const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);
    const pendingCount = filtered.filter(e => e.status === '待審核').length;
    const approvedCount = filtered.filter(e => e.status === '已核准').length;
    const paidCount = filtered.filter(e => e.status === '已付款').length;
    const rejectedCount = filtered.filter(e => e.status === '已駁回').length;
    
    const currencyStats = {};
    filtered.forEach(e => {
        const curr = e.currency || 'THB';
        if (!currencyStats[curr]) {
            currencyStats[curr] = {
                total: 0,
                count: 0,
                pending: 0,
                approved: 0,
                paid: 0,
                rejected: 0
            };
        }
        currencyStats[curr].total += e.amount;
        currencyStats[curr].count++;
        if (e.status === '待審核') currencyStats[curr].pending++;
        else if (e.status === '已核准') currencyStats[curr].approved++;
        else if (e.status === '已付款') currencyStats[curr].paid++;
        else if (e.status === '已駁回') currencyStats[curr].rejected++;
    });
    
    let currencyStatsHtml = '';
    const currencyKeys = Object.keys(currencyStats);
    if (currencyKeys.length > 0) {
        currencyStatsHtml = currencyKeys.map(curr => {
            const data = currencyStats[curr];
            return `
                <div style="background:#f8f9fc;padding:8px 12px;border-radius:6px;text-align:center;border:1px solid #eee;min-width:80px;">
                    <div style="font-weight:bold;font-size:14px;color:#333;">${curr}</div>
                    <div style="font-size:16px;font-weight:bold;color:#2196F3;">${data.total.toFixed(2)}</div>
                    <div style="font-size:10px;color:#999;display:flex;justify-content:center;gap:6px;margin-top:2px;">
                        <span style="color:#e65100;">待${data.pending}</span>
                        <span style="color:#0d47a1;">核${data.approved}</span>
                        <span style="color:#1b5e20;">付${data.paid}</span>
                        <span style="color:#c62828;">駁${data.rejected}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    let timeRangeLabel = '';
    if (searchDateStart && searchDateEnd) {
        timeRangeLabel = `📅 ${searchDateStart} ~ ${searchDateEnd}`;
    } else if (searchDateStart) {
        timeRangeLabel = `📅 ${searchDateStart}`;
    } else if (searchDate) {
        timeRangeLabel = `📅 ${searchDate}`;
    } else {
        timeRangeLabel = '📅 全部時段';
    }
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const statusOptions = `
        <option value="">全部狀態</option>
        <option value="待審核" ${searchStatus === '待審核' ? 'selected' : ''}>⏳ 待審核</option>
        <option value="已核准" ${searchStatus === '已核准' ? 'selected' : ''}>✅ 已核准</option>
        <option value="已付款" ${searchStatus === '已付款' ? 'selected' : ''}>💰 已付款</option>
        <option value="已駁回" ${searchStatus === '已駁回' ? 'selected' : ''}>❌ 已駁回</option>
    `;
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // ✅ 檢查各操作權限
    const canAdd = checkActionPermission('expenses', 'add');
    const canEdit = checkActionPermission('expenses', 'edit');
    const canDelete = checkActionPermission('expenses', 'delete');
    const canApprove = checkActionPermission('expenses', 'approve');
    const canPay = checkActionPermission('expenses', 'pay');
    const canViewDetail = checkActionPermission('expenses', 'view_detail');
    const canViewSummary = checkActionPermission('expenses', 'view_summary');
    
    // 構建表格
    let tableRows = '';
    if (filtered.length === 0) {
        tableRows = '<tr class="empty-row"><td colspan="10">暫無報銷記錄</td></tr>';
    } else {
        tableRows = filtered.map(e => {
            const emp = employees.find(emp => emp.id === e.employee_id);
            const account = accounts.find(a => a.id === e.account_id);
            const statusMap = {
                '待審核': '<span class="badge badge-warning">⏳ 待審核</span>',
                '已核准': '<span class="badge badge-info">✅ 已核准</span>',
                '已付款': '<span class="badge badge-success">💰 已付款</span>',
                '已駁回': '<span class="badge badge-danger">❌ 已駁回</span>'
            };
            const currency = e.currency || 'THB';
            let statusDisplay = statusMap[e.status] || '待審核';
            
            // 構建操作按鈕（根據權限顯示）
            let actionButtons = '';
            if (canViewDetail) {
                actionButtons += `<button class="btn btn-info btn-sm" onclick="showExpenseDetail(${e.id})">📋 明細</button>`;
            }
            if (canApprove && e.status === '待審核') {
                actionButtons += `<button class="btn btn-success btn-sm" onclick="showApproveExpense(${e.id})">核准</button>`;
            }
            if (canPay && e.status === '已核准') {
                actionButtons += `<button class="btn btn-success btn-sm" onclick="payExpense(${e.id})">付款</button>`;
            }
            if (canEdit && e.status !== '已核准' && e.status !== '已付款' && e.status !== '已駁回') {
                actionButtons += `<button class="btn btn-primary btn-sm" onclick="showEditExpense(${e.id})">修改</button>`;
            }
            if (canDelete && e.status !== '已付款') {
                actionButtons += `<button class="btn btn-danger btn-sm" onclick="deleteExpense(${e.id})">刪除</button>`;
            }
            
            return `<tr>
                <td><strong>${e.id}</strong></td>
                <td><strong>${emp ? emp.name : '未知'}</strong></td>
                <td>${emp ? emp.department || '-' : '-'}</td>
                <td>${e.category || '-'}</td>
                <td style="color:#2196F3;font-weight:bold;">${e.amount.toFixed(2)}</td>
                <td><span style="font-weight:bold;color:#666;">${currency}</span></td>
                <td>${formatDate(e.created_at)}</td>
                <td>${statusDisplay}</td>
                <td style="font-size:12px;color:#666;">${account ? account.name : (e.account_name || '-')}</td>
                <td>
                    <div class="btn-group" style="justify-content:center;flex-wrap:wrap;">
                        ${actionButtons}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }
    
    const statusLabelMap = {
        '待審核': '⏳ 待審核',
        '已核准': '✅ 已核准',
        '已付款': '💰 已付款',
        '已駁回': '❌ 已駁回'
    };
    const statusLabel = searchStatus ? statusLabelMap[searchStatus] || searchStatus : '';
    
    el.innerHTML = `
        <div class="page-header">
            <h1>🧾 費用報銷</h1>
            <p class="breadcrumb">營運管理 > 費用報銷</p>
        </div>
        
        <!-- 檢視模式切換 -->
        <div style="margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#fff;padding:12px 15px;border-radius:10px;border:1px solid #eee;">
            <span style="font-weight:500;font-size:14px;">📊 檢視模式：</span>
            <select id="expenseViewMode" style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="renderExpenses(document.getElementById('mainContent'))">
                <option value="detail" ${viewMode === 'detail' ? 'selected' : ''}>📋 明細記錄</option>
                <option value="summary" ${viewMode === 'summary' ? 'selected' : ''}>📊 幣種匯總</option>
            </select>
            <span style="font-size:12px;color:#999;margin-left:10px;">
                ${viewMode === 'summary' ? '💡 顯示時段內各幣種的報銷統計' : '💡 顯示每筆報銷明細'}
            </span>
        </div>
        
        <!-- 查詢工具欄 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;">
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding-bottom:10px;border-bottom:1px solid #f0f0f0;margin-bottom:10px;">
                <span style="font-weight:500;font-size:13px;color:#555;">📅 時段查詢：</span>
                <input type="date" id="expenseDateStart" value="${searchDateStart}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <span style="color:#999;">～</span>
                <input type="date" id="expenseDateEnd" value="${searchDateEnd}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <button class="btn btn-primary" onclick="renderExpenses(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('expenseDateStart').value='';document.getElementById('expenseDateEnd').value='';document.getElementById('expenseDate').value='';document.getElementById('expenseCurrencyFilter').value='';document.getElementById('expenseStatusFilter').value='';renderExpenses(document.getElementById('mainContent'))">✕ 清除</button>
                <button class="btn" onclick="document.getElementById('expenseDateStart').value='${todayStr}';document.getElementById('expenseDateEnd').value='${todayStr}';document.getElementById('expenseDate').value='';renderExpenses(document.getElementById('mainContent'))">📅 今天</button>
                <button class="btn" onclick="document.getElementById('expenseDateStart').value='';document.getElementById('expenseDateEnd').value='';document.getElementById('expenseDate').value='${todayStr}';renderExpenses(document.getElementById('mainContent'))">📅 單日</button>
                <span style="font-size:12px;color:#999;margin-left:auto;">${timeRangeLabel}</span>
            </div>
            
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                <span style="font-weight:500;font-size:13px;color:#555;">💱 幣種：</span>
                <select id="expenseCurrencyFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部幣種</option>
                    ${currencyOptions}
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">📌 狀態：</span>
                <select id="expenseStatusFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="renderExpenses(document.getElementById('mainContent'))">
                    ${statusOptions}
                </select>
                
                <button class="btn btn-primary" onclick="renderExpenses(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('expenseCurrencyFilter').value='';document.getElementById('expenseStatusFilter').value='';renderExpenses(document.getElementById('mainContent'))">✕ 清除篩選</button>
                ${canAdd ? `<button class="btn btn-success" onclick="showAddExpense()">➕ 新增報銷</button>` : ''}
                <button class="btn" onclick="renderExpenses(document.getElementById('mainContent'))">🔄 刷新</button>
                <span style="font-size:13px;color:#999;margin-left:auto;">
                    ${searchStatus ? `📌 ${statusLabel} | ` : ''}
                    共 ${filtered.length} 筆記錄
                </span>
            </div>
        </div>
        
        ${viewMode === 'summary' ? `
            <!-- ===== 匯總模式 ===== -->
            ${filtered.length > 0 ? `
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:15px;">
                    <div class="stat-card"><div class="stat-label">總報銷金額</div><div class="stat-value" style="color:#2196F3;">${totalAmount.toFixed(2)}</div></div>
                    <div class="stat-card" style="background:#fff3e0;border-color:#ffcc80;"><div class="stat-label">⏳ 待審核</div><div class="stat-value" style="color:#e65100;">${pendingCount}</div></div>
                    <div class="stat-card" style="background:#e3f2fd;border-color:#90caf9;"><div class="stat-label">✅ 已核准</div><div class="stat-value" style="color:#0d47a1;">${approvedCount}</div></div>
                    <div class="stat-card" style="background:#e8f5e9;border-color:#a5d6a7;"><div class="stat-label">💰 已付款</div><div class="stat-value" style="color:#1b5e20;">${paidCount}</div></div>
                    <div class="stat-card" style="background:#ffebee;border-color:#ef9a9a;"><div class="stat-label">❌ 已駁回</div><div class="stat-value" style="color:#c62828;">${rejectedCount}</div></div>
                </div>
                
                <!-- 各幣種報銷統計 -->
                <div class="table-container">
                    <h3 style="padding:12px 15px;margin:0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                        <span>💱 各幣種報銷統計</span>
                        <span style="font-size:12px;color:#999;font-weight:normal;">
                            ${searchDateStart && searchDateEnd ? `${searchDateStart} ~ ${searchDateEnd}` : searchDate ? searchDate : '全部時段'}
                            ${searchCurrency ? ` | 幣種：${searchCurrency}` : ''}
                            ${searchStatus ? ` | 狀態：${statusLabel}` : ''}
                        </span>
                    </h3>
                    <table>
                        <thead><tr>
                            <th style="text-align:center;min-width:80px;">幣種</th>
                            <th style="text-align:center;min-width:100px;">總金額</th>
                            <th style="text-align:center;min-width:80px;">筆數</th>
                            <th style="text-align:center;min-width:80px;">⏳ 待審核</th>
                            <th style="text-align:center;min-width:80px;">✅ 已核准</th>
                            <th style="text-align:center;min-width:80px;">💰 已付款</th>
                            <th style="text-align:center;min-width:80px;">❌ 已駁回</th>
                            <th style="text-align:center;min-width:120px;">佔比</th>
                        </tr></thead>
                        <tbody>
                            ${Object.keys(currencyStats).map(curr => {
                                const data = currencyStats[curr];
                                const percent = totalAmount > 0 ? (data.total / totalAmount * 100) : 0;
                                return `<tr>
                                    <td style="text-align:center;font-weight:bold;font-size:16px;">${curr}</td>
                                    <td style="text-align:center;color:#2196F3;font-weight:bold;font-size:16px;">${data.total.toFixed(2)}</td>
                                    <td style="text-align:center;">${data.count}</td>
                                    <td style="text-align:center;color:#e65100;">${data.pending}</td>
                                    <td style="text-align:center;color:#0d47a1;">${data.approved}</td>
                                    <td style="text-align:center;color:#1b5e20;">${data.paid}</td>
                                    <td style="text-align:center;color:#c62828;">${data.rejected}</td>
                                    <td style="text-align:center;">
                                        <div style="background:#e0e0e0;border-radius:10px;height:16px;width:100px;display:inline-block;overflow:hidden;">
                                            <div style="background:${percent > 50 ? '#4CAF50' : percent > 30 ? '#ffa726' : '#2196F3'};height:100%;width:${Math.min(percent, 100)}%;border-radius:10px;transition:width 0.3s;"></div>
                                        </div>
                                        <span style="font-size:11px;color:#666;margin-left:5px;">${percent.toFixed(1)}%</span>
                                    </td>
                                </tr>`;
                            }).join('')}
                            <tr style="background:#f5f5f5;font-weight:bold;">
                                <td style="text-align:center;">📊 合計</td>
                                <td style="text-align:center;color:#2196F3;font-size:16px;">${totalAmount.toFixed(2)}</td>
                                <td style="text-align:center;">${filtered.length}</td>
                                <td style="text-align:center;color:#e65100;">${pendingCount}</td>
                                <td style="text-align:center;color:#0d47a1;">${approvedCount}</td>
                                <td style="text-align:center;color:#1b5e20;">${paidCount}</td>
                                <td style="text-align:center;color:#c62828;">${rejectedCount}</td>
                                <td style="text-align:center;">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align:center;padding:40px;color:#999;background:#fff;border-radius:10px;border:1px solid #eee;">
                    📭 ${searchDateStart || searchDateEnd || searchDate ? '該時段暫無報銷記錄' : '暫無報銷記錄，請新增報銷'}
                </div>
            `}
        ` : `
            <!-- ===== 明細模式 ===== -->
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>ID</th>
                        <th>申請人</th>
                        <th>部門</th>
                        <th>類別</th>
                        <th>金額</th>
                        <th>幣種</th>
                        <th>日期</th>
                        <th>狀態</th>
                        <th>支出帳戶</th>
                        <th>操作</th>
                    </tr></thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            ${filtered.length > 0 ? `
                <div style="margin-top:10px;display:flex;gap:15px;flex-wrap:wrap;font-size:12px;color:#999;padding:8px 12px;background:#f8f9fc;border-radius:6px;">
                    <span>📊 總計：<strong>${filtered.length}</strong> 筆記錄</span>
                    <span>💰 總金額：<strong>${totalAmount.toFixed(2)}</strong></span>
                    ${searchDateStart && searchDateEnd ? `<span>📅 時段：${searchDateStart} ~ ${searchDateEnd}</span>` : ''}
                    ${searchDate ? `<span>📅 日期：${searchDate}</span>` : ''}
                    ${searchCurrency ? `<span>💱 幣種：${searchCurrency}</span>` : ''}
                    ${searchStatus ? `<span>📌 狀態：${statusLabel}</span>` : ''}
                    <span style="margin-left:auto;">💡 點擊「明細」查看完整資訊</span>
                </div>
            ` : ''}
        `}
    `;
}

// ============================================================
// 顯示報銷明細 - 含權限檢查
// ============================================================

function showExpenseDetail(id) {
    // ✅ 檢查查看明細權限
    if (!checkActionPermission('expenses', 'view_detail')) {
        showPermissionDenied('查看報銷明細');
        return;
    }
    
    const expenses = DB.get('expense_records', []);
    const e = expenses.find(x => x.id === id);
    if (!e) { alert('記錄不存在'); return; }
    
    const employees = DB.get('employees', []);
    const accounts = DB.get('accounts', []);
    const emp = employees.find(emp => emp.id === e.employee_id);
    const account = accounts.find(a => a.id === e.account_id);
    
    const statusMap = {
        '待審核': '<span class="badge badge-warning">⏳ 待審核</span>',
        '已核准': '<span class="badge badge-info">✅ 已核准</span>',
        '已付款': '<span class="badge badge-success">💰 已付款</span>',
        '已駁回': '<span class="badge badge-danger">❌ 已駁回</span>'
    };
    
    const currency = e.currency || 'THB';
    const amountDisplay = e.amount.toFixed(2);
    const deductAmountDisplay = e.deduct_amount ? e.deduct_amount.toFixed(2) : '-';
    const thbRefDisplay = e.thb_reference ? e.thb_reference.toFixed(2) : e.amount.toFixed(2);
    const sellRateDisplay = e.sell_rate || '-';
    
    const approvedAt = e.approved_at ? formatDate(e.approved_at) : '-';
    const paidAt = e.paid_at ? formatDate(e.paid_at) : '-';
    
    // ✅ 檢查操作權限
    const canApprove = checkActionPermission('expenses', 'approve') && e.status === '待審核';
    const canPay = checkActionPermission('expenses', 'pay') && e.status === '已核准';
    
    const html = `
        <div class="modal-title" style="font-size:22px;text-align:center;">📋 報銷明細 #${e.id}</div>
        
        <div style="text-align:center;margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            ${statusMap[e.status] || '未知'}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;padding:15px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            <div><strong>📌 申請人：</strong>${emp ? emp.name : '未知'}</div>
            <div><strong>🏢 部門：</strong>${emp ? (emp.department || '-') : '-'}</div>
            <div><strong>💼 職位：</strong>${emp ? (emp.position || '-') : '-'}</div>
            <div><strong>📂 類別：</strong>${e.category || '-'}</div>
            <div><strong>💰 金額：</strong><span style="color:#2196F3;font-weight:bold;font-size:18px;">${amountDisplay} ${currency}</span></div>
            <div><strong>💱 泰銖參考：</strong>${thbRefDisplay}</div>
            <div><strong>📅 申請日期：</strong>${formatDate(e.created_at)}</div>
            <div><strong>📅 費用日期：</strong>${e.date ? formatDate(e.date) : '-'}</div>
        </div>
        
        ${e.status === '已核准' || e.status === '已付款' ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;padding:15px;background:#e3f2fd;border-radius:8px;border:1px solid #90caf9;">
                <div><strong>✅ 核准時間：</strong>${approvedAt}</div>
                <div><strong>🏦 支出帳戶：</strong>${account ? account.name : (e.account_name || '-')}</div>
                <div><strong>💱 支出幣種：</strong>${currency}</div>
                <div><strong>📤 支出金額：</strong><span style="color:#ff6b6b;font-weight:bold;">${deductAmountDisplay} ${currency}</span></div>
                <div><strong>💱 賣出價：</strong>${sellRateDisplay}</div>
                <div><strong>📊 帳戶餘額（更新後）：</strong>${account ? get_account_balance(account.id, currency).toFixed(2) + ' ' + currency : '-'}</div>
            </div>
        ` : ''}
        
        ${e.status === '已付款' ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;padding:15px;background:#e8f5e9;border-radius:8px;border:1px solid #a5d6a7;">
                <div><strong>💰 付款時間：</strong>${paidAt}</div>
                <div><strong>✅ 付款狀態：</strong><span class="badge badge-success">已付款</span></div>
            </div>
        ` : ''}
        
        <div style="margin-bottom:15px;padding:15px;background:#f5f5f5;border-radius:8px;border:1px solid #e0e0e0;">
            <div style="margin-bottom:8px;"><strong>📝 說明：</strong></div>
            <div style="padding:8px 12px;background:#fff;border-radius:4px;border:1px solid #eee;min-height:40px;white-space:pre-wrap;word-break:break-word;">${e.description || '（無說明）'}</div>
        </div>
        
        <div style="margin-bottom:15px;padding:15px;background:#f5f5f5;border-radius:8px;border:1px solid #e0e0e0;">
            <div style="margin-bottom:8px;"><strong>📌 備註：</strong></div>
            <div style="padding:8px 12px;background:#fff;border-radius:4px;border:1px solid #eee;min-height:40px;white-space:pre-wrap;word-break:break-word;">${e.remark || '（無備註）'}</div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:10px 15px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;font-size:12px;color:#888;">
            <div><strong>建立人：</strong>${e.admin_name || '系統'}</div>
            <div style="text-align:right;"><strong>建立時間：</strong>${formatDate(e.created_at)}</div>
        </div>
        
        <div class="modal-actions">
            ${canApprove ? `<button class="btn btn-success" onclick="closeModal(this.closest('.modal-overlay'));showApproveExpense(${e.id})">✅ 核准</button>` : ''}
            ${canPay ? `<button class="btn btn-success" onclick="closeModal(this.closest('.modal-overlay'));payExpense(${e.id})">💰 付款</button>` : ''}
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
        </div>
    `;
    showModalWide(html);
}

// ============================================================
// 新增報銷 - 含權限檢查 + 員工搜尋功能
// ============================================================

function showAddExpense() {
    // ✅ 檢查新增報銷權限
    if (!checkActionPermission('expenses', 'add')) {
        showPermissionDenied('新增報銷');
        return;
    }
    
    const employees = DB.get('employees', []);
    const currencies = DB.get('currencies', []);
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" ${c.currency === 'THB' ? 'selected' : ''}>${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    // 構建員工下拉選項
    const employeeOptions = employees.map(e => 
        `<option value="${e.id}">${e.id}. ${e.name} (${e.department || '-'})</option>`
    ).join('');
    
    const html = `
        <div class="modal-title">🧾 新增費用報銷</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 新增報銷後需由管理員核准並選擇支出帳戶</span>
        </div>
        
        <!-- 員工搜尋區塊 -->
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #e0e0e0;">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <span style="font-weight:500;font-size:14px;color:#333;">🔍 搜尋員工：</span>
                <input type="text" id="expenseEmployeeSearch" placeholder="輸入員工ID或姓名" style="flex:1;min-width:150px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') searchEmployeeForExpense()">
                <button class="btn btn-primary" onclick="searchEmployeeForExpense()">🔍 搜尋</button>
                <button class="btn" onclick="clearEmployeeSearch()">✕ 清除</button>
            </div>
            <div id="employeeSearchResult" style="margin-top:8px;font-size:13px;color:#999;text-align:center;display:none;"></div>
        </div>
        
        <div class="form-group">
            <label>申請人 *</label>
            <select id="expenseEmployee" onchange="showSelectedEmployeeInfo()">
                <option value="">請選擇...</option>
                ${employeeOptions}
                ${employees.length === 0 ? '<option value="">⚠️ 請先新增員工</option>' : ''}
            </select>
        </div>
        <div id="selectedEmployeeInfo" style="margin-bottom:15px;padding:10px;background:#e8f5e9;border-radius:6px;display:none;text-align:center;border:1px solid #a5d6a7;">
            <span style="color:#2e7d32;">✅ 已選擇：</span>
            <span id="selectedEmployeeName" style="font-weight:bold;color:#1b5e20;">-</span>
            <span id="selectedEmployeeDept" style="font-size:12px;color:#666;margin-left:10px;"></span>
        </div>
        
        <div class="form-group"><label>費用類別 *</label>
            <select id="expenseCategory">
                <option value="交通費">交通費</option>
                <option value="餐飲費">餐飲費</option>
                <option value="住宿費">住宿費</option>
                <option value="辦公用品">辦公用品</option>
                <option value="交際費">交際費</option>
                <option value="其他">其他</option>
            </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>金額 *</label>
                <input type="number" id="expenseAmount" step="0.01" min="0.01" placeholder="請輸入金額">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>幣種 *</label>
                <select id="expenseCurrency">
                    ${currencyOptions}
                    ${currencies.length === 0 ? '<option value="THB">THB</option>' : ''}
                </select>
            </div>
        </div>
        <div class="form-group"><label>日期</label><input type="date" id="expenseDateInput"></div>
        <div class="form-group"><label>說明</label><textarea id="expenseDescription" rows="3" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="請輸入費用說明"></textarea></div>
        <div class="form-group"><label>備註</label><input type="text" id="expenseRemark" placeholder="請輸入備註"></div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 報銷提交後狀態為「待審核」，需管理員核准並選擇支出帳戶</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddExpense()">確認新增</button>
        </div>
    `;
    showModal(html);
    
    // ===== 員工搜尋函數 =====
    window.searchEmployeeForExpense = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const searchInput = overlay.querySelector('#expenseEmployeeSearch');
        const resultDiv = overlay.querySelector('#employeeSearchResult');
        const employeeSelect = overlay.querySelector('#expenseEmployee');
        const keyword = searchInput.value.trim();
        
        if (!keyword) {
            resultDiv.style.display = 'none';
            return;
        }
        
        const employees = DB.get('employees', []);
        const isNumeric = /^\d+$/.test(keyword);
        
        let foundEmployees = [];
        
        if (isNumeric) {
            // 按ID搜尋
            const idMatch = parseInt(keyword);
            foundEmployees = employees.filter(e => e.id === idMatch || e.id.toString().includes(keyword));
        }
        
        // 按姓名搜尋（如果沒有找到或同時搜尋）
        const nameMatches = employees.filter(e => e.name.toLowerCase().includes(keyword.toLowerCase()));
        nameMatches.forEach(e => {
            if (!foundEmployees.find(f => f.id === e.id)) {
                foundEmployees.push(e);
            }
        });
        
        if (foundEmployees.length === 0) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = '#ff6b6b';
            resultDiv.innerHTML = '❌ 找不到匹配的員工，請重新輸入';
            return;
        }
        
        // 更新下拉選單
        let optionsHtml = '<option value="">請選擇...</option>';
        foundEmployees.forEach(e => {
            optionsHtml += `<option value="${e.id}" data-dept="${e.department || '-'}" data-pos="${e.position || '-'}">${e.id}. ${e.name} (${e.department || '-'})</option>`;
        });
        employeeSelect.innerHTML = optionsHtml;
        
        // 如果只有一個結果，自動選中
        if (foundEmployees.length === 1) {
            employeeSelect.value = foundEmployees[0].id;
            showSelectedEmployeeInfo();
        }
        
        resultDiv.style.display = 'block';
        resultDiv.style.color = '#4CAF50';
        resultDiv.innerHTML = `✅ 找到 ${foundEmployees.length} 位員工，已更新下方列表`;
    };
    
    window.clearEmployeeSearch = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const searchInput = overlay.querySelector('#expenseEmployeeSearch');
        const resultDiv = overlay.querySelector('#employeeSearchResult');
        const employeeSelect = overlay.querySelector('#expenseEmployee');
        
        searchInput.value = '';
        resultDiv.style.display = 'none';
        
        // 恢復原始員工列表
        const employees = DB.get('employees', []);
        let optionsHtml = '<option value="">請選擇...</option>';
        employees.forEach(e => {
            optionsHtml += `<option value="${e.id}" data-dept="${e.department || '-'}" data-pos="${e.position || '-'}">${e.id}. ${e.name} (${e.department || '-'})</option>`;
        });
        employeeSelect.innerHTML = optionsHtml;
        employeeSelect.value = '';
        document.getElementById('selectedEmployeeInfo').style.display = 'none';
    };
    
    window.showSelectedEmployeeInfo = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const select = overlay.querySelector('#expenseEmployee');
        const selectedOption = select.options[select.selectedIndex];
        const infoDiv = document.getElementById('selectedEmployeeInfo');
        const nameSpan = document.getElementById('selectedEmployeeName');
        const deptSpan = document.getElementById('selectedEmployeeDept');
        
        if (selectedOption && selectedOption.value) {
            const dept = selectedOption.dataset.dept || '-';
            const pos = selectedOption.dataset.pos || '-';
            infoDiv.style.display = 'block';
            nameSpan.textContent = selectedOption.text.replace(/\(\d+\.\s*/, '').replace(/\s*\(.*\)/, '').trim();
            deptSpan.textContent = `🏢 ${dept} | 💼 ${pos}`;
        } else {
            infoDiv.style.display = 'none';
        }
    };
}

// ============================================================
// 提交新增報銷
// ============================================================

function submitAddExpense() {
    const overlay = document.querySelector('.modal-overlay');
    const employeeId = parseInt(overlay.querySelector('#expenseEmployee').value);
    if (!employeeId) { alert('請選擇申請人'); return; }
    
    const amount = parseFloat(overlay.querySelector('#expenseAmount').value);
    if (!amount || amount <= 0) { alert('請輸入有效金額'); return; }
    
    const currency = overlay.querySelector('#expenseCurrency').value || 'THB';
    const expenses = DB.get('expense_records', []);
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    const thbAmount = convertToTHB(amount, currency);
    
    expenses.push({
        id: DB.getNextId('expense_records'),
        employee_id: employeeId,
        employee_name: employee ? employee.name : '未知',
        category: overlay.querySelector('#expenseCategory').value,
        amount: amount,
        currency: currency,
        thb_amount: thbAmount,
        date: overlay.querySelector('#expenseDateInput').value || now(),
        description: overlay.querySelector('#expenseDescription').value.trim(),
        remark: overlay.querySelector('#expenseRemark').value.trim(),
        status: '待審核',
        account_id: null,
        account_name: null,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('expense_records', expenses);
    
    addOperationLog('費用報銷', '新增', employee ? employee.name : '未知', 
        `新增報銷 - ${employee ? employee.name : '未知'} - ${amount} ${currency} (≈${thbAmount.toFixed(2)} 泰銖)`, employeeId);
    
    overlay.remove();
    renderExpenses(document.getElementById('mainContent'));
    alert(`✅ 報銷已新增，等待審核\n\n金額：${amount.toFixed(2)} ${currency}\n泰銖參考：${thbAmount.toFixed(2)}`);
}

// ============================================================
// 核准報銷（選擇支出帳戶）- 含權限檢查
// ============================================================

function showApproveExpense(id) {
    // ✅ 檢查核准報銷權限
    if (!checkActionPermission('expenses', 'approve')) {
        showPermissionDenied('核准報銷');
        return;
    }
    
    const expenses = DB.get('expense_records', []);
    const e = expenses.find(x => x.id === id);
    if (!e) { alert('記錄不存在'); return; }
    
    if (e.status !== '待審核') {
        alert('此報銷已處理，無法再次核准');
        return;
    }
    
    const accounts = DB.get('accounts', []);
    if (accounts.length === 0) {
        alert('⚠️ 請先到「往來帳款」頁面新增帳戶');
        return;
    }
    
    const employee = DB.get('employees', []).find(emp => emp.id === e.employee_id);
    const employeeName = employee ? employee.name : '未知';
    
    const currencies = DB.get('currencies', []);
    const expenseCurrency = e.currency || 'THB';
    
    let accountOptions = '';
    accounts.forEach(a => {
        const balances = a.balances || {};
        const currencyKeys = Object.keys(balances);
        if (currencyKeys.length === 0) {
            accountOptions += `<option value="${a.id}|THB" data-balance="0">${a.name} (THB: 0.00)</option>`;
        } else {
            currencyKeys.forEach(curr => {
                const balance = balances[curr] || 0;
                accountOptions += `<option value="${a.id}|${curr}" data-balance="${balance}" data-currency="${curr}">${a.name} (${curr}: ${balance.toFixed(2)})</option>`;
            });
        }
    });
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" ${c.currency === expenseCurrency ? 'selected' : ''}>${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const html = `
        <div class="modal-title">✅ 核准報銷 - 選擇支出帳戶</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 核准報銷將從所選帳戶的指定幣種支出金額</span>
        </div>
        
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:14px;">
                <div><strong>申請人：</strong>${employeeName}</div>
                <div><strong>類別：</strong>${e.category || '-'}</div>
                <div><strong>金額：</strong><span style="color:#2196F3;font-weight:bold;">${e.amount.toFixed(2)} ${e.currency || 'THB'}</span></div>
                <div><strong>泰銖參考：</strong>${(e.thb_amount || e.amount).toFixed(2)}</div>
                <div><strong>日期：</strong>${formatDate(e.created_at)}</div>
            </div>
            ${e.description ? `<div style="grid-column:1/-1;margin-top:5px;"><strong>說明：</strong>${e.description}</div>` : ''}
            ${e.remark ? `<div style="grid-column:1/-1;"><strong>備註：</strong>${e.remark}</div>` : ''}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>支出帳戶 *</label>
                <select id="approveAccount" onchange="updateApprovePreview()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                    ${accountOptions}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>支出幣種 *</label>
                <select id="approveCurrency" onchange="updateApprovePreview()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                    ${currencyOptions}
                </select>
            </div>
        </div>
        
        <div id="approveBalancePreview" style="margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;display:none;">
            <span style="color:#e65100;">💡 支出後帳戶餘額：<strong id="approveAfterBalance">0.00</strong> <span id="approveAfterCurrency">THB</span></span>
            <span style="color:#e65100;margin-left:15px;">泰銖參考：<strong id="approveTHBRef">0.00</strong></span>
        </div>
        
        <div id="approveExchangeInfo" style="margin-bottom:15px;padding:10px;background:#e3f2fd;border-radius:6px;border:1px solid #90caf9;text-align:center;font-size:12px;display:none;">
            <span style="color:#1565C0;">💱 匯率：</span>
            <span id="approveRateDisplay" style="color:#1565C0;font-weight:bold;">1 THB = 1 THB</span>
            <span style="color:#1565C0;margin-left:10px;">（使用賣出價，無條件舍去）</span>
        </div>
        
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 核准後報銷狀態變更為「已核准」，可繼續執行付款</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitApproveExpense(${id})">✅ 確認核准</button>
        </div>
    `;
    showModal(html);
    
    window.updateApprovePreview = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        
        const accountSelect = overlayEl.querySelector('#approveAccount');
        const currencySelect = overlayEl.querySelector('#approveCurrency');
        const selectedOption = accountSelect.options[accountSelect.selectedIndex];
        const previewDiv = document.getElementById('approveBalancePreview');
        const afterBalanceSpan = document.getElementById('approveAfterBalance');
        const afterCurrencySpan = document.getElementById('approveAfterCurrency');
        const thbRefSpan = document.getElementById('approveTHBRef');
        const exchangeInfoDiv = document.getElementById('approveExchangeInfo');
        const rateDisplaySpan = document.getElementById('approveRateDisplay');
        
        const selectedCurrency = currencySelect.value;
        const currentBalance = parseFloat(selectedOption?.dataset?.balance || 0);
        const expenseAmount = e.amount;
        const expenseCurrency = e.currency || 'THB';
        
        let deductAmount = 0;
        let thbRef = 0;
        
        if (selectedCurrency === 'THB') {
            deductAmount = expenseAmount;
            thbRef = expenseAmount;
            rateDisplaySpan.textContent = `1 THB = 1 THB`;
        } else {
            const thbValue = convertToTHB(expenseAmount, expenseCurrency);
            thbRef = thbValue;
            deductAmount = convertFromTHB(thbValue, selectedCurrency);
            const sellRate = getSellRate(selectedCurrency);
            const thbToCurrency = 1 / sellRate;
            rateDisplaySpan.textContent = `1 THB = ${thbToCurrency.toFixed(4)} ${selectedCurrency} (賣出價 ${sellRate})`;
        }
        
        const afterBalance = currentBalance - deductAmount;
        
        previewDiv.style.display = 'block';
        afterBalanceSpan.textContent = afterBalance.toFixed(2);
        afterBalanceSpan.style.color = afterBalance >= 0 ? '#2e7d32' : '#c62828';
        afterCurrencySpan.textContent = selectedCurrency;
        thbRefSpan.textContent = thbRef.toFixed(2);
        
        exchangeInfoDiv.style.display = 'block';
        
        if (currentBalance < deductAmount) {
            previewDiv.style.background = '#ffebee';
            previewDiv.style.borderColor = '#ef9a9a';
            previewDiv.innerHTML = `
                <span style="color:#c62828;">⚠️ 帳戶 ${selectedCurrency} 餘額不足！</span>
                <span style="color:#c62828;">當前餘額：${currentBalance.toFixed(2)} ${selectedCurrency}</span>
                <span style="color:#c62828;">需要：${deductAmount.toFixed(2)} ${selectedCurrency}</span>
                <span style="color:#c62828;font-weight:bold;">（餘額將變為負值）</span>
            `;
        } else {
            previewDiv.style.background = '#fff8e1';
            previewDiv.style.borderColor = '#ffcc80';
            previewDiv.innerHTML = `
                <span style="color:#e65100;">💡 支出後帳戶餘額：<strong id="approveAfterBalance" style="color:${afterBalance >= 0 ? '#2e7d32' : '#c62828'};">${afterBalance.toFixed(2)}</strong> <span id="approveAfterCurrency">${selectedCurrency}</span></span>
                <span style="color:#e65100;margin-left:15px;">泰銖參考：<strong id="approveTHBRef">${thbRef.toFixed(2)}</strong></span>
            `;
        }
    };
    
    document.getElementById('approveAccount')?.addEventListener('change', updateApprovePreview);
    document.getElementById('approveCurrency')?.addEventListener('change', updateApprovePreview);
    
    setTimeout(() => {
        if (window.updateApprovePreview) window.updateApprovePreview();
    }, 100);
}

function submitApproveExpense(id) {
    const overlay = document.querySelector('.modal-overlay');
    const accountStr = overlay.querySelector('#approveAccount').value;
    if (!accountStr) { alert('請選擇支出帳戶'); return; }
    
    const currency = overlay.querySelector('#approveCurrency').value;
    if (!currency) { alert('請選擇支出幣種'); return; }
    
    const [accountIdStr] = accountStr.split('|');
    const accountId = parseInt(accountIdStr);
    if (!accountId) { alert('請選擇有效的支出帳戶'); return; }
    
    const expenses = DB.get('expense_records', []);
    const e = expenses.find(x => x.id === id);
    if (!e) { alert('記錄不存在'); return; }
    
    if (e.status !== '待審核') {
        alert('此報銷已處理，無法再次核准');
        overlay.remove();
        renderExpenses(document.getElementById('mainContent'));
        return;
    }
    
    const expenseCurrency = e.currency || 'THB';
    const expenseAmount = e.amount;
    
    let deductAmount = 0;
    let thbRef = 0;
    
    if (currency === 'THB') {
        deductAmount = expenseAmount;
        thbRef = expenseAmount;
    } else {
        const thbValue = convertToTHB(expenseAmount, expenseCurrency);
        thbRef = thbValue;
        deductAmount = convertFromTHB(thbValue, currency);
        const sellRate = getSellRate(currency);
        if (deductAmount < 1) {
            alert(`⚠️ 換算後金額不足 1 ${currency}！\n泰銖參考：${thbValue.toFixed(2)} / 賣出價 ${sellRate} = ${(thbValue/sellRate).toFixed(4)} ${currency}\n請選擇其他幣種。`);
            return;
        }
    }
    
    const currentBalance = get_account_balance(accountId, currency);
    if (currentBalance < deductAmount) {
        if (!confirm(`⚠️ 帳戶 ${currency} 餘額不足！\n當前餘額：${currentBalance.toFixed(2)} ${currency}\n需要：${deductAmount.toFixed(2)} ${currency}\n是否仍要核准？（餘額將變為負值）`)) {
            return;
        }
    }
    
    const account = getAccount(accountId);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const beforeData = { ...e };
    
    e.status = '已核准';
    e.account_id = accountId;
    e.account_name = account ? account.name : '未知帳戶';
    e.currency = currency;
    e.deduct_amount = deductAmount;
    e.thb_reference = thbRef;
    e.sell_rate = getSellRate(currency);
    e.approved_at = now();
    e.approved_admin_id = adminId;
    e.approved_admin_name = adminName;
    
    DB.set('expense_records', expenses);
    
    update_account_balance(accountId, currency, -deductAmount);
    
    add_account_transaction(
        accountId,
        currency,
        deductAmount,
        'out',
        'expense_approval',
        e.id,
        `費用報銷支出 - ${e.employee_name || '未知'} - ${e.category || '費用'} - ${deductAmount} ${currency} (泰銖參考：${thbRef.toFixed(2)}) - 賣出價 ${e.sell_rate} - 操作人：${adminName}`
    );
    
    addOperationLog('費用報銷', '核准', e.employee_name || '未知', 
        `核准報銷 - ${e.employee_name || '未知'} - ${deductAmount} ${currency} (泰銖參考：${thbRef.toFixed(2)}) - 帳戶：${e.account_name} - 賣出價 ${e.sell_rate}`, e.employee_id, beforeData, e);
    
    overlay.remove();
    renderExpenses(document.getElementById('mainContent'));
    
    const newBalance = get_account_balance(accountId, currency);
    alert(`✅ 報銷已核准！\n\n` +
        `申請人：${e.employee_name || '未知'}\n` +
        `原報銷金額：${expenseAmount.toFixed(2)} ${expenseCurrency}\n` +
        `支出幣種：${currency}\n` +
        `支出金額：${deductAmount.toFixed(2)} ${currency}\n` +
        `泰銖參考：${thbRef.toFixed(2)}\n` +
        `賣出價：${e.sell_rate}\n` +
        `支出帳戶：${e.account_name}\n` +
        `帳戶餘額：${newBalance.toFixed(2)} ${currency}\n\n` +
        `📌 可點擊「付款」完成最終付款`);
}

// ============================================================
// 付款 - 含權限檢查
// ============================================================

function payExpense(id) {
    // ✅ 檢查付款權限
    if (!checkActionPermission('expenses', 'pay')) {
        showPermissionDenied('報銷付款');
        return;
    }
    
    if (!confirm('確定要將此筆報銷標記為「已付款」嗎？')) return;
    
    const expenses = DB.get('expense_records', []);
    const e = expenses.find(x => x.id === id);
    if (!e) { alert('記錄不存在'); return; }
    
    if (e.status !== '已核准') {
        alert('⚠️ 此報銷尚未核准，請先核准並選擇支出帳戶');
        return;
    }
    
    const beforeData = { ...e };
    e.status = '已付款';
    e.paid_at = now();
    e.paid_admin_name = getCurrentAdminName();
    e.paid_admin_id = getCurrentAdminId();
    DB.set('expense_records', expenses);
    
    addOperationLog('費用報銷', '付款', e.employee_name || '未知', 
        `標記已付款 - ${e.employee_name || '未知'} - ${e.deduct_amount || e.amount} ${e.currency || 'THB'} (泰銖參考：${e.thb_reference || e.amount})`, e.employee_id, beforeData, e);
    
    renderExpenses(document.getElementById('mainContent'));
    alert(`✅ 已標記為已付款\n\n` +
        `申請人：${e.employee_name || '未知'}\n` +
        `支出金額：${e.deduct_amount || e.amount} ${e.currency || 'THB'}\n` +
        `泰銖參考：${e.thb_reference || e.amount}\n` +
        `支出帳戶：${e.account_name || '未指定'}`);
}

// ============================================================
// 修改報銷 - 含權限檢查
// ============================================================

function showEditExpense(id) {
    // ✅ 檢查修改報銷權限
    if (!checkActionPermission('expenses', 'edit')) {
        showPermissionDenied('修改報銷');
        return;
    }
    
    const expenses = DB.get('expense_records', []);
    const e = expenses.find(x => x.id === id);
    if (!e) { alert('記錄不存在'); return; }
    
    if (e.status === '已核准' || e.status === '已付款' || e.status === '已駁回') {
        alert('⚠️ 已核准、已付款或已駁回的報銷不能修改');
        return;
    }
    
    const employees = DB.get('employees', []);
    const currencies = DB.get('currencies', []);
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" ${c.currency === e.currency ? 'selected' : ''}>${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const html = `
        <div class="modal-title">✏️ 修改報銷</div>
        <div class="form-group"><label>申請人</label>
            <select id="editExpenseEmployee">
                ${employees.map(emp => 
                    `<option value="${emp.id}" ${emp.id === e.employee_id ? 'selected' : ''}>${emp.id}. ${emp.name} (${emp.department || '-'})</option>`
                ).join('')}
            </select>
        </div>
        <div class="form-group"><label>費用類別</label>
            <select id="editExpenseCategory">
                <option value="交通費" ${e.category === '交通費' ? 'selected' : ''}>交通費</option>
                <option value="餐飲費" ${e.category === '餐飲費' ? 'selected' : ''}>餐飲費</option>
                <option value="住宿費" ${e.category === '住宿費' ? 'selected' : ''}>住宿費</option>
                <option value="辦公用品" ${e.category === '辦公用品' ? 'selected' : ''}>辦公用品</option>
                <option value="交際費" ${e.category === '交際費' ? 'selected' : ''}>交際費</option>
                <option value="其他" ${e.category === '其他' ? 'selected' : ''}>其他</option>
            </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>金額</label>
                <input type="number" id="editExpenseAmount" step="0.01" value="${e.amount}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>幣種</label>
                <select id="editExpenseCurrency">
                    ${currencyOptions}
                    ${currencies.length === 0 ? '<option value="THB">THB</option>' : ''}
                </select>
            </div>
        </div>
        <div class="form-group"><label>日期</label><input type="date" id="editExpenseDate" value="${e.date ? e.date.slice(0,10) : ''}"></div>
        <div class="form-group"><label>說明</label><textarea id="editExpenseDescription" rows="3" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">${e.description || ''}</textarea></div>
        <div class="form-group"><label>備註</label><input type="text" id="editExpenseRemark" value="${e.remark || ''}"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitEditExpense(${id})">確認修改</button>
        </div>
    `;
    showModal(html);
}

function submitEditExpense(id) {
    const overlay = document.querySelector('.modal-overlay');
    const expenses = DB.get('expense_records', []);
    const e = expenses.find(x => x.id === id);
    if (e) {
        const beforeData = { ...e };
        e.employee_id = parseInt(overlay.querySelector('#editExpenseEmployee').value);
        e.category = overlay.querySelector('#editExpenseCategory').value;
        e.amount = parseFloat(overlay.querySelector('#editExpenseAmount').value) || 0;
        e.currency = overlay.querySelector('#editExpenseCurrency').value || 'THB';
        e.date = overlay.querySelector('#editExpenseDate').value || now();
        e.description = overlay.querySelector('#editExpenseDescription').value.trim();
        e.remark = overlay.querySelector('#editExpenseRemark').value.trim();
        e.thb_amount = convertToTHB(e.amount, e.currency);
        DB.set('expense_records', expenses);
        
        addOperationLog('費用報銷', '修改', e.employee_name || '未知', 
            `修改報銷 - ${e.employee_name || '未知'} - ${e.amount} ${e.currency} (≈${e.thb_amount.toFixed(2)} 泰銖)`, e.employee_id, beforeData, e);
    }
    overlay.remove();
    renderExpenses(document.getElementById('mainContent'));
    alert('✅ 報銷已更新');
}

// ============================================================
// 刪除報銷 - 含權限檢查
// ============================================================

function deleteExpense(id) {
    // ✅ 檢查刪除報銷權限
    if (!checkActionPermission('expenses', 'delete')) {
        showPermissionDenied('刪除報銷');
        return;
    }
    
    if (!confirm('確定要刪除此筆報銷記錄嗎？')) return;
    
    const expenses = DB.get('expense_records', []);
    const e = expenses.find(x => x.id === id);
    if (e) {
        if (e.status === '已付款') {
            alert('⚠️ 已付款的報銷不能刪除');
            return;
        }
        if (e.status === '已核准' && e.account_id) {
            const currency = e.currency || 'THB';
            const deductAmount = e.deduct_amount || e.amount;
            if (!confirm(`⚠️ 此報銷已核准並從帳戶「${e.account_name}」扣款 ${deductAmount} ${currency} (泰銖參考：${e.thb_reference || e.amount})，刪除將退還金額。\n確定要刪除嗎？`)) {
                return;
            }
            update_account_balance(e.account_id, currency, deductAmount);
            add_account_transaction(
                e.account_id,
                currency,
                deductAmount,
                'in',
                'expense_delete_refund',
                e.id,
                `刪除報銷退款 - ${e.employee_name || '未知'} - ${deductAmount} ${currency} (泰銖參考：${e.thb_reference || e.amount}) - 操作人：${getCurrentAdminName()}`
            );
        }
        
        addOperationLog('費用報銷', '删除', e.employee_name || '未知', 
            `刪除報銷 - ${e.employee_name || '未知'} - ${e.amount} ${e.currency || 'THB'}`, e.employee_id);
    }
    
    const newExpenses = expenses.filter(x => x.id !== id);
    DB.set('expense_records', newExpenses);
    renderExpenses(document.getElementById('mainContent'));
    alert('✅ 報銷已刪除');
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