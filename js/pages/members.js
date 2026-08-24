// ============================================================
// 2. 来客管理（完整版 - 支持买入/卖出价换币，全部无条件舍去 + 介紹人搜尋 + 多幣種充值/出金 + 權限控制）
// ============================================================

// ============================================================
// 渲染會員列表
// ============================================================

function renderMembers(el) {
    const members = DB.get('members', []);
    const agents = DB.get('agents', []);
    const currencies = DB.get('currencies', []);
    
    // 檢查瀏覽權限
    if (!checkActionPermission('members', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>📋 来客管理</h1>
                <p class="breadcrumb">会员中心 > 来客管理</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「来客管理」的权限</p>
            </div>
        `;
        return;
    }
    
    const searchKeyword = document.getElementById('memberSearch')?.value?.trim() || '';
    
    let filteredMembers = members;
    if (searchKeyword) {
        const isNumeric = /^\d+$/.test(searchKeyword);
        filteredMembers = members.filter(m => {
            const nameMatch = m.name.toLowerCase().includes(searchKeyword.toLowerCase());
            const idMatch = isNumeric && m.id.toString().includes(searchKeyword);
            return nameMatch || idMatch;
        });
    }
    
    const membersWithTotal = filteredMembers.map(m => {
        const memberAccount = getMemberAccount(m.id);
        const balances = memberAccount.balances || {};
        let totalTHB = 0;
        currencies.forEach(c => {
            const balance = balances[c.currency] || 0;
            totalTHB += balance * getBuyRate(c.currency);
        });
        return {
            ...m,
            totalTHB: totalTHB
        };
    });
    
    const resultCount = membersWithTotal.length;
    const totalCount = members.length;
    const searchInfo = searchKeyword ? `找到 ${resultCount} 笔结果（共 ${totalCount} 位会员）` : `共 ${totalCount} 位会员`;
    
    // 檢查各操作權限
    const canAdd = checkActionPermission('members', 'add');
    const canRecharge = checkActionPermission('members', 'recharge');
    const canWithdraw = checkActionPermission('members', 'withdraw');
    const canEdit = checkActionPermission('members', 'edit');
    const canDelete = checkActionPermission('members', 'delete');
    const canViewAccount = checkActionPermission('members', 'view_account');
    const canViewPayment = checkActionPermission('members', 'view');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>📋 来客管理</h1>
            <p class="breadcrumb">会员中心 > 来客管理</p>
        </div>
        <div class="toolbar">
            <div class="search-box">
                <input type="text" id="memberSearch" placeholder="输入姓名或会员编号..." value="${searchKeyword}" onkeydown="if(event.key==='Enter') renderMembers(document.getElementById('mainContent'))">
                <button class="btn btn-primary" onclick="renderMembers(document.getElementById('mainContent'))">🔍 搜索</button>
                ${searchKeyword ? `<button class="btn" onclick="document.getElementById('memberSearch').value='';renderMembers(document.getElementById('mainContent'))">✕ 清除</button>` : ''}
                <span style="font-size:13px;color:#999;margin-left:5px;">${searchInfo}</span>
            </div>
            ${canAdd ? `<button class="btn btn-primary" onclick="showAddMember()">➕ 新增会员</button>` : ''}
            <button class="btn" onclick="renderMembers(document.getElementById('mainContent'))">🔄 刷新</button>
        </div>
        <div class="table-container">
            <table>
                <thead><tr>
                    <th>ID</th><th>姓名</th><th>手机</th>
                    <th>主余额 (泰铢)</th>
                    <th>借款</th><th>来源</th><th>介绍人</th><th>操作</th>
                </tr></thead>
                <tbody>
                    ${membersWithTotal.length === 0 ? `<tr class="empty-row"><td colspan="8">${searchKeyword ? '未找到匹配的会员' : '暂无会员'}</td></tr>` :
                    membersWithTotal.map(m => {
                        const agent = agents.find(a => a.id === m.intermediary_id);
                        let displayName = m.name;
                        if (searchKeyword) {
                            const regex = new RegExp(`(${searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                            displayName = m.name.replace(regex, '<mark style="background:#ffeb3b;padding:0 2px;border-radius:2px;">$1</mark>');
                        }
                        
                        // 構建操作按鈕（根據權限顯示）
                        let actionButtons = '';
                        if (canRecharge) {
                            actionButtons += `<button class="btn btn-success btn-sm" onclick="doRecharge(${m.id})">充值</button>`;
                        }
                        if (canWithdraw) {
                            actionButtons += `<button class="btn btn-warning btn-sm" onclick="doWithdraw(${m.id})">出金</button>`;
                        }
                        if (canEdit) {
                            actionButtons += `<button class="btn btn-primary btn-sm" onclick="showEditMember(${m.id})">修改</button>`;
                        }
                        if (canDelete) {
                            actionButtons += `<button class="btn btn-danger btn-sm" onclick="deleteMember(${m.id})">删除</button>`;
                        }
                        if (canViewPayment) {
                            actionButtons += `<button class="btn btn-info btn-sm" onclick="showMemberPaymentRecords(${m.id})">📋 款项</button>`;
                        }
                        if (canViewAccount) {
                            actionButtons += `<button class="btn btn-secondary btn-sm" onclick="showMemberAccount(${m.id})">🏦 账户</button>`;
                        }
                        
                        return `<tr>
                            <td><strong>${m.id}</strong> ${searchKeyword && m.id.toString().includes(searchKeyword) ? '🔍' : ''}</td>
                            <td><strong>${displayName}</strong></td>
                            <td>${m.phone || '-'}</td>
                            <td style="color:#2196F3;font-weight:bold;" title="按买入价换算，仅供参考">${m.totalTHB.toFixed(2)}</td>
                            <td>${m.unpaid_loan.toFixed(2)}</td>
                            <td>${m.source || '-'}</td>
                            <td>${agent ? agent.name : '-'}</td>
                            <td>
                                <div class="btn-group">
                                    ${actionButtons}
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================
// 显示会员款项记录
// ============================================================

function showMemberPaymentRecords(id) {
    // ✅ 檢查查看款項權限
    if (!checkActionPermission('members', 'view')) {
        showPermissionDenied('查看會員款項');
        return;
    }
    
    const member = getMember(id);
    if (!member) { alert('会员不存在'); return; }
    
    // ★ 獲取下分記錄
    const downRecords = DB.get('down_records', []).filter(r => {
        const session = DB.get('sessions', []).find(s => s.id === r.session_id);
        return session && session.member_id === id;
    });
    
    const upRecords = DB.get('up_records', []).filter(r => {
        const session = DB.get('sessions', []).find(s => s.id === r.session_id);
        return session && session.member_id === id;
    });
    const rechargeRecords = DB.get('recharge_records', []).filter(r => r.member_id === id);
    const withdrawRecords = DB.get('withdraw_records', []).filter(r => r.member_id === id);
    const exchangeTransactions = DB.get('transactions', []).filter(t => t.member_id === id && t.type === 'exchange');
    
    const allRecords = [
        ...upRecords.map(r => ({ 
            ...r, 
            type: '上分', 
            created_at: r.up_time,
            currency: r.currency || 'THB',
            thb_amount: r.thb_amount || r.amount || 0,
            amount_display: r.amount || 0,
            status_display: r.payment_status === 'paid' ? '已付' : '未付',
            receiver_display: r.receiver || '-',
            detail: `${r.amount || 0} ${r.currency || 'THB'}`
        })),
        ...downRecords.map(r => ({ 
            ...r, 
            type: '下分', 
            created_at: r.down_time,
            currency: r.converted_currency || r.currency || 'THB',
            thb_amount: r.amount || 0,
            amount_display: r.amount || 0,
            status_display: '已完成',
            receiver_display: '-',
            detail: `${r.amount || 0} 泰銖 → ${r.converted_amount || 0} ${r.converted_currency || r.currency || 'THB'}`
        })),
        ...rechargeRecords.map(r => ({ 
            ...r, 
            type: '充值',
            currency: r.currency || 'THB',
            thb_amount: r.thb_amount || r.amount || 0,
            amount_display: r.amount || 0,
            status_display: '已完成',
            receiver_display: r.receiver || '-',
            detail: `${r.amount || 0} ${r.currency || 'THB'}`
        })),
        ...withdrawRecords.map(r => ({ 
            ...r, 
            type: '出金',
            currency: r.currency || 'THB',
            thb_amount: r.thb_amount || r.amount || 0,
            amount_display: r.amount || 0,
            status_display: '已完成',
            receiver_display: r.sender || '-',
            detail: `${r.amount || 0} ${r.currency || 'THB'}`
        })),
        ...exchangeTransactions.map(t => ({ 
            ...t, 
            type: '換幣',
            created_at: t.created_at,
            currency: t.from_currency || 'THB',
            thb_amount: t.amount || 0,
            amount_display: t.from_amount || t.amount || 0,
            status_display: '已完成',
            receiver_display: '-',
            detail: `${t.from_amount || t.amount} ${t.from_currency || 'THB'} → ${t.to_amount || 0} ${t.to_currency || ''}`
        }))
    ];
    
    allRecords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const typeColorMap = {
        '充值': '#4CAF50',
        '出金': '#ff6b6b',
        '上分': '#2196F3',
        '下分': '#FF9800',  // ★ 橙色顯示下分
        '換幣': '#9C27B0'
    };
    
    const html = `
        <div class="modal-title">📋 ${member.name} 的款项记录</div>
        <div style="max-height:450px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">类型</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">时间</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">金额</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">币别</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">泰铢</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">明细</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">状态</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">收款/出款人</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">操作人</th>
                </tr></thead>
                <tbody>
                    ${allRecords.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:20px;color:#999;">暂无记录</td></tr>' :
                    allRecords.slice(0, 50).map(r => {
                        const color = typeColorMap[r.type] || '#333';
                        const isDown = r.type === '下分';
                        const isUp = r.type === '上分';
                        
                        // 金額顯示（下分為綠色，上分為藍色）
                        let amountDisplay = r.amount_display.toFixed(2);
                        if (isDown) {
                            amountDisplay = `<span style="color:#4CAF50;">+${amountDisplay}</span>`;
                        } else if (isUp) {
                            amountDisplay = `<span style="color:#2196F3;">-${amountDisplay}</span>`;
                        }
                        
                        // 狀態顯示
                        let statusDisplay = '-';
                        if (isUp) {
                            statusDisplay = r.status_display === '已付' ? 
                                '<span style="color:#4CAF50;">✅ 已付</span>' : 
                                '<span style="color:#ff6b6b;">⏳ 未付</span>';
                        } else if (isDown) {
                            statusDisplay = '<span style="color:#4CAF50;">✅ 已完成</span>';
                        } else if (r.type === '換幣') {
                            statusDisplay = '<span style="color:#9C27B0;">🔄 已完成</span>';
                        } else {
                            statusDisplay = '<span style="color:#4CAF50;">✅ 已完成</span>';
                        }
                        
                        return `
                        <tr>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:${color};">${r.type}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(r.created_at)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${amountDisplay}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.currency || 'THB'}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${(r.thb_amount || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.detail || '-'}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${statusDisplay}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.receiver_display || r.sender || '-'}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.admin_name || '-'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-top:10px;font-size:13px;color:#666;text-align:center;border:1px solid #eee;">
            📌 共 ${allRecords.length} 笔记录（包含充值、出金、上分、下分、換幣）
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    
    showModalWide(html);
}

// ============================================================
// 寬版 Modal
// ============================================================

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

function formatNumber(num) {
    if (num === undefined || num === null) return '0.00';
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// 显示会员账户（各币种余额 + 换币按钮）
// ============================================================

function showMemberAccount(memberId) {
    // ✅ 檢查查看帳戶權限
    if (!checkActionPermission('members', 'view_account')) {
        showPermissionDenied('查看會員帳戶');
        return;
    }
    
    const member = getMember(memberId);
    if (!member) { alert('会员不存在'); return; }
    
    const memberBalances = getMemberAccount(memberId);
    const balances = memberBalances.balances || {};
    const currencies = DB.get('currencies', []);
    
    let totalTHB = 0;
    const balanceDetails = currencies.map(c => {
        const balance = balances[c.currency] || 0;
        const rate = getBuyRate(c.currency);
        const thbValue = balance * rate;
        totalTHB += thbValue;
        return {
            currency: c.currency,
            name: c.name || c.currency,
            balance: balance,
            rate: rate,
            thbValue: thbValue,
            buyRate: getBuyRate(c.currency),
            sellRate: getSellRate(c.currency)
        };
    });
    
    balanceDetails.sort((a, b) => {
        if (a.currency === 'THB') return -1;
        if (b.currency === 'THB') return 1;
        return a.currency.localeCompare(b.currency);
    });
    
    // 檢查換幣權限
    const canExchange = checkActionPermission('members', 'exchange');
    
    let html = `
        <div class="modal-title" style="font-size:22px;text-align:center;">🏦 ${member.name} - 账户余额</div>
        
        <div style="margin-bottom:20px;padding:20px;background:linear-gradient(135deg, #4CAF50, #2E7D32);border-radius:12px;text-align:center;box-shadow:0 4px 15px rgba(76,175,80,0.3);">
            <div style="color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;letter-spacing:1px;">💎 账户总价值（参考）</div>
            <div style="color:#fff;font-size:42px;font-weight:bold;margin:5px 0;">${formatNumber(totalTHB)}</div>
            <div style="color:rgba(255,255,255,0.8);font-size:13px;">泰铢（按买入价换算，仅供参考）</div>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:15px;">
            ${balanceDetails.map(d => {
                const isTHB = d.currency === 'THB';
                const isPositive = d.balance >= 0;
                const bgColor = isTHB ? '#e3f2fd' : (isPositive ? '#f5f5f5' : '#ffebee');
                const borderColor = isTHB ? '#2196F3' : (isPositive ? '#e0e0e0' : '#ffcdd2');
                const textColor = isTHB ? '#0d47a1' : (isPositive ? '#333' : '#c62828');
                const valueColor = isTHB ? '#1565C0' : (isPositive ? '#1a237e' : '#d32f2f');
                return `
                    <div style="background:${bgColor};padding:16px 10px;border-radius:10px;text-align:center;border:2px solid ${borderColor};">
                        <div style="font-size:18px;font-weight:bold;color:${textColor};">${d.currency}</div>
                        <div style="font-size:26px;font-weight:bold;color:${valueColor};margin:4px 0;">${formatNumber(d.balance)}</div>
                        <div style="font-size:12px;color:#888;margin-top:2px;">≈ ${formatNumber(d.thbValue)} 泰铢（参考）</div>
                        ${!isTHB ? `<div style="font-size:10px;color:#999;margin-top:2px;">买入 ${d.buyRate} | 卖出 ${d.sellRate}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        ${canExchange ? `
            <div style="text-align:center;margin-bottom:15px;">
                <button class="btn btn-primary" onclick="closeModal(this.closest('.modal-overlay'));showCurrencyExchange(${memberId})" style="padding:10px 30px;font-size:16px;">
                    🔄 换币
                </button>
            </div>
        ` : ''}
        
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 换币时：所有换汇结果均无条件舍去到整数位</span>
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModal(html);
}

// ============================================================
// 換幣功能（選擇入金/出金帳戶 + 幣種）
// ============================================================

function showCurrencyExchange(memberId) {
    // ✅ 檢查換幣權限
    if (!checkActionPermission('members', 'exchange')) {
        showPermissionDenied('會員換幣');
        return;
    }
    
    const member = getMember(memberId);
    if (!member) { alert('会员不存在'); return; }
    
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    const memberAccount = getMemberAccount(memberId);
    const balances = memberAccount.balances || {};
    
    // 獲取玩家有餘額的幣種（可出金幣種）
    const availableFromCurrencies = currencies.filter(c => (balances[c.currency] || 0) > 0);
    
    if (availableFromCurrencies.length === 0) {
        alert(`⚠️ ${member.name} 所有币种余额均为 0，无法换币`);
        return;
    }
    
    // 構建帳戶選項（顯示所有帳戶的幣種餘額）
    let accountOptions = '';
    accounts.forEach(a => {
        const bal = a.balances || {};
        const currencyKeys = Object.keys(bal);
        if (currencyKeys.length === 0) {
            accountOptions += `<option value="${a.id}|THB" data-balance="0" data-currency="THB">${a.name} (THB: 0.00)</option>`;
        } else {
            currencyKeys.forEach(curr => {
                const balance = bal[curr] || 0;
                accountOptions += `<option value="${a.id}|${curr}" data-balance="${balance}" data-currency="${curr}">${a.name} (${curr}: ${balance.toFixed(2)})</option>`;
            });
        }
    });
    
    // 構建幣種選項
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" data-buy="${getBuyRate(c.currency)}" data-sell="${getSellRate(c.currency)}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const fromCurrencyOptions = availableFromCurrencies.map(c => 
        `<option value="${c.currency}" data-balance="${balances[c.currency] || 0}" data-buy="${getBuyRate(c.currency)}" data-sell="${getSellRate(c.currency)}">${c.currency} (余额: ${(balances[c.currency] || 0).toFixed(2)})</option>`
    ).join('');
    
    const html = `
        <div class="modal-title" style="font-size:20px;">🔄 换币 - ${member.name}</div>
        
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;font-size:14px;">💡 换币规则：所有换汇结果均<b>无条件舍去到整数位</b></span>
        </div>
        
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;text-align:center;border:1px solid #e8e8e8;">
            ${currencies.map((c, index) => {
                const balance = balances[c.currency] || 0;
                const buyRate = getBuyRate(c.currency);
                const sellRate = getSellRate(c.currency);
                return `<span style="margin:0 8px;${balance > 0 ? 'font-weight:bold;color:#2196F3;' : 'color:#ccc;'}">${c.currency}: ${balance.toFixed(2)} (买入${buyRate}/卖出${sellRate})</span>${index < currencies.length - 1 ? ' | ' : ''}`;
            }).join('')}
        </div>
        
        <!-- 出金區塊（從玩家帳戶扣除 → 存入出金帳戶） -->
        <div style="margin-bottom:15px;padding:12px;background:#ffebee;border-radius:8px;border:1px solid #ef9a9a;">
            <h4 style="margin:0 0 10px 0;color:#c62828;font-size:14px;">📤 出金（從玩家帳戶扣除 → 存入出金帳戶）</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>出金幣種（玩家扣除）*</label>
                    <select id="exchangeFromCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onchange="updateExchangePreview()">
                        ${fromCurrencyOptions}
                    </select>
                    <div style="font-size:11px;color:#666;margin-top:4px;">
                        玩家餘額：<strong id="fromBalanceAmount" style="color:#2196F3;">0.00</strong>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>出金金額 *</label>
                    <input type="number" id="exchangeAmount" step="0.01" min="0.01" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" oninput="updateExchangePreview()" placeholder="请输入要兑换的金额">
                </div>
            </div>
            <div style="margin-top:8px;">
                <label style="font-size:12px;color:#666;">📥 存入出金帳戶 *</label>
                <select id="exchangeFromAccount" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-top:2px;" onchange="updateExchangePreview()">
                    ${accountOptions}
                </select>
                <div id="fromAccountBalanceDisplay" style="font-size:11px;color:#666;margin-top:4px;">
                    帳戶餘額：<strong id="fromAccountBalance" style="color:#2196F3;">0.00</strong>
                </div>
            </div>
        </div>
        
        <!-- 入金區塊（從入金帳戶扣除 → 存入玩家帳戶） -->
        <div style="margin-bottom:15px;padding:12px;background:#e8f5e9;border-radius:8px;border:1px solid #a5d6a7;">
            <h4 style="margin:0 0 10px 0;color:#2e7d32;font-size:14px;">📥 入金（從入金帳戶扣除 → 存入玩家帳戶）</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>入金幣種（玩家存入）*</label>
                    <select id="exchangeToCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onchange="updateExchangePreview()">
                        ${currencyOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>入金金額（自動計算）</label>
                    <div id="exchangeResultDisplay" style="width:100%;padding:8px 12px;border:1px solid #e0e0e0;border-radius:6px;font-size:16px;font-weight:bold;color:#1b5e20;background:#f5f5f5;text-align:center;min-height:40px;display:flex;align-items:center;justify-content:center;">
                        0.00
                    </div>
                </div>
            </div>
            <div style="margin-top:8px;">
                <label style="font-size:12px;color:#666;">📤 從入金帳戶扣除 *</label>
                <select id="exchangeToAccount" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-top:2px;" onchange="updateExchangePreview()">
                    ${accountOptions}
                </select>
                <div id="toAccountBalanceDisplay" style="font-size:11px;color:#666;margin-top:4px;">
                    帳戶餘額：<strong id="toAccountBalance" style="color:#4CAF50;">0.00</strong>
                </div>
            </div>
        </div>
        
        <div id="exchangePreview" style="margin-bottom:15px;padding:15px;background:#e8f5e9;border-radius:8px;border:1px solid #a5d6a7;text-align:center;">
            <div style="font-size:14px;color:#2e7d32;">
                💱 兑换后可获得：
                <span id="exchangeResultAmount" style="font-size:24px;font-weight:bold;color:#1b5e20;">0.00</span>
                <span id="exchangeResultCurrency" style="font-size:18px;font-weight:bold;color:#1b5e20;">-</span>
            </div>
            <div style="font-size:12px;color:#666;margin-top:5px;">
                <span id="exchangeDirection" style="font-weight:bold;">-</span>
            </div>
            <div id="exchangeDetail" style="font-size:12px;color:#888;margin-top:3px;"></div>
        </div>
        
        <div style="padding:10px;background:#fff3e0;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">⚠️ 所有换汇结果均无条件舍去到整数位</span>
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitExchange(${memberId})">✅ 确认兑换</button>
        </div>
    `;
    const overlay = showModal(html);
    
    window.updateExchangePreview = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        
        const fromSelect = overlayEl.querySelector('#exchangeFromCurrency');
        const toSelect = overlayEl.querySelector('#exchangeToCurrency');
        const amountInput = overlayEl.querySelector('#exchangeAmount');
        const fromAccountSelect = overlayEl.querySelector('#exchangeFromAccount');
        const toAccountSelect = overlayEl.querySelector('#exchangeToAccount');
        const resultAmount = overlayEl.querySelector('#exchangeResultAmount');
        const resultCurrency = overlayEl.querySelector('#exchangeResultCurrency');
        const resultDisplay = overlayEl.querySelector('#exchangeResultDisplay');
        const directionSpan = overlayEl.querySelector('#exchangeDirection');
        const detailSpan = overlayEl.querySelector('#exchangeDetail');
        const fromBalanceAmount = overlayEl.querySelector('#fromBalanceAmount');
        const fromAccountBalance = overlayEl.querySelector('#fromAccountBalance');
        const toAccountBalance = overlayEl.querySelector('#toAccountBalance');
        
        const fromCurrency = fromSelect.value;
        const toCurrency = toSelect.value;
        const amount = parseFloat(amountInput.value) || 0;
        
        const selectedFromOption = fromSelect.options[fromSelect.selectedIndex];
        const fromBalance = parseFloat(selectedFromOption?.dataset?.balance || 0);
        fromBalanceAmount.textContent = fromBalance.toFixed(2);
        
        const selectedFromAccount = fromAccountSelect.options[fromAccountSelect.selectedIndex];
        const selectedToAccount = toAccountSelect.options[toAccountSelect.selectedIndex];
        
        if (selectedFromAccount) {
            const fromAccBalance = parseFloat(selectedFromAccount.dataset.balance || 0);
            const fromAccCurrency = selectedFromAccount.dataset.currency || 'THB';
            fromAccountBalance.textContent = fromAccBalance.toFixed(2) + ' ' + fromAccCurrency;
            fromAccountBalance.style.color = fromAccBalance >= 0 ? '#2196F3' : '#c62828';
        }
        
        if (selectedToAccount) {
            const toAccBalance = parseFloat(selectedToAccount.dataset.balance || 0);
            const toAccCurrency = selectedToAccount.dataset.currency || 'THB';
            toAccountBalance.textContent = toAccBalance.toFixed(2) + ' ' + toAccCurrency;
            toAccountBalance.style.color = toAccBalance >= 0 ? '#4CAF50' : '#c62828';
        }
        
        const fromBuy = getBuyRate(fromCurrency);
        const fromSell = getSellRate(fromCurrency);
        const toBuy = getBuyRate(toCurrency);
        const toSell = getSellRate(toCurrency);
        
        let result = 0;
        let directionText = '';
        let detailText = '';
        
        if (fromCurrency === 'THB') {
            result = convertFromTHB(amount, toCurrency);
            directionText = `1 泰铢 = ${(1/toSell).toFixed(4)} ${toCurrency} (卖出价，无条件舍去)`;
            detailText = `计算：${amount} 泰铢 ÷ 卖出价 ${toSell} = ${result} ${toCurrency}`;
        } else if (toCurrency === 'THB') {
            const rawResult = amount * fromBuy;
            result = Math.floor(rawResult);
            directionText = `1 ${fromCurrency} = ${fromBuy.toFixed(4)} 泰铢 (买入价，无条件舍去)`;
            detailText = `计算：${amount} ${fromCurrency} × 买入价 ${fromBuy} = ${rawResult.toFixed(4)} → 舍去 = ${result} 泰铢`;
        } else {
            const thbValue = convertToTHB(amount, fromCurrency);
            result = convertFromTHB(thbValue, toCurrency);
            directionText = `1 ${fromCurrency} = ${fromBuy.toFixed(4)} 泰铢 (买入) → ${(1/toSell).toFixed(4)} ${toCurrency} (卖出，舍去)`;
            detailText = `计算：${amount} ${fromCurrency} × 买入价 ${fromBuy} = ${thbValue} 泰铢 → ${thbValue} ÷ 卖出价 ${toSell} = ${result} ${toCurrency}`;
        }
        
        resultAmount.textContent = result.toFixed(2);
        resultCurrency.textContent = toCurrency;
        if (resultDisplay) {
            resultDisplay.textContent = result.toFixed(2) + ' ' + toCurrency;
        }
        directionSpan.textContent = directionText;
        detailSpan.textContent = detailText;
        
        if (fromCurrency === toCurrency) {
            resultAmount.textContent = '⚠️ 相同币种';
            resultCurrency.textContent = '';
            if (resultDisplay) resultDisplay.textContent = '⚠️ 相同币种';
            directionSpan.textContent = '请选择不同的币种';
            detailSpan.textContent = '';
        }
        
        if (amount > fromBalance) {
            resultAmount.textContent = '⚠️ 余额不足';
            resultCurrency.textContent = '';
            if (resultDisplay) resultDisplay.textContent = '⚠️ 余额不足';
            detailSpan.textContent = '';
        }
    };
    
    setTimeout(() => {
        if (window.updateExchangePreview) window.updateExchangePreview();
    }, 50);
}

function submitExchange(memberId) {
    // ✅ 檢查換幣權限
    if (!checkActionPermission('members', 'exchange')) {
        showPermissionDenied('會員換幣');
        return;
    }
    
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    
    const fromSelect = overlay.querySelector('#exchangeFromCurrency');
    const toSelect = overlay.querySelector('#exchangeToCurrency');
    const amountInput = overlay.querySelector('#exchangeAmount');
    const fromAccountSelect = overlay.querySelector('#exchangeFromAccount');
    const toAccountSelect = overlay.querySelector('#exchangeToAccount');
    
    const fromCurrency = fromSelect.value;
    const toCurrency = toSelect.value;
    const amount = parseFloat(amountInput.value);
    const fromAccountStr = fromAccountSelect.value;
    const toAccountStr = toAccountSelect.value;
    
    if (!amount || amount <= 0) {
        alert('请输入有效的兑换金额');
        return;
    }
    
    if (fromCurrency === toCurrency) {
        alert('出金币种和入金币种不能相同');
        return;
    }
    
    const fromBalance = parseFloat(fromSelect.options[fromSelect.selectedIndex]?.dataset?.balance || 0);
    if (amount > fromBalance) {
        alert(`⚠️ ${fromCurrency} 玩家余额不足！\n当前余额：${fromBalance.toFixed(2)}\n需要：${amount.toFixed(2)}`);
        return;
    }
    
    if (!fromAccountStr) {
        alert('請選擇有效的出金帳戶');
        return;
    }
    const [fromAccountIdStr, fromAccountCurrency] = fromAccountStr.split('|');
    const fromAccountId = parseInt(fromAccountIdStr);
    if (!fromAccountId) {
        alert('請選擇有效的出金帳戶');
        return;
    }
    
    if (!toAccountStr) {
        alert('請選擇有效的入金帳戶');
        return;
    }
    const [toAccountIdStr, toAccountCurrency] = toAccountStr.split('|');
    const toAccountId = parseInt(toAccountIdStr);
    if (!toAccountId) {
        alert('請選擇有效的入金帳戶');
        return;
    }
    
    const fromBuy = getBuyRate(fromCurrency);
    const fromSell = getSellRate(fromCurrency);
    const toSell = getSellRate(toCurrency);
    
    let toAmount = 0;
    let direction = '';
    let directionLabel = '';
    let buyRate = fromBuy;
    let sellRate = toSell;
    
    if (fromCurrency === 'THB') {
        toAmount = convertFromTHB(amount, toCurrency);
        direction = 'sell';
        directionLabel = '泰铢→外币（卖出价，无条件舍去）';
        buyRate = fromBuy;
        sellRate = toSell;
        
        if (toAmount < 1) {
            alert(`⚠️ 兑换金额不足 1 ${toCurrency}！\n泰铢：${amount} / 卖出价 ${toSell} = ${(amount/toSell).toFixed(4)} ${toCurrency}\n请增加泰铢金额。`);
            return;
        }
    } else if (toCurrency === 'THB') {
        const rawResult = amount * fromBuy;
        toAmount = Math.floor(rawResult);
        direction = 'buy';
        directionLabel = '外币→泰铢（买入价，无条件舍去）';
        buyRate = fromBuy;
        sellRate = fromSell;
        
        if (toAmount < 1) {
            alert(`⚠️ 兑换金额不足 1 泰铢！\n${amount} ${fromCurrency} × 买入价 ${fromBuy} = ${rawResult.toFixed(4)} → 舍去 = ${toAmount} 泰铢\n请增加兑换金额。`);
            return;
        }
    } else {
        const thbValue = convertToTHB(amount, fromCurrency);
        toAmount = convertFromTHB(thbValue, toCurrency);
        direction = 'cross';
        directionLabel = '外币→外币（买入+卖出，舍去）';
        buyRate = fromBuy;
        sellRate = toSell;
        
        if (toAmount < 1) {
            alert(`⚠️ 兑换金额不足 1 ${toCurrency}！\n请增加兑换金额。`);
            return;
        }
    }
    
    const fromAccountBalance = get_account_balance(fromAccountId, fromCurrency);
    if (fromAccountBalance < amount) {
        if (!confirm(`⚠️ 出金帳戶 ${fromCurrency} 餘額不足！\n當前餘額：${fromAccountBalance.toFixed(2)} ${fromCurrency}\n需要：${amount.toFixed(2)} ${fromCurrency}\n是否仍要繼續？（餘額將變為負值）`)) {
            return;
        }
    }
    
    const toAccountBalance = get_account_balance(toAccountId, toCurrency);
    if (toAccountBalance < toAmount) {
        if (!confirm(`⚠️ 入金帳戶 ${toCurrency} 餘額不足！\n當前餘額：${toAccountBalance.toFixed(2)} ${toCurrency}\n需要：${toAmount.toFixed(2)} ${toCurrency}\n是否仍要繼續？（餘額將變為負值）`)) {
            return;
        }
    }
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const member = getMember(memberId);
    
    let confirmMsg = `确认兑换？\n\n` +
        `📤 出金（玩家扣除 → 出金帳戶）：\n` +
        `   從玩家帳戶扣除：${amount.toFixed(2)} ${fromCurrency}\n` +
        `   存入出金帳戶：${amount.toFixed(2)} ${fromCurrency}\n` +
        `   出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId}\n\n` +
        `📥 入金（入金帳戶 → 玩家存入）：\n` +
        `   從入金帳戶扣除：${toAmount.toFixed(2)} ${toCurrency}\n` +
        `   存入玩家帳戶：${toAmount.toFixed(2)} ${toCurrency}\n` +
        `   入金帳戶：${getAccount(toAccountId)?.name || toAccountId}\n\n` +
        `汇率方向：${directionLabel}\n` +
        `买入价：${buyRate}\n` +
        `卖出价：${sellRate}\n` +
        `会员：${member ? member.name : '未知'}\n\n`;
    
    if (fromCurrency === 'THB') {
        confirmMsg += `计算：${amount} 泰铢 ÷ 卖出价 ${sellRate} = ${toAmount} ${toCurrency}`;
    } else if (toCurrency === 'THB') {
        confirmMsg += `计算：${amount} ${fromCurrency} × 买入价 ${buyRate} = ${(amount * buyRate).toFixed(4)} → 舍去 = ${toAmount} 泰铢`;
    } else {
        const thbValue = convertToTHB(amount, fromCurrency);
        confirmMsg += `计算：${amount} ${fromCurrency} × 买入价 ${buyRate} = ${thbValue} 泰铢 → ${thbValue} ÷ 卖出价 ${sellRate} = ${toAmount} ${toCurrency}`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    // ============================================================
    // ★ 步驟1：從玩家帳戶扣除（出金）
    // ============================================================
    updateMemberAccountBalance(memberId, fromCurrency, -amount);
    
    const memberAccountTx = DB.get('member_account_transactions', []);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: memberId,
        currency: fromCurrency,
        amount: amount,
        type: 'out',
        note: `🔄 换币出金 - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel})`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    // ============================================================
    // ★ 步驟2：存入出金帳戶
    // ============================================================
    update_account_balance(fromAccountId, fromCurrency, amount);
    
    const accountTx = DB.get('account_transactions', []);
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: fromAccountId,
        currency: fromCurrency,
        amount: amount,
        type: 'in',
        reference_type: 'exchange_withdraw',
        reference_id: memberId,
        note: `🔄 换币出金存入 - 會員 ${member ? member.name : '未知'} - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel})`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    
    // ============================================================
    // ★ 步驟3：從入金帳戶扣除
    // ============================================================
    update_account_balance(toAccountId, toCurrency, -toAmount);
    
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: toAccountId,
        currency: toCurrency,
        amount: toAmount,
        type: 'out',
        reference_type: 'exchange_deposit',
        reference_id: memberId,
        note: `🔄 换币入金扣除 - 會員 ${member ? member.name : '未知'} - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel})`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    
    // ============================================================
    // ★ 步驟4：存入玩家帳戶（入金）
    // ============================================================
    updateMemberAccountBalance(memberId, toCurrency, toAmount);
    
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: memberId,
        currency: toCurrency,
        amount: toAmount,
        type: 'in',
        note: `🔄 换币入金 - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel})`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    // ============================================================
    // ★ 步驟5：記錄交易流水（只記錄一筆換幣記錄）
    // ============================================================
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: memberId,
        type: 'exchange',
        amount: toAmount,
        from_amount: amount,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        direction: direction,
        direction_label: directionLabel,
        buy_rate: buyRate,
        sell_rate: sellRate,
        note: `🔄 换币 - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel})`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('transactions', transactions);
    
    // ============================================================
    // ★ 步驟6：記錄兌匯紀錄（用於兌匯紀錄頁面）
    // ============================================================
    if (typeof addExchangeRecord === 'function') {
        addExchangeRecord(
            memberId,
            member ? member.name : '未知',
            '会员账户',
            fromCurrency,
            amount,
            toCurrency,
            toAmount,
            direction,
            buyRate,
            sellRate,
            null,
            `${directionLabel} - 出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId} → 入金帳戶：${getAccount(toAccountId)?.name || toAccountId}`
        );
    }
    
    // ============================================================
    // ★ 步驟7：記錄操作日誌
    // ============================================================
    addOperationLog('会员管理', '换币', member ? member.name : '未知',
        `${member ? member.name : '未知'} 换币：${amount} ${fromCurrency} → ${toAmount} ${toCurrency} (${directionLabel})`, memberId);
    
    overlay.remove();
    
    const newFromBalance = getMemberAccountBalance(memberId, fromCurrency);
    const newToBalance = getMemberAccountBalance(memberId, toCurrency);
    const newFromAccountBalance = get_account_balance(fromAccountId, fromCurrency);
    const newToAccountBalance = get_account_balance(toAccountId, toCurrency);
    
    alert(`✅ 换币完成！\n\n` +
        `📤 出金（玩家 → 出金帳戶）：\n` +
        `   玩家扣除：-${amount.toFixed(2)} ${fromCurrency}（剩餘：${newFromBalance.toFixed(2)}）\n` +
        `   出金帳戶存入：+${amount.toFixed(2)} ${fromCurrency}（餘額：${newFromAccountBalance.toFixed(2)}）\n` +
        `   出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId}\n\n` +
        `📥 入金（入金帳戶 → 玩家）：\n` +
        `   入金帳戶扣除：-${toAmount.toFixed(2)} ${toCurrency}（餘額：${newToAccountBalance.toFixed(2)}）\n` +
        `   玩家存入：+${toAmount.toFixed(2)} ${toCurrency}（餘額：${newToBalance.toFixed(2)}）\n` +
        `   入金帳戶：${getAccount(toAccountId)?.name || toAccountId}\n\n` +
        `汇率方向：${directionLabel}\n` +
        `买入价：${buyRate}\n` +
        `卖出价：${sellRate}\n` +
        `操作人：${adminName}`);
    
    showMemberAccount(memberId);
}

// ============================================================
// 显示会员账户交易记录
// ============================================================

function showMemberAccountTx(memberId) {
    const member = getMember(memberId);
    if (!member) { alert('会员不存在'); return; }
    
    const transactions = getMemberAccountTransactions(memberId, 50);
    const admins = getAdmins();
    
    let html = `
        <div class="modal-title">📋 ${member.name} - 账户交易记录</div>
        <div style="max-height:400px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">时间</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">币别</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">类型</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">操作人</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">备注</th>
                </tr></thead>
                <tbody>
                    ${transactions.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">暂无交易记录</td></tr>' :
                    transactions.map(t => {
                        const admin = admins.find(a => a.id === t.admin_id);
                        return `<tr>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(t.created_at)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${t.currency}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:${t.type === 'in' ? '#4CAF50' : '#ff6b6b'}">${t.type === 'in' ? '+' : '-'}${t.amount.toFixed(2)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${t.type === 'in' ? '💰 存入' : '📤 支出'}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${t.admin_name || (admin ? (admin.display_name || admin.username) : '系统')}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;">${t.note || '-'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-top:10px;font-size:13px;color:#666;text-align:center;">
            <span>📌 共 ${transactions.length} 笔交易</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModal(html);
}

// ============================================================
// 充值功能（支援多幣種直接存入）
// ============================================================

function doRecharge(id) {
    // ✅ 檢查充值權限
    if (!checkActionPermission('members', 'recharge')) {
        showPermissionDenied('會員充值');
        return;
    }
    
    const member = getMember(id);
    if (!member) return;
    
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    
    const memberAccount = getMemberAccount(id);
    const memberBalances = memberAccount.balances || {};
    
    let totalTHB = 0;
    const balanceDetails = currencies.map(c => {
        const balance = memberBalances[c.currency] || 0;
        const rate = getBuyRate(c.currency);
        const thbValue = balance * rate;
        totalTHB += thbValue;
        return {
            currency: c.currency,
            name: c.name || c.currency,
            balance: balance,
            rate: rate,
            thbValue: thbValue
        };
    });
    
    balanceDetails.sort((a, b) => {
        if (a.currency === 'THB') return -1;
        if (b.currency === 'THB') return 1;
        return a.currency.localeCompare(b.currency);
    });
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" ${c.currency === 'THB' ? 'selected' : ''}>${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    let accountOptions = '';
    accounts.forEach(a => {
        const balances = a.balances || {};
        const currencyKeys = Object.keys(balances);
        if (currencyKeys.length === 0) {
            accountOptions += `<option value="${a.id}|THB" data-balance="0" data-currency="THB">${a.name} (THB: 0.00)</option>`;
        } else {
            currencyKeys.forEach(curr => {
                const balance = balances[curr] || 0;
                accountOptions += `<option value="${a.id}|${curr}" data-balance="${balance}" data-currency="${curr}">${a.name} (${curr}: ${balance.toFixed(2)})</option>`;
            });
        }
    });
    
    const html = `
        <div class="modal-title">💰 充值 - ${member.name}</div>
        
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #2196F3, #1565C0);border-radius:8px;text-align:center;">
            <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;">💰 會員帳戶總價值（參考）</div>
            <div style="color:#fff;font-size:28px;font-weight:bold;">${formatNumber(totalTHB)}</div>
            <div style="color:rgba(255,255,255,0.8);font-size:11px;">泰銖（按買入價換算，僅供參考）</div>
        </div>
        
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;text-align:center;border:1px solid #e8e8e8;">
            ${balanceDetails.map((d, index) => {
                const isTHB = d.currency === 'THB';
                const hasBalance = d.balance > 0;
                return `<span style="margin:0 8px;${isTHB ? 'font-weight:bold;color:#1565C0;' : ''}${!hasBalance ? 'color:#ccc;' : ''}">${d.currency}: ${d.balance.toFixed(2)} (≈${d.thbValue.toFixed(2)}泰銖)</span>${index < balanceDetails.length - 1 ? ' | ' : ''}`;
            }).join('')}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>存入幣種 *</label>
                <select id="rechargeCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                    ${currencyOptions}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>金額 *</label>
                <input type="number" id="rechargeAmount" step="0.01" min="0.01" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="請輸入金額">
            </div>
        </div>
        
        <div style="padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;margin-bottom:15px;text-align:center;">
            <span style="color:#1565C0;">💡 充值金額將以 <strong id="rechargeCurrencyDisplay">THB</strong> 存入玩家帳戶，<b>不進行即時兌換</b></span>
        </div>
        
        <div class="form-group"><label>收款帳戶（往來帳款）*</label>
            <select id="rechargeAccount" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                ${accountOptions}
            </select>
        </div>
        
        <div style="margin-bottom:15px;padding:8px 12px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;">
            <span style="color:#e65100;">📌 所選帳戶的 <span id="receiveCurrencyDisplay" style="font-weight:bold;">THB</span> 幣種將增加 <span id="receiveAmountDisplay" style="font-weight:bold;color:#e65100;">0.00</span></span>
        </div>
        
        <div class="form-group"><label>備註</label>
            <input type="text" id="rechargeNote" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="請輸入備註">
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitRecharge(${id})">確認充值</button>
        </div>
    `;
    showModal(html);
    
    window.updateRechargeDisplay = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const currency = overlay.querySelector('#rechargeCurrency').value;
        const amount = parseFloat(overlay.querySelector('#rechargeAmount').value) || 0;
        const accountSelect = overlay.querySelector('#rechargeAccount');
        const selectedOption = accountSelect.options[accountSelect.selectedIndex];
        
        const currencyDisplay = document.getElementById('rechargeCurrencyDisplay');
        if (currencyDisplay) currencyDisplay.textContent = currency;
        
        const receiveCurrencyDisplay = document.getElementById('receiveCurrencyDisplay');
        const receiveAmountDisplay = document.getElementById('receiveAmountDisplay');
        if (receiveCurrencyDisplay) receiveCurrencyDisplay.textContent = currency;
        if (receiveAmountDisplay) receiveAmountDisplay.textContent = amount.toFixed(2) + ' ' + currency;
        
        if (selectedOption && selectedOption.value) {
            const balance = parseFloat(selectedOption.dataset.balance || 0);
            const accCurrency = selectedOption.dataset.currency || 'THB';
            const afterBalance = balance + amount;
            const previewDiv = document.getElementById('rechargeTHBDisplay');
            if (previewDiv) {
                if (accCurrency === currency) {
                    previewDiv.innerHTML = `
                        <span style="color:#2e7d32;font-size:14px;">💡 存入後帳戶餘額：</span>
                        <span style="color:#1b5e20;font-size:20px;font-weight:bold;">${afterBalance.toFixed(2)}</span>
                        <span style="color:#2e7d32;font-size:14px;"> ${currency}</span>
                        <div style="font-size:11px;color:#666;margin-top:2px;">當前餘額：${balance.toFixed(2)} ${currency}</div>
                    `;
                } else {
                    previewDiv.innerHTML = `
                        <span style="color:#2e7d32;font-size:14px;">💡 存入後 <strong>${currency}</strong> 帳戶餘額：</span>
                        <span style="color:#1b5e20;font-size:20px;font-weight:bold;">${afterBalance.toFixed(2)}</span>
                        <span style="color:#2e7d32;font-size:14px;"> ${currency}</span>
                        <div style="font-size:11px;color:#666;margin-top:2px;">當前餘額：${balance.toFixed(2)} ${currency}</div>
                    `;
                }
            }
        }
    };
    
    document.getElementById('rechargeCurrency').addEventListener('change', updateRechargeDisplay);
    document.getElementById('rechargeAmount').addEventListener('input', updateRechargeDisplay);
    document.getElementById('rechargeAccount').addEventListener('change', updateRechargeDisplay);
    
    setTimeout(() => {
        if (window.updateRechargeDisplay) window.updateRechargeDisplay();
    }, 50);
}

function submitRecharge(id) {
    // ✅ 檢查充值權限（二次確認）
    if (!checkActionPermission('members', 'recharge')) {
        showPermissionDenied('會員充值');
        return;
    }
    
    const overlay = document.querySelector('.modal-overlay');
    const currency = overlay.querySelector('#rechargeCurrency').value;
    const amount = parseFloat(overlay.querySelector('#rechargeAmount').value);
    if (!amount || amount <= 0) { alert('請輸入有效金額'); return; }
    
    const accountStr = overlay.querySelector('#rechargeAccount').value;
    if (!accountStr) { alert('請選擇收款帳戶'); return; }
    const [accountIdStr, accountCurrency] = accountStr.split('|');
    const accountId = parseInt(accountIdStr);
    if (!accountId) { alert('請選擇有效的收款帳戶'); return; }
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const member = getMember(id);
    
    updateMemberAccountBalance(id, currency, amount);
    
    const memberAccountTx = DB.get('member_account_transactions', []);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: id,
        currency: currency,
        amount: amount,
        type: 'in',
        note: `充值存入 (${currency}: ${amount.toFixed(2)}) - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    const rate = getBuyRate(currency);
    const thbAmount = Math.floor(amount * rate);
    const members = DB.get('members', []);
    const m = members.find(x => x.id === id);
    if (m) {
        m.balance += thbAmount;
        DB.set('members', members);
    }
    
    const account = getAccount(accountId);
    if (account) {
        const accountBalances = account.balances || {};
        if (accountBalances[currency] === undefined) {
            add_account_currency(accountId, currency, 0);
        }
        update_account_balance(accountId, currency, amount);
    }
    
    const accountTx = DB.get('account_transactions', []);
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: accountId,
        currency: currency,
        amount: amount,
        type: 'in',
        reference_type: 'recharge',
        reference_id: id,
        note: `充值 - ${member ? member.name : '未知'} - ${amount} ${currency} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: id,
        type: 'recharge',
        amount: thbAmount,
        note: `充值 - ${amount} ${currency} (≈${thbAmount} 泰銖) - ${member ? member.name : '未知'} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('transactions', transactions);
    
    const recharges = DB.get('recharge_records', []);
    recharges.push({
        id: DB.getNextId('recharge_records'),
        member_id: id,
        amount: amount,
        currency: currency,
        thb_amount: thbAmount,
        receiver: account ? account.name : '未知帳戶',
        note: overlay.querySelector('#rechargeNote').value.trim(),
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('recharge_records', recharges);
    
    addOperationLog('会员管理', '充值', member ? member.name : '未知',
        `会员充值：${member ? member.name : '未知'} - ${amount} ${currency} (≈${thbAmount} 泰銖)`, id);
    
    overlay.remove();
    renderMembers(document.getElementById('mainContent'));
    
    const newBalance = getMemberAccountBalance(id, currency);
    const accountNewBalance = get_account_balance(accountId, currency);
    
    alert(`✅ 充值完成！\n\n` +
        `幣別：${currency}\n` +
        `存入金額：${amount.toFixed(2)} ${currency}\n` +
        `泰銖參考：${thbAmount.toFixed(2)} 泰銖\n` +
        `玩家帳戶餘額：${newBalance.toFixed(2)} ${currency}\n` +
        `往來帳戶餘額：${accountNewBalance.toFixed(2)} ${currency}\n` +
        `操作人：${adminName}`);
}

// ============================================================
// 出金功能（支援多幣種直接扣除）
// ============================================================

function doWithdraw(id) {
    // ✅ 檢查出金權限
    if (!checkActionPermission('members', 'withdraw')) {
        showPermissionDenied('會員出金');
        return;
    }
    
    const member = getMember(id);
    if (!member) return;
    
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    
    const memberAccount = getMemberAccount(id);
    const memberBalances = memberAccount.balances || {};
    
    let totalTHB = 0;
    const balanceDetails = currencies.map(c => {
        const balance = memberBalances[c.currency] || 0;
        const rate = getBuyRate(c.currency);
        const thbValue = balance * rate;
        totalTHB += thbValue;
        return {
            currency: c.currency,
            name: c.name || c.currency,
            balance: balance,
            rate: rate,
            thbValue: thbValue
        };
    });
    
    balanceDetails.sort((a, b) => {
        if (a.currency === 'THB') return -1;
        if (b.currency === 'THB') return 1;
        return a.currency.localeCompare(b.currency);
    });
    
    const availableCurrencies = balanceDetails.filter(d => d.balance > 0);
    
    if (availableCurrencies.length === 0) {
        alert(`玩家 ${member.name} 的所有幣種餘額皆為 0，無法出金`);
        return;
    }
    
    const currencyOptions = availableCurrencies.map(c => 
        `<option value="${c.currency}" ${c.currency === 'THB' ? 'selected' : ''}>${c.currency} (可用：${c.balance.toFixed(2)})</option>`
    ).join('');
    
    let accountOptions = '';
    accounts.forEach(a => {
        const balances = a.balances || {};
        const currencyKeys = Object.keys(balances);
        if (currencyKeys.length === 0) {
            accountOptions += `<option value="${a.id}|THB" data-balance="0" data-currency="THB">${a.name} (THB: 0.00)</option>`;
        } else {
            currencyKeys.forEach(curr => {
                const balance = balances[curr] || 0;
                accountOptions += `<option value="${a.id}|${curr}" data-balance="${balance}" data-currency="${curr}">${a.name} (${curr}: ${balance.toFixed(2)})</option>`;
            });
        }
    });
    
    const html = `
        <div class="modal-title">📤 出金 - ${member.name}</div>
        
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #2196F3, #1565C0);border-radius:8px;text-align:center;">
            <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;">💰 會員帳戶總價值（參考）</div>
            <div style="color:#fff;font-size:28px;font-weight:bold;">${formatNumber(totalTHB)}</div>
            <div style="color:rgba(255,255,255,0.8);font-size:11px;">泰銖（按買入價換算，僅供參考）</div>
        </div>
        
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;text-align:center;border:1px solid #e8e8e8;">
            ${balanceDetails.map((d, index) => {
                const isTHB = d.currency === 'THB';
                const hasBalance = d.balance > 0;
                return `<span style="margin:0 8px;${isTHB ? 'font-weight:bold;color:#1565C0;' : ''}${!hasBalance ? 'color:#ccc;' : ''}">${d.currency}: ${d.balance.toFixed(2)} (≈${d.thbValue.toFixed(2)}泰銖)</span>${index < balanceDetails.length - 1 ? ' | ' : ''}`;
            }).join('')}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>出金幣種 *</label>
                <select id="withdrawCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                    ${currencyOptions}
                </select>
                <div style="font-size:11px;color:#999;margin-top:4px;">可出金金額會以所選幣種扣除</div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>出金金額 *</label>
                <input type="number" id="withdrawAmount" step="0.01" min="0.01" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="請輸入金額">
            </div>
        </div>
        
        <div style="padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;margin-bottom:15px;text-align:center;">
            <span style="color:#1565C0;">💡 將從玩家帳戶扣除 <strong id="withdrawCurrencyDisplay">THB</strong>，<b>不進行即時兌換</b></span>
        </div>
        
        <div class="form-group"><label>支出帳戶（往來帳款）*</label>
            <select id="withdrawPaymentAccount" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                ${accountOptions}
            </select>
        </div>
        
        <div style="margin-bottom:15px;padding:8px 12px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;">
            <span style="color:#e65100;">📌 所選帳戶的 <span id="withdrawPayCurrencyDisplay" style="font-weight:bold;">THB</span> 幣種將減少 <span id="withdrawPayAmountDisplay" style="font-weight:bold;color:#e65100;">0.00</span></span>
        </div>
        
        <div class="form-group"><label>備註</label>
            <input type="text" id="withdrawNote" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="請輸入備註">
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-warning" onclick="submitWithdraw(${id})">確認出金</button>
        </div>
    `;
    const overlay = showModal(html);
    
    window.updateWithdrawDisplay = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const currency = overlay.querySelector('#withdrawCurrency').value;
        const amount = parseFloat(overlay.querySelector('#withdrawAmount').value) || 0;
        const accountSelect = overlay.querySelector('#withdrawPaymentAccount');
        const selectedOption = accountSelect.options[accountSelect.selectedIndex];
        
        const currencyDisplay = document.getElementById('withdrawCurrencyDisplay');
        if (currencyDisplay) currencyDisplay.textContent = currency;
        
        const payCurrencyDisplay = document.getElementById('withdrawPayCurrencyDisplay');
        const payAmountDisplay = document.getElementById('withdrawPayAmountDisplay');
        if (payCurrencyDisplay) payCurrencyDisplay.textContent = currency;
        if (payAmountDisplay) payAmountDisplay.textContent = amount.toFixed(2) + ' ' + currency;
        
        const selectedCurrencyOption = overlay.querySelector('#withdrawCurrency').options[overlay.querySelector('#withdrawCurrency').selectedIndex];
        const balance = parseFloat(selectedCurrencyOption?.text?.match(/可用：([\d.]+)/)?.[1] || 0);
        
        const previewDiv = document.getElementById('withdrawTHBDisplay');
        if (previewDiv) {
            if (amount > balance && amount > 0) {
                previewDiv.innerHTML = `
                    <span style="color:#c62828;font-size:14px;">⚠️ 餘額不足！</span>
                    <span style="color:#c62828;font-size:14px;">當前餘額：${balance.toFixed(2)} ${currency}</span>
                    <span style="color:#c62828;font-size:14px;">需要：${amount.toFixed(2)} ${currency}</span>
                `;
                previewDiv.style.background = '#ffebee';
                previewDiv.style.borderColor = '#ef9a9a';
            } else if (amount > 0) {
                previewDiv.innerHTML = `
                    <span style="color:#2e7d32;font-size:14px;">💡 出金後剩餘：</span>
                    <span style="color:#1b5e20;font-size:20px;font-weight:bold;">${(balance - amount).toFixed(2)}</span>
                    <span style="color:#2e7d32;font-size:14px;"> ${currency}</span>
                    <div style="font-size:11px;color:#666;margin-top:2px;">當前餘額：${balance.toFixed(2)} ${currency}</div>
                `;
                previewDiv.style.background = '#e8f5e9';
                previewDiv.style.borderColor = '#a5d6a7';
            }
        }
        
        if (selectedOption && selectedOption.value) {
            const accBalance = parseFloat(selectedOption.dataset.balance || 0);
            const accCurrency = selectedOption.dataset.currency || 'THB';
            const afterBalance = accBalance - amount;
        }
    };
    
    document.getElementById('withdrawCurrency').addEventListener('change', updateWithdrawDisplay);
    document.getElementById('withdrawAmount').addEventListener('input', updateWithdrawDisplay);
    document.getElementById('withdrawPaymentAccount').addEventListener('change', updateWithdrawDisplay);
    
    setTimeout(() => {
        if (window.updateWithdrawDisplay) window.updateWithdrawDisplay();
    }, 50);
}

function submitWithdraw(id) {
    // ✅ 檢查出金權限（二次確認）
    if (!checkActionPermission('members', 'withdraw')) {
        showPermissionDenied('會員出金');
        return;
    }
    
    const overlay = document.querySelector('.modal-overlay');
    const currency = overlay.querySelector('#withdrawCurrency').value;
    const amount = parseFloat(overlay.querySelector('#withdrawAmount').value);
    if (!amount || amount <= 0) { alert('請輸入有效金額'); return; }
    
    const accountStr = overlay.querySelector('#withdrawPaymentAccount').value;
    if (!accountStr) { alert('請選擇支出帳戶'); return; }
    const [accountIdStr, accountCurrency] = accountStr.split('|');
    const accountId = parseInt(accountIdStr);
    if (!accountId) { alert('請選擇有效的支出帳戶'); return; }
    
    const member = getMember(id);
    if (!member) { alert('會員不存在'); return; }
    
    const currentBalance = getMemberAccountBalance(id, currency);
    if (currentBalance < amount) {
        alert(`${currency} 餘額不足！\n當前餘額：${currentBalance.toFixed(2)}\n需要：${amount.toFixed(2)}`);
        return;
    }
    
    const accountBalance = get_account_balance(accountId, currency);
    if (accountBalance < amount) {
        alert(`帳戶 ${currency} 餘額不足！\n當前餘額：${accountBalance.toFixed(2)}\n需要：${amount.toFixed(2)}`);
        return;
    }
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    updateMemberAccountBalance(id, currency, -amount);
    
    const memberAccountTx = DB.get('member_account_transactions', []);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: id,
        currency: currency,
        amount: amount,
        type: 'out',
        note: `出金扣除 (${currency}: ${amount.toFixed(2)}) - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    const rate = getBuyRate(currency);
    const thbAmount = Math.floor(amount * rate);
    const members = DB.get('members', []);
    const m = members.find(x => x.id === id);
    if (m) {
        m.balance -= thbAmount;
        DB.set('members', members);
    }
    
    update_account_balance(accountId, currency, -amount);
    
    const accountTx = DB.get('account_transactions', []);
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: accountId,
        currency: currency,
        amount: amount,
        type: 'out',
        reference_type: 'withdraw',
        reference_id: id,
        note: `出金 - ${member.name} - ${amount} ${currency} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: id,
        type: 'refund',
        amount: thbAmount,
        note: `出金 - ${amount} ${currency} (≈${thbAmount} 泰銖) - ${member.name} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('transactions', transactions);
    
    const withdraws = DB.get('withdraw_records', []);
    withdraws.push({
        id: DB.getNextId('withdraw_records'),
        member_id: id,
        amount: amount,
        currency: currency,
        thb_amount: thbAmount,
        sender: getAccount(accountId)?.name || '未知帳戶',
        note: overlay.querySelector('#withdrawNote').value.trim(),
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('withdraw_records', withdraws);
    
    addOperationLog('会员管理', '出金', member.name,
        `会员出金：${member.name} - ${amount} ${currency} (≈${thbAmount} 泰銖)`, id);
    
    overlay.remove();
    renderMembers(document.getElementById('mainContent'));
    
    const newBalance = getMemberAccountBalance(id, currency);
    const accountNewBalance = get_account_balance(accountId, currency);
    
    alert(`✅ 出金完成！\n\n` +
        `幣別：${currency}\n` +
        `出金金額：${amount.toFixed(2)} ${currency}\n` +
        `泰銖參考：${thbAmount.toFixed(2)} 泰銖\n` +
        `玩家帳戶餘額：${newBalance.toFixed(2)} ${currency}\n` +
        `往來帳戶餘額：${accountNewBalance.toFixed(2)} ${currency}\n` +
        `操作人：${adminName}`);
}

// ============================================================
// 顯示介紹人搜尋對話框
// ============================================================

function showAgentSearchDialog(callback, currentAgentId) {
    const agents = DB.get('agents', []);
    
    let currentAgent = null;
    if (currentAgentId) {
        currentAgent = agents.find(a => a.id === currentAgentId);
    }
    
    let agentListHtml = '';
    agents.forEach(a => {
        const isSelected = currentAgent && currentAgent.id === a.id;
        const members = DB.get('members', []).filter(m => m.intermediary_id === a.id);
        agentListHtml += `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer;${isSelected ? 'background:#e3f2fd;' : ''}" 
                 onclick="selectAgentFromDialog(${a.id}, '${a.name.replace(/'/g, "\\'")}')">
                <div>
                    <strong>${a.name}</strong>
                    <span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${a.id})</span>
                </div>
                <div style="font-size:12px;color:#666;">
                    👤 ${members.length} 位會員
                    ${a.phone ? ` | 📱 ${a.phone}` : ''}
                </div>
            </div>
        `;
    });
    
    if (agents.length === 0) {
        agentListHtml = `
            <div style="text-align:center;padding:30px;color:#999;">
                📭 暫無介紹人<br>
                <span style="font-size:12px;">請先到「介紹人」頁面新增介紹人</span>
            </div>
        `;
    }
    
    const html = `
        <div class="modal-title" style="font-size:18px;">🔍 搜尋介紹人</div>
        
        <div style="display:flex;gap:10px;margin-bottom:15px;align-items:center;">
            <input type="text" id="agentSearchInput" placeholder="輸入介紹人ID或姓名..." style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') searchAgentInDialog()">
            <button class="btn btn-primary" onclick="searchAgentInDialog()">🔍 搜尋</button>
            <button class="btn" onclick="clearAgentSearchInDialog()">✕ 清除</button>
        </div>
        
        <div id="agentSearchResult" style="margin-bottom:10px;font-size:13px;color:#999;text-align:center;display:none;"></div>
        
        <div style="max-height:300px;overflow-y:auto;border:1px solid #eee;border-radius:6px;">
            ${agentListHtml}
        </div>
        
        ${currentAgent ? `
            <div style="margin-top:10px;padding:8px 12px;background:#e8f5e9;border-radius:6px;border:1px solid #a5d6a7;text-align:center;">
                <span style="color:#2e7d32;">✅ 目前選擇：</span>
                <strong style="color:#1b5e20;">${currentAgent.name}</strong>
                <span style="color:#666;font-size:12px;margin-left:8px;">(ID: ${currentAgent.id})</span>
                <button class="btn btn-sm btn-danger" onclick="clearSelectedAgent()" style="margin-left:10px;">移除</button>
            </div>
        ` : `
            <div style="margin-top:10px;padding:8px 12px;background:#f8f9fc;border-radius:6px;border:1px solid #eee;text-align:center;color:#999;">
                💡 點擊上方列表選擇介紹人，或搜尋後選擇
            </div>
        `}
        
        <div class="modal-actions">
            <button class="btn" onclick="closeAgentSearchDialog()">取消</button>
            <button class="btn btn-primary" onclick="confirmAgentSelection()">✅ 確認選擇</button>
        </div>
    `;
    
    window._agentSearchCallback = callback;
    window._selectedAgentId = currentAgentId || null;
    window._selectedAgentName = currentAgent ? currentAgent.name : '';
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'agentSearchDialog';
    overlay.style.zIndex = '2000';
    overlay.innerHTML = '<div class="modal" style="max-width:550px;">' + html + '</div>';
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            if (window._agentSearchCallback) {
                const currentId = window._selectedAgentId;
                const currentName = window._selectedAgentName;
                if (currentId && currentName) {
                    window._agentSearchCallback(currentId, currentName);
                }
            }
            overlay.remove();
        }
    });
    
    window.searchAgentInDialog = function() {
        const overlayEl = document.querySelector('#agentSearchDialog');
        if (!overlayEl) return;
        
        const input = overlayEl.querySelector('#agentSearchInput');
        const resultDiv = overlayEl.querySelector('#agentSearchResult');
        const listDiv = overlayEl.querySelector('div[style*="max-height:300px"]');
        const keyword = input.value.trim();
        
        if (!keyword) {
            resultDiv.style.display = 'none';
            const agents = DB.get('agents', []);
            let html = '';
            agents.forEach(a => {
                const members = DB.get('members', []).filter(m => m.intermediary_id === a.id);
                const isSelected = window._selectedAgentId === a.id;
                html += `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer;${isSelected ? 'background:#e3f2fd;' : ''}" 
                         onclick="selectAgentFromDialog(${a.id}, '${a.name.replace(/'/g, "\\'")}')">
                        <div>
                            <strong>${a.name}</strong>
                            <span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${a.id})</span>
                        </div>
                        <div style="font-size:12px;color:#666;">
                            👤 ${members.length} 位會員
                            ${a.phone ? ` | 📱 ${a.phone}` : ''}
                        </div>
                    </div>
                `;
            });
            if (agents.length === 0) {
                html = `
                    <div style="text-align:center;padding:30px;color:#999;">
                        📭 暫無介紹人<br>
                        <span style="font-size:12px;">請先到「介紹人」頁面新增介紹人</span>
                    </div>
                `;
            }
            listDiv.innerHTML = html;
            return;
        }
        
        const agents = DB.get('agents', []);
        const isNumeric = /^\d+$/.test(keyword);
        
        const foundAgents = agents.filter(a => {
            const nameMatch = a.name.toLowerCase().includes(keyword.toLowerCase());
            const idMatch = isNumeric && a.id.toString().includes(keyword);
            return nameMatch || idMatch;
        });
        
        if (foundAgents.length === 0) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = '#ff6b6b';
            resultDiv.innerHTML = '❌ 找不到匹配的介紹人，請重新輸入';
            listDiv.innerHTML = '';
            return;
        }
        
        resultDiv.style.display = 'block';
        resultDiv.style.color = '#4CAF50';
        resultDiv.innerHTML = `✅ 找到 ${foundAgents.length} 位介紹人`;
        
        let html = '';
        foundAgents.forEach(a => {
            const members = DB.get('members', []).filter(m => m.intermediary_id === a.id);
            const isSelected = window._selectedAgentId === a.id;
            html += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer;${isSelected ? 'background:#e3f2fd;' : ''}" 
                     onclick="selectAgentFromDialog(${a.id}, '${a.name.replace(/'/g, "\\'")}')">
                    <div>
                        <strong>${a.name}</strong>
                        <span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${a.id})</span>
                    </div>
                    <div style="font-size:12px;color:#666;">
                        👤 ${members.length} 位會員
                        ${a.phone ? ` | 📱 ${a.phone}` : ''}
                    </div>
                </div>
            `;
        });
        listDiv.innerHTML = html;
    };
    
    window.clearAgentSearchInDialog = function() {
        const overlayEl = document.querySelector('#agentSearchDialog');
        if (!overlayEl) return;
        
        const input = overlayEl.querySelector('#agentSearchInput');
        const resultDiv = overlayEl.querySelector('#agentSearchResult');
        input.value = '';
        resultDiv.style.display = 'none';
        const agents = DB.get('agents', []);
        const listDiv = overlayEl.querySelector('div[style*="max-height:300px"]');
        let html = '';
        agents.forEach(a => {
            const members = DB.get('members', []).filter(m => m.intermediary_id === a.id);
            const isSelected = window._selectedAgentId === a.id;
            html += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer;${isSelected ? 'background:#e3f2fd;' : ''}" 
                     onclick="selectAgentFromDialog(${a.id}, '${a.name.replace(/'/g, "\\'")}')">
                    <div>
                        <strong>${a.name}</strong>
                        <span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${a.id})</span>
                    </div>
                    <div style="font-size:12px;color:#666;">
                        👤 ${members.length} 位會員
                        ${a.phone ? ` | 📱 ${a.phone}` : ''}
                    </div>
                </div>
            `;
        });
        if (agents.length === 0) {
            html = `
                <div style="text-align:center;padding:30px;color:#999;">
                    📭 暫無介紹人<br>
                    <span style="font-size:12px;">請先到「介紹人」頁面新增介紹人</span>
                </div>
            `;
        }
        listDiv.innerHTML = html;
    };
    
    window.selectAgentFromDialog = function(id, name) {
        window._selectedAgentId = id;
        window._selectedAgentName = name;
        
        const overlayEl = document.querySelector('#agentSearchDialog');
        if (!overlayEl) return;
        
        const listDiv = overlayEl.querySelector('div[style*="max-height:300px"]');
        const items = listDiv.querySelectorAll('div[style*="cursor:pointer"]');
        items.forEach(item => {
            item.style.background = '';
        });
        const children = listDiv.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.textContent.includes(`(ID: ${id})`)) {
                child.style.background = '#e3f2fd';
                break;
            }
        }
        
        const bottomDiv = overlayEl.querySelector('div[style*="background:#e8f5e9"]') || 
                          overlayEl.querySelector('div[style*="background:#f8f9fc"]');
        if (bottomDiv) {
            bottomDiv.innerHTML = `
                <span style="color:#2e7d32;">✅ 目前選擇：</span>
                <strong style="color:#1b5e20;">${name}</strong>
                <span style="color:#666;font-size:12px;margin-left:8px;">(ID: ${id})</span>
                <button class="btn btn-sm btn-danger" onclick="clearSelectedAgent()" style="margin-left:10px;">移除</button>
            `;
            bottomDiv.style.background = '#e8f5e9';
            bottomDiv.style.border = '1px solid #a5d6a7';
        }
    };
    
    window.clearSelectedAgent = function() {
        window._selectedAgentId = null;
        window._selectedAgentName = '';
        
        const overlayEl = document.querySelector('#agentSearchDialog');
        if (!overlayEl) return;
        
        const bottomDiv = overlayEl.querySelector('div[style*="background:#e8f5e9"]') || 
                          overlayEl.querySelector('div[style*="background:#f8f9fc"]');
        if (bottomDiv) {
            bottomDiv.innerHTML = `
                <span style="color:#999;">💡 點擊上方列表選擇介紹人，或搜尋後選擇</span>
            `;
            bottomDiv.style.background = '#f8f9fc';
            bottomDiv.style.border = '1px solid #eee';
        }
        
        const listDiv = overlayEl.querySelector('div[style*="max-height:300px"]');
        const children = listDiv.children;
        for (let i = 0; i < children.length; i++) {
            children[i].style.background = '';
        }
    };
    
    window.confirmAgentSelection = function() {
        const id = window._selectedAgentId;
        const name = window._selectedAgentName;
        
        if (window._agentSearchCallback) {
            if (id && name) {
                window._agentSearchCallback(id, name);
            } else {
                window._agentSearchCallback(null, '');
            }
        }
        
        const overlayEl = document.querySelector('#agentSearchDialog');
        if (overlayEl) overlayEl.remove();
    };
    
    window.closeAgentSearchDialog = function() {
        const overlayEl = document.querySelector('#agentSearchDialog');
        if (overlayEl) overlayEl.remove();
    };
}

// ============================================================
// 新增會員
// ============================================================

function showAddMember() {
    // ✅ 檢查新增權限
    if (!checkActionPermission('members', 'add')) {
        showPermissionDenied('新增會員');
        return;
    }
    
    const agents = DB.get('agents', []);
    // ★ 移除預選介紹人 - 改為 null
    const currentAgent = null;
    
    const html = `
        <div class="modal-title">📝 新增會員</div>
        <div class="form-group"><label>姓名 *</label><input type="text" id="newMemberName" placeholder="請輸入姓名"></div>
        <div class="form-group"><label>手機</label><input type="text" id="newMemberPhone" placeholder="請輸入手機"></div>
        <div class="form-group"><label>來源</label><input type="text" id="newMemberSource" placeholder="來源"></div>
        <div class="form-group">
            <label>介紹人</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <div id="selectedAgentDisplay" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#f5f5f5;color:#666;min-height:38px;display:flex;align-items:center;">
                    ${currentAgent ? `<span style="color:#2196F3;font-weight:bold;">${currentAgent.name}</span><span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${currentAgent.id})</span>` : '未選擇介紹人'}
                </div>
                <button class="btn btn-primary btn-sm" onclick="openAgentSearchDialogForAdd()">🔍 搜尋</button>
                ${currentAgent ? `<button class="btn btn-danger btn-sm" onclick="clearAddAgentSelection()">✕</button>` : ''}
            </div>
            <input type="hidden" id="newMemberAgent" value="${currentAgent ? currentAgent.id : ''}">
            <div style="font-size:11px;color:#999;margin-top:4px;">💡 點擊「搜尋」按鈕可透過ID或姓名尋找介紹人</div>
        </div>
        <div class="form-group"><label>備註</label><input type="text" id="newMemberRemark"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddMember()">確認新增</button>
        </div>
    `;
    const overlay = showModal(html);
    
    // ★ 初始化為 null（無預選介紹人）
    window._addAgentId = null;
    window._addAgentName = '';
    
    window.openAgentSearchDialogForAdd = function() {
        showAgentSearchDialog(function(agentId, agentName) {
            window._addAgentId = agentId;
            window._addAgentName = agentName || '';
            
            const displayDiv = document.getElementById('selectedAgentDisplay');
            const hiddenInput = document.getElementById('newMemberAgent');
            
            if (agentId && agentName) {
                displayDiv.innerHTML = `<span style="color:#2196F3;font-weight:bold;">${agentName}</span><span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${agentId})</span>`;
                hiddenInput.value = agentId;
                const btnGroup = displayDiv.parentElement;
                if (!btnGroup.querySelector('.btn-danger')) {
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'btn btn-danger btn-sm';
                    removeBtn.textContent = '✕';
                    removeBtn.onclick = clearAddAgentSelection;
                    btnGroup.appendChild(removeBtn);
                }
            } else {
                displayDiv.innerHTML = '未選擇介紹人';
                hiddenInput.value = '';
                const removeBtn = displayDiv.parentElement.querySelector('.btn-danger');
                if (removeBtn) removeBtn.remove();
            }
        }, window._addAgentId);
    };
    
    window.clearAddAgentSelection = function() {
        window._addAgentId = null;
        window._addAgentName = '';
        const displayDiv = document.getElementById('selectedAgentDisplay');
        const hiddenInput = document.getElementById('newMemberAgent');
        displayDiv.innerHTML = '未選擇介紹人';
        hiddenInput.value = '';
        const removeBtn = displayDiv.parentElement.querySelector('.btn-danger');
        if (removeBtn) removeBtn.remove();
    };
}

function submitAddMember() {
    const overlay = document.querySelector('.modal-overlay');
    const name = overlay.querySelector('#newMemberName').value.trim();
    if (!name) { alert('请输入姓名'); return; }
    
    const members = DB.get('members', []);
    const memberId = DB.getNextId('members');
    const agentId = parseInt(overlay.querySelector('#newMemberAgent').value) || null;
    
    if (agentId) {
        const agent = getAgent(agentId);
        if (!agent) {
            alert('選擇的介紹人不存在，請重新搜尋');
            return;
        }
    }
    
    const newMember = {
        id: memberId,
        name: name,
        phone: overlay.querySelector('#newMemberPhone').value.trim(),
        source: overlay.querySelector('#newMemberSource').value.trim(),
        intermediary_id: agentId,
        balance: 0,
        unpaid_loan: 0,
        remark: overlay.querySelector('#newMemberRemark').value.trim()
    };
    members.push(newMember);
    DB.set('members', members);
    
    const memberAccounts = DB.get('member_accounts', []);
    memberAccounts.push({
        member_id: memberId,
        balances: {
            THB: 0,
            CNY: 0,
            USD: 0,
            LAK: 0,
            USDT: 0
        }
    });
    DB.set('member_accounts', memberAccounts);
    
    addOperationLog('会员管理', '新增', name, `新增会员：${name} (ID: ${memberId})${agentId ? ' - 介绍人：' + (getAgent(agentId)?.name || '') : ''}`, memberId);
    
    overlay.remove();
    renderMembers(document.getElementById('mainContent'));
    alert(`✅ 会员已新增\n\n${agentId ? '介绍人：' + (getAgent(agentId)?.name || '') : '無介紹人'}`);
}

// ============================================================
// 修改會員
// ============================================================

function showEditMember(id) {
    // ✅ 檢查修改權限
    if (!checkActionPermission('members', 'edit')) {
        showPermissionDenied('修改會員');
        return;
    }
    
    const member = getMember(id);
    if (!member) return;
    const agents = DB.get('agents', []);
    const currentAgent = agents.find(a => a.id === member.intermediary_id) || null;
    
    const html = `
        <div class="modal-title">✏️ 修改会员 - ${member.name}</div>
        <div class="form-group"><label>姓名</label><input type="text" id="editMemberName" value="${member.name}"></div>
        <div class="form-group"><label>手机</label><input type="text" id="editMemberPhone" value="${member.phone || ''}"></div>
        <div class="form-group"><label>来源</label><input type="text" id="editMemberSource" value="${member.source || ''}"></div>
        <div class="form-group">
            <label>介绍人</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <div id="editSelectedAgentDisplay" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#f5f5f5;color:#666;min-height:38px;display:flex;align-items:center;">
                    ${currentAgent ? `<span style="color:#2196F3;font-weight:bold;">${currentAgent.name}</span><span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${currentAgent.id})</span>` : '未選擇介紹人'}
                </div>
                <button class="btn btn-primary btn-sm" onclick="openAgentSearchDialogForEdit()">🔍 搜尋</button>
                ${currentAgent ? `<button class="btn btn-danger btn-sm" onclick="clearEditAgentSelection()">✕</button>` : ''}
            </div>
            <input type="hidden" id="editMemberAgent" value="${currentAgent ? currentAgent.id : ''}">
            <div style="font-size:11px;color:#999;margin-top:4px;">💡 點擊「搜尋」按鈕可透過ID或姓名尋找介紹人</div>
        </div>
        <div class="form-group"><label>备注</label><input type="text" id="editMemberRemark" value="${member.remark || ''}"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitEditMember(${id})">确认修改</button>
        </div>
    `;
    const overlay = showModal(html);
    
    window._editAgentId = currentAgent ? currentAgent.id : null;
    window._editAgentName = currentAgent ? currentAgent.name : '';
    
    window.openAgentSearchDialogForEdit = function() {
        showAgentSearchDialog(function(agentId, agentName) {
            window._editAgentId = agentId;
            window._editAgentName = agentName || '';
            
            const displayDiv = document.getElementById('editSelectedAgentDisplay');
            const hiddenInput = document.getElementById('editMemberAgent');
            
            if (agentId && agentName) {
                displayDiv.innerHTML = `<span style="color:#2196F3;font-weight:bold;">${agentName}</span><span style="font-size:12px;color:#999;margin-left:8px;">(ID: ${agentId})</span>`;
                hiddenInput.value = agentId;
                const btnGroup = displayDiv.parentElement;
                if (!btnGroup.querySelector('.btn-danger')) {
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'btn btn-danger btn-sm';
                    removeBtn.textContent = '✕';
                    removeBtn.onclick = clearEditAgentSelection;
                    btnGroup.appendChild(removeBtn);
                }
            } else {
                displayDiv.innerHTML = '未選擇介紹人';
                hiddenInput.value = '';
                const removeBtn = displayDiv.parentElement.querySelector('.btn-danger');
                if (removeBtn) removeBtn.remove();
            }
        }, window._editAgentId);
    };
    
    window.clearEditAgentSelection = function() {
        window._editAgentId = null;
        window._editAgentName = '';
        const displayDiv = document.getElementById('editSelectedAgentDisplay');
        const hiddenInput = document.getElementById('editMemberAgent');
        displayDiv.innerHTML = '未選擇介紹人';
        hiddenInput.value = '';
        const removeBtn = displayDiv.parentElement.querySelector('.btn-danger');
        if (removeBtn) removeBtn.remove();
    };
}

function submitEditMember(id) {
    const overlay = document.querySelector('.modal-overlay');
    const name = overlay.querySelector('#editMemberName').value.trim();
    if (!name) { alert('请输入姓名'); return; }
    
    const members = DB.get('members', []);
    const m = members.find(x => x.id === id);
    if (m) {
        const beforeData = { ...m };
        let changes = [];
        
        const newAgentId = parseInt(overlay.querySelector('#editMemberAgent').value) || null;
        
        if (newAgentId) {
            const agent = getAgent(newAgentId);
            if (!agent) {
                alert('選擇的介紹人不存在，請重新搜尋');
                return;
            }
        }
        
        if (name !== m.name) changes.push('姓名');
        const phone = overlay.querySelector('#editMemberPhone').value.trim();
        if (phone !== m.phone) changes.push('手机');
        const source = overlay.querySelector('#editMemberSource').value.trim();
        if (source !== m.source) changes.push('来源');
        if (newAgentId !== m.intermediary_id) {
            changes.push('介绍人');
        }
        const remark = overlay.querySelector('#editMemberRemark').value.trim();
        if (remark !== m.remark) changes.push('备注');
        
        m.name = name;
        m.phone = phone;
        m.source = source;
        m.intermediary_id = newAgentId;
        m.remark = remark;
        DB.set('members', members);
        
        if (changes.length > 0) {
            const agent = getAgent(newAgentId);
            addOperationLog('会员管理', '修改', m.name, 
                `修改会员：${m.name} (ID: ${id}) - 修改字段：${changes.join('、')}${agent ? ' - 介绍人：' + agent.name : ''}`, id, beforeData, m);
        }
    }
    overlay.remove();
    renderMembers(document.getElementById('mainContent'));
    const agent = getAgent(m.intermediary_id);
    alert(`✅ 会员已更新\n\n${agent ? '介绍人：' + agent.name : '無介紹人'}`);
}

// ============================================================
// 刪除會員
// ============================================================

function deleteMember(id) {
    // ✅ 檢查刪除權限
    if (!checkActionPermission('members', 'delete')) {
        showPermissionDenied('刪除會員');
        return;
    }
    
    const member = getMember(id);
    if (!member) return;
    if (!confirm(`确定要删除会员「${member.name}」吗？`)) return;
    
    const members = DB.get('members', []).filter(m => m.id !== id);
    DB.set('members', members);
    
    const memberAccounts = DB.get('member_accounts', []).filter(ma => ma.member_id !== id);
    DB.set('member_accounts', memberAccounts);
    
    addOperationLog('会员管理', '删除', member.name, `删除会员：${member.name} (ID: ${id})`, id, member, null);
    
    renderMembers(document.getElementById('mainContent'));
    alert('✅ 会员已删除');
}

// ============================================================
// 辅助函数
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

function closeModal(overlay) {
    if (overlay) overlay.remove();
}