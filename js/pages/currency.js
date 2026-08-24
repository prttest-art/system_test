// ============================================================
// 8. 币种汇率（买入价 / 卖出价 + 權限控制）
// ============================================================

// ============================================================
// 渲染币种汇率頁面 - 含權限檢查
// ============================================================

function renderCurrency(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('currency', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>💱 币种汇率设定</h1>
                <p class="breadcrumb">营运管理 > 币种汇率</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「币种汇率」的权限</p>
            </div>
        `;
        return;
    }
    
    const currencies = DB.get('currencies', []);
    
    // ✅ 檢查各操作權限
    const canUpdate = checkActionPermission('currency', 'update');
    const canAdd = checkActionPermission('currency', 'add');
    const canDelete = checkActionPermission('currency', 'delete');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>💱 币种汇率设定</h1>
            <p class="breadcrumb">营运管理 > 币种汇率</p>
        </div>
        <div style="margin-bottom:20px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;font-size:14px;">
            <span style="color:#1565C0;">💡 <strong>买入价</strong> = 外币→泰铢（玩家存入/充值） | <strong>卖出价</strong> = 泰铢→外币（玩家出金/换币）</span>
            <br><span style="color:#1565C0;font-size:12px;">买入价通常低于卖出价，差额为系统汇差收益</span>
        </div>
        <div class="table-container">
            <table>
                <thead><tr>
                    <th>币种</th>
                    <th>名称</th>
                    <th>买入价 (外币→泰铢)</th>
                    <th>卖出价 (泰铢→外币)</th>
                    <th>汇差</th>
                    <th>操作</th>
                </tr></thead>
                <tbody>
                    ${currencies.map(c => {
                        const spread = c.sell_rate - c.buy_rate;
                        const spreadPercent = c.buy_rate > 0 ? (spread / c.buy_rate * 100) : 0;
                        const isTHB = c.currency === 'THB';
                        return `
                        <tr>
                            <td><strong>${c.currency}</strong></td>
                            <td>${c.name || c.currency}</td>
                            <td>
                                ${canUpdate ? `
                                    <input type="number" id="buy_rate_${c.currency}" value="${c.buy_rate}" step="0.0001" min="0.0001" style="width:120px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;" ${isTHB ? 'readonly style="background:#f5f5f5;"' : ''}>
                                ` : `
                                    <span style="font-weight:bold;color:#2196F3;">${c.buy_rate.toFixed(4)}</span>
                                `}
                            </td>
                            <td>
                                ${canUpdate ? `
                                    <input type="number" id="sell_rate_${c.currency}" value="${c.sell_rate}" step="0.0001" min="0.0001" style="width:120px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;" ${isTHB ? 'readonly style="background:#f5f5f5;"' : ''}>
                                ` : `
                                    <span style="font-weight:bold;color:#ff6b6b;">${c.sell_rate.toFixed(4)}</span>
                                `}
                            </td>
                            <td style="color:${spread > 0 ? '#4CAF50' : '#ff6b6b'};font-weight:bold;">
                                ${spread.toFixed(4)} 
                                <span style="font-size:11px;color:#888;">(${spreadPercent.toFixed(2)}%)</span>
                            </td>
                            <td>
                                ${canUpdate && !isTHB ? `<button class="btn btn-primary btn-sm" onclick="updateCurrency('${c.currency}')">更新</button>` : ''}
                                ${canUpdate && isTHB ? `<span style="color:#999;font-size:11px;">不可修改</span>` : ''}
                                ${!canUpdate ? `<span style="color:#999;font-size:11px;">無權限</span>` : ''}
                                ${canDelete && !isTHB ? `<button class="btn btn-danger btn-sm" onclick="deleteCurrency('${c.currency}')">删除</button>` : ''}
                                ${canDelete && isTHB ? '' : ''}
                                ${!canDelete && !isTHB ? '' : ''}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top:20px;padding:20px;background:#fff;border-radius:10px;border:1px solid #eee;">
            <h3>➕ 新增币种</h3>
            ${canAdd ? `
                <div style="display:flex;gap:15px;flex-wrap:wrap;margin-top:10px;align-items:end;">
                    <div>
                        <label style="font-size:12px;color:#888;">币种代码</label>
                        <input type="text" id="newCurrencyCode" placeholder="例如: EUR" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;width:120px;">
                    </div>
                    <div>
                        <label style="font-size:12px;color:#888;">买入价 (→泰铢)</label>
                        <input type="number" id="newCurrencyBuyRate" placeholder="买入价" step="0.0001" min="0.0001" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;width:150px;">
                    </div>
                    <div>
                        <label style="font-size:12px;color:#888;">卖出价 (泰铢→)</label>
                        <input type="number" id="newCurrencySellRate" placeholder="卖出价" step="0.0001" min="0.0001" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;width:150px;">
                    </div>
                    <button class="btn btn-primary" onclick="addCurrency()">新增</button>
                </div>
                <div style="margin-top:8px;font-size:12px;color:#999;">
                    💡 买入价应低于卖出价，否则系统会亏损
                </div>
            ` : `
                <div style="padding:15px;background:#f8f9fc;border-radius:6px;text-align:center;color:#999;">
                    ⛔ 您没有新增币种的权限
                </div>
            `}
        </div>
    `;
}

// ============================================================
// 更新汇率 - 含權限檢查
// ============================================================

function updateCurrency(currency) {
    // ✅ 檢查更新匯率權限
    if (!checkActionPermission('currency', 'update')) {
        showPermissionDenied('更新匯率');
        return;
    }
    
    if (currency === 'THB') {
        alert('泰铢汇率固定为 1，不可修改');
        return;
    }
    
    const buyRate = parseFloat(document.getElementById('buy_rate_' + currency).value);
    const sellRate = parseFloat(document.getElementById('sell_rate_' + currency).value);
    
    if (!buyRate || buyRate <= 0) { alert('请输入有效的买入价'); return; }
    if (!sellRate || sellRate <= 0) { alert('请输入有效的卖出价'); return; }
    if (buyRate >= sellRate) {
        if (!confirm(`⚠️ 买入价 (${buyRate}) 大于等于卖出价 (${sellRate})，系统将无法赚取汇差。\n确定要继续吗？`)) {
            return;
        }
    }
    
    const currencies = DB.get('currencies', []);
    const c = currencies.find(x => x.currency === currency);
    if (c) {
        const beforeData = { ...c };
        c.buy_rate = buyRate;
        c.sell_rate = sellRate;
        c.rate = (buyRate + sellRate) / 2;
        DB.set('currencies', currencies);
        
        addOperationLog('币种汇率', '修改', currency, `更新 ${currency} 汇率：买入 ${buyRate}，卖出 ${sellRate}，汇差 ${(sellRate - buyRate).toFixed(4)}`, null, beforeData, c);
        
        alert(`✅ ${currency} 汇率已更新\n买入价：${buyRate}\n卖出价：${sellRate}\n汇差：${(sellRate - buyRate).toFixed(4)}`);
        renderCurrency(document.getElementById('mainContent'));
    }
}

// ============================================================
// 删除币种 - 含權限檢查
// ============================================================

function deleteCurrency(currency) {
    // ✅ 檢查刪除幣種權限
    if (!checkActionPermission('currency', 'delete')) {
        showPermissionDenied('刪除幣種');
        return;
    }
    
    if (currency === 'THB') {
        alert('不能删除泰铢');
        return;
    }
    
    // 檢查是否有會員帳戶使用該幣種
    const members = DB.get('members', []);
    const memberAccounts = DB.get('member_accounts', []);
    let isUsed = false;
    let usedCount = 0;
    
    memberAccounts.forEach(ma => {
        if (ma.balances && ma.balances[currency] !== undefined && ma.balances[currency] !== 0) {
            isUsed = true;
            usedCount++;
        }
    });
    
    if (isUsed) {
        if (!confirm(`⚠️ 有 ${usedCount} 位會員的帳戶含有 ${currency} 餘額，刪除幣種將遺失這些餘額。\n確定要刪除嗎？`)) {
            return;
        }
    }
    
    if (!confirm(`确定要删除 ${currency} 吗？`)) return;
    
    const currencies = DB.get('currencies', []).filter(c => c.currency !== currency);
    DB.set('currencies', currencies);
    
    addOperationLog('币种汇率', '删除', currency, `删除币种：${currency}`);
    
    renderCurrency(document.getElementById('mainContent'));
    alert('✅ 已删除');
}

// ============================================================
// 新增币种 - 含權限檢查
// ============================================================

function addCurrency() {
    // ✅ 檢查新增幣種權限
    if (!checkActionPermission('currency', 'add')) {
        showPermissionDenied('新增幣種');
        return;
    }
    
    const code = document.getElementById('newCurrencyCode').value.trim().toUpperCase();
    const buyRate = parseFloat(document.getElementById('newCurrencyBuyRate').value);
    const sellRate = parseFloat(document.getElementById('newCurrencySellRate').value);
    
    if (!code) { alert('请输入币种代码'); return; }
    if (code.length > 10) { alert('币种代码不能超过10个字符'); return; }
    if (!buyRate || buyRate <= 0) { alert('请输入有效的买入价'); return; }
    if (!sellRate || sellRate <= 0) { alert('请输入有效的卖出价'); return; }
    if (buyRate >= sellRate) {
        if (!confirm(`⚠️ 买入价 (${buyRate}) 大于等于卖出价 (${sellRate})，系统将无法赚取汇差。\n确定要继续吗？`)) {
            return;
        }
    }
    
    const currencies = DB.get('currencies', []);
    if (currencies.find(c => c.currency === code)) {
        alert('币种已存在');
        return;
    }
    
    currencies.push({ 
        currency: code, 
        name: code, 
        buy_rate: buyRate, 
        sell_rate: sellRate,
        rate: (buyRate + sellRate) / 2
    });
    DB.set('currencies', currencies);
    
    addOperationLog('币种汇率', '新增', code, `新增币种：${code} (买入 ${buyRate}，卖出 ${sellRate}，汇差 ${(sellRate - buyRate).toFixed(4)})`);
    
    document.getElementById('newCurrencyCode').value = '';
    document.getElementById('newCurrencyBuyRate').value = '';
    document.getElementById('newCurrencySellRate').value = '';
    renderCurrency(document.getElementById('mainContent'));
    alert('✅ 已新增');
}

// ============================================================
// 輔助函數（供其他頁面使用）
// ============================================================

// 獲取所有幣種
function get_all_currencies() {
    return DB.get('currencies', []);
}

// 獲取單一幣種匯率資訊
function get_currency_rate_info(currency) {
    const currencies = DB.get('currencies', []);
    return currencies.find(c => c.currency === currency);
}

// 更新幣種匯率（供其他頁面調用）
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

// 新增幣種（供其他頁面調用）
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

// 刪除幣種（供其他頁面調用）
function delete_currency(currency) {
    if (currency === 'THB') return false;
    const currencies = DB.get('currencies', []).filter(c => c.currency !== currency);
    DB.set('currencies', currencies);
    addOperationLog('币种汇率', '删除', currency, `删除币种：${currency}`);
    return true;
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