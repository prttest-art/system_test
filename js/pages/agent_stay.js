// ============================================================
// 13. 代理住宿（住宿費用支出 + 住宿還款 - 支持多幣種 + 現金/帳戶付款 + 代理人搜尋 + 時段查詢 + 權限控制）
// ============================================================

// 初始化代理住宿記錄存儲
function initAgentStayRecords() {
    if (!localStorage.getItem('rpt_agent_stay_records')) {
        DB.set('agent_stay_records', []);
        DB.set('agent_stay_records_next', 1);
    }
}

/**
 * 獲取代理住宿記錄
 */
function getAgentStayRecords(filters) {
    initAgentStayRecords();
    let records = DB.get('agent_stay_records', []);
    
    if (filters) {
        if (filters.agent_id) {
            records = records.filter(r => r.agent_id === filters.agent_id);
        }
        if (filters.date) {
            records = records.filter(r => r.created_at && r.created_at.startsWith(filters.date));
        }
        if (filters.date_start && filters.date_end) {
            records = records.filter(r => {
                if (!r.created_at) return false;
                const dateStr = r.created_at.split(' ')[0];
                return dateStr >= filters.date_start && dateStr <= filters.date_end;
            });
        }
        if (filters.type) {
            records = records.filter(r => r.type === filters.type);
        }
        if (filters.status) {
            records = records.filter(r => r.status === filters.status);
        }
        if (filters.account_id) {
            records = records.filter(r => r.account_id === filters.account_id);
        }
        if (filters.currency) {
            records = records.filter(r => r.currency === filters.currency);
        }
        if (filters.payment_method) {
            records = records.filter(r => r.payment_method === filters.payment_method);
        }
    }
    
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return records;
}

/**
 * 獲取代理住宿統計
 */
function getAgentStayStats(filters) {
    initAgentStayRecords();
    let records = DB.get('agent_stay_records', []);
    
    if (filters) {
        if (filters.agent_id) {
            records = records.filter(r => r.agent_id === filters.agent_id);
        }
        if (filters.date) {
            records = records.filter(r => r.created_at && r.created_at.startsWith(filters.date));
        }
        if (filters.date_start && filters.date_end) {
            records = records.filter(r => {
                if (!r.created_at) return false;
                const dateStr = r.created_at.split(' ')[0];
                return dateStr >= filters.date_start && dateStr <= filters.date_end;
            });
        }
    }
    
    const expenses = records.filter(r => r.type === 'expense');
    const payments = records.filter(r => r.type === 'payment');
    const unpaid = expenses.filter(r => r.status === '未結清');
    const paid = expenses.filter(r => r.status === '已結清');
    
    const unpaidByCurrency = {};
    unpaid.forEach(r => {
        const currency = r.currency || 'THB';
        if (!unpaidByCurrency[currency]) {
            unpaidByCurrency[currency] = 0;
        }
        unpaidByCurrency[currency] += r.amount;
    });
    
    const totalByCurrency = {};
    expenses.forEach(r => {
        const currency = r.currency || 'THB';
        if (!totalByCurrency[currency]) {
            totalByCurrency[currency] = 0;
        }
        totalByCurrency[currency] += r.amount;
    });
    
    const paidByCurrency = {};
    payments.forEach(r => {
        const currency = r.currency || 'THB';
        if (!paidByCurrency[currency]) {
            paidByCurrency[currency] = 0;
        }
        paidByCurrency[currency] += r.amount;
    });
    
    return {
        total_expense: expenses.length,
        total_paid: paid.length,
        total_unpaid: unpaid.length,
        unpaid_by_currency: unpaidByCurrency,
        total_by_currency: totalByCurrency,
        paid_by_currency: paidByCurrency
    };
}

/**
 * 新增住宿費用（支持多幣種）
 */
function addStayExpense(agentId, amount, currency, checkInDate, checkOutDate, accountId, note) {
    initAgentStayRecords();
    const records = DB.get('agent_stay_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const agent = getAgent(agentId);
    const account = getAccount(accountId);
    
    if (!agent) {
        return { success: false, message: '代理人不存在' };
    }
    if (!account) {
        return { success: false, message: '往來賬款賬戶不存在' };
    }
    
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const days = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    
    const accountBalance = get_account_balance(accountId, currency);
    if (accountBalance < amount) {
        return { 
            success: false, 
            message: `⚠️ 賬戶「${account.name}」${currency} 餘額不足！\n當前餘額：${accountBalance.toFixed(2)} ${currency}\n需要：${amount.toFixed(2)} ${currency}\n請先充值往來賬戶或選擇其他賬戶` 
        };
    }
    
    const thbAmount = convertToTHB(amount, currency);
    
    const record = {
        id: DB.getNextId('agent_stay_records'),
        agent_id: agentId,
        agent_name: agent.name,
        type: 'expense',
        amount: amount,
        currency: currency,
        thb_amount: thbAmount,
        days: days,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        account_id: accountId,
        account_name: account.name,
        status: '未結清',
        note: note || '',
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    };
    records.push(record);
    DB.set('agent_stay_records', records);
    
    update_account_balance(accountId, currency, -amount);
    
    add_account_transaction(
        accountId,
        currency,
        amount,
        'out',
        'agent_stay_expense',
        record.id,
        `代理住宿費用 - ${agent.name} - ${amount} ${currency} (≈${thbAmount.toFixed(2)} 泰銖) - ${checkInDate} ~ ${checkOutDate} - 操作人：${adminName}`
    );
    
    addOperationLog('代理住宿', '新增', agent.name, 
        `新增住宿費用：${agent.name} - ${amount} ${currency} (≈${thbAmount.toFixed(2)} 泰銖) - ${checkInDate} ~ ${checkOutDate} - 賬戶：${account.name}`, agentId);
    
    return { 
        success: true, 
        message: `✅ 住宿費用已記錄！\n代理人：${agent.name}\n金額：${amount} ${currency} (≈${thbAmount.toFixed(2)} 泰銖)\n天數：${days} 天\n支付賬戶：${account.name}\n賬戶餘額：${(accountBalance - amount).toFixed(2)} ${currency}`, 
        record: record 
    };
}

/**
 * 住宿還款（支持多幣種 + 現金/帳戶付款）
 */
function addStayPayment(agentId, amount, currency, paymentMethod, accountId, note) {
    initAgentStayRecords();
    const records = DB.get('agent_stay_records', []);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const agent = getAgent(agentId);
    const account = paymentMethod === 'account' ? getAccount(accountId) : null;
    
    if (!agent) {
        return { success: false, message: '代理人不存在' };
    }
    
    if (paymentMethod === 'account' && !account) {
        return { success: false, message: '往來賬款賬戶不存在' };
    }
    
    const unpaidRecords = records.filter(r => 
        r.agent_id === agentId && 
        r.type === 'expense' && 
        r.status === '未結清' &&
        r.currency === currency
    );
    const totalUnpaid = unpaidRecords.reduce((sum, r) => sum + r.amount, 0);
    
    const otherCurrencyUnpaid = records.filter(r => 
        r.agent_id === agentId && 
        r.type === 'expense' && 
        r.status === '未結清' &&
        r.currency !== currency
    );
    const otherCurrencyTotal = otherCurrencyUnpaid.reduce((sum, r) => sum + r.amount, 0);
    
    let warningMsg = '';
    if (totalUnpaid <= 0 && otherCurrencyTotal > 0) {
        warningMsg = `\n\n⚠️ 該代理人還有其他幣種的未結清費用：\n${otherCurrencyUnpaid.map(r => `  ${r.currency}: ${r.amount.toFixed(2)}`).join('\n')}\n請選擇對應幣種進行還款。`;
        return { 
            success: false, 
            message: `代理人 ${agent.name} 沒有 ${currency} 的未結清住宿費用${warningMsg}`
        };
    }
    
    if (totalUnpaid <= 0) {
        return { success: false, message: `代理人 ${agent.name} 沒有 ${currency} 的未結清住宿費用` };
    }
    
    let paymentAmount = Math.min(amount, totalUnpaid);
    let remainingAmount = paymentAmount;
    let paidRecords = [];
    
    unpaidRecords.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    for (const record of unpaidRecords) {
        if (remainingAmount <= 0) break;
        const deductAmount = Math.min(record.amount, remainingAmount);
        record.amount -= deductAmount;
        remainingAmount -= deductAmount;
        paidRecords.push({
            record_id: record.id,
            paid_amount: deductAmount
        });
        if (record.amount === 0) {
            record.status = '已結清';
        }
    }
    DB.set('agent_stay_records', records);
    
    const thbAmount = convertFromTHB(paymentAmount, currency);
    
    const paymentMethodLabel = paymentMethod === 'account' ? `帳戶：${account.name}` : '現金';
    
    const paymentRecord = {
        id: DB.getNextId('agent_stay_records'),
        agent_id: agentId,
        agent_name: agent.name,
        type: 'payment',
        amount: paymentAmount,
        currency: currency,
        thb_amount: thbAmount,
        days: 0,
        check_in_date: null,
        check_out_date: null,
        payment_method: paymentMethod,
        payment_method_label: paymentMethodLabel,
        account_id: paymentMethod === 'account' ? accountId : null,
        account_name: paymentMethod === 'account' ? account.name : '現金',
        status: '已結清',
        note: note || `還款 - 共抵扣 ${paidRecords.length} 筆住宿費用 - 付款方式：${paymentMethodLabel}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    };
    records.push(paymentRecord);
    DB.set('agent_stay_records', records);
    
    if (paymentMethod === 'account' && accountId) {
        update_account_balance(accountId, currency, paymentAmount);
        
        add_account_transaction(
            accountId,
            currency,
            paymentAmount,
            'in',
            'agent_stay_payment',
            paymentRecord.id,
            `代理住宿還款 - ${agent.name} - ${paymentAmount} ${currency} (≈${thbAmount.toFixed(2)} 泰銖) - 抵扣 ${paidRecords.length} 筆費用 - 操作人：${adminName}`
        );
    }
    
    addOperationLog('代理住宿', '還款', agent.name, 
        `住宿還款：${agent.name} - ${paymentAmount} ${currency} (≈${thbAmount.toFixed(2)} 泰銖) - 抵扣 ${paidRecords.length} 筆費用 - 付款方式：${paymentMethodLabel}`, agentId);
    
    let detailMsg = `✅ 還款成功！\n\n代理人：${agent.name}\n還款金額：${paymentAmount} ${currency} (≈${thbAmount.toFixed(2)} 泰銖)\n付款方式：${paymentMethodLabel}\n`;
    paidRecords.forEach((p, index) => {
        const record = records.find(r => r.id === p.record_id);
        detailMsg += `  ${index + 1}. 費用 ID #${p.record_id} - 抵扣 ${p.paid_amount.toFixed(2)} ${currency}`;
        if (record && record.amount === 0) {
            detailMsg += ` ✅ 已結清\n`;
        } else {
            detailMsg += ` (剩餘 ${record ? record.amount.toFixed(2) : 0} ${currency})\n`;
        }
    });
    const remainingUnpaid = records.filter(r => r.agent_id === agentId && r.type === 'expense' && r.status === '未結清' && r.currency === currency);
    const totalRemaining = remainingUnpaid.reduce((sum, r) => sum + r.amount, 0);
    detailMsg += `\n剩餘未結清（${currency}）：${totalRemaining.toFixed(2)} ${currency}`;
    
    if (paymentMethod === 'account' && accountId) {
        detailMsg += `\n賬戶餘額：${(get_account_balance(accountId, currency)).toFixed(2)} ${currency}`;
    }
    
    return { success: true, message: detailMsg, record: paymentRecord };
}

