// ============================================================
// 6. 往来账款（完整版 - 支援幣種管理 + 入金/出金 + 權限控制）
// ============================================================

// ============================================================
// 渲染往来账款頁面
// ============================================================

function renderAccounts(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('accounts', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>📒 往来账款</h1>
                <p class="breadcrumb">营运管理 > 往来账款</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「往来账款」的权限</p>
            </div>
        `;
        return;
    }
    
    const accounts = DB.get('accounts', []);
    const accountTx = DB.get('account_transactions', []);
    const currencies = DB.get('currencies', []);
    
    // 獲取當前選中的賬戶ID（用於右側顯示）
    const selectedAccountId = window._selectedAccountId || null;
    
    // 獲取時段查詢參數
    const searchDateStart = document.getElementById('accountDateStart')?.value || '';
    const searchDateEnd = document.getElementById('accountDateEnd')?.value || '';
    
    // 獲取選中賬戶的詳細信息
    let selectedAccount = null;
    let selectedTx = [];
    let selectedBalances = {};
    
    if (selectedAccountId) {
        selectedAccount = getAccount(selectedAccountId);
        if (selectedAccount) {
            selectedBalances = selectedAccount.balances || {};
            selectedTx = accountTx.filter(t => t.account_id === selectedAccountId);
            
            // 按時間過濾（時段查詢）
            if (searchDateStart && searchDateEnd) {
                selectedTx = selectedTx.filter(t => {
                    if (!t.created_at) return false;
                    const dateStr = t.created_at.split(' ')[0];
                    return dateStr >= searchDateStart && dateStr <= searchDateEnd;
                });
            } else if (searchDateStart) {
                selectedTx = selectedTx.filter(t => {
                    if (!t.created_at) return false;
                    return t.created_at.startsWith(searchDateStart);
                });
            }
            
            selectedTx.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
    }
    
    // 計算時段統計
    let totalIn = 0;
    let totalOut = 0;
    let totalNet = 0;
    const currencyStats = {};
    
    selectedTx.forEach(t => {
        const curr = t.currency || 'THB';
        if (!currencyStats[curr]) {
            currencyStats[curr] = { in: 0, out: 0, net: 0 };
        }
        if (t.type === 'in') {
            currencyStats[curr].in += t.amount;
            totalIn += t.amount;
        } else {
            currencyStats[curr].out += t.amount;
            totalOut += t.amount;
        }
        currencyStats[curr].net = currencyStats[curr].in - currencyStats[curr].out;
    });
    totalNet = totalIn - totalOut;
    
    // 幣種統計HTML
    let currencyStatsHtml = '';
    const currencyKeys = Object.keys(currencyStats);
    if (currencyKeys.length > 0) {
        currencyStatsHtml = currencyKeys.map(curr => {
            const data = currencyStats[curr];
            const netColor = data.net >= 0 ? '#4CAF50' : '#ff6b6b';
            return `
                <div style="background:#f8f9fc;padding:8px 12px;border-radius:6px;text-align:center;border:1px solid #eee;">
                    <div style="font-weight:bold;font-size:14px;color:#333;">${curr}</div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;">
                        <span style="color:#4CAF50;">+${data.in.toFixed(2)}</span>
                        <span style="color:#ff6b6b;">-${data.out.toFixed(2)}</span>
                        <span style="color:${netColor};font-weight:bold;">${data.net >= 0 ? '+' : ''}${data.net.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 構建幣種下拉選項（用於新增幣種）
    const allCurrencyOptions = currencies.map(c => 
        `<option value="${c.currency}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    // 檢查選中帳戶是否已有某幣種
    const existingCurrencies = selectedAccount ? Object.keys(selectedAccount.balances || {}) : [];
    
    // 可新增的幣種（所有幣種中尚未在該帳戶中的）
    const availableCurrencies = currencies.filter(c => !existingCurrencies.includes(c.currency));
    
    // ✅ 檢查各操作權限
    const canAddAccount = checkActionPermission('accounts', 'add_account');
    const canDeleteAccount = checkActionPermission('accounts', 'delete_account');
    const canAddCurrency = checkActionPermission('accounts', 'add_currency');
    const canRemoveCurrency = checkActionPermission('accounts', 'remove_currency');
    const canDeposit = checkActionPermission('accounts', 'deposit');
    const canWithdraw = checkActionPermission('accounts', 'withdraw');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>📒 往来账款</h1>
            <p class="breadcrumb">营运管理 > 往来账款</p>
        </div>
        <div class="toolbar">
            ${canAddAccount ? `<button class="btn btn-primary" onclick="showAddAccount()">➕ 新增账户</button>` : ''}
            <button class="btn" onclick="renderAccounts(document.getElementById('mainContent'))">🔄 刷新</button>
        </div>
        
        <!-- 時段查詢工具欄 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <span style="font-weight:500;font-size:13px;color:#555;">📅 查詢時段：</span>
            <input type="date" id="accountDateStart" value="${searchDateStart}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
            <span style="color:#999;">～</span>
            <input type="date" id="accountDateEnd" value="${searchDateEnd}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
            <button class="btn btn-primary" onclick="renderAccounts(document.getElementById('mainContent'))">🔍 查詢</button>
            <button class="btn" onclick="document.getElementById('accountDateStart').value='';document.getElementById('accountDateEnd').value='';renderAccounts(document.getElementById('mainContent'))">✕ 清除</button>
            <button class="btn" onclick="document.getElementById('accountDateStart').value='${today()}';document.getElementById('accountDateEnd').value='${today()}';renderAccounts(document.getElementById('mainContent'))">📅 今天</button>
            <span style="font-size:12px;color:#999;margin-left:auto;">
                ${searchDateStart && searchDateEnd ? `📅 ${searchDateStart} ~ ${searchDateEnd}` : searchDateStart ? `📅 ${searchDateStart}` : '全部時段'}
                ${selectedAccount ? ` | 帳戶：${selectedAccount.name}` : ''}
            </span>
        </div>
        
        <div class="flex-grid">
            <div class="table-container">
                <h3 style="padding:12px 15px;margin:0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                    <span>📋 账户列表</span>
                    <span style="font-size:12px;color:#999;font-weight:normal;">共 ${accounts.length} 個帳戶</span>
                </h3>
                <table>
                    <thead><tr><th>ID</th><th>名称</th><th>币种</th><th>操作</th></tr></thead>
                    <tbody>
                        ${accounts.length === 0 ? '<tr class="empty-row"><td colspan="4">暂无账户</td></tr>' :
                        accounts.map(a => {
                            const currenciesList = Object.keys(a.balances || {}).join(', ');
                            const isSelected = selectedAccountId === a.id;
                            return `<tr style="${isSelected ? 'background:#e3f2fd;' : ''}">
                                <td><strong>${a.id}</strong></td>
                                <td><strong>${a.name}</strong></td>
                                <td>${currenciesList || '-'}</td>
                                <td>
                                    <button class="btn btn-primary btn-sm" onclick="selectAccount(${a.id})">📊 详情</button>
                                    ${canDeleteAccount ? `<button class="btn btn-danger btn-sm" onclick="deleteAccount(${a.id})">删除</button>` : ''}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div>
                <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:20px;min-height:400px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:15px;">
                        <h3 id="accountDetailTitle" style="margin:0;">📊 ${selectedAccount ? selectedAccount.name : '账户详情'}</h3>
                        ${selectedAccount ? `<button class="btn btn-sm" onclick="window._selectedAccountId=null;document.getElementById('accountDateStart').value='';document.getElementById('accountDateEnd').value='';renderAccounts(document.getElementById('mainContent'))">✕ 关闭</button>` : ''}
                    </div>
                    
                    ${selectedAccount ? `
                        <!-- 账户基本信息 -->
                        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:8px;">
                            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;">
                                <div><strong>名称：</strong>${selectedAccount.name}</div>
                                <div><strong>描述：</strong>${selectedAccount.description || '-'}</div>
                                <div><strong>创建时间：</strong>${selectedAccount.created_at ? formatDate(selectedAccount.created_at) : '-'}</div>
                                <div><strong>幣種數：</strong>${existingCurrencies.length}</div>
                            </div>
                            ${searchDateStart && searchDateEnd ? `<div style="margin-top:4px;color:#2196F3;font-size:12px;">📅 查詢時段：${searchDateStart} ~ ${searchDateEnd}</div>` : ''}
                        </div>
                        
                        <!-- 幣種管理 -->
                        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;border:1px solid #90caf9;">
                            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                                <span style="font-weight:bold;color:#0d47a1;">💱 幣種管理</span>
                                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                                    ${canAddCurrency ? `
                                        <select id="addCurrencySelect" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                                            <option value="">選擇幣種</option>
                                            ${availableCurrencies.map(c => 
                                                `<option value="${c.currency}">${c.currency} (${c.name || c.currency})</option>`
                                            ).join('')}
                                            ${availableCurrencies.length === 0 ? '<option value="">⚠️ 無可新增幣種</option>' : ''}
                                        </select>
                                        <button class="btn btn-success btn-sm" onclick="addCurrencyToAccount(${selectedAccount.id})">➕ 新增幣種</button>
                                    ` : ''}
                                    ${canRemoveCurrency ? `
                                        <select id="removeCurrencySelect" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                                            <option value="">選擇幣種</option>
                                            ${existingCurrencies.map(curr => 
                                                `<option value="${curr}">${curr}</option>`
                                            ).join('')}
                                            ${existingCurrencies.length === 0 ? '<option value="">⚠️ 無幣種可移除</option>' : ''}
                                        </select>
                                        <button class="btn btn-danger btn-sm" onclick="removeCurrencyFromAccount(${selectedAccount.id})">🗑️ 移除幣種</button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <!-- 入金/出金操作 -->
                        <div style="margin-bottom:15px;padding:12px;background:#fff8e1;border-radius:8px;border:1px solid #ffcc80;">
                            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                                <span style="font-weight:bold;color:#e65100;">💵 帳戶操作</span>
                                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                    ${canDeposit ? `<button class="btn btn-success btn-sm" onclick="showAccountDeposit(${selectedAccount.id})">📥 入金</button>` : ''}
                                    ${canWithdraw ? `<button class="btn btn-danger btn-sm" onclick="showAccountWithdraw(${selectedAccount.id})">📤 出金</button>` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <!-- 币种余额 -->
                        <h4 style="margin-bottom:10px;">💰 币种余额</h4>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:15px;">
                            ${Object.entries(selectedBalances).length === 0 ? 
                                '<div style="grid-column:1/-1;text-align:center;color:#999;padding:10px;">暂无币种余额</div>' :
                                Object.entries(selectedBalances).map(([currency, balance]) => `
                                    <div style="background:${balance >= 0 ? '#e3f2fd' : '#ffebee'};padding:12px;border-radius:8px;text-align:center;border:1px solid ${balance >= 0 ? '#90caf9' : '#ef9a9a'};">
                                        <div style="font-weight:bold;font-size:16px;color:#333;">${currency}</div>
                                        <div style="font-size:20px;font-weight:bold;color:${balance >= 0 ? '#2196F3' : '#ff6b6b'};">${balance.toFixed(2)}</div>
                                    </div>
                                `).join('')
                            }
                        </div>
                        
                        <!-- 時段統計摘要 -->
                        ${selectedTx.length > 0 ? `
                            <h4 style="margin-bottom:10px;">📊 時段統計</h4>
                            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px;">
                                <div style="background:#e8f5e9;padding:10px;border-radius:8px;text-align:center;border:1px solid #a5d6a7;">
                                    <div style="font-size:11px;color:#888;">📥 總存入</div>
                                    <div style="font-size:18px;font-weight:bold;color:#2e7d32;">${totalIn.toFixed(2)}</div>
                                </div>
                                <div style="background:#ffebee;padding:10px;border-radius:8px;text-align:center;border:1px solid #ef9a9a;">
                                    <div style="font-size:11px;color:#888;">📤 總支出</div>
                                    <div style="font-size:18px;font-weight:bold;color:#c62828;">${totalOut.toFixed(2)}</div>
                                </div>
                                <div style="background:${totalNet >= 0 ? '#e8f5e9' : '#ffebee'};padding:10px;border-radius:8px;text-align:center;border:1px solid ${totalNet >= 0 ? '#a5d6a7' : '#ef9a9a'};">
                                    <div style="font-size:11px;color:#888;">📊 淨額</div>
                                    <div style="font-size:18px;font-weight:bold;color:${totalNet >= 0 ? '#2e7d32' : '#c62828'};">${totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)}</div>
                                </div>
                            </div>
                            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px;">
                                ${currencyStatsHtml}
                            </div>
                        ` : ''}
                        
                        <!-- 交易记录 -->
                        <h4 style="margin-bottom:10px;">📋 交易记录 
                            <span style="font-size:12px;color:#999;font-weight:normal;">
                                ${searchDateStart && searchDateEnd ? `(${searchDateStart} ~ ${searchDateEnd})` : ''}
                                ${selectedTx.length > 0 ? `共 ${selectedTx.length} 筆` : ''}
                            </span>
                        </h4>
                        <div style="max-height:350px;overflow-y:auto;border:1px solid #eee;border-radius:6px;">
                            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                                <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">时间</th>
                                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">币种</th>
                                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:right;">金额</th>
                                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">类型</th>
                                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">操作人</th>
                                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">备注</th>
                                </tr></thead>
                                <tbody>
                                    ${selectedTx.length === 0 ? 
                                        `<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">
                                            ${searchDateStart || searchDateEnd ? '該時段暫無交易記錄' : '暫無交易記錄'}
                                        </td></tr>` :
                                    selectedTx.slice(0, 100).map(t => `
                                        <tr>
                                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;">${formatDate(t.created_at)}</td>
                                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;">${t.currency}</td>
                                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:right;color:${t.type === 'in' ? '#4CAF50' : '#ff6b6b'};font-weight:bold;">${t.type === 'in' ? '+' : '-'}${t.amount.toFixed(2)}</td>
                                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;"><span class="badge ${t.type === 'in' ? 'badge-success' : 'badge-danger'}">${t.type === 'in' ? '📥 存入' : '📤 支出'}</span></td>
                                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${t.admin_name || '系统'}</td>
                                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#888;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.note || '-'}">${t.note || '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ${selectedTx.length > 100 ? `<div style="text-align:center;padding:6px;font-size:12px;color:#999;border-top:1px solid #eee;">共 ${selectedTx.length} 筆交易，僅顯示最近100筆</div>` : ''}
                        ${selectedTx.length === 0 && (searchDateStart || searchDateEnd) ? 
                            `<div style="text-align:center;padding:10px;font-size:12px;color:#999;">💡 提示：可調整查詢時段以查看更多記錄</div>` : ''}
                    ` : `
                        <p style="color:#999;font-size:14px;text-align:center;padding:40px 0;">👈 请点击「详情」查看账户信息</p>
                        <p style="color:#ccc;font-size:12px;text-align:center;">選擇帳戶後可管理幣種、入金/出金及查詢交易記錄</p>
                    `}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// 選擇帳戶（點擊詳情按鈕時調用）
// ============================================================

function selectAccount(id) {
    window._selectedAccountId = id;
    renderAccounts(document.getElementById('mainContent'));
}

// ============================================================
// 顯示賬戶詳情
// ============================================================

function showAccountDetail(id) {
    selectAccount(id);
}

// ============================================================
// 新增賬戶 - 含權限檢查
// ============================================================

function showAddAccount() {
    // ✅ 檢查新增賬戶權限
    if (!checkActionPermission('accounts', 'add_account')) {
        showPermissionDenied('新增賬戶');
        return;
    }
    
    const html = `
        <div class="modal-title">📒 新增账户</div>
        <div class="form-group"><label>账户名称 *</label><input type="text" id="newAccountName"></div>
        <div class="form-group"><label>描述</label><input type="text" id="newAccountDesc"></div>
        <div class="form-group"><label>初始币种</label>
            <select id="newAccountCurrency"><option value="THB">THB</option><option value="CNY">CNY</option><option value="USD">USD</option><option value="LAK">LAK</option><option value="USDT">USDT</option></select>
        </div>
        <div class="form-group"><label>初始余额</label><input type="number" id="newAccountBalance" value="0" step="0.01"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddAccount()">确认新增</button>
        </div>
    `;
    showModal(html);
}

function submitAddAccount() {
    const overlay = document.querySelector('.modal-overlay');
    const name = overlay.querySelector('#newAccountName').value.trim();
    if (!name) { alert('请输入账户名称'); return; }
    
    const accounts = DB.get('accounts', []);
    const currency = overlay.querySelector('#newAccountCurrency').value;
    const balance = parseFloat(overlay.querySelector('#newAccountBalance').value) || 0;
    
    const newAccount = {
        id: DB.getNextId('accounts'),
        name: name,
        description: overlay.querySelector('#newAccountDesc').value.trim(),
        balances: { [currency]: balance },
        created_at: now()
    };
    accounts.push(newAccount);
    DB.set('accounts', accounts);
    
    addOperationLog('往来账款', '新增帳戶', name, `新增帳戶：${name} (初始幣種：${currency}，初始餘額：${balance})`, newAccount.id);
    
    overlay.remove();
    renderAccounts(document.getElementById('mainContent'));
    alert('✅ 账户已新增');
}

// ============================================================
// 刪除賬戶 - 含權限檢查
// ============================================================

function deleteAccount(id) {
    // ✅ 檢查刪除賬戶權限
    if (!checkActionPermission('accounts', 'delete_account')) {
        showPermissionDenied('刪除賬戶');
        return;
    }
    
    const account = getAccount(id);
    if (!account) return;
    if (!confirm(`确定要删除账户「${account.name}」吗？`)) return;
    
    const balances = account.balances || {};
    const hasBalance = Object.values(balances).some(b => b !== 0);
    if (hasBalance) {
        if (!confirm(`⚠️ 帳戶「${account.name}」尚有餘額，刪除將遺失這些餘額。\n確定要刪除嗎？`)) {
            return;
        }
    }
    
    const accounts = DB.get('accounts', []).filter(a => a.id !== id);
    DB.set('accounts', accounts);
    
    addOperationLog('往来账款', '刪除帳戶', account.name, `刪除帳戶：${account.name}`, id);
    
    if (window._selectedAccountId === id) {
        window._selectedAccountId = null;
    }
    
    renderAccounts(document.getElementById('mainContent'));
    alert('✅ 账户已删除');
}

// ============================================================
// 幣種管理功能 - 含權限檢查
// ============================================================

function addCurrencyToAccount(accountId) {
    // ✅ 檢查新增幣種權限
    if (!checkActionPermission('accounts', 'add_currency')) {
        showPermissionDenied('新增幣種');
        return;
    }
    
    const select = document.getElementById('addCurrencySelect');
    const currency = select.value;
    if (!currency) {
        alert('請選擇要新增的幣種');
        return;
    }
    
    const account = getAccount(accountId);
    if (!account) {
        alert('帳戶不存在');
        return;
    }
    
    if (account.balances && account.balances[currency] !== undefined) {
        alert(`帳戶「${account.name}」已有 ${currency} 幣種`);
        return;
    }
    
    if (!account.balances) {
        account.balances = {};
    }
    account.balances[currency] = 0;
    
    const accounts = DB.get('accounts', []);
    const index = accounts.findIndex(a => a.id === accountId);
    if (index !== -1) {
        accounts[index] = account;
        DB.set('accounts', accounts);
    }
    
    addOperationLog('往来账款', '新增幣種', account.name, `帳戶「${account.name}」新增幣種：${currency}`, accountId);
    
    renderAccounts(document.getElementById('mainContent'));
    alert(`✅ 已為帳戶「${account.name}」新增 ${currency} 幣種`);
}

function removeCurrencyFromAccount(accountId) {
    // ✅ 檢查移除幣種權限
    if (!checkActionPermission('accounts', 'remove_currency')) {
        showPermissionDenied('移除幣種');
        return;
    }
    
    const select = document.getElementById('removeCurrencySelect');
    const currency = select.value;
    if (!currency) {
        alert('請選擇要移除的幣種');
        return;
    }
    
    const account = getAccount(accountId);
    if (!account) {
        alert('帳戶不存在');
        return;
    }
    
    const balance = account.balances && account.balances[currency] !== undefined ? account.balances[currency] : 0;
    if (balance !== 0) {
        if (!confirm(`⚠️ ${currency} 尚有餘額 ${balance.toFixed(2)}，移除將遺失這些餘額。\n確定要移除嗎？`)) {
            return;
        }
    }
    
    delete account.balances[currency];
    
    const accounts = DB.get('accounts', []);
    const index = accounts.findIndex(a => a.id === accountId);
    if (index !== -1) {
        accounts[index] = account;
        DB.set('accounts', accounts);
    }
    
    addOperationLog('往来账款', '移除幣種', account.name, `帳戶「${account.name}」移除幣種：${currency}`, accountId);
    
    renderAccounts(document.getElementById('mainContent'));
    alert(`✅ 已從帳戶「${account.name}」移除 ${currency} 幣種`);
}

// ============================================================
// 入金功能 - 含權限檢查
// ============================================================

function showAccountDeposit(accountId) {
    // ✅ 檢查入金權限
    if (!checkActionPermission('accounts', 'deposit')) {
        showPermissionDenied('賬戶入金');
        return;
    }
    
    const account = getAccount(accountId);
    if (!account) {
        alert('帳戶不存在');
        return;
    }
    
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    const balances = account.balances || {};
    
    const existingCurrencies = Object.keys(balances);
    if (existingCurrencies.length === 0) {
        alert(`⚠️ 帳戶「${account.name}」尚無任何幣種，請先新增幣種`);
        return;
    }
    
    const currencyOptions = existingCurrencies.map(curr => 
        `<option value="${curr}">${curr} (目前餘額：${(balances[curr] || 0).toFixed(2)})</option>`
    ).join('');
    
    const accountOptions = accounts
        .filter(a => a.id !== accountId)
        .map(a => {
            const bal = a.balances || {};
            const balDisplay = Object.entries(bal)
                .filter(([_, b]) => b !== 0)
                .map(([c, b]) => `${c}: ${b.toFixed(2)}`)
                .join(' | ');
            return `<option value="${a.id}">${a.name} ${balDisplay ? '(' + balDisplay + ')' : ''}</option>`;
        }).join('');
    
    const html = `
        <div class="modal-title">📥 入金 - ${account.name}</div>
        <div style="margin-bottom:15px;padding:12px;background:#e8f5e9;border-radius:8px;border:1px solid #a5d6a7;text-align:center;">
            <span style="color:#2e7d32;">💡 選擇幣種和金額存入此帳戶</span>
        </div>
        
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><strong>帳戶名稱：</strong>${account.name}</div>
                <div><strong>現有幣種：</strong>${existingCurrencies.join(', ')}</div>
            </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>幣種 *</label>
                <select id="depositCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onchange="updateDepositPreview()">
                    ${currencyOptions}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>金額 *</label>
                <input type="number" id="depositAmount" step="0.01" min="0.01" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" oninput="updateDepositPreview()" placeholder="請輸入金額">
            </div>
        </div>
        
        <div style="margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;display:none;" id="depositPreview">
            <span style="color:#e65100;">💡 入金後帳戶餘額：<strong id="depositAfterBalance">0.00</strong> <span id="depositCurrencyDisplay">-</span></span>
        </div>
        
        <div class="form-group">
            <label>來源（可選）</label>
            <select id="depositSource" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                <option value="">無（現金入金）</option>
                ${accountOptions}
            </select>
        </div>
        
        <div class="form-group">
            <label>備註</label>
            <input type="text" id="depositNote" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="請輸入備註">
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitAccountDeposit(${accountId})">✅ 確認入金</button>
        </div>
    `;
    showModal(html);
    
    window.updateDepositPreview = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const currency = overlay.querySelector('#depositCurrency').value;
        const amount = parseFloat(overlay.querySelector('#depositAmount').value) || 0;
        const previewDiv = document.getElementById('depositPreview');
        const afterBalanceSpan = document.getElementById('depositAfterBalance');
        const currencyDisplay = document.getElementById('depositCurrencyDisplay');
        
        const account = getAccount(accountId);
        if (account && account.balances) {
            const currentBalance = account.balances[currency] || 0;
            const afterBalance = currentBalance + amount;
            if (amount > 0) {
                previewDiv.style.display = 'block';
                afterBalanceSpan.textContent = afterBalance.toFixed(2);
                afterBalanceSpan.style.color = afterBalance >= 0 ? '#2e7d32' : '#c62828';
                currencyDisplay.textContent = currency;
            } else {
                previewDiv.style.display = 'none';
            }
        }
    };
    
    document.getElementById('depositCurrency').addEventListener('change', updateDepositPreview);
    document.getElementById('depositAmount').addEventListener('input', updateDepositPreview);
    
    setTimeout(() => {
        if (window.updateDepositPreview) window.updateDepositPreview();
    }, 50);
}

function submitAccountDeposit(accountId) {
    const overlay = document.querySelector('.modal-overlay');
    const currency = overlay.querySelector('#depositCurrency').value;
    const amount = parseFloat(overlay.querySelector('#depositAmount').value);
    const sourceAccountId = overlay.querySelector('#depositSource').value;
    const note = overlay.querySelector('#depositNote').value.trim() || '';
    
    if (!currency) {
        alert('請選擇幣種');
        return;
    }
    if (!amount || amount <= 0) {
        alert('請輸入有效金額');
        return;
    }
    
    const account = getAccount(accountId);
    if (!account) {
        alert('帳戶不存在');
        return;
    }
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    update_account_balance(accountId, currency, amount);
    
    const accountTx = DB.get('account_transactions', []);
    const sourceInfo = sourceAccountId ? `來源帳戶：${getAccount(parseInt(sourceAccountId))?.name || ''}` : '現金入金';
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: accountId,
        currency: currency,
        amount: amount,
        type: 'in',
        reference_type: 'deposit',
        reference_id: null,
        note: `入金 - ${account.name} - ${amount} ${currency} - ${sourceInfo}${note ? ' - ' + note : ''} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    
    if (sourceAccountId) {
        const sourceId = parseInt(sourceAccountId);
        const sourceAccount = getAccount(sourceId);
        if (sourceAccount) {
            const sourceBalance = sourceAccount.balances && sourceAccount.balances[currency] !== undefined ? sourceAccount.balances[currency] : 0;
            if (sourceBalance >= amount) {
                update_account_balance(sourceId, currency, -amount);
                accountTx.push({
                    id: DB.getNextId('account_transactions'),
                    account_id: sourceId,
                    currency: currency,
                    amount: amount,
                    type: 'out',
                    reference_type: 'deposit_transfer',
                    reference_id: accountId,
                    note: `轉帳出金 - ${sourceAccount.name} → ${account.name} - ${amount} ${currency} - 操作人：${adminName}`,
                    admin_id: adminId,
                    admin_name: adminName,
                    created_at: now()
                });
                DB.set('account_transactions', accountTx);
            } else {
                alert(`⚠️ 來源帳戶 ${currency} 餘額不足！\n當前餘額：${sourceBalance.toFixed(2)}\n需要：${amount.toFixed(2)}`);
            }
        }
    }
    
    addOperationLog('往来账款', '入金', account.name, 
        `入金 ${account.name} - ${amount} ${currency}${sourceAccountId ? ' (來源：' + getAccount(parseInt(sourceAccountId))?.name + ')' : ' (現金)'}`, accountId);
    
    overlay.remove();
    renderAccounts(document.getElementById('mainContent'));
    
    const newBalance = get_account_balance(accountId, currency);
    alert(`✅ 入金完成！\n\n帳戶：${account.name}\n幣種：${currency}\n金額：+${amount.toFixed(2)}\n入金後餘額：${newBalance.toFixed(2)} ${currency}\n${sourceAccountId ? '來源帳戶：' + getAccount(parseInt(sourceAccountId))?.name : '來源：現金'}\n操作人：${adminName}`);
}

// ============================================================
// 出金功能 - 含權限檢查
// ============================================================

function showAccountWithdraw(accountId) {
    // ✅ 檢查出金權限
    if (!checkActionPermission('accounts', 'withdraw')) {
        showPermissionDenied('賬戶出金');
        return;
    }
    
    const account = getAccount(accountId);
    if (!account) {
        alert('帳戶不存在');
        return;
    }
    
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    const balances = account.balances || {};
    
    const availableCurrencies = Object.keys(balances).filter(curr => balances[curr] > 0);
    if (availableCurrencies.length === 0) {
        alert(`⚠️ 帳戶「${account.name}」所有幣種餘額皆為 0，無法出金`);
        return;
    }
    
    const currencyOptions = availableCurrencies.map(curr => 
        `<option value="${curr}">${curr} (目前餘額：${(balances[curr] || 0).toFixed(2)})</option>`
    ).join('');
    
    const accountOptions = accounts
        .filter(a => a.id !== accountId)
        .map(a => {
            const bal = a.balances || {};
            const balDisplay = Object.entries(bal)
                .filter(([_, b]) => b !== 0)
                .map(([c, b]) => `${c}: ${b.toFixed(2)}`)
                .join(' | ');
            return `<option value="${a.id}">${a.name} ${balDisplay ? '(' + balDisplay + ')' : ''}</option>`;
        }).join('');
    
    const html = `
        <div class="modal-title">📤 出金 - ${account.name}</div>
        <div style="margin-bottom:15px;padding:12px;background:#ffebee;border-radius:8px;border:1px solid #ef9a9a;text-align:center;">
            <span style="color:#c62828;">💡 選擇幣種和金額從此帳戶提出</span>
        </div>
        
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><strong>帳戶名稱：</strong>${account.name}</div>
                <div><strong>可出金幣種：</strong>${availableCurrencies.join(', ')}</div>
            </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>幣種 *</label>
                <select id="withdrawCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onchange="updateWithdrawPreview()">
                    ${currencyOptions}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>金額 *</label>
                <input type="number" id="withdrawAmount" step="0.01" min="0.01" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" oninput="updateWithdrawPreview()" placeholder="請輸入金額">
            </div>
        </div>
        
        <div style="margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;display:none;" id="withdrawPreview">
            <span style="color:#e65100;">💡 出金後帳戶餘額：<strong id="withdrawAfterBalance">0.00</strong> <span id="withdrawCurrencyDisplay">-</span></span>
        </div>
        
        <div class="form-group">
            <label>目的地（可選）</label>
            <select id="withdrawDestination" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                <option value="">無（現金出金）</option>
                ${accountOptions}
            </select>
        </div>
        
        <div class="form-group">
            <label>備註</label>
            <input type="text" id="withdrawNote" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="請輸入備註">
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-danger" onclick="submitAccountWithdraw(${accountId})">✅ 確認出金</button>
        </div>
    `;
    showModal(html);
    
    window.updateWithdrawPreview = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const currency = overlay.querySelector('#withdrawCurrency').value;
        const amount = parseFloat(overlay.querySelector('#withdrawAmount').value) || 0;
        const previewDiv = document.getElementById('withdrawPreview');
        const afterBalanceSpan = document.getElementById('withdrawAfterBalance');
        const currencyDisplay = document.getElementById('withdrawCurrencyDisplay');
        
        const account = getAccount(accountId);
        if (account && account.balances) {
            const currentBalance = account.balances[currency] || 0;
            const afterBalance = currentBalance - amount;
            if (amount > 0) {
                previewDiv.style.display = 'block';
                afterBalanceSpan.textContent = afterBalance.toFixed(2);
                afterBalanceSpan.style.color = afterBalance >= 0 ? '#2e7d32' : '#c62828';
                currencyDisplay.textContent = currency;
            } else {
                previewDiv.style.display = 'none';
            }
        }
    };
    
    document.getElementById('withdrawCurrency').addEventListener('change', updateWithdrawPreview);
    document.getElementById('withdrawAmount').addEventListener('input', updateWithdrawPreview);
    
    setTimeout(() => {
        if (window.updateWithdrawPreview) window.updateWithdrawPreview();
    }, 50);
}

function submitAccountWithdraw(accountId) {
    const overlay = document.querySelector('.modal-overlay');
    const currency = overlay.querySelector('#withdrawCurrency').value;
    const amount = parseFloat(overlay.querySelector('#withdrawAmount').value);
    const destinationAccountId = overlay.querySelector('#withdrawDestination').value;
    const note = overlay.querySelector('#withdrawNote').value.trim() || '';
    
    if (!currency) {
        alert('請選擇幣種');
        return;
    }
    if (!amount || amount <= 0) {
        alert('請輸入有效金額');
        return;
    }
    
    const account = getAccount(accountId);
    if (!account) {
        alert('帳戶不存在');
        return;
    }
    
    const currentBalance = get_account_balance(accountId, currency);
    if (currentBalance < amount) {
        alert(`${currency} 餘額不足！\n當前餘額：${currentBalance.toFixed(2)}\n需要：${amount.toFixed(2)}`);
        return;
    }
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    update_account_balance(accountId, currency, -amount);
    
    const accountTx = DB.get('account_transactions', []);
    const destInfo = destinationAccountId ? `目的地帳戶：${getAccount(parseInt(destinationAccountId))?.name || ''}` : '現金出金';
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: accountId,
        currency: currency,
        amount: amount,
        type: 'out',
        reference_type: 'withdraw',
        reference_id: null,
        note: `出金 - ${account.name} - ${amount} ${currency} - ${destInfo}${note ? ' - ' + note : ''} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    
    if (destinationAccountId) {
        const destId = parseInt(destinationAccountId);
        const destAccount = getAccount(destId);
        if (destAccount) {
            if (destAccount.balances && destAccount.balances[currency] === undefined) {
                destAccount.balances[currency] = 0;
                const accounts = DB.get('accounts', []);
                const idx = accounts.findIndex(a => a.id === destId);
                if (idx !== -1) {
                    accounts[idx] = destAccount;
                    DB.set('accounts', accounts);
                }
            }
            update_account_balance(destId, currency, amount);
            accountTx.push({
                id: DB.getNextId('account_transactions'),
                account_id: destId,
                currency: currency,
                amount: amount,
                type: 'in',
                reference_type: 'withdraw_transfer',
                reference_id: accountId,
                note: `轉帳入金 - ${account.name} → ${destAccount.name} - ${amount} ${currency} - 操作人：${adminName}`,
                admin_id: adminId,
                admin_name: adminName,
                created_at: now()
            });
            DB.set('account_transactions', accountTx);
        }
    }
    
    addOperationLog('往来账款', '出金', account.name, 
        `出金 ${account.name} - ${amount} ${currency}${destinationAccountId ? ' (目的地：' + getAccount(parseInt(destinationAccountId))?.name + ')' : ' (現金)'}`, accountId);
    
    overlay.remove();
    renderAccounts(document.getElementById('mainContent'));
    
    const newBalance = get_account_balance(accountId, currency);
    alert(`✅ 出金完成！\n\n帳戶：${account.name}\n幣種：${currency}\n金額：-${amount.toFixed(2)}\n出金後餘額：${newBalance.toFixed(2)} ${currency}\n${destinationAccountId ? '目的地帳戶：' + getAccount(parseInt(destinationAccountId))?.name : '目的地：現金'}\n操作人：${adminName}`);
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

function getCurrencyRate(currency) {
    const currencies = DB.get('currencies', []);
    const found = currencies.find(c => c.currency === currency);
    return found ? found.rate : 1;
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
