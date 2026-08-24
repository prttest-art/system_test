// ============================================================
// 10. 兑汇纪录（每桌换币明细 - 支持买入/卖出价 + 時段查詢 + 帳戶匯總 + 權限控制）
// ============================================================

// 初始化兑汇记录存储
function initExchangeRecords() {
    if (!localStorage.getItem('rpt_exchange_records')) {
        DB.set('exchange_records', []);
        DB.set('exchange_records_next', 1);
    }
}

/**
 * 记录换币操作
 */
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
    return true;
}

/**
 * 获取换币记录（支持筛选）
 */
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
        if (filters.account_id) {
            records = records.filter(r => r.account_id === filters.account_id);
        }
        if (filters.date_start && filters.date_end) {
            records = records.filter(r => {
                if (!r.created_at) return false;
                const dateStr = r.created_at.split(' ')[0];
                return dateStr >= filters.date_start && dateStr <= filters.date_end;
            });
        }
    }
    
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return records;
}

/**
 * 獲取時段內各帳戶各幣種進出總額
 */
function getAccountExchangeSummary(dateStart, dateEnd, accountId) {
    initExchangeRecords();
    let records = DB.get('exchange_records', []);
    
    if (dateStart && dateEnd) {
        records = records.filter(r => {
            if (!r.created_at) return false;
            const dateStr = r.created_at.split(' ')[0];
            return dateStr >= dateStart && dateStr <= dateEnd;
        });
    }
    
    const summary = {};
    const accountTx = DB.get('account_transactions', []);
    
    const filteredTx = accountTx.filter(t => {
        if (!t.created_at) return false;
        const dateStr = t.created_at.split(' ')[0];
        const isExchange = t.reference_type === 'exchange_deposit' || 
                          t.reference_type === 'exchange_withdraw' ||
                          (t.note && t.note.includes('换币'));
        return isExchange && dateStr >= dateStart && dateStr <= dateEnd;
    });
    
    const targetAccountId = accountId ? parseInt(accountId) : null;
    
    filteredTx.forEach(t => {
        const accId = t.account_id;
        if (targetAccountId && accId !== targetAccountId) return;
        
        const currency = t.currency || 'THB';
        const key = `${accId}|${currency}`;
        
        if (!summary[key]) {
            summary[key] = {
                account_id: accId,
                account_name: getAccount(accId)?.name || '未知帳戶',
                currency: currency,
                total_in: 0,
                total_out: 0,
                net: 0,
                records: []
            };
        }
        
        if (t.type === 'in') {
            summary[key].total_in += t.amount;
        } else if (t.type === 'out') {
            summary[key].total_out += t.amount;
        }
        summary[key].net = summary[key].total_in - summary[key].total_out;
        summary[key].records.push(t);
    });
    
    const result = Object.values(summary);
    result.sort((a, b) => {
        if (a.account_name !== b.account_name) {
            return a.account_name.localeCompare(b.account_name);
        }
        return a.currency.localeCompare(b.currency);
    });
    
    return result;
}

/**
 * 獲取時段內所有帳戶總匯總
 */
function getTotalAccountSummary(dateStart, dateEnd) {
    const details = getAccountExchangeSummary(dateStart, dateEnd);
    const total = {};
    
    details.forEach(d => {
        if (!total[d.currency]) {
            total[d.currency] = {
                currency: d.currency,
                total_in: 0,
                total_out: 0,
                net: 0
            };
        }
        total[d.currency].total_in += d.total_in;
        total[d.currency].total_out += d.total_out;
        total[d.currency].net += d.net;
    });
    
    return Object.values(total);
}

/**
 * 获取某桌的换币汇总
 */
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
// 渲染兑汇纪录页面 - 含權限檢查
// ============================================================