/**
 * 刪除住宿記錄（僅限未結清的記錄）- 需退回賬戶餘額
 */
function deleteStayRecord(recordId) {
    initAgentStayRecords();
    const records = DB.get('agent_stay_records', []);
    const record = records.find(r => r.id === recordId);
    if (!record) {
        return { success: false, message: '記錄不存在' };
    }
    if (record.type === 'payment') {
        return { success: false, message: '還款記錄不能刪除' };
    }
    if (record.status === '已結清') {
        return { success: false, message: '已結清的記錄不能刪除' };
    }
    
    const agent = getAgent(record.agent_id);
    const accountId = record.account_id;
    const currency = record.currency || 'THB';
    
    if (accountId) {
        update_account_balance(accountId, currency, record.amount);
        add_account_transaction(
            accountId,
            currency,
            record.amount,
            'in',
            'agent_stay_expense_refund',
            recordId,
            `刪除住宿費用退款 - ${agent ? agent.name : '未知'} - ${record.amount} ${currency} - 操作人：${getCurrentAdminName()}`
        );
    }
    
    const newRecords = records.filter(r => r.id !== recordId);
    DB.set('agent_stay_records', newRecords);
    
    addOperationLog('代理住宿', '刪除', agent ? agent.name : '未知', 
        `刪除住宿費用：${agent ? agent.name : '未知'} - ${record.amount} ${currency} (已退款)`, record.agent_id);
    
    return { success: true, message: `✅ 記錄已刪除，${record.amount.toFixed(2)} ${currency} 已退還到賬戶` };
}

// ============================================================
// 代理人搜尋函數（支援ID或姓名）
// ============================================================

function searchAgents(keyword) {
    const agents = DB.get('agents', []);
    if (!keyword || keyword.trim() === '') {
        return agents;
    }
    
    const searchTerm = keyword.trim().toLowerCase();
    const isNumeric = /^\d+$/.test(searchTerm);
    
    return agents.filter(a => {
        const nameMatch = a.name.toLowerCase().includes(searchTerm);
        const idMatch = isNumeric && a.id.toString().includes(searchTerm);
        return nameMatch || idMatch;
    });
}

// ============================================================
// 渲染代理住宿頁面（含時段查詢 + 權限控制）
// ============================================================

