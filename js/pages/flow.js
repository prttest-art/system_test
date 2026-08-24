// ============================================================
// 4. 流水（支援日期及會員編號查詢 + 顯示換幣記錄 + 時段查詢 + 權限控制）
// ============================================================

// ============================================================
// 渲染流水頁面
// ============================================================

function renderFlow(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('flow', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>💳 充值/退费/借款流水</h1>
                <p class="breadcrumb">营运管理 > 充值/退费/借款流水</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「充值/退费/借款流水」的权限</p>
            </div>
        `;
        return;
    }
    
    const transactions = DB.get('transactions', []);
    const members = DB.get('members', []);
    const admins = getAdmins();
    const accounts = DB.get('accounts', []);
    const rechargeRecords = DB.get('recharge_records', []);
    const withdrawRecords = DB.get('withdraw_records', []);
    const upRecords = DB.get('up_records', []);
    const sessions = DB.get('sessions', []);
    const exchangeRecords = DB.get('exchange_records', []);
    
    const typeMap = { 
        recharge: '充值', 
        refund: '出金', 
        loan: '借款', 
        repay: '还款', 
        rebate: '返点',
        exchange: '換幣'  // ← 確保有這個
    };
    const colorMap = { 
        recharge: '#4CAF50', 
        repay: '#4CAF50', 
        refund: '#ff6b6b', 
        loan: '#ff6b6b', 
        rebate: '#26c6da',
        exchange: '#9C27B0'  // ← 紫色顯示換幣
    };
    
    // 獲取查詢參數
    const todayStr = new Date().toISOString().split('T')[0];
    const searchDate = document.getElementById('flowDateSearch')?.value || '';
    const searchDateStart = document.getElementById('flowDateStart')?.value || '';
    const searchDateEnd = document.getElementById('flowDateEnd')?.value || '';
    const searchMemberId = document.getElementById('flowMemberSearch')?.value || '';
    const searchMemberInput = document.getElementById('flowMemberInput')?.value || '';
    
    // ===== 建立所有流水記錄（合併交易 + 換幣） =====
    let allFlowRecords = [];
    
    // 1. 加入交易記錄
    transactions.forEach(t => {
        allFlowRecords.push({
            ...t,
            _type: 'transaction',
            display_type: typeMap[t.type] || t.type,
            display_time: t.created_at,
            display_amount: t.amount,
            display_currency: 'THB',
            display_note: t.note || '',
            display_member_id: t.member_id,
            display_admin_name: t.admin_name || '系统',
            display_color: colorMap[t.type] || '#333'
        });
    });
    
    // 2. 加入換幣記錄
    exchangeRecords.forEach(e => {
        const member = members.find(m => m.id === e.member_id);
        const memberName = member ? member.name : (e.member_name || '未知');
        
        let directionLabel = '';
        if (e.direction === 'buy') {
            directionLabel = '外币→泰铢';
        } else if (e.direction === 'sell') {
            directionLabel = '泰铢→外币';
        } else if (e.direction === 'cross') {
            directionLabel = '外币→外币';
        }
        
        const exchangeNote = `換幣：${e.from_amount} ${e.from_currency} → ${e.to_amount} ${e.to_currency} (${directionLabel})`;
        const fullNote = e.note ? `${exchangeNote} - ${e.note}` : exchangeNote;
        
        allFlowRecords.push({
            id: e.id,
            _type: 'exchange',
            display_type: '換幣',
            display_time: e.created_at,
            display_amount: e.from_amount,
            display_currency: e.from_currency,
            display_to_amount: e.to_amount,
            display_to_currency: e.to_currency,
            display_direction: e.direction,
            display_direction_label: directionLabel,
            display_note: fullNote,
            display_member_id: e.member_id,
            display_member_name: memberName,
            display_admin_name: e.admin_name || '系统',
            display_color: '#2196F3',
            display_buy_rate: e.buy_rate,
            display_sell_rate: e.sell_rate,
            display_table_type: e.table_type || '会员账户'
        });
    });
    
    // ===== 過濾記錄 =====
    let filteredRecords = allFlowRecords.slice().reverse();
    
    // 按時段過濾（優先使用時段查詢）
    if (searchDateStart && searchDateEnd) {
        filteredRecords = filteredRecords.filter(r => {
            if (!r.display_time) return false;
            const dateStr = r.display_time.split(' ')[0];
            return dateStr >= searchDateStart && dateStr <= searchDateEnd;
        });
    } else if (searchDateStart) {
        filteredRecords = filteredRecords.filter(r => {
            if (!r.display_time) return false;
            return r.display_time.startsWith(searchDateStart);
        });
    } else if (searchDate) {
        filteredRecords = filteredRecords.filter(r => {
            if (!r.display_time) return false;
            return r.display_time.startsWith(searchDate);
        });
    }
    
    // 按會員過濾
    let targetMemberId = searchMemberId;
    if (!targetMemberId && searchMemberInput) {
        const foundMember = members.find(m => 
            m.id.toString() === searchMemberInput || 
            m.name.includes(searchMemberInput)
        );
        if (foundMember) {
            targetMemberId = foundMember.id.toString();
        }
    }
    
    if (targetMemberId) {
        const memberId = parseInt(targetMemberId);
        filteredRecords = filteredRecords.filter(r => r.display_member_id === memberId);
    }
    
    // 只顯示最近200筆
    filteredRecords = filteredRecords.slice(0, 200);
    
    // 生成會員下拉選單選項
    const memberOptions = members.map(m => 
        `<option value="${m.id}">${m.id}. ${m.name}</option>`
    ).join('');
    
    // 顯示當前查詢的會員名稱
    let currentMemberName = '';
    if (targetMemberId) {
        const found = members.find(m => m.id === parseInt(targetMemberId));
        if (found) currentMemberName = found.name;
    }
    
    // 建立帳戶名稱映射（往來帳款）
    const accountMap = {};
    accounts.forEach(a => {
        accountMap[a.id] = a.name;
    });
    
    // 計算統計
    let totalRecharge = 0;
    let totalRefund = 0;
    let totalLoan = 0;
    let totalRepay = 0;
    let totalRebate = 0;
    let totalExchange = 0;
    
    filteredRecords.forEach(r => {
        if (r._type === 'exchange') {
            totalExchange += r.display_amount;
        } else if (r.type === 'recharge') {
            totalRecharge += r.display_amount;
        } else if (r.type === 'refund') {
            totalRefund += r.display_amount;
        } else if (r.type === 'loan') {
            totalLoan += r.display_amount;
        } else if (r.type === 'repay') {
            totalRepay += r.display_amount;
        } else if (r.type === 'rebate') {
            totalRebate += r.display_amount;
        }
    });
    
    // 構建表格行
    let tableRows = '';
    if (filteredRecords.length === 0) {
        tableRows = '<tr class="empty-row"><td colspan="8">暫無交易或換幣記錄</td></tr>';
    } else {
        tableRows = filteredRecords.map(r => {
            let memberName = '';
            if (r.display_member_id) {
                const member = members.find(m => m.id === r.display_member_id);
                memberName = member ? member.name : (r.display_member_name || '未知');
            } else {
                memberName = '系统';
            }
            
            // 查找管理員
            const admin = admins.find(a => a.id === r.admin_id);
            const adminName = r.display_admin_name || (admin ? (admin.display_name || admin.username) : '系统');
            
            // 根據記錄類型顯示不同內容
            let amountDisplay = '';
            let noteDisplay = '';
            let extraInfo = '';
            
            if (r._type === 'exchange') {
                // 換幣記錄顯示
                amountDisplay = `<span style="color:#ff6b6b;">-${r.display_amount.toFixed(2)} ${r.display_currency}</span> → <span style="color:#4CAF50;">+${r.display_to_amount.toFixed(2)} ${r.display_to_currency}</span>`;
                noteDisplay = r.display_note || '-';
                extraInfo = `<span style="font-size:11px;color:#888;">💰 ${r.display_table_type || '会员账户'}</span>`;
            } else {
                // 交易記錄顯示
                amountDisplay = `<span style="color:${r.display_color};font-weight:bold;">${r.display_amount.toFixed(2)}</span>`;
                noteDisplay = (r.display_note && r.display_note.trim()) ? r.display_note.trim() : '無';
                
                // 查找相關帳戶資訊
                let accountInfo = '-';
                let accountCurrency = '';
                let accountAmount = '';
                
                if (r.type === 'recharge') {
                    const rechargeRecord = rechargeRecords.find(rec => 
                        rec.member_id === r.display_member_id && 
                        Math.abs(rec.thb_amount - r.display_amount) < 0.01 &&
                        rec.created_at === r.display_time
                    );
                    if (rechargeRecord && rechargeRecord.receiver) {
                        const matchedAccount = accounts.find(a => 
                            rechargeRecord.receiver.includes(a.name)
                        );
                        if (matchedAccount) {
                            accountInfo = `📥 ${rechargeRecord.receiver}`;
                            accountCurrency = rechargeRecord.currency || 'THB';
                            accountAmount = rechargeRecord.amount || 0;
                        }
                    }
                } else if (r.type === 'refund') {
                    const withdrawRecord = withdrawRecords.find(rec => 
                        rec.member_id === r.display_member_id && 
                        Math.abs(rec.thb_amount - r.display_amount) < 0.01 &&
                        rec.created_at === r.display_time
                    );
                    if (withdrawRecord && withdrawRecord.sender) {
                        const matchedAccount = accounts.find(a => 
                            withdrawRecord.sender.includes(a.name)
                        );
                        if (matchedAccount) {
                            accountInfo = `📤 ${withdrawRecord.sender}`;
                            accountCurrency = withdrawRecord.currency || 'THB';
                            accountAmount = withdrawRecord.amount || 0;
                        }
                    }
                }
                
                if (accountCurrency && accountAmount) {
                    extraInfo = `<span style="font-size:11px;color:#888;">${accountInfo} (${accountCurrency}: ${accountAmount.toFixed(2)})</span>`;
                } else if (r.type === 'loan' || r.type === 'repay') {
                    extraInfo = '<span style="font-size:11px;color:#888;">💵 现金</span>';
                } else if (r.type === 'rebate') {
                    extraInfo = '<span style="font-size:11px;color:#888;">🔄 返点</span>';
                }
            }
            
            // 類型標籤
            let typeBadge = '';
            if (r._type === 'exchange') {
                typeBadge = `<span class="badge badge-info" style="background:#e3f2fd;color:#0d47a1;">🔄 換幣</span>`;
            } else {
                const typeName = typeMap[r.type] || r.type;
                const isSuccess = r.type === 'recharge' || r.type === 'repay';
                typeBadge = `<span class="badge ${isSuccess ? 'badge-success' : 'badge-danger'}">${typeName}</span>`;
            }
            
            return `<tr>
                <td style="font-size:12px;white-space:nowrap;">${formatDate(r.display_time)}</td>
                <td><strong>${memberName}</strong></td>
                <td>${typeBadge}</td>
                <td style="font-weight:bold;">${amountDisplay}</td>
                <td style="font-size:12px;color:#555;">${extraInfo}</td>
                <td style="font-size:12px;color:${noteDisplay === '無' ? '#999' : '#333'};max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${noteDisplay}">${noteDisplay}</td>
                <td style="font-size:12px;color:#666;">${adminName}</td>
            </tr>`;
        }).join('');
    }
    
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
    
    el.innerHTML = `
        <div class="page-header">
            <h1>💳 充值/退费/借款流水</h1>
            <p class="breadcrumb">营运管理 > 充值/退费/借款流水</p>
        </div>
        
        <!-- 查詢工具列 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;">
            <!-- 第一排：時段查詢 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding-bottom:10px;border-bottom:1px solid #f0f0f0;margin-bottom:10px;">
                <span style="font-weight:500;font-size:13px;color:#555;">📅 時段查詢：</span>
                <input type="date" id="flowDateStart" value="${searchDateStart}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <span style="color:#999;">～</span>
                <input type="date" id="flowDateEnd" value="${searchDateEnd}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <button class="btn btn-primary" onclick="renderFlow(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('flowDateStart').value='';document.getElementById('flowDateEnd').value='';document.getElementById('flowDateSearch').value='';renderFlow(document.getElementById('mainContent'))">✕ 清除</button>
                <button class="btn" onclick="document.getElementById('flowDateStart').value='${todayStr}';document.getElementById('flowDateEnd').value='${todayStr}';document.getElementById('flowDateSearch').value='';renderFlow(document.getElementById('mainContent'))">📅 今天</button>
                <button class="btn" onclick="document.getElementById('flowDateStart').value='';document.getElementById('flowDateEnd').value='';document.getElementById('flowDateSearch').value='${todayStr}';renderFlow(document.getElementById('mainContent'))">📅 單日</button>
                <span style="font-size:12px;color:#999;margin-left:auto;">${timeRangeLabel}</span>
            </div>
            
            <!-- 第二排：會員查詢 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                <span style="font-weight:500;font-size:13px;color:#555;">👤 會員查詢：</span>
                <input type="text" id="flowMemberInput" placeholder="輸入會員ID或姓名" value="${searchMemberInput}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:150px;" onkeydown="if(event.key==='Enter') renderFlow(document.getElementById('mainContent'))">
                <span style="color:#999;font-size:13px;">或</span>
                <select id="flowMemberSearch" onchange="document.getElementById('flowMemberInput').value='';renderFlow(document.getElementById('mainContent'))" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">選擇會員</option>
                    ${memberOptions}
                </select>
                <button class="btn btn-primary" onclick="renderFlow(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('flowMemberInput').value='';document.getElementById('flowMemberSearch').value='';renderFlow(document.getElementById('mainContent'))">✕ 清除會員</button>
                <button class="btn" onclick="renderFlow(document.getElementById('mainContent'))">🔄 刷新</button>
                
                ${currentMemberName ? `<span style="font-size:12px;color:#2196F3;font-weight:bold;">👤 ${currentMemberName}</span>` : ''}
                <span style="font-size:13px;color:#999;margin-left:auto;">共 ${filteredRecords.length} 笔记录</span>
            </div>
        </div>
        
        <!-- 統計摘要 -->
        ${filteredRecords.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:15px;padding:10px 15px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;font-size:13px;">
                <span><strong>📊 統計摘要</strong></span>
                <span>💰 充值：<span style="color:#4CAF50;font-weight:bold;">${totalRecharge.toFixed(2)}</span></span>
                <span>📤 出金：<span style="color:#ff6b6b;font-weight:bold;">${totalRefund.toFixed(2)}</span></span>
                <span>💳 借款：<span style="color:#ff6b6b;font-weight:bold;">${totalLoan.toFixed(2)}</span></span>
                <span>💳 還款：<span style="color:#4CAF50;font-weight:bold;">${totalRepay.toFixed(2)}</span></span>
                <span>🔄 返點：<span style="color:#26c6da;font-weight:bold;">${totalRebate.toFixed(2)}</span></span>
                <span>🔄 換幣：<span style="color:#2196F3;font-weight:bold;">${totalExchange.toFixed(2)}</span></span>
                <span style="color:#999;">| 總筆數：<strong>${filteredRecords.length}</strong></span>
            </div>
        ` : ''}
        
        <!-- 換幣記錄說明 -->
        <div style="margin-bottom:10px;padding:8px 12px;background:#e3f2fd;border-radius:6px;font-size:12px;color:#1565C0;display:flex;gap:15px;flex-wrap:wrap;align-items:center;">
            <span>💡 <strong>換幣記錄</strong>顯示格式：<span style="color:#ff6b6b;">-出金金額 出金幣種</span> → <span style="color:#4CAF50;">+入金金額 入金幣種</span></span>
            <span style="font-size:11px;color:#888;">換幣使用買入/賣出價，結果無條件舍去</span>
        </div>
        
        <div class="table-container">
            <table>
                <thead><tr>
                    <th style="min-width:140px;">时间</th>
                    <th style="min-width:80px;">会员</th>
                    <th style="min-width:80px;">类型</th>
                    <th style="min-width:180px;">金额</th>
                    <th style="min-width:150px;">相关账户</th>
                    <th style="min-width:150px;">备注</th>
                    <th style="min-width:80px;">操作人</th>
                </tr></thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
        
        ${filteredRecords.length > 0 ? `
            <div style="margin-top:10px;display:flex;gap:15px;flex-wrap:wrap;font-size:12px;color:#999;padding:8px 12px;background:#f8f9fc;border-radius:6px;">
                <span>📊 總計：<strong>${filteredRecords.length}</strong> 筆記錄</span>
                <span>🔄 換幣：<strong>${filteredRecords.filter(r => r._type === 'exchange').length}</strong> 筆</span>
                <span>💳 交易：<strong>${filteredRecords.filter(r => r._type === 'transaction').length}</strong> 筆</span>
                ${searchDateStart && searchDateEnd ? `<span>📅 時段：${searchDateStart} ~ ${searchDateEnd}</span>` : ''}
                ${searchDate ? `<span>📅 日期：${searchDate}</span>` : ''}
                ${currentMemberName ? `<span>👤 會員：${currentMemberName}</span>` : ''}
            </div>
        ` : ''}
    `;
}

// ============================================================
// 輔助函數
// ============================================================

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