function renderExchange(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('exchange', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>💱 兑汇纪录</h1>
                <p class="breadcrumb">营运管理 > 兑汇纪录</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「兑汇纪录」的权限</p>
            </div>
        `;
        return;
    }
    
    initExchangeRecords();
    const currencies = DB.get('currencies', []);
    const members = DB.get('members', []);
    const sessions = DB.get('sessions', []);
    const accounts = DB.get('accounts', []);
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 獲取查詢參數
    const searchDate = document.getElementById('exchangeDate')?.value || '';
    const searchDateStart = document.getElementById('exchangeDateStart')?.value || '';
    const searchDateEnd = document.getElementById('exchangeDateEnd')?.value || '';
    const searchTable = document.getElementById('exchangeTable')?.value || '';
    const searchMember = document.getElementById('exchangeMember')?.value || '';
    const searchCurrency = document.getElementById('exchangeCurrency')?.value || '';
    const searchDirection = document.getElementById('exchangeDirection')?.value || '';
    const searchAccount = document.getElementById('exchangeAccount')?.value || '';
    const viewMode = document.getElementById('exchangeViewMode')?.value || 'detail';
    
    // 構建篩選條件
    const filters = {};
    if (searchDate) filters.date = searchDate;
    if (searchDateStart && searchDateEnd) {
        filters.date_start = searchDateStart;
        filters.date_end = searchDateEnd;
    }
    if (searchTable) filters.table_type = searchTable;
    if (searchMember) {
        const memberId = parseInt(searchMember);
        if (!isNaN(memberId)) filters.member_id = memberId;
    }
    if (searchCurrency) filters.from_currency = searchCurrency;
    if (searchDirection) filters.direction = searchDirection;
    if (searchAccount) filters.account_id = parseInt(searchAccount);
    
    // 獲取記錄
    let records = [];
    let accountSummary = [];
    let totalSummary = [];
    
    if (viewMode === 'summary') {
        const useDateStart = searchDateStart || searchDate;
        const useDateEnd = searchDateEnd || searchDate;
        if (useDateStart && useDateEnd) {
            accountSummary = getAccountExchangeSummary(useDateStart, useDateEnd, searchAccount || null);
            totalSummary = getTotalAccountSummary(useDateStart, useDateEnd);
        }
        records = getExchangeRecords(Object.keys(filters).length > 0 ? filters : null);
    } else {
        records = getExchangeRecords(Object.keys(filters).length > 0 ? filters : null);
    }
    
    const allTables = [...new Set(sessions.map(s => s.table_type).filter(Boolean))];
    const defaultTables = ['决赛桌', 'VIP包1', 'VIP包2', '大厅1', '大厅2'];
    const tableOptions = [...new Set([...defaultTables, ...allTables])];
    
    const memberOptions = members.map(m => 
        `<option value="${m.id}">${m.id}. ${m.name}</option>`
    ).join('');
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}">${c.currency}</option>`
    ).join('');
    
    const accountOptions = accounts.map(a => 
        `<option value="${a.id}">${a.name}</option>`
    ).join('');
    
    // 方向映射
    const directionMap = {
        'buy': '外币→泰铢 (买入价)',
        'sell': '泰铢→外币 (卖出价)',
        'cross': '外币→外币 (买入+卖出)'
    };
    
    const directionColor = {
        'buy': '#4CAF50',
        'sell': '#ff6b6b',
        'cross': '#2196F3'
    };
    
    const directionOptions = Object.entries(directionMap).map(([key, label]) => 
        `<option value="${key}">${label}</option>`
    ).join('');
    
    // 顯示時段標籤
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
    
    // 構建明細表格
    let tableRows = '';
    if (records.length === 0) {
        tableRows = '<tr class="empty-row"><td colspan="10">暫無兑汇记录</td></tr>';
    } else {
        tableRows = records.slice(0, 200).map(r => {
            const member = members.find(m => m.id === r.member_id);
            const memberDisplay = member ? member.name : (r.member_name || '未知');
            const directionText = directionMap[r.direction] || r.direction;
            const directionColorClass = directionColor[r.direction] || '#333';
            
            const rateDisplay = r.direction === 'buy' ? `买入 ${r.buy_rate || '-'}` :
                                r.direction === 'sell' ? `卖出 ${r.sell_rate || '-'}` :
                                `买入 ${r.buy_rate || '-'} / 卖出 ${r.sell_rate || '-'}`;
            
            return `<tr>
                <td style="text-align:center;font-size:12px;">${formatDate(r.created_at)}</td>
                <td style="text-align:center;"><strong>${r.table_type || '会员账户'}</strong></td>
                <td style="text-align:center;"><strong>${memberDisplay}</strong></td>
                <td style="text-align:center;">${r.from_currency}</td>
                <td style="text-align:center;color:#ff6b6b;font-weight:bold;">-${r.from_amount.toFixed(2)}</td>
                <td style="text-align:center;">${r.to_currency}</td>
                <td style="text-align:center;color:#4CAF50;font-weight:bold;">+${r.to_amount.toFixed(2)}</td>
                <td style="text-align:center;color:${directionColorClass};font-weight:bold;font-size:12px;">${directionText}</td>
                <td style="text-align:center;font-size:11px;color:#666;">${rateDisplay}</td>
                <td style="text-align:center;font-size:11px;color:#888;">${r.admin_name || '系统'}</td>
            </tr>`;
        }).join('');
    }
    
    // 構建帳戶匯總表格
    let summaryRows = '';
    let totalSummaryRows = '';
    
    if (viewMode === 'summary' && accountSummary.length > 0) {
        summaryRows = accountSummary.map(d => {
            const netColor = d.net >= 0 ? '#4CAF50' : '#ff6b6b';
            return `<tr>
                <td style="text-align:center;"><strong>${d.account_name}</strong></td>
                <td style="text-align:center;"><strong>${d.currency}</strong></td>
                <td style="text-align:center;color:#4CAF50;font-weight:bold;">${d.total_in.toFixed(2)}</td>
                <td style="text-align:center;color:#ff6b6b;font-weight:bold;">${d.total_out.toFixed(2)}</td>
                <td style="text-align:center;color:${netColor};font-weight:bold;">${d.net.toFixed(2)}</td>
                <td style="text-align:center;font-size:11px;color:#999;">${d.records.length} 筆</td>
            </tr>`;
        }).join('');
        
        if (totalSummary.length > 0) {
            totalSummaryRows = totalSummary.map(d => {
                const netColor = d.net >= 0 ? '#4CAF50' : '#ff6b6b';
                return `<tr style="background:#f5f5f5;font-weight:bold;">
                    <td style="text-align:center;">📊 全部帳戶</td>
                    <td style="text-align:center;"><strong>${d.currency}</strong></td>
                    <td style="text-align:center;color:#4CAF50;">${d.total_in.toFixed(2)}</td>
                    <td style="text-align:center;color:#ff6b6b;">${d.total_out.toFixed(2)}</td>
                    <td style="text-align:center;color:${netColor};">${d.net.toFixed(2)}</td>
                    <td style="text-align:center;color:#999;">-</td>
                </tr>`;
            }).join('');
        }
    }
    
    // 計算總筆數
    const totalRecords = records.length;
    
    el.innerHTML = `
        <div class="page-header">
            <h1>💱 兑汇纪录</h1>
            <p class="breadcrumb">营运管理 > 兑汇纪录</p>
        </div>
        
        <!-- 檢視模式切換 -->
        <div style="margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#fff;padding:12px 15px;border-radius:10px;border:1px solid #eee;">
            <span style="font-weight:500;font-size:14px;">📊 檢視模式：</span>
            <select id="exchangeViewMode" style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="renderExchange(document.getElementById('mainContent'))">
                <option value="detail" ${viewMode === 'detail' ? 'selected' : ''}>📋 明細記錄</option>
                <option value="summary" ${viewMode === 'summary' ? 'selected' : ''}>📊 帳戶匯總</option>
            </select>
            <span style="font-size:12px;color:#999;margin-left:10px;">
                ${viewMode === 'summary' ? '💡 顯示時段內各帳戶各幣種的進出總額' : '💡 顯示每筆兑汇明細'}
            </span>
        </div>
        
        <!-- 篩選工具欄 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;">
            <!-- 第一排：時段查詢 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding-bottom:10px;border-bottom:1px solid #f0f0f0;margin-bottom:10px;">
                <span style="font-weight:500;font-size:13px;color:#555;">📅 時段查詢：</span>
                <input type="date" id="exchangeDateStart" value="${searchDateStart}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <span style="color:#999;">～</span>
                <input type="date" id="exchangeDateEnd" value="${searchDateEnd}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <button class="btn btn-primary" onclick="renderExchange(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('exchangeDateStart').value='';document.getElementById('exchangeDateEnd').value='';document.getElementById('exchangeDate').value='';renderExchange(document.getElementById('mainContent'))">✕ 清除</button>
                <button class="btn" onclick="document.getElementById('exchangeDateStart').value='${todayStr}';document.getElementById('exchangeDateEnd').value='${todayStr}';document.getElementById('exchangeDate').value='';renderExchange(document.getElementById('mainContent'))">📅 今天</button>
                <button class="btn" onclick="document.getElementById('exchangeDateStart').value='';document.getElementById('exchangeDateEnd').value='';document.getElementById('exchangeDate').value='${todayStr}';renderExchange(document.getElementById('mainContent'))">📅 單日</button>
                <span style="font-size:12px;color:#999;margin-left:auto;">${timeRangeLabel}</span>
            </div>
            
            <!-- 第二排：篩選條件 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                ${viewMode === 'summary' ? `
                    <!-- 匯總模式：帳戶篩選 -->
                    <span style="font-weight:500;font-size:13px;color:#555;">🏦 帳戶：</span>
                    <select id="exchangeAccount" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                        <option value="">全部帳戶</option>
                        ${accountOptions}
                    </select>
                ` : `
                    <!-- 明細模式：原有篩選 -->
                    <span style="font-weight:500;font-size:13px;color:#555;">🎯 桌号：</span>
                    <select id="exchangeTable" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                        <option value="">全部</option>
                        ${tableOptions.map(t => `<option value="${t}" ${t === searchTable ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    
                    <span style="font-weight:500;font-size:13px;color:#555;">👤 会员：</span>
                    <select id="exchangeMember" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                        <option value="">全部</option>
                        ${memberOptions}
                    </select>
                    
                    <span style="font-weight:500;font-size:13px;color:#555;">💱 币种：</span>
                    <select id="exchangeCurrency" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                        <option value="">全部</option>
                        ${currencyOptions}
                    </select>
                    
                    <span style="font-weight:500;font-size:13px;color:#555;">🔄 方向：</span>
                    <select id="exchangeDirection" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                        <option value="">全部</option>
                        ${directionOptions}
                    </select>
                `}
                
                <button class="btn btn-primary" onclick="renderExchange(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('exchangeAccount').value='';document.getElementById('exchangeTable').value='';document.getElementById('exchangeMember').value='';document.getElementById('exchangeCurrency').value='';document.getElementById('exchangeDirection').value='';renderExchange(document.getElementById('mainContent'))">✕ 清除篩選</button>
                <button class="btn" onclick="renderExchange(document.getElementById('mainContent'))">🔄 刷新</button>
                <span style="font-size:13px;color:#999;margin-left:auto;">
                    ${viewMode === 'summary' ? `共 ${accountSummary.length} 個帳戶幣種` : `共 ${totalRecords} 笔记录`}
                </span>
            </div>
        </div>
        
        ${viewMode === 'summary' ? `
            <!-- ===== 匯總模式 ===== -->
            ${accountSummary.length > 0 ? `
                <!-- 總匯總卡片 -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:15px;">
                    ${totalSummary.map(d => `
                        <div style="background:${d.net >= 0 ? '#e8f5e9' : '#ffebee'};padding:15px;border-radius:8px;text-align:center;border:1px solid ${d.net >= 0 ? '#a5d6a7' : '#ef9a9a'};">
                            <div style="font-size:12px;color:#888;">${d.currency} 淨額</div>
                            <div style="font-size:24px;font-weight:bold;color:${d.net >= 0 ? '#2e7d32' : '#c62828'};">${d.net.toFixed(2)}</div>
                            <div style="font-size:11px;color:#999;margin-top:2px;">
                                入：${d.total_in.toFixed(2)} | 出：${d.total_out.toFixed(2)}
                            </div>
                        </div>
                    `).join('')}
                    ${totalSummary.length === 0 ? '<div style="text-align:center;color:#999;padding:20px;">暫無匯總數據</div>' : ''}
                </div>
                
                <!-- 各帳戶明細表格 -->
                <div class="table-container">
                    <h3 style="padding:12px 15px;margin:0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                        <span>📊 各帳戶各幣種進出總額</span>
                        <span style="font-size:12px;color:#999;font-weight:normal;">
                            ${searchDateStart && searchDateEnd ? `${searchDateStart} ~ ${searchDateEnd}` : searchDate ? searchDate : '全部時段'}
                            ${searchAccount ? ` | 帳戶：${accounts.find(a => a.id === parseInt(searchAccount))?.name || ''}` : ''}
                        </span>
                    </h3>
                    <table>
                        <thead><tr>
                            <th style="text-align:center;min-width:120px;">帳戶</th>
                            <th style="text-align:center;min-width:80px;">幣種</th>
                            <th style="text-align:center;min-width:100px;">📥 總存入</th>
                            <th style="text-align:center;min-width:100px;">📤 總支出</th>
                            <th style="text-align:center;min-width:100px;">📊 淨額</th>
                            <th style="text-align:center;min-width:80px;">筆數</th>
                        </tr></thead>
                        <tbody>
                            ${summaryRows || '<tr class="empty-row"><td colspan="6">暫無匯總數據</td></tr>'}
                            ${totalSummaryRows ? `<tr><td colspan="6" style="padding:5px;background:#f0f0f0;"></td></tr>${totalSummaryRows}` : ''}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align:center;padding:40px;color:#999;background:#fff;border-radius:10px;border:1px solid #eee;">
                    📭 ${searchDateStart || searchDateEnd || searchDate ? '該時段暫無兌匯記錄' : '請選擇時段後點擊「查詢」查看帳戶匯總'}
                    ${(searchDateStart || searchDateEnd || searchDate) ? '<br><span style="font-size:12px;">💡 提示：可調整查詢時段以查看更多記錄</span>' : ''}
                </div>
            `}
        ` : `
            <!-- ===== 明細模式 ===== -->
            ${records.length === 0 ? `
                <div style="text-align:center;padding:40px;color:#999;background:#fff;border-radius:10px;border:1px solid #eee;">
                    📭 ${searchDateStart || searchDateEnd || searchDate || searchTable || searchMember ? '該條件下暫無兌匯記錄' : '暫無兌匯記錄'}
                    ${(searchDateStart || searchDateEnd || searchDate) ? '<br><span style="font-size:12px;">💡 提示：可調整查詢時段以查看更多記錄</span>' : ''}
                </div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="min-width:140px;">时间</th>
                                <th style="min-width:80px;">桌号</th>
                                <th style="min-width:80px;">会员</th>
                                <th style="min-width:60px;">来源币种</th>
                                <th style="min-width:80px;">支出</th>
                                <th style="min-width:60px;">目标币种</th>
                                <th style="min-width:80px;">收入</th>
                                <th style="min-width:130px;">方向</th>
                                <th style="min-width:120px;">汇率</th>
                                <th style="min-width:80px;">操作人</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                ${records.length > 200 ? `<div style="text-align:center;padding:10px;color:#999;font-size:13px;">仅显示最近200笔记录</div>` : ''}
                <div style="margin-top:10px;display:flex;gap:15px;flex-wrap:wrap;font-size:12px;color:#999;padding:8px 12px;background:#f8f9fc;border-radius:6px;">
                    <span>📊 總計：<strong>${records.length}</strong> 筆記錄</span>
                    ${searchDateStart && searchDateEnd ? `<span>📅 時段：${searchDateStart} ~ ${searchDateEnd}</span>` : ''}
                    ${searchDate ? `<span>📅 日期：${searchDate}</span>` : ''}
                    ${searchTable ? `<span>🎯 桌號：${searchTable}</span>` : ''}
                    ${searchMember ? `<span>👤 會員：${members.find(m => m.id === parseInt(searchMember))?.name || ''}</span>` : ''}
                </div>
            `}
        `}
    `;
}

// ============================================================
// 换币工具函数（供其他页面调用）
// ============================================================

/**
 * 执行换币操作（统一入口）
 */
function executeExchange(params) {
    // 扣除来源币种
    updateMemberAccountBalance(params.memberId, params.fromCurrency, -params.fromAmount);
    
    // 记录会员账户交易（支出）
    const memberAccountTx = DB.get('member_account_transactions', []);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: params.memberId,
        currency: params.fromCurrency,
        amount: params.fromAmount,
        type: 'out',
        note: `换币支出 (${params.direction}) - ${params.fromAmount} ${params.fromCurrency} → ${params.toAmount.toFixed(2)} ${params.toCurrency} - ${params.note || ''}`,
        admin_id: getCurrentAdminId(),
        admin_name: getCurrentAdminName(),
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    // 存入目标币种
    updateMemberAccountBalance(params.memberId, params.toCurrency, params.toAmount);
    
    // 记录会员账户交易（存入）
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: params.memberId,
        currency: params.toCurrency,
        amount: params.toAmount,
        type: 'in',
        note: `换币收入 (${params.direction}) - ${params.fromAmount} ${params.fromCurrency} → ${params.toAmount.toFixed(2)} ${params.toCurrency} - ${params.note || ''}`,
        admin_id: getCurrentAdminId(),
        admin_name: getCurrentAdminName(),
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    // 记录交易流水
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: params.memberId,
        type: 'recharge',
        amount: 0,
        note: `换币 (${params.direction}) - ${params.fromAmount} ${params.fromCurrency} → ${params.toAmount.toFixed(2)} ${params.toCurrency} - ${params.note || ''}`,
        admin_id: getCurrentAdminId(),
        admin_name: getCurrentAdminName(),
        created_at: now()
    });
    DB.set('transactions', transactions);
    
    // 记录兑汇
    addExchangeRecord(
        params.memberId,
        params.memberName,
        params.tableType,
        params.fromCurrency,
        params.fromAmount,
        params.toCurrency,
        params.toAmount,
        params.direction,
        params.buyRate,
        params.sellRate,
        params.sessionId,
        params.note || ''
    );
    
    return true;
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