function renderAgentStay(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('agent_stay', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>🏨 代理住宿</h1>
                <p class="breadcrumb">營運管理 > 代理住宿</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「代理住宿」的权限</p>
            </div>
        `;
        return;
    }
    
    initAgentStayRecords();
    
    const agents = DB.get('agents', []);
    const accounts = DB.get('accounts', []);
    const currencies = DB.get('currencies', []);
    
    // 獲取篩選參數
    const searchAgent = document.getElementById('stayAgentFilter')?.value || '';
    const searchAgentInput = document.getElementById('stayAgentSearchInput')?.value || '';
    const searchDate = document.getElementById('stayDateFilter')?.value || '';
    const searchDateStart = document.getElementById('stayDateStart')?.value || '';
    const searchDateEnd = document.getElementById('stayDateEnd')?.value || '';
    const searchType = document.getElementById('stayTypeFilter')?.value || '';
    const searchStatus = document.getElementById('stayStatusFilter')?.value || '';
    const searchAccount = document.getElementById('stayAccountFilter')?.value || '';
    const searchCurrency = document.getElementById('stayCurrencyFilter')?.value || '';
    const searchPaymentMethod = document.getElementById('stayPaymentMethodFilter')?.value || '';
    
    let finalAgentId = searchAgent;
    if (!finalAgentId && searchAgentInput) {
        const foundAgents = searchAgents(searchAgentInput);
        if (foundAgents.length === 1) {
            finalAgentId = foundAgents[0].id.toString();
        }
    }
    
    const filters = {};
    if (finalAgentId) filters.agent_id = parseInt(finalAgentId);
    if (searchDateStart && searchDateEnd) {
        filters.date_start = searchDateStart;
        filters.date_end = searchDateEnd;
    } else if (searchDateStart) {
        filters.date = searchDateStart;
    } else if (searchDate) {
        filters.date = searchDate;
    }
    if (searchType) filters.type = searchType;
    if (searchStatus) filters.status = searchStatus;
    if (searchAccount) filters.account_id = parseInt(searchAccount);
    if (searchCurrency) filters.currency = searchCurrency;
    if (searchPaymentMethod) filters.payment_method = searchPaymentMethod;
    
    const records = getAgentStayRecords(Object.keys(filters).length > 0 ? filters : null);
    
    const statsFilters = {};
    if (finalAgentId) statsFilters.agent_id = parseInt(finalAgentId);
    if (searchDateStart && searchDateEnd) {
        statsFilters.date_start = searchDateStart;
        statsFilters.date_end = searchDateEnd;
    } else if (searchDateStart) {
        statsFilters.date = searchDateStart;
    } else if (searchDate) {
        statsFilters.date = searchDate;
    }
    const stats = getAgentStayStats(Object.keys(statsFilters).length > 0 ? statsFilters : null);
    
    const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const totalPaid = records.filter(r => r.type === 'payment').reduce((sum, r) => sum + r.amount, 0);
    const totalUnpaid = records.filter(r => r.type === 'expense' && r.status === '未結清').reduce((sum, r) => sum + r.amount, 0);
    
    const unpaidByCurrencyFiltered = {};
    records.filter(r => r.type === 'expense' && r.status === '未結清').forEach(r => {
        const currency = r.currency || 'THB';
        if (!unpaidByCurrencyFiltered[currency]) {
            unpaidByCurrencyFiltered[currency] = 0;
        }
        unpaidByCurrencyFiltered[currency] += r.amount;
    });
    
    // ✅ 檢查各操作權限
    const canAddExpense = checkActionPermission('agent_stay', 'add_expense');
    const canAddPayment = checkActionPermission('agent_stay', 'add_payment');
    const canDelete = checkActionPermission('agent_stay', 'delete');
    const canViewUnpaid = checkActionPermission('agent_stay', 'view_unpaid');
    
    const agentOptions = agents.map(a => 
        `<option value="${a.id}">${a.name} (ID:${a.id})</option>`
    ).join('');
    
    const accountOptions = accounts.map(a => {
        const balances = a.balances || {};
        const balanceDisplay = Object.entries(balances)
            .filter(([_, bal]) => bal !== 0)
            .map(([currency, bal]) => `${currency}: ${bal.toFixed(2)}`)
            .join(' | ');
        return `<option value="${a.id}" data-balances='${JSON.stringify(balances)}'>${a.name} ${balanceDisplay ? '(' + balanceDisplay + ')' : ''}</option>`;
    }).join('');
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const paymentMethodOptions = `
        <option value="">全部</option>
        <option value="account" ${searchPaymentMethod === 'account' ? 'selected' : ''}>🏦 帳戶付款</option>
        <option value="cash" ${searchPaymentMethod === 'cash' ? 'selected' : ''}>💵 現金</option>
    `;
    
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
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    let currentAgentName = '';
    if (finalAgentId) {
        const found = agents.find(a => a.id === parseInt(finalAgentId));
        if (found) currentAgentName = found.name;
    } else if (searchAgentInput) {
        const foundAgents = searchAgents(searchAgentInput);
        if (foundAgents.length === 1) {
            currentAgentName = foundAgents[0].name;
        } else if (foundAgents.length > 1) {
            currentAgentName = `找到 ${foundAgents.length} 位代理人`;
        }
    }
    
    // 構建表格
    let tableRows = '';
    if (records.length === 0) {
        tableRows = '<tr class="empty-row"><td colspan="13">暫無記錄</td></tr>';
    } else {
        tableRows = records.slice(0, 200).map(r => {
            const agent = agents.find(a => a.id === r.agent_id);
            const agentName = agent ? agent.name : r.agent_name || '未知';
            const account = accounts.find(a => a.id === r.account_id);
            const accountName = account ? account.name : (r.account_name || '-');
            const currency = r.currency || 'THB';
            const thbDisplay = r.thb_amount ? `(≈${r.thb_amount.toFixed(2)} 泰銖)` : '';
            
            let typeBadge = '';
            let statusBadge = '';
            let paymentMethodDisplay = '';
            
            if (r.type === 'expense') {
                typeBadge = '<span class="badge badge-danger">💰 住宿費</span>';
                statusBadge = r.status === '已結清' ? 
                    '<span class="badge badge-success">✅ 已結清</span>' : 
                    '<span class="badge badge-warning">⏳ 未結清</span>';
                paymentMethodDisplay = '-';
            } else {
                typeBadge = '<span class="badge badge-success">💵 還款</span>';
                statusBadge = '<span class="badge badge-info">✅ 已結清</span>';
                const methodLabel = r.payment_method_label || (r.payment_method === 'account' ? '🏦 帳戶' : '💵 現金');
                paymentMethodDisplay = methodLabel;
            }
            
            const daysDisplay = r.days && r.days > 0 ? `${r.days} 天` : '-';
            const dateDisplay = r.check_in_date && r.check_out_date ? 
                `${r.check_in_date} ~ ${r.check_out_date}` : '-';
            
            // 刪除按鈕（僅對未結清的費用記錄顯示）
            let deleteButton = '';
            if (r.type === 'expense' && r.status === '未結清' && canDelete) {
                deleteButton = `<button class="btn btn-danger btn-sm" onclick="handleDeleteStayRecord(${r.id})">刪除</button>`;
            } else if (r.type === 'expense') {
                deleteButton = '<span style="color:#999;font-size:11px;">已結清</span>';
            } else {
                deleteButton = '<span style="color:#999;font-size:11px;">-</span>';
            }
            
            return `<tr>
                <td style="text-align:center;font-size:12px;">${formatDate(r.created_at)}</td>
                <td style="text-align:center;"><strong>${agentName}</strong></td>
                <td style="text-align:center;">${typeBadge}</td>
                <td style="text-align:center;font-weight:bold;color:${r.type === 'expense' ? '#ff6b6b' : '#4CAF50'};">${r.amount.toFixed(2)} ${currency}</td>
                <td style="text-align:center;font-size:11px;color:#999;">${thbDisplay}</td>
                <td style="text-align:center;">${daysDisplay}</td>
                <td style="text-align:center;font-size:12px;">${dateDisplay}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center;font-size:12px;color:#666;">${paymentMethodDisplay}</td>
                <td style="text-align:center;font-size:12px;color:#666;">${accountName}</td>
                <td style="text-align:center;font-size:12px;color:#666;">${r.note || '-'}</td>
                <td style="text-align:center;font-size:12px;color:#666;">${r.admin_name || '系統'}</td>
                <td style="text-align:center;">${deleteButton}</td>
            </tr>`;
        }).join('');
    }
    
    let unpaidCurrencyHtml = '';
    const currencyKeys = Object.keys(unpaidByCurrencyFiltered);
    if (currencyKeys.length > 0) {
        unpaidCurrencyHtml = currencyKeys.map(curr => 
            `<span style="background:#fff3e0;padding:4px 12px;border-radius:12px;margin:0 4px;font-size:13px;border:1px solid #ffcc80;">
                ${curr}: <strong style="color:#e65100;">${unpaidByCurrencyFiltered[curr].toFixed(2)}</strong>
            </span>`
        ).join(' ');
    } else {
        unpaidCurrencyHtml = '<span style="color:#999;font-size:13px;">暫無未結清費用</span>';
    }
    
    let searchHint = '';
    if (searchAgentInput && !finalAgentId) {
        const foundAgents = searchAgents(searchAgentInput);
        if (foundAgents.length > 1) {
            searchHint = `<div style="margin-bottom:10px;padding:8px 12px;background:#fff3e0;border-radius:6px;font-size:13px;color:#e65100;border:1px solid #ffcc80;">
                ⚠️ 找到 <strong>${foundAgents.length}</strong> 位代理人，請從下拉選單中選擇一位：
                ${foundAgents.map(a => `<span style="background:#e3f2fd;padding:2px 10px;border-radius:10px;margin:0 4px;">${a.name} (ID:${a.id})</span>`).join('')}
            </div>`;
        } else if (foundAgents.length === 0) {
            searchHint = `<div style="margin-bottom:10px;padding:8px 12px;background:#ffebee;border-radius:6px;font-size:13px;color:#c62828;border:1px solid #ef9a9a;">
                ❌ 找不到匹配的代理人，請重新輸入
            </div>`;
        }
    }
    
    el.innerHTML = `
        <div class="page-header">
            <h1>🏨 代理住宿</h1>
            <p class="breadcrumb">營運管理 > 代理住宿</p>
        </div>
        
        <!-- 統計卡片 -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
            <div class="stat-card" style="border-left:4px solid #2196F3;">
                <div class="stat-label">📋 申請筆數</div>
                <div class="stat-value" style="color:#2196F3;">${stats.total_expense}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #4CAF50;">
                <div class="stat-label">✅ 已付款筆數</div>
                <div class="stat-value" style="color:#4CAF50;">${stats.total_paid}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ff6b6b;">
                <div class="stat-label">⏳ 未結清筆數</div>
                <div class="stat-value" style="color:#ff6b6b;">${stats.total_unpaid}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ffa726;cursor:pointer;" onclick="${canViewUnpaid ? "showUnpaidByCurrency()" : "showPermissionDenied('查看未付款總額')"}">
                <div class="stat-label">💱 各幣種未付款總額</div>
                <div class="stat-value" style="color:#ffa726;font-size:18px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                    ${Object.entries(stats.unpaid_by_currency).map(([curr, amt]) => 
                        `<span style="font-size:14px;background:#fff3e0;padding:2px 10px;border-radius:10px;">${curr}: ${amt.toFixed(2)}</span>`
                    ).join('')}
                    ${Object.keys(stats.unpaid_by_currency).length === 0 ? '<span style="font-size:14px;color:#999;">無</span>' : ''}
                </div>
                ${canViewUnpaid ? '<div style="font-size:11px;color:#999;margin-top:4px;">👆 點擊查看詳細</div>' : '<div style="font-size:11px;color:#ff6b6b;margin-top:4px;">⛔ 無查看權限</div>'}
            </div>
        </div>
        
        <!-- 各幣種未付款總額詳細 -->
        <div id="unpaidCurrencyDetail" style="display:none;margin-bottom:15px;padding:15px;background:#fff;border-radius:10px;border:2px solid #ffa726;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h3 style="font-size:16px;color:#e65100;">💱 各幣種未付款總額</h3>
                <button class="btn btn-sm" onclick="document.getElementById('unpaidCurrencyDetail').style.display='none'">✕ 關閉</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
                ${Object.entries(stats.unpaid_by_currency).length === 0 ? 
                    '<div style="text-align:center;color:#999;padding:20px;">暫無未結清費用</div>' :
                    Object.entries(stats.unpaid_by_currency).map(([currency, amount]) => `
                        <div style="background:${amount > 0 ? '#fff3e0' : '#f5f5f5'};padding:15px;border-radius:8px;text-align:center;border:1px solid ${amount > 0 ? '#ffcc80' : '#e0e0e0'};">
                            <div style="font-size:14px;font-weight:bold;color:#666;">${currency}</div>
                            <div style="font-size:24px;font-weight:bold;color:${amount > 0 ? '#e65100' : '#999'};">${amount.toFixed(2)}</div>
                            <div style="font-size:11px;color:#999;">${amount > 0 ? '未結清' : '已結清'}</div>
                        </div>
                    `).join('')
                }
            </div>
            <div style="margin-top:10px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:13px;text-align:center;color:#666;">
                📌 總未結清金額（泰銖參考）：<strong>${Object.values(stats.unpaid_by_currency).reduce((sum, v) => sum + v, 0).toFixed(2)}</strong>
            </div>
        </div>
        
        ${searchHint}
        
        <!-- 篩選工具欄 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-bottom:10px;border-bottom:1px solid #f0f0f0;margin-bottom:10px;">
                <span style="font-weight:500;font-size:13px;color:#555;">🔍 搜尋代理人：</span>
                <input type="text" id="stayAgentSearchInput" placeholder="輸入ID或姓名..." value="${searchAgentInput}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:130px;" onkeydown="if(event.key==='Enter') renderAgentStay(document.getElementById('mainContent'))">
                <span style="font-weight:500;font-size:13px;color:#999;">或</span>
                <select id="stayAgentFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="document.getElementById('stayAgentSearchInput').value='';renderAgentStay(document.getElementById('mainContent'))">
                    <option value="">選擇代理人</option>
                    ${agentOptions}
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;margin-left:5px;">📅 時段：</span>
                <input type="date" id="stayDateStart" value="${searchDateStart}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:140px;">
                <span style="color:#999;font-size:13px;">～</span>
                <input type="date" id="stayDateEnd" value="${searchDateEnd}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:140px;">
                
                <button class="btn btn-primary" onclick="renderAgentStay(document.getElementById('mainContent'))" style="padding:6px 14px;">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('stayAgentSearchInput').value='';document.getElementById('stayAgentFilter').value='';document.getElementById('stayDateStart').value='';document.getElementById('stayDateEnd').value='';document.getElementById('stayDateFilter').value='';renderAgentStay(document.getElementById('mainContent'))" style="padding:6px 14px;">✕ 清除</button>
                <button class="btn" onclick="renderAgentStay(document.getElementById('mainContent'))" style="padding:6px 14px;">🔄 刷新</button>
                <button class="btn" onclick="document.getElementById('stayDateStart').value='${todayStr}';document.getElementById('stayDateEnd').value='${todayStr}';document.getElementById('stayDateFilter').value='';renderAgentStay(document.getElementById('mainContent'))" style="padding:6px 14px;">📅 今天</button>
                
                <span style="font-size:12px;color:#999;margin-left:auto;">${timeRangeLabel}</span>
            </div>
            
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                <span style="font-weight:500;font-size:13px;color:#555;">📊 類型：</span>
                <select id="stayTypeFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部</option>
                    <option value="expense" ${searchType === 'expense' ? 'selected' : ''}>住宿費</option>
                    <option value="payment" ${searchType === 'payment' ? 'selected' : ''}>還款</option>
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">📌 狀態：</span>
                <select id="stayStatusFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部</option>
                    <option value="未結清" ${searchStatus === '未結清' ? 'selected' : ''}>未結清</option>
                    <option value="已結清" ${searchStatus === '已結清' ? 'selected' : ''}>已結清</option>
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">🏦 帳戶：</span>
                <select id="stayAccountFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部</option>
                    ${accountOptions}
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">💱 幣種：</span>
                <select id="stayCurrencyFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部</option>
                    ${currencyOptions}
                </select>
                
                <span style="font-weight:500;font-size:13px;color:#555;">💳 付款方式：</span>
                <select id="stayPaymentMethodFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    ${paymentMethodOptions}
                </select>
                
                <button class="btn" onclick="document.getElementById('stayAgentSearchInput').value='';document.getElementById('stayAgentFilter').value='';document.getElementById('stayDateStart').value='';document.getElementById('stayDateEnd').value='';document.getElementById('stayDateFilter').value='';document.getElementById('stayTypeFilter').value='';document.getElementById('stayStatusFilter').value='';document.getElementById('stayAccountFilter').value='';document.getElementById('stayCurrencyFilter').value='';document.getElementById('stayPaymentMethodFilter').value='';renderAgentStay(document.getElementById('mainContent'))" style="padding:6px 14px;">✕ 清除全部</button>
                
                <span style="font-size:13px;color:#999;margin-left:auto;">共 ${records.length} 筆記錄</span>
            </div>
        </div>
        
        <!-- 操作按鈕（根據權限顯示） -->
        <div style="margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap;">
            ${canAddExpense ? `<button class="btn btn-primary" onclick="showAddStayExpense()">💰 新增住宿費用</button>` : ''}
            ${canAddPayment ? `<button class="btn btn-success" onclick="showAddStayPayment()">💵 住宿還款</button>` : ''}
            ${canViewUnpaid ? `<button class="btn btn-warning" onclick="showUnpaidByCurrency()" style="background:#ffa726;color:#fff;">💱 查看各幣種未付款總額</button>` : ''}
        </div>
        
        <!-- 記錄表格 -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="min-width:140px;text-align:center;">時間</th>
                        <th style="min-width:80px;text-align:center;">代理人</th>
                        <th style="min-width:80px;text-align:center;">類型</th>
                        <th style="min-width:120px;text-align:center;">金額</th>
                        <th style="min-width:120px;text-align:center;">泰銖參考</th>
                        <th style="min-width:60px;text-align:center;">天數</th>
                        <th style="min-width:180px;text-align:center;">入住/退房</th>
                        <th style="min-width:80px;text-align:center;">狀態</th>
                        <th style="min-width:100px;text-align:center;">付款方式</th>
                        <th style="min-width:100px;text-align:center;">往來賬戶</th>
                        <th style="min-width:100px;text-align:center;">備註</th>
                        <th style="min-width:80px;text-align:center;">操作人</th>
                        <th style="min-width:80px;text-align:center;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
        ${records.length > 200 ? `<div style="text-align:center;padding:10px;color:#999;font-size:13px;">僅顯示最近200筆記錄</div>` : ''}
    `;
}

// ============================================================
// 顯示各幣種未付款總額（彈窗詳細版）- 含權限檢查
// ============================================================

function showUnpaidByCurrency() {
    // ✅ 檢查查看未付款權限
    if (!checkActionPermission('agent_stay', 'view_unpaid')) {
        showPermissionDenied('查看未付款總額');
        return;
    }
    
    initAgentStayRecords();
    const records = DB.get('agent_stay_records', []);
    const agents = DB.get('agents', []);
    
    const unpaidExpenses = records.filter(r => r.type === 'expense' && r.status === '未結清');
    
    if (unpaidExpenses.length === 0) {
        alert('✅ 目前沒有未結清的住宿費用');
        return;
    }
    
    const byCurrency = {};
    const byAgent = {};
    
    unpaidExpenses.forEach(r => {
        const currency = r.currency || 'THB';
        if (!byCurrency[currency]) {
            byCurrency[currency] = {
                total: 0,
                records: []
            };
        }
        byCurrency[currency].total += r.amount;
        byCurrency[currency].records.push(r);
        
        const agentKey = r.agent_id;
        if (!byAgent[agentKey]) {
            byAgent[agentKey] = {
                agent_name: r.agent_name || '未知',
                records: []
            };
        }
        byAgent[agentKey].records.push(r);
    });
    
    let currencyStatsHtml = '';
    const currencyKeys = Object.keys(byCurrency).sort();
    currencyKeys.forEach(curr => {
        const data = byCurrency[curr];
        const totalTHB = data.records.reduce((sum, r) => sum + (r.thb_amount || r.amount), 0);
        currencyStatsHtml += `
            <div style="background:#fff3e0;padding:15px 20px;border-radius:8px;border:1px solid #ffcc80;text-align:center;">
                <div style="font-size:14px;font-weight:bold;color:#666;">${curr}</div>
                <div style="font-size:28px;font-weight:bold;color:#e65100;">${data.total.toFixed(2)}</div>
                <div style="font-size:11px;color:#999;">${data.records.length} 筆未結清</div>
                <div style="font-size:11px;color:#999;">≈ ${totalTHB.toFixed(2)} 泰銖</div>
            </div>
        `;
    });
    
    const totalTHBAll = unpaidExpenses.reduce((sum, r) => sum + (r.thb_amount || r.amount), 0);
    const totalAmountAll = unpaidExpenses.reduce((sum, r) => sum + r.amount, 0);
    
    let agentDetailHtml = '';
    const agentKeys = Object.keys(byAgent).sort((a, b) => {
        const nameA = byAgent[a].agent_name || '';
        const nameB = byAgent[b].agent_name || '';
        return nameA.localeCompare(nameB);
    });
    agentKeys.forEach(key => {
        const data = byAgent[key];
        const total = data.records.reduce((sum, r) => sum + r.amount, 0);
        const thbTotal = data.records.reduce((sum, r) => sum + (r.thb_amount || r.amount), 0);
        agentDetailHtml += `
            <div style="margin-bottom:8px;border:1px solid #eee;border-radius:6px;overflow:hidden;">
                <div style="background:#f8f9fc;padding:8px 12px;display:flex;justify-content:space-between;font-weight:bold;font-size:13px;">
                    <span>👤 ${data.agent_name}</span>
                    <span>${total.toFixed(2)} | ≈ ${thbTotal.toFixed(2)} 泰銖</span>
                </div>
                <div style="padding:4px 12px;">
                    ${data.records.map(r => `
                        <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f5f5f5;font-size:12px;">
                            <span>#${r.id} ${r.check_in_date || ''} ~ ${r.check_out_date || ''}</span>
                            <span style="color:#e65100;font-weight:bold;">${r.amount.toFixed(2)} ${r.currency || 'THB'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    // ✅ 檢查是否有還款權限
    const canAddPayment = checkActionPermission('agent_stay', 'add_payment');
    
    const html = `
        <div class="modal-title" style="font-size:20px;">💱 各幣種未付款總額</div>
        
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #ffa726, #e65100);border-radius:8px;text-align:center;color:#fff;">
            <div style="font-size:13px;opacity:0.9;">📌 總未結清費用</div>
            <div style="font-size:28px;font-weight:bold;">${totalAmountAll.toFixed(2)}</div>
            <div style="font-size:13px;opacity:0.8;">≈ ${totalTHBAll.toFixed(2)} 泰銖 | 共 ${unpaidExpenses.length} 筆</div>
        </div>
        
        <h4 style="margin-bottom:10px;text-align:center;font-size:16px;">📊 各幣種統計</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px;">
            ${currencyStatsHtml}
        </div>
        
        <h4 style="margin-bottom:10px;text-align:center;font-size:16px;">👥 各代理人明細</h4>
        <div style="max-height:300px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;padding:4px 0;">
            ${agentDetailHtml}
        </div>
        
        <div style="margin-top:10px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;color:#666;text-align:center;">
            💡 點擊「住宿還款」可按幣種進行還款抵扣
        </div>
        
        <div class="modal-actions">
            ${canAddPayment ? `<button class="btn btn-success" onclick="closeModal(this.closest('.modal-overlay'));showAddStayPayment()">💵 前往還款</button>` : ''}
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
        </div>
    `;
    showModalWide(html);
}

// ============================================================
// 新增住宿費用（支持多幣種 + 代理人搜尋）- 含權限檢查
// ============================================================

function showAddStayExpense() {
    // ✅ 檢查新增住宿費用權限
    if (!checkActionPermission('agent_stay', 'add_expense')) {
        showPermissionDenied('新增住宿費用');
        return;
    }
    
    const agents = DB.get('agents', []);
    const accounts = DB.get('accounts', []);
    const currencies = DB.get('currencies', []);
    const members = DB.get('members', []);
    
    if (agents.length === 0) {
        alert('⚠️ 請先新增介紹人');
        return;
    }
    if (accounts.length === 0) {
        alert('⚠️ 請先到「往來賬款」頁面新增賬戶');
        return;
    }
    if (currencies.length === 0) {
        alert('⚠️ 請先到「幣種匯率」頁面設定幣種');
        return;
    }
    
    const agentOptions = agents.map(a => 
        `<option value="${a.id}">${a.name} (ID:${a.id})</option>`
    ).join('');
    
    const accountOptions = accounts.map(a => {
        const balances = a.balances || {};
        const balanceDisplay = Object.entries(balances)
            .filter(([_, bal]) => bal !== 0)
            .map(([currency, bal]) => `${currency}: ${bal.toFixed(2)}`)
            .join(' | ');
        return `<option value="${a.id}" data-balances='${JSON.stringify(balances)}'>${a.name} ${balanceDisplay ? '(' + balanceDisplay + ')' : ''}</option>`;
    }).join('');
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" data-rate="${c.buy_rate || c.rate || 1}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const html = `
        <div class="modal-title">💰 新增住宿費用</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 可通過會員ID/姓名搜索介紹人，選擇幣種和往來賬款賬戶支付</span>
        </div>
        
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #e0e0e0;">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <span style="font-weight:500;font-size:14px;color:#333;">🔍 搜索介紹人：</span>
                <input type="text" id="searchAgentInput" placeholder="輸入會員ID或姓名" style="flex:1;min-width:150px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') searchAgentForStay()">
                <button class="btn btn-primary" onclick="searchAgentForStay()">搜索</button>
                <button class="btn" onclick="clearAgentSearch()">清除</button>
            </div>
            <div id="agentSearchResult" style="margin-top:8px;font-size:13px;color:#999;text-align:center;display:none;"></div>
        </div>
        
        <div class="form-group">
            <label>選擇介紹人 *</label>
            <select id="stayExpenseAgent" onchange="showAgentInfo()">
                <option value="">請選擇...</option>
                ${agentOptions}
            </select>
        </div>
        <div id="selectedAgentInfo" style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;display:none;text-align:center;border:1px solid #e0e0e0;">
            <span style="color:#666;">📌 已選擇：</span>
            <span id="selectedAgentName" style="font-weight:bold;color:#2196F3;">-</span>
            <span id="selectedAgentPhone" style="font-size:12px;color:#999;margin-left:10px;"></span>
            <span id="selectedAgentUnpaid" style="font-size:12px;color:#ffa726;margin-left:10px;"></span>
        </div>
        
        <div class="form-group">
            <label>幣種 *</label>
            <select id="stayExpenseCurrency" onchange="updateExpensePreview()">
                ${currencyOptions}
            </select>
        </div>
        
        <div class="form-group">
            <label>入住日期 *</label>
            <input type="date" id="stayCheckIn" value="${today}">
        </div>
        <div class="form-group">
            <label>退房日期 *</label>
            <input type="date" id="stayCheckOut" value="${tomorrow}">
        </div>
        <div class="form-group">
            <label>住宿費用 *</label>
            <input type="number" id="stayExpenseAmount" step="0.01" min="0.01" placeholder="請輸入住宿總費用" oninput="updateExpensePreview()">
        </div>
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-bottom:15px;font-size:13px;text-align:center;border:1px solid #eee;">
            <span>📅 住宿天數：<strong id="stayDaysPreview">0</strong> 天</span>
            <span style="margin-left:15px;">💰 每日平均：<strong id="stayDailyPreview">0.00</strong></span>
            <span style="margin-left:15px;">💱 泰銖參考：<strong id="stayTHBPreview">0.00</strong></span>
        </div>
        
        <div class="form-group">
            <label>支付賬戶 *</label>
            <select id="stayExpenseAccount" onchange="updateExpensePreview()">
                ${accountOptions}
            </select>
        </div>
        <div id="accountBalancePreview" style="margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;display:none;">
            <span style="color:#e65100;">💡 支付後賬戶餘額：<strong id="afterBalanceDisplay">0.00</strong> <span id="afterBalanceCurrency">THB</span></span>
        </div>
        
        <div class="form-group">
            <label>備註</label>
            <input type="text" id="stayExpenseNote" placeholder="請輸入備註（可選）">
        </div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 住宿費用將從所選往來賬戶扣除，記錄為「未結清」狀態</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitStayExpense()">確認新增</button>
        </div>
    `;
    showModal(html);
    
    // 搜索介紹人函數
    window.searchAgentForStay = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const searchInput = overlay.querySelector('#searchAgentInput');
        const resultDiv = overlay.querySelector('#agentSearchResult');
        const agentSelect = overlay.querySelector('#stayExpenseAgent');
        const keyword = searchInput.value.trim();
        
        if (!keyword) {
            resultDiv.style.display = 'none';
            return;
        }
        
        const agents = DB.get('agents', []);
        const members = DB.get('members', []);
        const records = DB.get('agent_stay_records', []);
        
        let foundAgents = [];
        const isNumeric = /^\d+$/.test(keyword);
        
        if (isNumeric) {
            const memberId = parseInt(keyword);
            const member = members.find(m => m.id === memberId);
            if (member && member.intermediary_id) {
                const agent = agents.find(a => a.id === member.intermediary_id);
                if (agent) {
                    foundAgents.push({
                        agent: agent,
                        member: member,
                        matchType: '會員ID'
                    });
                }
            }
        }
        
        if (foundAgents.length === 0) {
            const matchedMembers = members.filter(m => m.name.toLowerCase().includes(keyword.toLowerCase()));
            if (matchedMembers.length > 0) {
                matchedMembers.forEach(m => {
                    if (m.intermediary_id) {
                        const agent = agents.find(a => a.id === m.intermediary_id);
                        if (agent && !foundAgents.find(f => f.agent.id === agent.id)) {
                            foundAgents.push({
                                agent: agent,
                                member: m,
                                matchType: '會員姓名'
                            });
                        }
                    }
                });
            }
        }
        
        if (foundAgents.length === 0) {
            const matchedAgents = agents.filter(a => a.name.toLowerCase().includes(keyword.toLowerCase()));
            matchedAgents.forEach(a => {
                const member = members.find(m => m.intermediary_id === a.id);
                foundAgents.push({
                    agent: a,
                    member: member || null,
                    matchType: '介紹人姓名'
                });
            });
        }
        
        if (foundAgents.length === 0 && isNumeric) {
            const agentId = parseInt(keyword);
            const agent = agents.find(a => a.id === agentId);
            if (agent) {
                const member = members.find(m => m.intermediary_id === agentId);
                foundAgents.push({
                    agent: agent,
                    member: member || null,
                    matchType: '介紹人ID'
                });
            }
        }
        
        if (foundAgents.length === 0) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = '#ff6b6b';
            resultDiv.innerHTML = '❌ 找不到匹配的介紹人，請重新輸入';
            return;
        }
        
        let optionsHtml = '<option value="">請選擇...</option>';
        foundAgents.forEach(item => {
            const agent = item.agent;
            const member = item.member;
            const unpaid = records.filter(r => r.agent_id === agent.id && r.type === 'expense' && r.status === '未結清');
            const totalUnpaid = unpaid.reduce((sum, r) => sum + r.amount, 0);
            const label = member ? 
                `${agent.name} (關聯會員：${member.name}  #${member.id})` : 
                `${agent.name} (ID:${agent.id})`;
            optionsHtml += `<option value="${agent.id}" data-member="${member ? member.id : ''}" data-member-name="${member ? member.name : ''}" data-phone="${agent.phone || ''}" data-unpaid="${totalUnpaid}">${label}</option>`;
        });
        agentSelect.innerHTML = optionsHtml;
        
        if (foundAgents.length === 1) {
            agentSelect.value = foundAgents[0].agent.id;
            showAgentInfo();
        }
        
        resultDiv.style.display = 'block';
        resultDiv.style.color = '#4CAF50';
        const matchTypes = foundAgents.map(item => item.matchType).join('、');
        resultDiv.innerHTML = `✅ 找到 ${foundAgents.length} 位介紹人 (匹配方式：${matchTypes})，已更新下方列表`;
    };
    
    window.clearAgentSearch = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const searchInput = overlay.querySelector('#searchAgentInput');
        const resultDiv = overlay.querySelector('#agentSearchResult');
        const agentSelect = overlay.querySelector('#stayExpenseAgent');
        
        searchInput.value = '';
        resultDiv.style.display = 'none';
        
        const agents = DB.get('agents', []);
        const records = DB.get('agent_stay_records', []);
        let optionsHtml = '<option value="">請選擇...</option>';
        agents.forEach(a => {
            const unpaid = records.filter(r => r.agent_id === a.id && r.type === 'expense' && r.status === '未結清');
            const totalUnpaid = unpaid.reduce((sum, r) => sum + r.amount, 0);
            optionsHtml += `<option value="${a.id}" data-member="" data-member-name="" data-phone="${a.phone || ''}" data-unpaid="${totalUnpaid}">${a.name} (ID:${a.id})</option>`;
        });
        agentSelect.innerHTML = optionsHtml;
        agentSelect.value = '';
        document.getElementById('selectedAgentInfo').style.display = 'none';
    };
    
    window.showAgentInfo = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const agentSelect = overlay.querySelector('#stayExpenseAgent');
        const selectedOption = agentSelect.options[agentSelect.selectedIndex];
        const infoDiv = document.getElementById('selectedAgentInfo');
        const nameSpan = document.getElementById('selectedAgentName');
        const phoneSpan = document.getElementById('selectedAgentPhone');
        const unpaidSpan = document.getElementById('selectedAgentUnpaid');
        
        if (selectedOption && selectedOption.value) {
            const agentId = parseInt(selectedOption.value);
            const agent = DB.get('agents', []).find(a => a.id === agentId);
            if (agent) {
                const memberName = selectedOption.dataset.memberName || '';
                const phone = selectedOption.dataset.phone || agent.phone || '';
                const unpaid = parseFloat(selectedOption.dataset.unpaid || 0);
                
                infoDiv.style.display = 'block';
                nameSpan.textContent = agent.name + (memberName ? ` (會員：${memberName})` : '');
                phoneSpan.textContent = phone ? `📱 ${phone}` : '';
                unpaidSpan.textContent = `未結清：${unpaid.toFixed(2)} 泰銖`;
            }
        } else {
            infoDiv.style.display = 'none';
        }
    };
    
    window.updateExpensePreview = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const checkInInput = overlay.querySelector('#stayCheckIn');
        const checkOutInput = overlay.querySelector('#stayCheckOut');
        const amountInput = overlay.querySelector('#stayExpenseAmount');
        const accountSelect = overlay.querySelector('#stayExpenseAccount');
        const currencySelect = overlay.querySelector('#stayExpenseCurrency');
        const daysPreview = document.getElementById('stayDaysPreview');
        const dailyPreview = document.getElementById('stayDailyPreview');
        const thbPreview = document.getElementById('stayTHBPreview');
        const balancePreview = document.getElementById('accountBalancePreview');
        const afterBalanceDisplay = document.getElementById('afterBalanceDisplay');
        const afterBalanceCurrency = document.getElementById('afterBalanceCurrency');
        
        const checkIn = new Date(checkInInput.value);
        const checkOut = new Date(checkOutInput.value);
        const amount = parseFloat(amountInput.value) || 0;
        const currency = currencySelect.value;
        
        if (checkInInput.value && checkOutInput.value && checkOut > checkIn) {
            const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            daysPreview.textContent = days;
            if (days > 0) {
                dailyPreview.textContent = (amount / days).toFixed(2) + ' ' + currency;
            }
        }
        
        const thbAmount = convertToTHB(amount, currency);
        thbPreview.textContent = thbAmount.toFixed(2);
        
        const selectedOption = accountSelect.options[accountSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            let balances = {};
            try {
                balances = JSON.parse(selectedOption.dataset.balances || '{}');
            } catch(e) {}
            const currentBalance = balances[currency] || 0;
            const afterBalance = currentBalance - amount;
            balancePreview.style.display = 'block';
            afterBalanceDisplay.textContent = afterBalance.toFixed(2);
            afterBalanceDisplay.style.color = afterBalance >= 0 ? '#2e7d32' : '#c62828';
            afterBalanceCurrency.textContent = currency;
        } else {
            balancePreview.style.display = 'none';
        }
    };
    
    document.getElementById('stayCheckIn').addEventListener('change', updateExpensePreview);
    document.getElementById('stayCheckOut').addEventListener('change', updateExpensePreview);
    document.getElementById('stayExpenseAmount').addEventListener('input', updateExpensePreview);
    document.getElementById('stayExpenseAccount').addEventListener('change', updateExpensePreview);
    document.getElementById('stayExpenseCurrency').addEventListener('change', updateExpensePreview);
    
    setTimeout(() => {
        if (window.updateExpensePreview) window.updateExpensePreview();
    }, 100);
}

// ============================================================
// 提交新增住宿費用
// ============================================================

function submitStayExpense() {
    const overlay = document.querySelector('.modal-overlay');
    const agentSelect = overlay.querySelector('#stayExpenseAgent');
    const agentId = parseInt(agentSelect.value);
    const checkInDate = overlay.querySelector('#stayCheckIn').value;
    const checkOutDate = overlay.querySelector('#stayCheckOut').value;
    const amount = parseFloat(overlay.querySelector('#stayExpenseAmount').value);
    const currency = overlay.querySelector('#stayExpenseCurrency').value;
    const accountId = parseInt(overlay.querySelector('#stayExpenseAccount').value);
    const note = overlay.querySelector('#stayExpenseNote').value.trim() || '';
    
    if (!agentId) {
        alert('請選擇或搜索介紹人');
        return;
    }
    if (!checkInDate || !checkOutDate) {
        alert('請輸入入住和退房日期');
        return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
        alert('退房日期必須晚於入住日期');
        return;
    }
    if (!amount || amount <= 0) {
        alert('請輸入有效的住宿費用');
        return;
    }
    if (!currency) {
        alert('請選擇幣種');
        return;
    }
    if (!accountId) {
        alert('請選擇支付賬戶');
        return;
    }
    
    const result = addStayExpense(agentId, amount, currency, checkInDate, checkOutDate, accountId, note);
    if (result.success) {
        overlay.remove();
        renderAgentStay(document.getElementById('mainContent'));
        alert(result.message);
    } else {
        alert(result.message);
    }
}

// ============================================================
// 住宿還款彈窗（支持多幣種 + 現金/帳戶付款 + 代理人搜尋）- 含權限檢查
// ============================================================

function showAddStayPayment() {
    // ✅ 檢查住宿還款權限
    if (!checkActionPermission('agent_stay', 'add_payment')) {
        showPermissionDenied('住宿還款');
        return;
    }
    
    const agents = DB.get('agents', []);
    const accounts = DB.get('accounts', []);
    const currencies = DB.get('currencies', []);
    const records = DB.get('agent_stay_records', []);
    
    if (accounts.length === 0) {
        alert('⚠️ 請先到「往來賬款」頁面新增賬戶');
        return;
    }
    if (currencies.length === 0) {
        alert('⚠️ 請先到「幣種匯率」頁面設定幣種');
        return;
    }
    
    const agentsWithUnpaid = agents.filter(a => {
        const unpaid = records.filter(r => r.agent_id === a.id && r.type === 'expense' && r.status === '未結清');
        return unpaid.reduce((sum, r) => sum + r.amount, 0) > 0;
    });
    
    if (agentsWithUnpaid.length === 0) {
        alert('⚠️ 沒有代理人存在未結清的住宿費用');
        return;
    }
    
    const agentOptions = agentsWithUnpaid.map(a => {
        const unpaid = records.filter(r => r.agent_id === a.id && r.type === 'expense' && r.status === '未結清');
        const totalUnpaid = unpaid.reduce((sum, r) => sum + r.amount, 0);
        const currencySummary = unpaid.reduce((acc, r) => {
            const c = r.currency || 'THB';
            acc[c] = (acc[c] || 0) + r.amount;
            return acc;
        }, {});
        const summaryStr = Object.entries(currencySummary)
            .map(([c, amt]) => `${c}: ${amt.toFixed(2)}`)
            .join(' ');
        return `<option value="${a.id}" data-unpaid="${totalUnpaid}" data-currencies='${JSON.stringify(currencySummary)}'>${a.name} (ID:${a.id}) - 未結清：${summaryStr}</option>`;
    }).join('');
    
    const accountOptions = accounts.map(a => {
        const balances = a.balances || {};
        const balanceDisplay = Object.entries(balances)
            .filter(([_, bal]) => bal !== 0)
            .map(([currency, bal]) => `${currency}: ${bal.toFixed(2)}`)
            .join(' | ');
        return `<option value="${a.id}" data-balances='${JSON.stringify(balances)}'>${a.name} ${balanceDisplay ? '(' + balanceDisplay + ')' : ''}</option>`;
    }).join('');
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" data-rate="${c.sell_rate || c.rate || 1}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const html = `
        <div class="modal-title">💵 住宿還款</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 還款將按時間順序（從舊到新）依次抵扣未結清的住宿費用</span>
        </div>
        
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #e0e0e0;">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <span style="font-weight:500;font-size:14px;color:#333;">🔍 搜尋代理人：</span>
                <input type="text" id="searchPaymentAgentInput" placeholder="輸入ID或姓名" style="flex:1;min-width:150px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') searchPaymentAgent()">
                <button class="btn btn-primary" onclick="searchPaymentAgent()">搜尋</button>
                <button class="btn" onclick="clearPaymentAgentSearch()">清除</button>
            </div>
            <div id="paymentAgentSearchResult" style="margin-top:8px;font-size:13px;color:#999;text-align:center;display:none;"></div>
        </div>
        
        <div class="form-group">
            <label>代理人 *</label>
            <select id="stayPaymentAgent" onchange="updatePaymentPreview()">
                <option value="">請選擇...</option>
                ${agentOptions}
            </select>
        </div>
        <div id="unpaidDetails" style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;max-height:150px;overflow-y:auto;border:1px solid #eee;">
            <div style="font-size:13px;color:#666;text-align:center;">選擇代理人後將顯示未結清明細</div>
        </div>
        
        <div class="form-group">
            <label>幣種 *</label>
            <select id="stayPaymentCurrency" onchange="updatePaymentPreview()">
                ${currencyOptions}
            </select>
        </div>
        
        <div class="form-group">
            <label>還款金額 *</label>
            <input type="number" id="stayPaymentAmount" step="0.01" min="0.01" placeholder="請輸入還款金額" oninput="updatePaymentPreview()">
        </div>
        <div id="paymentPreview" style="margin-bottom:15px;padding:10px;background:#e8f5e9;border-radius:6px;border:1px solid #a5d6a7;text-align:center;display:none;">
            <span style="color:#2e7d32;">💡 將抵扣 <strong id="paymentDeductCount">0</strong> 筆費用</span>
            <span style="color:#2e7d32;margin-left:15px;">💱 泰銖參考：<strong id="paymentTHBPreview">0.00</strong></span>
        </div>
        
        <div class="form-group">
            <label>付款方式 *</label>
            <select id="stayPaymentMethod" onchange="togglePaymentMethod()">
                <option value="account">🏦 帳戶付款（存入往來賬款）</option>
                <option value="cash">💵 現金付款</option>
            </select>
        </div>
        
        <div id="paymentAccountGroup">
            <div class="form-group">
                <label>收款賬戶 *</label>
                <select id="stayPaymentAccount" onchange="updatePaymentPreview()">
                    ${accountOptions}
                </select>
            </div>
            <div id="paymentAccountPreview" style="margin-bottom:15px;padding:10px;background:#e3f2fd;border-radius:6px;border:1px solid #90caf9;text-align:center;font-size:13px;display:none;">
                <span style="color:#1565C0;">💡 收款後賬戶餘額：<strong id="afterPaymentBalanceDisplay">0.00</strong> <span id="afterPaymentCurrency">THB</span></span>
            </div>
        </div>
        
        <div id="cashPaymentInfo" style="display:none;margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;">
            <span style="color:#e65100;">💵 現金付款 - 請確認已收到現金</span>
        </div>
        
        <div class="form-group">
            <label>備註</label>
            <input type="text" id="stayPaymentNote" placeholder="請輸入備註（可選）">
        </div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 還款將自動更新對應住宿費用為「已結清」狀態</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitStayPayment()">確認還款</button>
        </div>
    `;
    showModal(html);
    
    window.searchPaymentAgent = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const searchInput = overlay.querySelector('#searchPaymentAgentInput');
        const resultDiv = overlay.querySelector('#paymentAgentSearchResult');
        const agentSelect = overlay.querySelector('#stayPaymentAgent');
        const keyword = searchInput.value.trim();
        
        if (!keyword) {
            resultDiv.style.display = 'none';
            return;
        }
        
        const agents = DB.get('agents', []);
        const records = DB.get('agent_stay_records', []);
        const isNumeric = /^\d+$/.test(keyword);
        
        const foundAgents = agents.filter(a => {
            const nameMatch = a.name.toLowerCase().includes(keyword.toLowerCase());
            const idMatch = isNumeric && a.id.toString().includes(keyword);
            return nameMatch || idMatch;
        });
        
        if (foundAgents.length === 0) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = '#ff6b6b';
            resultDiv.innerHTML = '❌ 找不到匹配的代理人，請重新輸入';
            return;
        }
        
        let optionsHtml = '<option value="">請選擇...</option>';
        foundAgents.forEach(a => {
            const unpaid = records.filter(r => r.agent_id === a.id && r.type === 'expense' && r.status === '未結清');
            const totalUnpaid = unpaid.reduce((sum, r) => sum + r.amount, 0);
            const currencySummary = unpaid.reduce((acc, r) => {
                const c = r.currency || 'THB';
                acc[c] = (acc[c] || 0) + r.amount;
                return acc;
            }, {});
            const summaryStr = Object.entries(currencySummary)
                .map(([c, amt]) => `${c}: ${amt.toFixed(2)}`)
                .join(' ');
            optionsHtml += `<option value="${a.id}" data-unpaid="${totalUnpaid}" data-currencies='${JSON.stringify(currencySummary)}'>${a.name} (ID:${a.id}) - 未結清：${summaryStr}</option>`;
        });
        agentSelect.innerHTML = optionsHtml;
        
        if (foundAgents.length === 1) {
            agentSelect.value = foundAgents[0].id;
            updatePaymentPreview();
        }
        
        resultDiv.style.display = 'block';
        resultDiv.style.color = '#4CAF50';
        resultDiv.innerHTML = `✅ 找到 ${foundAgents.length} 位代理人，已更新下方列表`;
    };
    
    window.clearPaymentAgentSearch = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const searchInput = overlay.querySelector('#searchPaymentAgentInput');
        const resultDiv = overlay.querySelector('#paymentAgentSearchResult');
        const agentSelect = overlay.querySelector('#stayPaymentAgent');
        
        searchInput.value = '';
        resultDiv.style.display = 'none';
        
        const agents = DB.get('agents', []);
        const records = DB.get('agent_stay_records', []);
        const agentsWithUnpaid = agents.filter(a => {
            const unpaid = records.filter(r => r.agent_id === a.id && r.type === 'expense' && r.status === '未結清');
            return unpaid.reduce((sum, r) => sum + r.amount, 0) > 0;
        });
        
        let optionsHtml = '<option value="">請選擇...</option>';
        agentsWithUnpaid.forEach(a => {
            const unpaid = records.filter(r => r.agent_id === a.id && r.type === 'expense' && r.status === '未結清');
            const totalUnpaid = unpaid.reduce((sum, r) => sum + r.amount, 0);
            const currencySummary = unpaid.reduce((acc, r) => {
                const c = r.currency || 'THB';
                acc[c] = (acc[c] || 0) + r.amount;
                return acc;
            }, {});
            const summaryStr = Object.entries(currencySummary)
                .map(([c, amt]) => `${c}: ${amt.toFixed(2)}`)
                .join(' ');
            optionsHtml += `<option value="${a.id}" data-unpaid="${totalUnpaid}" data-currencies='${JSON.stringify(currencySummary)}'>${a.name} (ID:${a.id}) - 未結清：${summaryStr}</option>`;
        });
        agentSelect.innerHTML = optionsHtml;
        agentSelect.value = '';
        document.getElementById('unpaidDetails').innerHTML = '<div style="font-size:13px;color:#666;text-align:center;">選擇代理人後將顯示未結清明細</div>';
    };
    
    window.togglePaymentMethod = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        
        const method = overlayEl.querySelector('#stayPaymentMethod').value;
        const accountGroup = overlayEl.querySelector('#paymentAccountGroup');
        const cashInfo = overlayEl.querySelector('#cashPaymentInfo');
        
        if (method === 'account') {
            accountGroup.style.display = 'block';
            cashInfo.style.display = 'none';
        } else {
            accountGroup.style.display = 'none';
            cashInfo.style.display = 'block';
        }
        updatePaymentPreview();
    };
    
    window.updatePaymentPreview = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        
        const agentSelect = overlayEl.querySelector('#stayPaymentAgent');
        const amountInput = overlayEl.querySelector('#stayPaymentAmount');
        const accountSelect = overlayEl.querySelector('#stayPaymentAccount');
        const currencySelect = overlayEl.querySelector('#stayPaymentCurrency');
        const methodSelect = overlayEl.querySelector('#stayPaymentMethod');
        const previewDiv = overlayEl.querySelector('#paymentPreview');
        const deductCountSpan = overlayEl.querySelector('#paymentDeductCount');
        const thbPreviewSpan = overlayEl.querySelector('#paymentTHBPreview');
        const detailsDiv = overlayEl.querySelector('#unpaidDetails');
        const accountPreview = document.getElementById('paymentAccountPreview');
        const afterBalanceDisplay = document.getElementById('afterPaymentBalanceDisplay');
        const afterPaymentCurrency = document.getElementById('afterPaymentCurrency');
        
        const agentId = parseInt(agentSelect.value);
        const amount = parseFloat(amountInput.value) || 0;
        const currency = currencySelect.value;
        const method = methodSelect.value;
        
        const records = DB.get('agent_stay_records', []);
        const unpaid = records.filter(r => 
            r.agent_id === agentId && 
            r.type === 'expense' && 
            r.status === '未結清' &&
            r.currency === currency
        );
        unpaid.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        const otherUnpaid = records.filter(r => 
            r.agent_id === agentId && 
            r.type === 'expense' && 
            r.status === '未結清' &&
            r.currency !== currency
        );
        
        let detailsHtml = '<div style="font-size:12px;">';
        
        if (unpaid.length === 0) {
            detailsHtml += `<div style="color:#ff6b6b;text-align:center;padding:5px;">該代理人沒有 ${currency} 的未結清費用</div>`;
            if (otherUnpaid.length > 0) {
                detailsHtml += `<div style="color:#ffa726;text-align:center;padding:5px;border-top:1px solid #eee;">💡 其他幣種未結清：</div>`;
                otherUnpaid.forEach(r => {
                    detailsHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #f0f0f0;color:#ffa726;">
                        <span>#${r.id} ${r.currency}</span>
                        <span>${r.amount.toFixed(2)}</span>
                    </div>`;
                });
            }
            detailsHtml += '</div>';
            detailsDiv.innerHTML = detailsHtml;
            return;
        }
        
        let remainingAmount = amount;
        let deductCount = 0;
        
        unpaid.forEach((r, index) => {
            const deduct = Math.min(r.amount, remainingAmount);
            if (deduct > 0 && remainingAmount > 0) {
                deductCount++;
                remainingAmount -= deduct;
            }
            detailsHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #f0f0f0;">
                <span>#${r.id} ${r.check_in_date || ''} ~ ${r.check_out_date || ''}</span>
                <span>${r.amount.toFixed(2)} ${currency} ${deduct > 0 && remainingAmount >= 0 ? '→ 抵扣 ' + deduct.toFixed(2) : ''}</span>
            </div>`;
            remainingAmount -= deduct;
        });
        detailsHtml += '</div>';
        detailsDiv.innerHTML = detailsHtml;
        
        const thbAmount = convertFromTHB(amount, currency);
        
        if (amount > 0 && deductCount > 0) {
            previewDiv.style.display = 'block';
            deductCountSpan.textContent = deductCount;
            thbPreviewSpan.textContent = thbAmount.toFixed(2);
        } else {
            previewDiv.style.display = 'none';
        }
        
        if (method === 'account') {
            const selectedOption = accountSelect.options[accountSelect.selectedIndex];
            if (selectedOption && selectedOption.value) {
                let balances = {};
                try {
                    balances = JSON.parse(selectedOption.dataset.balances || '{}');
                } catch(e) {}
                const currentBalance = balances[currency] || 0;
                const afterBalance = currentBalance + amount;
                accountPreview.style.display = 'block';
                afterBalanceDisplay.textContent = afterBalance.toFixed(2);
                afterBalanceDisplay.style.color = afterBalance >= 0 ? '#1565C0' : '#c62828';
                afterPaymentCurrency.textContent = currency;
            } else {
                accountPreview.style.display = 'none';
            }
        } else {
            accountPreview.style.display = 'none';
        }
    };
    
    document.getElementById('stayPaymentAccount').addEventListener('change', updatePaymentPreview);
    document.getElementById('stayPaymentCurrency').addEventListener('change', updatePaymentPreview);
    document.getElementById('stayPaymentMethod').addEventListener('change', togglePaymentMethod);
    
    setTimeout(() => {
        if (window.updatePaymentPreview) window.updatePaymentPreview();
        if (window.togglePaymentMethod) window.togglePaymentMethod();
    }, 100);
}

// ============================================================
// 提交還款
// ============================================================

function submitStayPayment() {
    const overlay = document.querySelector('.modal-overlay');
    const agentId = parseInt(overlay.querySelector('#stayPaymentAgent').value);
    const amount = parseFloat(overlay.querySelector('#stayPaymentAmount').value);
    const currency = overlay.querySelector('#stayPaymentCurrency').value;
    const paymentMethod = overlay.querySelector('#stayPaymentMethod').value;
    const note = overlay.querySelector('#stayPaymentNote').value.trim() || '';
    
    if (!agentId) {
        alert('請選擇代理人');
        return;
    }
    if (!amount || amount <= 0) {
        alert('請輸入有效的還款金額');
        return;
    }
    if (!currency) {
        alert('請選擇幣種');
        return;
    }
    
    let accountId = null;
    if (paymentMethod === 'account') {
        accountId = parseInt(overlay.querySelector('#stayPaymentAccount').value);
        if (!accountId) {
            alert('請選擇收款賬戶');
            return;
        }
    }
    
    const records = DB.get('agent_stay_records', []);
    const unpaid = records.filter(r => 
        r.agent_id === agentId && 
        r.type === 'expense' && 
        r.status === '未結清' &&
        r.currency === currency
    );
    const totalUnpaid = unpaid.reduce((sum, r) => sum + r.amount, 0);
    
    if (totalUnpaid <= 0) {
        const otherUnpaid = records.filter(r => 
            r.agent_id === agentId && 
            r.type === 'expense' && 
            r.status === '未結清' &&
            r.currency !== currency
        );
        let msg = `代理人 ${agentId} 沒有 ${currency} 的未結清費用`;
        if (otherUnpaid.length > 0) {
            msg += `\n\n其他幣種未結清：\n${otherUnpaid.map(r => `  ${r.currency}: ${r.amount.toFixed(2)}`).join('\n')}`;
        }
        alert(msg);
        return;
    }
    
    if (amount > totalUnpaid) {
        if (!confirm(`⚠️ 還款金額 (${amount.toFixed(2)} ${currency}) 超過未結清總額 (${totalUnpaid.toFixed(2)} ${currency})，超出的部分將無法抵扣。\n確定要繼續嗎？`)) {
            return;
        }
    }
    
    const result = addStayPayment(agentId, amount, currency, paymentMethod, accountId, note);
    if (result.success) {
        overlay.remove();
        renderAgentStay(document.getElementById('mainContent'));
        alert(result.message);
    } else {
        alert(result.message);
    }
}

// ============================================================
// 刪除住宿記錄（使用者點擊調用）- 含權限檢查
// ============================================================

function handleDeleteStayRecord(recordId) {
    // ✅ 檢查刪除權限
    if (!checkActionPermission('agent_stay', 'delete')) {
        showPermissionDenied('刪除住宿記錄');
        return;
    }
    
    if (!confirm('確定要刪除此住宿費用記錄嗎？\n（僅限未結清的記錄，金額將退還到原賬戶）')) return;
    
    const result = deleteStayRecord(recordId);
    if (result.success) {
        renderAgentStay(document.getElementById('mainContent'));
        alert(result.message);
    } else {
        alert(result.message);
    }
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