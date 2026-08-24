// ============================================================
// 7. 台桌看板（完整版 - 含權限控制 + 退水四捨五入到百位）
// ============================================================

let currentTable = '决赛桌';
let insuranceRate = 5;

// ============================================================
// 獲取保險記錄
// ============================================================

function getInsuranceRecords(tableType) {
    const records = DB.get('insurance_records', []);
    return records.filter(r => r.table_type === tableType);
}

function getTotalInsurance(tableType) {
    const records = getInsuranceRecords(tableType);
    return records.reduce((sum, r) => sum + r.amount, 0);
}

// ============================================================
// 小费相关函数
// ============================================================

function getTipsRecords(tableType) {
    const records = DB.get('tips_records', []);
    return records.filter(r => r.table_type === tableType);
}

function getTotalTips(tableType) {
    const records = getTipsRecords(tableType);
    return records.reduce((sum, r) => sum + r.amount, 0);
}

function addTipsRecord(tableType, employeeId, employeeName, amount, note) {
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
        created_at: now(),
        withdrawn: false,
        withdrawn_at: null,
        withdrawn_account_id: null,
        withdrawn_currency: null,
        withdrawn_amount: null,
        withdrawn_admin_name: null
    });
    DB.set('tips_records', records);
    addOperationLog('台桌看板', '小费', tableType, `${tableType} - ${employeeName} 小费 ${amount} 泰铢`);
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
                withdrawn: r.withdrawn || false,
                withdrawn_amount: r.withdrawn_amount || 0,
                records: []
            };
        }
        summary[r.employee_id].total_amount += r.amount;
        summary[r.employee_id].count++;
        summary[r.employee_id].records.push(r);
        if (r.withdrawn) {
            summary[r.employee_id].withdrawn = true;
            summary[r.employee_id].withdrawn_amount = (summary[r.employee_id].withdrawn_amount || 0) + (r.withdrawn_amount || r.amount || 0);
        }
    });
    return summary;
}

function initTipsRecords() {
    if (!localStorage.getItem('rpt_tips_records')) {
        DB.set('tips_records', []);
        DB.set('tips_records_next', 1);
    }
}

// ============================================================
// 計算玩家退水 - 四捨五入到百位
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

// ============================================================
// 渲染台桌看板 - 含權限檢查
// ============================================================

function renderTables(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('tables', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>🎯 台桌看板</h1>
                <p class="breadcrumb">营运管理 > 台桌看板</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「台桌看板」的权限</p>
            </div>
        `;
        return;
    }
    
    initTipsRecords();
    
    const sessions = DB.get('sessions', []);
    const members = DB.get('members', []);
    const agents = DB.get('agents', []);
    const waterRecords = DB.get('water_records', []);
    const upRecords = DB.get('up_records', []);
    const downRecords = DB.get('down_records', []);
    const rechargeRecords = DB.get('recharge_records', []);
    const transactions = DB.get('transactions', []);
    const withdrawRecords = DB.get('withdraw_records', []);
    const currencies = DB.get('currencies', []);
    const agentLevels = DB.get('agent_levels', []);
    const employees = DB.get('employees', []);
    const accounts = DB.get('accounts', []);
    
    const todaySessions = sessions.filter(s => s.table_type === currentTable);
    const activeSession = todaySessions.find(s => s.status === 'active' && s.session_type === 'table_open');
    const waterTotal = waterRecords.filter(w => w.table_type === currentTable).reduce((sum, w) => sum + w.amount, 0);
    const waterCount = waterRecords.filter(w => w.table_type === currentTable).length;
    
    const tipsRecords = getTipsRecords(currentTable);
    const tipsTotal = tipsRecords.reduce((sum, r) => sum + r.amount, 0);
    const tipsCount = tipsRecords.length;
    const tipsWithdrawn = tipsRecords.every(r => r.withdrawn === true);
    const tipsWithdrawnCount = tipsRecords.filter(r => r.withdrawn === true).length;
    const tipsWithdrawnTotal = tipsRecords.filter(r => r.withdrawn === true).reduce((sum, r) => sum + (r.withdrawn_amount || r.amount || 0), 0);
    
    const playerSessions = todaySessions.filter(s => s.session_type === 'player');
    let totalHours = 0;
    playerSessions.forEach(s => {
        totalHours += calculatePlayerDuration(s.id);
    });
    
    let totalRebate = 0;
    playerSessions.forEach(s => {
        totalRebate += calculatePlayerRebate(s.id, waterTotal, totalHours);
    });
    
    const playerRebateDetails = [];
    let totalRebateAmount = 0;
    
    if (totalHours > 0 && waterTotal > 0) {
        playerSessions.forEach(s => {
            const member = getMember(s.member_id);
            const agent = getAgent(s.agent_id);
            const duration = calculatePlayerDuration(s.id);
            const percentage = totalHours > 0 ? duration / totalHours : 0;
            let rebateRate = 0;
            if (agent) {
                const level = agentLevels.find(l => l.id === agent.level_id);
                if (level) {
                    rebateRate = level.rate;
                } else {
                    rebateRate = agent.rebate_rate || 0;
                }
            }
            // ★ 計算原始退水金額並四捨五入到百位
            const rawRebateAmount = waterTotal * percentage * (rebateRate / 100);
            const rebateAmount = Math.round(rawRebateAmount / 100) * 100;
            totalRebateAmount += rebateAmount;
            playerRebateDetails.push({
                sessionId: s.id,
                memberId: s.member_id,
                memberName: member ? member.name : '未知',
                agentId: s.agent_id,
                agentName: agent ? agent.name : '無',
                rebateRate: rebateRate,
                duration: duration,
                percentage: percentage,
                rebateAmount: rebateAmount,
                rawRebateAmount: rawRebateAmount
            });
        });
    }
    
    let totalUp = 0;
    let totalDown = 0;
    playerSessions.forEach(s => {
        totalUp += s.up_amount || 0;
        totalDown += s.down_amount || 0;
    });
    const totalProfit = totalDown - totalUp;
    const hourlyRebate = totalHours > 0 ? totalRebateAmount / totalHours : 0;
    const distributableRebate = playerRebateDetails.filter(r => r.agentId && r.rebateAmount > 0).reduce((sum, r) => sum + r.rebateAmount, 0);
    
    const insuranceRecords = getInsuranceRecords(currentTable);
    const totalInsurance = insuranceRecords.reduce((sum, r) => sum + r.amount, 0);
    const insuranceEarningsAmount = totalInsurance > 0 ? totalInsurance * (insuranceRate / 100) : 0;
    
    const tipsAllWithdrawn = tipsCount > 0 ? tipsWithdrawn : true;
    const tipsStatus = tipsCount === 0 ? '無小費' : (tipsAllWithdrawn ? '✅ 已出款' : `⏳ 待出款 (${tipsWithdrawnCount}/${tipsCount})`);
    const tipsTotalAmount = tipsTotal;
    
    const settlements = DB.get('daily_settlements', []);
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySettlement = settlements.find(s => s.table_type === currentTable && s.settle_time && s.settle_time.startsWith(todayStr));
    const rebatePaid = todaySettlement?.rebate_paid || false;
    const rebatePaidMethod = todaySettlement?.rebate_paid_method || '';
    const rebatePaidStatus = rebatePaid ? `✅ 已付款 (${rebatePaidMethod})` : '⏳ 待付款';
    
    // ✅ 檢查各操作權限
    const canOpenTable = checkActionPermission('tables', 'open_table');
    const canSettleTable = checkActionPermission('tables', 'settle_table');
    const canAddPlayer = checkActionPermission('tables', 'add_player');
    const canAddWater = checkActionPermission('tables', 'add_water');
    const canAddInsurance = checkActionPermission('tables', 'add_insurance');
    const canAddTips = checkActionPermission('tables', 'add_tips');
    const canUp = checkActionPermission('tables', 'up');
    const canDown = checkActionPermission('tables', 'down');
    const canRecharge = checkActionPermission('tables', 'recharge');
    const canTableWithdraw = checkActionPermission('tables', 'table_withdraw');
    const canTableExchange = checkActionPermission('tables', 'table_exchange');
    const canViewHistory = checkActionPermission('tables', 'view_history');
    const canViewDetail = checkActionPermission('tables', 'view_detail');
    
    let playerTableBody = '';
    if (playerSessions.length === 0) {
        playerTableBody = '<tr class="empty-row"><td colspan="12">暂无玩家</td></tr>';
    } else {
        playerTableBody = playerSessions.map((s, i) => {
            const member = members.find(m => m.id === s.member_id);
            const agent = agents.find(a => a.id === s.agent_id);
            const memberAccount = getMemberAccount(s.member_id);
            const memberBalances = memberAccount.balances || {};
            let totalAccountBalance = 0;
            const balanceDetails = [];
            currencies.forEach(c => {
                const balance = memberBalances[c.currency] || 0;
                const rate = getBuyRate(c.currency);
                const thbValue = balance * rate;
                totalAccountBalance += thbValue;
                balanceDetails.push({ currency: c.currency, balance: balance, rate: rate, thbValue: thbValue });
            });
            const profit = (s.down_amount || 0) - (s.up_amount || 0);
            const duration = calculatePlayerDuration(s.id);
            const rebateInfo = playerRebateDetails.find(r => r.sessionId === s.id);
            const rebateAmount = rebateInfo ? rebateInfo.rebateAmount : 0;
            const isPaid = totalAccountBalance >= 0;
            let paymentStatusText = '';
            let paymentStatusClass = '';
            if (isPaid) {
                if (totalAccountBalance > 0) {
                    paymentStatusText = `✅ 已支付 (余额：${totalAccountBalance.toFixed(2)})`;
                    paymentStatusClass = 'badge-success';
                } else {
                    paymentStatusText = '✅ 已支付 (0.00)';
                    paymentStatusClass = 'badge-success';
                }
            } else {
                const debtAmount = Math.abs(totalAccountBalance);
                paymentStatusText = `❌ 未支付 (尚欠：${debtAmount.toFixed(2)})`;
                paymentStatusClass = 'badge-danger';
            }
            const playerUpRecords = upRecords.filter(r => r.session_id === s.id);
            const playerDownRecords = downRecords.filter(r => r.session_id === s.id);
            const timeline = [];
            playerUpRecords.forEach(r => { timeline.push({ type: '上分', time: r.up_time }); });
            playerDownRecords.forEach(r => { timeline.push({ type: '下分', time: r.down_time }); });
            timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
            const lastRecord = timeline.length > 0 ? timeline[timeline.length - 1] : null;
            const isLastDown = lastRecord && lastRecord.type === '下分';
            const isOffTable = isLastDown;
            const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
            const profitColor = profit >= 0 ? '#4CAF50' : '#ff6b6b';
            
            let actionButtons = '';
            if (canUp) actionButtons += `<button class="btn btn-success btn-sm" onclick="doUp(${s.id})" title="上分">⬆️</button>`;
            if (canDown) actionButtons += `<button class="btn btn-warning btn-sm" onclick="doDown(${s.id})" title="下分">⬇️</button>`;
            if (canRecharge) actionButtons += `<button class="btn btn-primary btn-sm" onclick="doTableRecharge(${s.id})" title="充值">💰</button>`;
            if (canTableWithdraw) actionButtons += `<button class="btn btn-danger btn-sm" onclick="doTableWithdraw(${s.id})" title="出金">📤</button>`;
            if (canTableExchange) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="doTableExchange(${s.id})" title="换币">🔄</button>`;
            if (canViewDetail) actionButtons += `<button class="btn btn-info btn-sm" onclick="showSessionDetail(${s.id})" title="明细">📋</button>`;
            
            return `<tr>
                <td style="text-align:center;">${i + 1}</td>
                <td style="text-align:center;"><strong>${member ? member.name : '未知'}</strong></td>
                <td style="text-align:center;">${agent ? agent.name : '-'}</td>
                <td style="text-align:center;">${(s.up_amount || 0).toFixed(2)}</td>
                <td style="text-align:center;">${(s.down_amount || 0).toFixed(2)}</td>
                <td style="text-align:center;color:${profitColor};font-weight:bold;">${profitDisplay}</td>
                <td style="text-align:center;">${formatDuration(duration)}</td>
                <td style="text-align:center;">${rebateAmount.toFixed(2)}</td>
                <td style="text-align:center;"><span class="badge ${paymentStatusClass}">${paymentStatusText}</span></td>
                <td style="text-align:center;"><span class="badge ${isOffTable ? 'badge-danger' : 'badge-success'}">${isOffTable ? '🔴 已下桌' : '🟢 进行中'}</span></td>
                <td style="text-align:center;"><div class="btn-group" style="justify-content:center;">${actionButtons}</div></td>
            </tr>`;
        }).join('');
    }
    
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;min-height:calc(100vh - 60px);">
            <div class="page-header">
                <h1>🎯 台桌看板</h1>
                <p class="breadcrumb">营运管理 > 台桌看板</p>
            </div>
            <div class="toolbar">
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn ${currentTable === '决赛桌' ? 'btn-primary' : ''}" onclick="switchTable('决赛桌')">决赛桌</button>
                    <button class="btn ${currentTable === 'VIP包1' ? 'btn-primary' : ''}" onclick="switchTable('VIP包1')">VIP包1</button>
                    <button class="btn ${currentTable === 'VIP包2' ? 'btn-primary' : ''}" onclick="switchTable('VIP包2')">VIP包2</button>
                    <button class="btn ${currentTable === '大厅1' ? 'btn-primary' : ''}" onclick="switchTable('大厅1')">大厅1</button>
                    <button class="btn ${currentTable === '大厅2' ? 'btn-primary' : ''}" onclick="switchTable('大厅2')">大厅2</button>
                </div>
                <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
                    ${canOpenTable ? `<button class="btn btn-success" onclick="openTable()">🆕 开桌</button>` : ''}
                    ${canSettleTable ? `<button class="btn btn-danger" onclick="settleTable()">✅ 整桌结算</button>` : ''}
                    ${canViewHistory ? `<button class="btn btn-info" onclick="showTableHistory()">📜 历史纪录</button>` : ''}
                    <button class="btn" onclick="renderTables(document.getElementById('mainContent'))">🔄 刷新</button>
                </div>
            </div>
            <div style="padding:10px 15px;background:#e3f2fd;border-radius:8px;margin-bottom:15px;font-weight:500;color:#1565C0;text-align:center;flex-shrink:0;">
                📊 ${currentTable}：${activeSession ? '🟢 已开桌 (' + formatDate(activeSession.start_time) + ')' : '📭 未开桌'}
                ${activeSession ? ` | 总时长：${formatDuration(totalHours)}` : ''}
                ${playerSessions.length > 0 ? ` | 玩家数：${playerSessions.length} 人` : ''}
                ${insuranceRecords.length > 0 ? ` | 保险次数：${insuranceRecords.length} 次` : ''}
                ${waterTotal > 0 ? ` | 抽水：${waterTotal.toFixed(2)}` : ''}
                ${tipsCount > 0 ? ` | 💰 小费：${tipsTotal.toFixed(2)}` : ''}
            </div>
            <div style="flex:1;min-height:0;overflow-y:auto;margin-bottom:10px;">
                <div class="table-container" style="border-radius:10px;">
                    <table>
                        <thead style="position:sticky;top:0;z-index:10;">
                            <tr>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;width:50px;">序号</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:80px;">玩家</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:80px;">介绍人</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:70px;">上分</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:70px;">下分</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:80px;">盈亏</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:80px;">时长</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:70px;">退水</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:200px;">付款状态</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:80px;">状态</th>
                                <th style="background:#f8f9fc;padding:10px 14px;text-align:center;border-bottom:2px solid #eee;white-space:nowrap;min-width:250px;">操作</th>
                            </tr>
                        </thead>
                        <tbody>${playerTableBody}</tbody>
                    </table>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:15px;flex-shrink:0;background:#f5f7fa;padding:12px 0;border-top:1px solid #e8e8e8;">
                <div class="table-stats" style="padding:12px 15px;background:#fff;border-radius:10px;border:1px solid #eee;">
                    <h3 style="text-align:center;font-size:14px;margin-bottom:5px;">💰 抽水 & 退水统计</h3>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:5px;text-align:center;">
                        <div><span style="color:#888;font-size:11px;">玩家数</span><br><strong style="font-size:16px;">${playerSessions.length}</strong></div>
                        <div><span style="color:#888;font-size:11px;">总时长</span><br><strong style="font-size:16px;">${formatDuration(totalHours)}</strong></div>
                        <div><span style="color:#888;font-size:11px;">总上分</span><br><strong style="font-size:16px;color:#2196F3;">${totalUp.toFixed(2)}</strong></div>
                        <div><span style="color:#888;font-size:11px;">总下分</span><br><strong style="font-size:16px;color:#ff6b6b;">${totalDown.toFixed(2)}</strong></div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:3px;text-align:center;border-top:1px solid #eee;padding-top:5px;">
                        <div><span style="color:#888;font-size:11px;">总盈亏</span><br><strong style="font-size:16px;color:${totalProfit >= 0 ? '#4CAF50' : '#ff6b6b'};">${totalProfit.toFixed(2)}</strong></div>
                        <div><span style="color:#888;font-size:11px;">抽水次数</span><br><strong style="font-size:16px;">${waterCount}</strong></div>
                        <div><span style="color:#888;font-size:11px;">总抽水</span><br><strong style="font-size:16px;color:#e65100;">${waterTotal.toFixed(2)}</strong></div>
                        <div><span style="color:#888;font-size:11px;">每小時退水</span><br><strong style="font-size:16px;color:#4CAF50;">${hourlyRebate.toFixed(2)}</strong></div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:3px;text-align:center;border-top:1px solid #eee;padding-top:5px;">
                        <div><span style="color:#888;font-size:11px;">总退水</span><br><strong style="font-size:16px;color:#e65100;">${totalRebateAmount.toFixed(2)}</strong></div>
                        <div><span style="color:#888;font-size:11px;">扣费金额</span><br><strong style="font-size:16px;color:#c62828;">${(waterTotal - totalRebateAmount).toFixed(2)}</strong></div>
                        <div><span style="color:#888;font-size:11px;">可分退水</span><br><strong style="font-size:16px;color:#1565C0;">${distributableRebate.toFixed(2)}</strong></div>
                    </div>
                </div>
                <div class="table-stats" style="padding:12px 15px;background:#fff;border-radius:10px;border:1px solid #eee;">
                    <h3 style="text-align:center;font-size:14px;margin-bottom:5px;">🛡️ 保险统计</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:5px;text-align:center;">
                        <div><div style="font-size:10px;color:#888;">保险次数</div><div style="font-size:18px;font-weight:bold;color:#2196F3;">${insuranceRecords.length}</div></div>
                        <div><div style="font-size:10px;color:#888;">总保险</div><div style="font-size:18px;font-weight:bold;color:#2196F3;">${totalInsurance.toFixed(2)}</div></div>
                        <div><div style="font-size:10px;color:#888;">保险收益</div><div style="font-size:18px;font-weight:bold;color:#4CAF50;">${insuranceEarningsAmount.toFixed(2)}</div></div>
                    </div>
                    <div style="margin-top:3px;padding-top:3px;border-top:1px solid #eee;text-align:center;font-size:11px;color:#666;">收益比例：<strong>${insuranceRate}%</strong></div>
                </div>
                <div class="table-stats" style="padding:12px 15px;background:#fff;border-radius:10px;border:1px solid #eee;">
                    <h3 style="text-align:center;font-size:14px;margin-bottom:5px;">💰 小费统计</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:5px;text-align:center;">
                        <div><div style="font-size:10px;color:#888;">小费笔数</div><div style="font-size:18px;font-weight:bold;color:#ffa726;">${tipsCount}</div></div>
                        <div><div style="font-size:10px;color:#888;">总小费</div><div style="font-size:18px;font-weight:bold;color:#ffa726;">${tipsTotalAmount.toFixed(2)}</div></div>
                    </div>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;justify-content:center;padding:8px 0;background:#fff;border-radius:10px;border:1px solid #eee;">
                ${canAddPlayer ? `<button class="btn btn-primary btn-sm" onclick="showAddPlayer()">➕ 新增玩家</button>` : ''}
                ${canAddWater ? `<button class="btn btn-success btn-sm" onclick="showAddWater()">💰 抽水</button>` : ''}
                ${canAddInsurance ? `<button class="btn btn-warning btn-sm" onclick="showInsuranceSetting()">🛡️ 保险</button>` : ''}
                ${canAddTips ? `<button class="btn btn-success btn-sm" onclick="showAddTips()" style="background:#ffa726;color:#fff;">💵 小费</button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="showWaterDetail()" style="background:#6c757d;color:#fff;">📊 抽水明细</button>
                <button class="btn btn-secondary btn-sm" onclick="showInsuranceDetail()" style="background:#6c757d;color:#fff;">📋 保险明细</button>
                <button class="btn btn-secondary btn-sm" onclick="showTipsDetail()" style="background:#6c757d;color:#fff;">📋 小费明细</button>
                <button class="btn btn-secondary btn-sm" onclick="showInsuranceRateSetting()" style="background:#6c757d;color:#fff;">📊 收益比例</button>
            </div>
        </div>
    `;
}

// ============================================================
// 開桌功能 - 含重置功能
// ============================================================

function openTable() {
    if (!checkActionPermission('tables', 'open_table')) {
        showPermissionDenied('開桌');
        return;
    }
    
    const sessions = DB.get('sessions', []);
    const existingOpen = sessions.find(s => s.table_type === currentTable && s.session_type === 'table_open' && s.status === 'active');
    const existingPlayers = sessions.filter(s => s.table_type === currentTable && s.session_type === 'player' && s.status === 'active');
    
    let warningMsg = '';
    if (existingOpen) {
        warningMsg += `⚠️ 目前已有開桌記錄（開桌時間：${formatDate(existingOpen.start_time)}）\n`;
    }
    if (existingPlayers.length > 0) {
        warningMsg += `⚠️ 目前有 ${existingPlayers.length} 位玩家在桌上\n`;
    }
    
    if (warningMsg) {
        warningMsg += `\n開桌將清除該桌所有現有資料（包含玩家、上分記錄、抽水、保險、小費等），確定要繼續嗎？`;
        if (!confirm(warningMsg)) {
            return;
        }
    }
    
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 16);
    
    const html = `
        <div class="modal-title">🆕 開桌 - ${currentTable}</div>
        <div style="margin-bottom:15px;padding:12px;background:#fff3e0;border-radius:8px;border:1px solid #ffcc80;text-align:center;">
            <span style="color:#e65100;">⚠️ 開桌將重置該桌所有資料（玩家、上分記錄、抽水、保險、小費等）</span>
        </div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 選擇開桌時間</span>
        </div>
        <div class="form-group">
            <label>開桌時間模式 *</label>
            <select id="openTableTimeMode" onchange="toggleOpenTableTime()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                <option value="now">🕐 即時（現在）</option>
                <option value="custom">✏️ 設定時間</option>
            </select>
        </div>
        <div id="openTableCustomTimeGroup" style="display:none;">
            <div class="form-group">
                <label>開桌日期時間 *</label>
                <input type="datetime-local" id="openTableCustomTime" value="${nowStr}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
            </div>
        </div>
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-bottom:15px;text-align:center;font-size:13px;color:#666;border:1px solid #eee;">
            📌 開桌時間：<strong id="openTableTimeDisplay" style="color:#2196F3;">${formatDate(now.toISOString().replace('T', ' ').substring(0, 19))}</strong>
        </div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 開桌後將清除該桌所有資料並重新開始</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitOpenTable()">✅ 確認開桌</button>
        </div>
    `;
    showModal(html);
    
    window.toggleOpenTableTime = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        
        const mode = overlayEl.querySelector('#openTableTimeMode').value;
        const customGroup = overlayEl.querySelector('#openTableCustomTimeGroup');
        const timeDisplay = overlayEl.querySelector('#openTableTimeDisplay');
        
        if (mode === 'now') {
            customGroup.style.display = 'none';
            const now = new Date();
            timeDisplay.textContent = formatDate(now.toISOString().replace('T', ' ').substring(0, 19));
        } else {
            customGroup.style.display = 'block';
            const customInput = overlayEl.querySelector('#openTableCustomTime');
            if (customInput.value) {
                const customDate = customInput.value.replace('T', ' ');
                timeDisplay.textContent = formatDate(customDate + ':00');
            }
        }
    };
    
    setTimeout(() => {
        const customInput = document.getElementById('openTableCustomTime');
        if (customInput) {
            customInput.addEventListener('change', function() {
                const overlayEl = document.querySelector('.modal-overlay');
                if (!overlayEl) return;
                const timeDisplay = overlayEl.querySelector('#openTableTimeDisplay');
                if (this.value) {
                    const customDate = this.value.replace('T', ' ');
                    timeDisplay.textContent = formatDate(customDate + ':00');
                }
            });
        }
    }, 100);
}

function submitOpenTable() {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    
    const mode = overlay.querySelector('#openTableTimeMode').value;
    let startTime = now();
    
    if (mode === 'custom') {
        const customInput = overlay.querySelector('#openTableCustomTime');
        if (customInput && customInput.value) {
            startTime = customInput.value.replace('T', ' ') + ':00';
        } else {
            alert('請選擇開桌時間');
            return;
        }
    }
    
    // ============================================================
    // ★ 重置該台桌所有內容
    // ============================================================
    
    const sessions = DB.get('sessions', []);
    const waterRecords = DB.get('water_records', []);
    const insuranceRecords = DB.get('insurance_records', []);
    const tipsRecords = DB.get('tips_records', []);
    const upRecords = DB.get('up_records', []);
    const downRecords = DB.get('down_records', []);
    const rechargeRecords = DB.get('recharge_records', []);
    const withdrawRecords = DB.get('withdraw_records', []);
    const exchangeRecords = DB.get('exchange_records', []);
    
    const remainingSessions = sessions.filter(s => s.table_type !== currentTable || s.session_type === 'table_open');
    DB.set('sessions', remainingSessions);
    
    const remainingWater = waterRecords.filter(w => w.table_type !== currentTable);
    DB.set('water_records', remainingWater);
    
    const remainingInsurance = insuranceRecords.filter(i => i.table_type !== currentTable);
    DB.set('insurance_records', remainingInsurance);
    
    const remainingTips = tipsRecords.filter(t => t.table_type !== currentTable);
    DB.set('tips_records', remainingTips);
    
    const playerSessionIds = sessions.filter(s => s.table_type === currentTable && s.session_type === 'player').map(s => s.id);
    const remainingUp = upRecords.filter(r => !playerSessionIds.includes(r.session_id));
    DB.set('up_records', remainingUp);
    
    const remainingDown = downRecords.filter(r => !playerSessionIds.includes(r.session_id));
    DB.set('down_records', remainingDown);
    
    const remainingExchange = exchangeRecords.filter(e => e.table_type !== currentTable);
    DB.set('exchange_records', remainingExchange);
    
    const tableOpenSessions = remainingSessions.filter(s => s.table_type === currentTable && s.session_type === 'table_open');
    const newRemainingSessions = remainingSessions.filter(s => !(s.table_type === currentTable && s.session_type === 'table_open'));
    
    const newSession = {
        id: DB.getNextId('sessions'),
        table_type: currentTable,
        session_type: 'table_open',
        status: 'active',
        start_time: startTime,
        end_time: null,
        member_id: null,
        agent_id: null,
        up_amount: 0,
        down_amount: 0
    };
    newRemainingSessions.push(newSession);
    DB.set('sessions', newRemainingSessions);
    
    const todayStr = new Date().toISOString().split('T')[0];
    const settlements = DB.get('daily_settlements', []);
    const remainingSettlements = settlements.filter(s => 
        !(s.table_type === currentTable && s.settle_time && s.settle_time.startsWith(todayStr))
    );
    DB.set('daily_settlements', remainingSettlements);
    
    insuranceRate = 5;
    
    addOperationLog('台桌看板', '开桌', currentTable, 
        `${currentTable} 已開桌 (${formatDate(startTime)}) - 已重置該桌所有資料`);
    
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    alert(`✅「${currentTable}」已開桌並重置完成！\n開桌時間：${formatDate(startTime)}\n\n已清除該桌所有玩家、上分記錄、抽水、保險、小費等資料。`);
}

// ============================================================
// 新增玩家 - 含權限檢查
// ============================================================

function showAddPlayer() {
    if (!checkActionPermission('tables', 'add_player')) {
        showPermissionDenied('新增玩家');
        return;
    }
    const members = DB.get('members', []);
    const agents = DB.get('agents', []);
    const html = `
        <div class="modal-title">➕ 新增玩家</div>
        <div style="margin-bottom:15px;color:#2196F3;text-align:center;">📍 当前桌号：${currentTable}</div>
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #e0e0e0;">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <span style="font-weight:500;font-size:14px;color:#333;">🔍 搜索会员：</span>
                <input type="text" id="playerSearchInput" placeholder="输入会员ID或姓名" style="flex:1;min-width:150px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') searchPlayerForTable()">
                <button class="btn btn-primary" onclick="searchPlayerForTable()">搜索</button>
                <button class="btn" onclick="clearPlayerSearch()">清除</button>
            </div>
            <div id="playerSearchResult" style="margin-top:8px;font-size:13px;color:#999;text-align:center;display:none;"></div>
        </div>
        <div class="form-group">
            <label>选择玩家 *</label>
            <select id="addPlayerSelect" onchange="showPlayerAgentInfo()">
                <option value="">请选择...</option>
                ${members.map(m => {
                    const agent = agents.find(a => a.id === m.intermediary_id);
                    return `<option value="${m.id}" data-agent="${agent ? agent.id : ''}" data-agent-name="${agent ? agent.name : '无'}">${m.id}. ${m.name} ${agent ? '（介绍人：' + agent.name + '）' : ''}</option>`;
                }).join('')}
            </select>
        </div>
        <div id="playerAgentInfo" style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;display:none;text-align:center;">
            <span style="color:#666;">📌 介绍人：</span>
            <span id="playerAgentDisplay" style="font-weight:bold;color:#2196F3;">-</span>
            <span style="color:#999;font-size:12px;margin-left:10px;">（自动读取会员资料）</span>
        </div>
        <div style="margin-bottom:15px;padding:10px;background:#fff3e0;border-radius:6px;border:1px solid #ffcc80;text-align:center;">
            <span style="color:#e65100;font-size:13px;">💡 介绍人将自动从会员资料中读取，无需手动选择</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddPlayer()">确认上桌</button>
        </div>
    `;
    showModal(html);
    
    window.searchPlayerForTable = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const searchInput = overlay.querySelector('#playerSearchInput');
        const select = overlay.querySelector('#addPlayerSelect');
        const resultDiv = overlay.querySelector('#playerSearchResult');
        const keyword = searchInput.value.trim();
        if (!keyword) { resultDiv.style.display = 'none'; return; }
        const members = DB.get('members', []);
        let foundMembers = [];
        const isNumeric = /^\d+$/.test(keyword);
        if (isNumeric) { foundMembers = members.filter(m => m.id.toString().includes(keyword)); } 
        else { foundMembers = members.filter(m => m.name.toLowerCase().includes(keyword.toLowerCase())); }
        if (foundMembers.length === 0) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = '#ff6b6b';
            resultDiv.innerHTML = '❌ 找不到匹配的会员，请重新输入';
            return;
        }
        const agents = DB.get('agents', []);
        let optionsHtml = '<option value="">请选择...</option>';
        foundMembers.forEach(m => {
            const agent = agents.find(a => a.id === m.intermediary_id);
            optionsHtml += `<option value="${m.id}" data-agent="${agent ? agent.id : ''}" data-agent-name="${agent ? agent.name : '无'}">${m.id}. ${m.name} ${agent ? '（介绍人：' + agent.name + '）' : ''}</option>`;
        });
        select.innerHTML = optionsHtml;
        if (foundMembers.length === 1) { select.value = foundMembers[0].id; showPlayerAgentInfo(); }
        resultDiv.style.display = 'block';
        resultDiv.style.color = '#4CAF50';
        resultDiv.innerHTML = `✅ 找到 ${foundMembers.length} 位会员，已更新下方列表`;
    };
    
    window.clearPlayerSearch = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const searchInput = overlay.querySelector('#playerSearchInput');
        const select = overlay.querySelector('#addPlayerSelect');
        const resultDiv = overlay.querySelector('#playerSearchResult');
        searchInput.value = '';
        resultDiv.style.display = 'none';
        const members = DB.get('members', []);
        const agents = DB.get('agents', []);
        let optionsHtml = '<option value="">请选择...</option>';
        members.forEach(m => {
            const agent = agents.find(a => a.id === m.intermediary_id);
            optionsHtml += `<option value="${m.id}" data-agent="${agent ? agent.id : ''}" data-agent-name="${agent ? agent.name : '无'}">${m.id}. ${m.name} ${agent ? '（介绍人：' + agent.name + '）' : ''}</option>`;
        });
        select.innerHTML = optionsHtml;
        select.value = '';
        document.getElementById('playerAgentInfo').style.display = 'none';
    };
}

function showPlayerAgentInfo() {
    const select = document.getElementById('addPlayerSelect');
    const selectedOption = select.options[select.selectedIndex];
    const infoDiv = document.getElementById('playerAgentInfo');
    const displaySpan = document.getElementById('playerAgentDisplay');
    if (selectedOption && selectedOption.value) {
        const agentName = selectedOption.dataset.agentName || '无';
        infoDiv.style.display = 'block';
        displaySpan.textContent = agentName;
    } else {
        infoDiv.style.display = 'none';
    }
}

function submitAddPlayer() {
    const overlay = document.querySelector('.modal-overlay');
    const select = overlay.querySelector('#addPlayerSelect');
    const memberId = parseInt(select.value);
    if (!memberId) { alert('请选择玩家'); return; }
    const member = getMember(memberId);
    if (!member) { alert('会员不存在'); return; }
    const agentId = member.intermediary_id || null;
    const agent = agentId ? getAgent(agentId) : null;
    const sessions = DB.get('sessions', []);
    sessions.push({
        id: DB.getNextId('sessions'),
        table_type: currentTable,
        session_type: 'player',
        status: 'active',
        start_time: now(),
        end_time: null,
        member_id: memberId,
        agent_id: agentId,
        up_amount: 0,
        down_amount: 0
    });
    DB.set('sessions', sessions);
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    alert(`✅ 玩家已上桌！\n玩家：${member.name}\n介绍人：${agent ? agent.name : '无'}`);
}

// ============================================================
// 抽水功能 - 含權限檢查
// ============================================================

function showAddWater() {
    if (!checkActionPermission('tables', 'add_water')) {
        showPermissionDenied('抽水');
        return;
    }
    const html = `
        <div class="modal-title">💰 新增抽水</div>
        <div class="form-group"><label>抽水金额 *</label><input type="number" id="waterAmount" step="0.01" min="0.01"></div>
        <div class="form-group"><label>备注</label><input type="text" id="waterNote"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitAddWater()">确认新增</button>
        </div>
    `;
    showModal(html);
}

function submitAddWater() {
    const overlay = document.querySelector('.modal-overlay');
    const amount = parseFloat(overlay.querySelector('#waterAmount').value);
    if (!amount || amount <= 0) { alert('请输入有效金额'); return; }
    const waterRecords = DB.get('water_records', []);
    waterRecords.push({
        id: DB.getNextId('water_records'),
        table_type: currentTable,
        amount: amount,
        note: overlay.querySelector('#waterNote').value.trim() || '',
        admin_name: getCurrentAdminName(),
        admin_id: getCurrentAdminId(),
        created_at: now()
    });
    DB.set('water_records', waterRecords);
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    alert('✅ 抽水已记录');
}

// ============================================================
// 保險功能 - 含權限檢查
// ============================================================

function showInsuranceSetting() {
    if (!checkActionPermission('tables', 'add_insurance')) {
        showPermissionDenied('保險');
        return;
    }
    const insuranceRecords = getInsuranceRecords(currentTable);
    const totalInsurance = insuranceRecords.reduce((sum, r) => sum + r.amount, 0);
    const html = `
        <div class="modal-title">🛡️ 保险设定 - ${currentTable}</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 输入单次保险金额（可为负值），系统将记录每次保险的金额和时间</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:15px;text-align:center;">
            <div style="padding:10px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">保险次数</div>
                <div style="font-size:20px;font-weight:bold;color:#2196F3;">${insuranceRecords.length}</div>
            </div>
            <div style="padding:10px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">累计总保险</div>
                <div style="font-size:20px;font-weight:bold;color:#2196F3;">${totalInsurance.toFixed(2)}</div>
            </div>
            <div style="padding:10px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">收益比例</div>
                <div style="font-size:20px;font-weight:bold;color:#4CAF50;">${insuranceRate}%</div>
            </div>
        </div>
        <div class="form-group">
            <label>单次保险金额 *（可输入负值）</label>
            <input type="number" id="insuranceAmount" step="0.01" value="0" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="请输入单次保险金额（负值表示减少）">
        </div>
        <div style="padding:10px;background:#e8f5e9;border-radius:6px;margin-bottom:15px;text-align:center;border:1px solid #a5d6a7;">
            <span style="color:#2e7d32;">💡 本次保险将增加：</span>
            <span id="insurancePreview" style="font-size:20px;font-weight:bold;color:#1b5e20;">0.00</span>
            <span style="color:#2e7d32;">，累计总保险：</span>
            <span id="insuranceTotalPreview" style="font-size:18px;font-weight:bold;color:#1b5e20;">${totalInsurance.toFixed(2)}</span>
        </div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;margin-bottom:15px;text-align:center;font-size:12px;color:#e65100;">
            📌 保险收益 = 累计总保险 × ${insuranceRate}%，于整桌结算时计算
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitInsuranceSetting()">✅ 确认新增</button>
        </div>
    `;
    showModal(html);
    const amountInput = document.getElementById('insuranceAmount');
    const previewSpan = document.getElementById('insurancePreview');
    const totalPreviewSpan = document.getElementById('insuranceTotalPreview');
    function updatePreview() {
        const amount = parseFloat(amountInput.value) || 0;
        previewSpan.textContent = amount.toFixed(2);
        totalPreviewSpan.textContent = (totalInsurance + amount).toFixed(2);
    }
    amountInput.addEventListener('input', updatePreview);
    setTimeout(updatePreview, 50);
}

function submitInsuranceSetting() {
    const overlay = document.querySelector('.modal-overlay');
    const amount = parseFloat(overlay.querySelector('#insuranceAmount').value) || 0;
    if (amount === 0) { if (!confirm('保险金额为 0，确定要记录吗？')) { return; } }
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const insuranceRecords = DB.get('insurance_records', []);
    insuranceRecords.push({
        id: DB.getNextId('insurance_records'),
        table_type: currentTable,
        amount: amount,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('insurance_records', insuranceRecords);
    addOperationLog('台桌看板', '保险', currentTable, `${currentTable} 保险 ${amount} 泰铢`);
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    const totalInsurance = insuranceRecords.reduce((sum, r) => sum + r.amount, 0);
    const earnings = totalInsurance > 0 ? totalInsurance * (insuranceRate / 100) : 0;
    alert(`✅ 保险已记录！\n\n单次保险：${amount.toFixed(2)}\n累计总保险：${totalInsurance.toFixed(2)}\n收益比例：${insuranceRate}%\n${totalInsurance !== 0 ? `保险收益：${earnings.toFixed(2)}` : '（总保险为0或负值，无收益）'}\n操作人：${adminName}`);
}

// ============================================================
// 小費功能 - 含權限檢查
// ============================================================

function showAddTips() {
    if (!checkActionPermission('tables', 'add_tips')) {
        showPermissionDenied('小費');
        return;
    }
    initTipsRecords();
    const employees = DB.get('employees', []);
    const activeEmployees = employees.filter(e => e.status === '在職');
    if (activeEmployees.length === 0) {
        alert('⚠️ 没有在職员工，请先到「员工管理」新增员工');
        return;
    }
    const html = `
        <div class="modal-title">💵 新增小费 - ${currentTable}</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 记录员工收到的现金小费</span>
        </div>
        <div class="form-group">
            <label>员工 *</label>
            <select id="tipsEmployee">${activeEmployees.map(e => `<option value="${e.id}">${e.name} (${e.position || '-'} / ${e.department || '-'})</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>小费金额 *</label>
            <input type="number" id="tipsAmount" step="0.01" min="0.01" placeholder="请输入小费金额">
        </div>
        <div class="form-group">
            <label>备注</label>
            <input type="text" id="tipsNote" placeholder="请输入备注（可选）">
        </div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 小费记录将汇总到员工名下，不影响玩家账户余额</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitAddTips()" style="background:#ffa726;color:#fff;">✅ 确认新增</button>
        </div>
    `;
    showModal(html);
}

function submitAddTips() {
    const overlay = document.querySelector('.modal-overlay');
    const employeeId = parseInt(overlay.querySelector('#tipsEmployee').value);
    const amount = parseFloat(overlay.querySelector('#tipsAmount').value);
    const note = overlay.querySelector('#tipsNote').value.trim() || '';
    if (!employeeId) { alert('请选择员工'); return; }
    if (!amount || amount <= 0) { alert('请输入有效的小费金额'); return; }
    const employees = DB.get('employees', []);
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) { alert('员工不存在'); return; }
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const records = DB.get('tips_records', []);
    records.push({
        id: DB.getNextId('tips_records'),
        table_type: currentTable,
        employee_id: employeeId,
        employee_name: employee.name,
        amount: amount,
        note: note,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now(),
        withdrawn: false,
        withdrawn_at: null,
        withdrawn_account_id: null,
        withdrawn_currency: null,
        withdrawn_amount: null,
        withdrawn_admin_name: null
    });
    DB.set('tips_records', records);
    addOperationLog('台桌看板', '小费', currentTable, `${currentTable} - ${employee.name} 小费 ${amount} 泰铢`, employeeId);
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    const totalTips = getTotalTips(currentTable);
    alert(`✅ 小费已记录！\n\n员工：${employee.name}\n金额：${amount.toFixed(2)} 泰铢\n桌号：${currentTable}\n当前桌总小费：${totalTips.toFixed(2)} 泰铢\n操作人：${adminName}`);
}

// ============================================================
// 上分功能 - 含權限檢查
// ============================================================

function doUp(sessionId) {
    if (!checkActionPermission('tables', 'up')) {
        showPermissionDenied('上分');
        return;
    }
    
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const member = getMember(session.member_id);
    const memberName = member ? member.name : '未知';
    
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    
    const tableOpenRecord = get_table_open_record(currentTable);
    const tableOpenTime = tableOpenRecord ? tableOpenRecord.start_time : now();
    const nowTime = now();
    
    const memberAccount = getMemberAccount(session.member_id);
    const memberBalances = memberAccount.balances || {};
    
    let totalTHB = 0;
    currencies.forEach(c => {
        const balance = memberBalances[c.currency] || 0;
        totalTHB += balance * getBuyRate(c.currency);
    });
    
    const memberBalanceOptions = currencies
        .filter(c => (memberBalances[c.currency] || 0) > 0)
        .map(c => ({
            currency: c.currency,
            balance: memberBalances[c.currency] || 0,
            rate: getBuyRate(c.currency),
            thbValue: (memberBalances[c.currency] || 0) * getBuyRate(c.currency)
        }));
    
    const html = `
        <div class="modal-title">⬆️ 上分 - ${memberName}</div>
        <div style="margin-bottom:10px;padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;text-align:center;">
            <span style="color:#1565C0;">📌 当前桌号：${currentTable}</span>
            ${tableOpenRecord ? ` | 开桌时间：${formatDate(tableOpenTime)}` : ''}
        </div>
        <div style="margin-bottom:10px;padding:8px 12px;background:#f8f9fc;border-radius:6px;font-size:13px;text-align:center;">
            <span style="color:#666;">💰 玩家账户总价值：</span>
            <span style="font-weight:bold;color:#4CAF50;font-size:16px;">${totalTHB.toFixed(2)} 泰铢</span>
        </div>
        <div style="margin-bottom:10px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:12px;text-align:center;color:#666;">
            ${currencies.map(c => {
                const balance = memberBalances[c.currency] || 0;
                const thbValue = balance * getBuyRate(c.currency);
                return `<span style="margin:0 5px;">${c.currency}: ${balance.toFixed(2)} (≈${thbValue.toFixed(2)}泰铢)</span>`;
            }).join(' | ')}
        </div>
        <div class="form-group">
            <label>时间模式 *</label>
            <select id="upTimeMode" onchange="toggleUpTimeInput()">
                <option value="now">🕐 即时（现在）</option>
                <option value="table_open">📋 开桌时间</option>
                <option value="custom">✏️ 设定时间</option>
            </select>
        </div>
        <div id="upCustomTimeGroup" style="display:none;">
            <div class="form-group">
                <label>设定日期时间 *</label>
                <input type="datetime-local" id="upCustomTime" step="1">
            </div>
        </div>
        <div id="upTimeDisplay" style="margin-bottom:10px;padding:8px 12px;background:#f5f5f5;border-radius:6px;text-align:center;font-size:13px;color:#666;">
            将使用时间：<span id="upTimePreview" style="font-weight:bold;color:#2196F3;">${formatDate(nowTime)}</span>
        </div>
        <div class="form-group"><label>金额 *</label><input type="number" id="upAmount" step="0.01" min="0.01"></div>
        <div class="form-group"><label>币别</label>
            <select id="upCurrency">${currencies.map(c => `<option value="${c.currency}">${c.currency}</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>付款状态 *</label>
            <select id="upPaymentStatus" onchange="toggleUpPaymentMethod()">
                <option value="unpaid">⏳ 未付（记录玩家账户扣除）</option>
                <option value="paid">✅ 已付</option>
            </select>
        </div>
        <div id="upPaymentMethodGroup" style="display:none;">
            <div class="form-group">
                <label>付款方式 *</label>
                <select id="upPaymentMethod" onchange="toggleUpAccountSelect()">
                    <option value="cash">💵 现金</option>
                    <option value="member_account">🏦 玩家账户余额</option>
                </select>
            </div>
            <div id="upAccountSelectGroup" style="display:none;">
                <div class="form-group">
                    <label>选择玩家币种 *</label>
                    <select id="upMemberAccountCurrency">
                        ${memberBalanceOptions.length === 0 ? 
                            '<option value="">⚠️ 玩家账户无余额</option>' :
                            memberBalanceOptions.map(c => 
                                `<option value="${c.currency}" data-balance="${c.balance}">${c.currency} (余额：${c.balance.toFixed(2)} ≈ ${c.thbValue.toFixed(2)}泰铢)</option>`
                            ).join('')
                        }
                    </select>
                </div>
                <div style="padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;margin-bottom:10px;text-align:center;">
                    <span style="color:#1565C0;">💡 将从玩家 <strong>${memberName}</strong> 的 <span id="selectedMemberCurrencyDisplay">${memberBalanceOptions.length > 0 ? memberBalanceOptions[0].currency : '-'}</span> 账户扣除对应金额</span>
                </div>
            </div>
        </div>
        <div id="upReceiverGroup" style="display:none;">
            <div class="form-group">
                <label>收款账户（往来账款）</label>
                <select id="upReceiverAccount">
                    ${accounts.map(a => {
                        const balances = get_account_balances(a.id);
                        return balances.map(b => 
                            `<option value="${a.id}|${b.currency}">${a.name} - ${b.currency} (余额：${b.balance.toFixed(2)})</option>`
                        ).join('');
                    }).join('')}
                    ${accounts.length === 0 ? '<option value="">⚠️ 暂无往来账户</option>' : ''}
                </select>
            </div>
            <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:13px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
                <span style="color:#e65100;">💡 上分金额将存入所选往来账户</span>
            </div>
        </div>
        <div style="padding:10px;background:#fff3e0;border-radius:6px;border:1px solid #ffcc80;font-size:13px;text-align:center;margin-top:10px;">
            <span style="color:#e65100;">💡 无论付款状态如何，都将从玩家账户扣除对应币别的金额（允许余额为负值）</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitUp(${sessionId})">确认上分</button>
        </div>
    `;
    const overlay = showModal(html);
    
    const currencySelect = overlay.querySelector('#upMemberAccountCurrency');
    if (currencySelect) {
        currencySelect.addEventListener('change', function() {
            const display = document.getElementById('selectedMemberCurrencyDisplay');
            if (display) {
                display.textContent = this.value || '-';
            }
        });
    }
    
    const timeModeSelect = overlay.querySelector('#upTimeMode');
    const customTimeGroup = overlay.querySelector('#upCustomTimeGroup');
    const timePreview = overlay.querySelector('#upTimePreview');
    const customTimeInput = overlay.querySelector('#upCustomTime');
    
    if (customTimeInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        customTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    window.toggleUpTimeInput = function() {
        const mode = timeModeSelect.value;
        const nowDt = now();
        const tableDt = tableOpenTime;
        
        if (mode === 'now') {
            customTimeGroup.style.display = 'none';
            timePreview.textContent = formatDate(nowDt);
        } else if (mode === 'table_open') {
            customTimeGroup.style.display = 'none';
            timePreview.textContent = tableDt ? formatDate(tableDt) : formatDate(nowDt);
        } else {
            customTimeGroup.style.display = 'block';
            if (customTimeInput.value) {
                const customDate = customTimeInput.value.replace('T', ' ');
                timePreview.textContent = formatDate(customDate + ':00');
            } else {
                timePreview.textContent = formatDate(nowDt);
            }
        }
    };
    
    if (customTimeInput) {
        customTimeInput.addEventListener('change', function() {
            if (timeModeSelect.value === 'custom' && this.value) {
                const customDate = this.value.replace('T', ' ');
                timePreview.textContent = formatDate(customDate + ':00');
            }
        });
    }
    
    const statusSelect = overlay.querySelector('#upPaymentStatus');
    const paymentMethodGroup = overlay.querySelector('#upPaymentMethodGroup');
    const paymentMethodSelect = overlay.querySelector('#upPaymentMethod');
    const accountSelectGroup = overlay.querySelector('#upAccountSelectGroup');
    const receiverGroup = overlay.querySelector('#upReceiverGroup');
    const memberCurrencySelect = overlay.querySelector('#upMemberAccountCurrency');
    
    window.toggleUpPaymentMethod = function() {
        const status = statusSelect.value;
        if (status === 'paid') {
            paymentMethodGroup.style.display = 'block';
            toggleUpAccountSelect();
            receiverGroup.style.display = 'block';
        } else {
            paymentMethodGroup.style.display = 'none';
            accountSelectGroup.style.display = 'none';
            receiverGroup.style.display = 'none';
        }
    };
    
    window.toggleUpAccountSelect = function() {
        const method = paymentMethodSelect.value;
        if (method === 'member_account') {
            accountSelectGroup.style.display = 'block';
            if (memberCurrencySelect) {
                const display = document.getElementById('selectedMemberCurrencyDisplay');
                if (display) {
                    display.textContent = memberCurrencySelect.value || '-';
                }
            }
        } else {
            accountSelectGroup.style.display = 'none';
        }
    };
    
    setTimeout(() => {
        if (window.toggleUpTimeInput) window.toggleUpTimeInput();
        if (window.toggleUpPaymentMethod) window.toggleUpPaymentMethod();
    }, 50);
}

function submitUp(sessionId) {
    const overlay = document.querySelector('.modal-overlay');
    const amount = parseFloat(overlay.querySelector('#upAmount').value);
    if (!amount || amount <= 0) { alert('请输入有效金额'); return; }
    const currency = overlay.querySelector('#upCurrency').value;
    const paymentStatus = overlay.querySelector('#upPaymentStatus').value;
    const thbAmount = convertToTHB(amount, currency);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    
    const timeMode = overlay.querySelector('#upTimeMode').value;
    let upTime = now();
    if (timeMode === 'table_open') {
        const tableOpenRecord = get_table_open_record(currentTable);
        upTime = tableOpenRecord ? tableOpenRecord.start_time : now();
    } else if (timeMode === 'custom') {
        const customInput = overlay.querySelector('#upCustomTime');
        if (customInput && customInput.value) {
            upTime = customInput.value.replace('T', ' ') + ':00';
        }
    }
    
    const sessions = DB.get('sessions', []);
    const s = sessions.find(x => x.id === sessionId);
    if (s) {
        s.up_amount = (s.up_amount || 0) + thbAmount;
        if (!s.start_time || s.start_time > upTime) {
            s.start_time = upTime;
        }
        DB.set('sessions', sessions);
    }
    
    const member = s ? getMember(s.member_id) : null;
    const memberName = member ? member.name : '未知';
    const memberId = member ? member.id : null;
    
    updateMemberAccountBalance(memberId, currency, -amount);
    const memberAccountTx = DB.get('member_account_transactions', []);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: memberId,
        currency: currency,
        amount: amount,
        type: 'out',
        note: `上分扣除 (${currency}: ${amount}) - 桌号：${currentTable} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    let paymentMethod = 'unpaid';
    let accountId = null;
    let receiverInfo = '';
    let paymentNote = '';
    let memberCurrencyUsed = '';
    
    if (paymentStatus === 'paid') {
        paymentMethod = overlay.querySelector('#upPaymentMethod').value;
        if (paymentMethod === 'member_account') {
            const memberCurrencySelect = overlay.querySelector('#upMemberAccountCurrency');
            if (memberCurrencySelect && memberCurrencySelect.value) {
                memberCurrencyUsed = memberCurrencySelect.value;
                paymentNote = `玩家账户 (${memberCurrencyUsed})`;
            } else {
                paymentNote = `玩家账户 (${currency})`;
            }
        } else {
            paymentMethod = 'cash';
            paymentNote = '现金';
        }
        
        const receiverStr = overlay.querySelector('#upReceiverAccount').value;
        if (receiverStr) {
            const [recId, recCurrency] = receiverStr.split('|');
            const receiverAccountId = parseInt(recId);
            const receiverCurrency = recCurrency;
            const account = getAccount(receiverAccountId);
            if (account) {
                const accountBalances = account.balances || {};
                if (accountBalances[receiverCurrency] === undefined) {
                    add_account_currency(receiverAccountId, receiverCurrency, 0);
                }
            }
            update_account_balance(receiverAccountId, receiverCurrency, thbAmount);
            const accountTx = DB.get('account_transactions', []);
            accountTx.push({
                id: DB.getNextId('account_transactions'),
                account_id: receiverAccountId,
                currency: receiverCurrency,
                amount: thbAmount,
                type: 'in',
                reference_type: 'up_received',
                reference_id: sessionId,
                note: `上分收款 - 玩家 ${memberName} (${amount} ${currency} ≈ ${thbAmount.toFixed(2)} 泰铢) - 付款方式：${paymentNote} - 操作人：${adminName}`,
                admin_id: adminId,
                admin_name: adminName,
                created_at: now()
            });
            DB.set('account_transactions', accountTx);
            receiverInfo = `收款账户：${getAccount(receiverAccountId)?.name || receiverAccountId} - ${receiverCurrency} (存入 ${thbAmount.toFixed(2)} ${receiverCurrency})`;
        }
    } else {
        paymentMethod = 'unpaid';
        paymentNote = '未付（已扣玩家账户）';
    }
    
    const upRecords = DB.get('up_records', []);
    const receiverDisplay = overlay.querySelector('#upReceiverAccount')?.value || '';
    const receiverName = receiverDisplay ? getAccount(parseInt(receiverDisplay.split('|')[0]))?.name || '' : '';
    upRecords.push({
        id: DB.getNextId('up_records'),
        session_id: sessionId,
        up_time: upTime,
        amount: amount,
        currency: currency,
        thb_amount: thbAmount,
        payment_status: paymentStatus,
        payment_method: paymentNote,
        account_id: null,
        account_currency: null,
        member_currency: memberCurrencyUsed || currency,
        receiver: receiverName || '',
        admin_id: adminId,
        admin_name: adminName
    });
    DB.set('up_records', upRecords);
    
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: memberId,
        type: 'recharge',
        amount: thbAmount,
        note: `上分 - ${amount} ${currency} (${thbAmount.toFixed(0)} 泰铢) - 桌号：${currentTable} - 付款状态：${paymentStatus === 'paid' ? '已付' : '未付'} - 付款方式：${paymentNote} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: upTime
    });
    DB.set('transactions', transactions);
    
    addOperationLog('台桌看板', '上分', memberName,
        `${memberName} 上分 ${amount} ${currency} (${thbAmount} 泰铢) - ${currentTable}`, memberId);
    
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    const timeModeMap = { 'now': '即时', 'table_open': '开桌时间', 'custom': '设定时间' };
    const newBalance = getMemberAccountBalance(memberId, currency);
    
    let alertMsg = `✅ 上分完成！\n金额：${amount} ${currency} (${thbAmount.toFixed(0)} 泰铢)\n时间模式：${timeModeMap[timeMode] || '即时'}\n时间：${formatDate(upTime)}\n付款状态：${paymentStatus === 'paid' ? '已付' : '未付'}\n付款方式：${paymentNote}\n玩家账户扣除：${amount} ${currency}\n玩家账户剩余：${newBalance.toFixed(2)} ${currency}\n${receiverInfo}\n操作人：${adminName}`;
    alert(alertMsg);
}

// ============================================================
// 下分功能 - 含權限檢查
// ============================================================

function doDown(sessionId) {
    if (!checkActionPermission('tables', 'down')) {
        showPermissionDenied('下分');
        return;
    }
    
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const member = getMember(session.member_id);
    const memberName = member ? member.name : '未知';
    const currencies = DB.get('currencies', []);
    
    const memberAccount = getMemberAccount(session.member_id);
    const memberBalances = memberAccount.balances || {};
    let totalTHB = 0;
    currencies.forEach(c => {
        const balance = memberBalances[c.currency] || 0;
        totalTHB += balance * getBuyRate(c.currency);
    });
    const nowTime = now();
    const currentProfit = (session.down_amount || 0) - (session.up_amount || 0);
    
    const html = `
        <div class="modal-title">⬇️ 下分 - ${memberName}</div>
        <div style="margin-bottom:10px;padding:10px;background:#fff3e0;border-radius:6px;border:1px solid #ffcc80;font-size:13px;text-align:center;">
            <span style="color:#e65100;">💡 下分金额以泰铢计算，可選擇存入不同幣別（按买入价换算，无条件舍去）</span>
        </div>
        <div style="margin-bottom:10px;padding:8px 12px;background:#f8f9fc;border-radius:6px;font-size:13px;text-align:center;">
            <span style="color:#666;">💰 玩家账户总价值：</span>
            <span style="font-weight:bold;color:#4CAF50;font-size:16px;">${totalTHB.toFixed(2)} 泰铢</span>
        </div>
        <div style="margin-bottom:10px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:12px;text-align:center;color:#666;">
            ${currencies.map(c => {
                const balance = memberBalances[c.currency] || 0;
                const thbValue = balance * getBuyRate(c.currency);
                return `<span style="margin:0 5px;">${c.currency}: ${balance.toFixed(2)} (≈${thbValue.toFixed(2)}泰铢)</span>`;
            }).join(' | ')}
        </div>
        <div class="form-group">
            <label>时间模式 *</label>
            <select id="downTimeMode" onchange="toggleDownTimeInput()">
                <option value="now">🕐 即时（现在）</option>
                <option value="custom">✏️ 设定时间</option>
            </select>
        </div>
        <div id="downCustomTimeGroup" style="display:none;">
            <div class="form-group">
                <label>设定日期时间 *</label>
                <input type="datetime-local" id="downCustomTime" step="1">
            </div>
        </div>
        <div id="downTimeDisplay" style="margin-bottom:10px;padding:8px 12px;background:#f5f5f5;border-radius:6px;text-align:center;font-size:13px;color:#666;">
            将使用时间：<span id="downTimePreview" style="font-weight:bold;color:#2196F3;">${formatDate(nowTime)}</span>
        </div>
        <div class="form-group">
            <label>存入币别 *</label>
            <select id="downCurrency" onchange="updateDownPreview()">
                ${currencies.map(c => `<option value="${c.currency}" ${c.currency === 'THB' ? 'selected' : ''}>${c.currency} (买入${getBuyRate(c.currency)}/卖出${getSellRate(c.currency)})</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>下分金额 (泰铢) *</label>
            <input type="number" id="downAmount" step="0.01" min="0" value="0" oninput="updateDownPreview()">
        </div>
        
        <div id="downPreview" style="margin-bottom:10px;padding:10px;background:#e8f5e9;border-radius:6px;border:1px solid #a5d6a7;text-align:center;display:none;">
            <span style="color:#2e7d32;font-size:13px;">💱 存入 <span id="downPreviewCurrency">-</span> 金额：</span>
            <span id="downPreviewAmount" style="font-size:20px;font-weight:bold;color:#1b5e20;">0.00</span>
            <span id="downPreviewCurrency2" style="font-size:16px;font-weight:bold;color:#1b5e20;">-</span>
            <div style="font-size:12px;color:#666;margin-top:3px;">买入价：1 泰铢 = <span id="downPreviewRate">-</span> <span id="downPreviewCurrency3">-</span>（无条件舍去）</div>
        </div>
        
        <div style="color:#999;font-size:12px;margin-bottom:10px;text-align:center;">输入 0 仅记录下分时间（表示玩家已下桌）</div>
        <div style="padding:10px;background:#f5f5f5;border-radius:6px;font-size:13px;margin-bottom:10px;text-align:center;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                <div><strong>当前上分总额：</strong><span style="color:#2196F3;">${(session.up_amount || 0).toFixed(2)}</span></div>
                <div><strong>当前下分总额：</strong><span style="color:#ff6b6b;">${(session.down_amount || 0).toFixed(2)}</span></div>
                <div><strong>当前盈亏：</strong><span style="color:${currentProfit >= 0 ? '#4CAF50' : '#ff6b6b'}">${currentProfit.toFixed(2)}</span></div>
            </div>
        </div>
        <div style="padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;text-align:center;margin-top:5px;">
            <span style="color:#1565C0;">💡 下分金额将以泰铢存入玩家账户的所选币别（按买入价兑换，无条件舍去）</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-warning" onclick="submitDown(${sessionId})">确认下分</button>
        </div>
    `;
    const overlay = showModal(html);
    
    window.updateDownPreview = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        const currency = overlayEl.querySelector('#downCurrency').value;
        const amount = parseFloat(overlayEl.querySelector('#downAmount').value) || 0;
        const previewDiv = overlayEl.querySelector('#downPreview');
        const previewCurrency = overlayEl.querySelector('#downPreviewCurrency');
        const previewAmount = overlayEl.querySelector('#downPreviewAmount');
        const previewCurrency2 = overlayEl.querySelector('#downPreviewCurrency2');
        const previewRate = overlayEl.querySelector('#downPreviewRate');
        const previewCurrency3 = overlayEl.querySelector('#downPreviewCurrency3');
        
        if (amount > 0) {
            const buyRate = getBuyRate(currency);
            const convertedAmount = Math.floor(amount * buyRate);
            previewDiv.style.display = 'block';
            previewCurrency.textContent = currency;
            previewAmount.textContent = convertedAmount.toFixed(2);
            previewCurrency2.textContent = currency;
            previewRate.textContent = buyRate.toFixed(4);
            previewCurrency3.textContent = currency;
        } else {
            previewDiv.style.display = 'none';
        }
    };
    
    const timeModeSelect = overlay.querySelector('#downTimeMode');
    const customTimeGroup = overlay.querySelector('#downCustomTimeGroup');
    const timePreview = overlay.querySelector('#downTimePreview');
    const customTimeInput = overlay.querySelector('#downCustomTime');
    if (customTimeInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        customTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    window.toggleDownTimeInput = function() {
        const mode = timeModeSelect.value;
        const nowDt = now();
        if (mode === 'now') {
            customTimeGroup.style.display = 'none';
            timePreview.textContent = formatDate(nowDt);
        } else {
            customTimeGroup.style.display = 'block';
            if (customTimeInput.value) {
                const customDate = customTimeInput.value.replace('T', ' ');
                timePreview.textContent = formatDate(customDate + ':00');
            } else {
                timePreview.textContent = formatDate(nowDt);
            }
        }
    };
    
    if (customTimeInput) {
        customTimeInput.addEventListener('change', function() {
            if (timeModeSelect.value === 'custom' && this.value) {
                const customDate = this.value.replace('T', ' ');
                timePreview.textContent = formatDate(customDate + ':00');
            }
        });
    }
    
    setTimeout(() => {
        if (window.toggleDownTimeInput) window.toggleDownTimeInput();
        if (window.updateDownPreview) window.updateDownPreview();
    }, 50);
}

function submitDown(sessionId) {
    const overlay = document.querySelector('.modal-overlay');
    const amount = parseFloat(overlay.querySelector('#downAmount').value) || 0;
    const currency = overlay.querySelector('#downCurrency').value;
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const buyRate = getBuyRate(currency);
    const convertedAmount = Math.floor(amount * buyRate);
    
    const timeMode = overlay.querySelector('#downTimeMode').value;
    let downTime = now();
    if (timeMode === 'custom') {
        const customInput = overlay.querySelector('#downCustomTime');
        if (customInput && customInput.value) {
            downTime = customInput.value.replace('T', ' ') + ':00';
        }
    }
    
    const sessions = DB.get('sessions', []);
    const s = sessions.find(x => x.id === sessionId);
    const member = s ? getMember(s.member_id) : null;
    const memberName = member ? member.name : '未知';
    const memberId = member ? member.id : null;
    
    if (s) {
        s.down_amount = (s.down_amount || 0) + amount;
        s.end_time = downTime;
        s.status = 'settled';
        DB.set('sessions', sessions);
    }
    
    const downRecords = DB.get('down_records', []);
    downRecords.push({
        id: DB.getNextId('down_records'),
        session_id: sessionId,
        down_time: downTime,
        amount: amount,
        currency: 'THB',
        converted_currency: currency,
        converted_amount: convertedAmount,
        admin_id: adminId,
        admin_name: adminName
    });
    DB.set('down_records', downRecords);
    
    if (amount > 0 && memberId) {
        updateMemberAccountBalance(memberId, currency, convertedAmount);
        const memberAccountTx = DB.get('member_account_transactions', []);
        memberAccountTx.push({
            id: DB.getNextId('member_account_transactions'),
            member_id: memberId,
            currency: currency,
            amount: convertedAmount,
            type: 'in',
            note: `下分存入 - ${amount} 泰铢 → ${convertedAmount.toFixed(2)} ${currency} (买入价 ${buyRate}，舍去) - 桌号：${currentTable} - 操作人：${adminName}`,
            admin_id: adminId,
            admin_name: adminName,
            created_at: now()
        });
        DB.set('member_account_transactions', memberAccountTx);
        
        const members = DB.get('members', []);
        const m = members.find(x => x.id === memberId);
        if (m) {
            m.balance += amount;
            DB.set('members', members);
        }
        
        const transactions = DB.get('transactions', []);
        transactions.push({
            id: DB.getNextId('transactions'),
            member_id: memberId,
            type: 'recharge',
            amount: amount,
            note: `下分收入 - ${amount} 泰铢 → ${convertedAmount.toFixed(2)} ${currency} (买入价 ${buyRate}，舍去) - 桌号：${currentTable} - 操作人：${adminName}`,
            admin_id: adminId,
            admin_name: adminName,
            created_at: downTime
        });
        DB.set('transactions', transactions);
        
        const upRecords = DB.get('up_records', []).filter(r => r.session_id === sessionId);
        const unpaidUpRecords = upRecords.filter(r => r.payment_status === 'unpaid');
        const totalUnpaid = unpaidUpRecords.reduce((sum, r) => sum + (r.thb_amount || 0), 0);
        if (totalUnpaid > 0 && (s.down_amount || 0) >= totalUnpaid) {
            const allUpRecords = DB.get('up_records', []);
            allUpRecords.forEach(r => {
                if (r.session_id === sessionId && r.payment_status === 'unpaid') {
                    r.payment_status = 'paid';
                    r.payment_method = '下分抵扣';
                }
            });
            DB.set('up_records', allUpRecords);
        }
    } else if (amount === 0 && memberId) {
        const transactions = DB.get('transactions', []);
        transactions.push({
            id: DB.getNextId('transactions'),
            member_id: memberId,
            type: 'refund',
            amount: 0,
            note: `下桌记录 - 玩家 ${memberName} - 桌号：${currentTable} - 操作人：${adminName}`,
            admin_id: adminId,
            admin_name: adminName,
            created_at: downTime
        });
        DB.set('transactions', transactions);
    }
    
    if (amount > 0) {
        addOperationLog('台桌看板', '下分', memberName,
            `${memberName} 下分 ${amount} 泰铢 → ${convertedAmount} ${currency} - ${currentTable}`, memberId);
    } else {
        addOperationLog('台桌看板', '下桌', memberName,
            `${memberName} 已下桌 - ${currentTable}`, memberId);
    }
    
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    const timeModeMap = { 'now': '即时', 'custom': '设定时间' };
    const newBalance = memberId ? getMemberAccountBalance(memberId, currency) : 0;
    
    if (amount > 0) {
        alert(`✅ 下分完成！\n下分金额：${amount.toFixed(2)} 泰铢\n存入币别：${currency}\n买入价：${buyRate} (舍去)\n兑换存入：${convertedAmount.toFixed(2)} ${currency}\n玩家账户余额：${newBalance.toFixed(2)} ${currency}\n时间模式：${timeModeMap[timeMode] || '即时'}\n时间：${formatDate(downTime)}\n操作人：${adminName}`);
    } else {
        alert(`✅ 已记录下分时间（玩家已下桌）\n时间模式：${timeModeMap[timeMode] || '即时'}\n时间：${formatDate(downTime)}\n操作人：${adminName}`);
    }
}

// ============================================================
// 充值功能 - 含權限檢查
// ============================================================

function doTableRecharge(sessionId) {
    if (!checkActionPermission('tables', 'recharge')) {
        showPermissionDenied('台桌充值');
        return;
    }
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) { alert('找不到玩家记录'); return; }
    const member = getMember(session.member_id);
    if (!member) { alert('找不到会员资料'); return; }
    doRechargeFromTable(member.id, member.name, member.balance);
}

function doRechargeFromTable(memberId, memberName, currentBalance) {
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    const memberAccount = getMemberAccount(memberId);
    const memberBalances = memberAccount.balances || {};
    let totalTHB = 0;
    currencies.forEach(c => {
        const balance = memberBalances[c.currency] || 0;
        totalTHB += balance * getBuyRate(c.currency);
    });
    const html = `
        <div class="modal-title">💰 充值 - ${memberName}</div>
        <div style="margin-bottom:15px;color:#666;text-align:center;">当前主余额：${currentBalance.toFixed(2)} 泰铢</div>
        <div style="margin-bottom:15px;padding:10px;background:#e3f2fd;border-radius:6px;font-size:14px;text-align:center;">
            <span style="color:#1565C0;">💰 玩家账户总价值：</span>
            <span style="font-weight:bold;color:#4CAF50;font-size:18px;">${totalTHB.toFixed(2)} 泰铢</span>
        </div>
        <div style="margin-bottom:10px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:12px;text-align:center;color:#666;">
            ${currencies.map(c => {
                const balance = memberBalances[c.currency] || 0;
                const thbValue = balance * getBuyRate(c.currency);
                return `<span style="margin:0 5px;">${c.currency}: ${balance.toFixed(2)} (≈${thbValue.toFixed(2)}泰铢)</span>`;
            }).join(' | ')}
        </div>
        <div class="form-group"><label>充值金额 (泰铢) *</label><input type="number" id="tableRechargeAmount" step="0.01" min="0.01"></div>
        <div class="form-group"><label>存入币别 *</label>
            <select id="tableRechargeCurrency">
                ${currencies.map(c => `<option value="${c.currency}" ${c.currency === 'THB' ? 'selected' : ''}>${c.currency} (买入${getBuyRate(c.currency)}/卖出${getSellRate(c.currency)})</option>`).join('')}
            </select>
        </div>
        <div style="padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;margin-bottom:10px;text-align:center;">
            <span style="color:#1565C0;">💡 充值金额将存入玩家账户的所选币别，使用<b>买入价</b>换算（无条件舍去）</span>
        </div>
        <div class="form-group"><label>收款账户 *</label>
            <select id="tableRechargeAccount">${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>备注</label><input type="text" id="tableRechargeNote"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitTableRecharge(${memberId})">确认充值</button>
        </div>
    `;
    showModal(html);
}

function submitTableRecharge(memberId) {
    const overlay = document.querySelector('.modal-overlay');
    const amount = parseFloat(overlay.querySelector('#tableRechargeAmount').value);
    if (!amount || amount <= 0) { alert('请输入有效金额'); return; }
    const currency = overlay.querySelector('#tableRechargeCurrency').value;
    const accountId = parseInt(overlay.querySelector('#tableRechargeAccount').value);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const member = getMember(memberId);
    const buyRate = getBuyRate(currency);
    const thbAmount = Math.floor(amount * buyRate);
    
    const members = DB.get('members', []);
    const m = members.find(x => x.id === memberId);
    if (m) {
        m.balance += thbAmount;
        DB.set('members', members);
    }
    updateMemberAccountBalance(memberId, currency, amount);
    const memberAccountTx = DB.get('member_account_transactions', []);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: memberId,
        currency: currency,
        amount: amount,
        type: 'in',
        note: `充值存入 (${currency}: ${amount}) - 买入价 ${buyRate} (舍去) - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
    
    updateAccountBalance(accountId, currency, amount);
    const accountTx = DB.get('account_transactions', []);
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: accountId,
        currency: currency,
        amount: amount,
        type: 'in',
        reference_type: 'recharge',
        reference_id: memberId,
        note: `充值 (${currency}: ${amount}) - 买入价 ${buyRate} (舍去) - ${member ? member.name : '未知'} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: memberId,
        type: 'recharge',
        amount: thbAmount,
        note: `充值 (${currency}: ${amount}) - 买入价 ${buyRate} (舍去) - ${member ? member.name : '未知'} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('transactions', transactions);
    
    const recharges = DB.get('recharge_records', []);
    recharges.push({
        id: DB.getNextId('recharge_records'),
        member_id: memberId,
        amount: amount,
        currency: currency,
        thb_amount: thbAmount,
        receiver: overlay.querySelector('#tableRechargeAccount').options[overlay.querySelector('#tableRechargeAccount').selectedIndex].text,
        note: overlay.querySelector('#tableRechargeNote').value.trim(),
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('recharge_records', recharges);
    addOperationLog('台桌看板', '充值', member ? member.name : '未知',
        `${member ? member.name : '未知'} 充值 ${amount} ${currency} (${thbAmount} 泰铢) - ${currentTable}`, memberId);
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    const newBalance = getMemberAccountBalance(memberId, currency);
    alert(`✅ 充值完成！\n金额：${amount.toFixed(2)} ${currency}\n买入价：${buyRate} (舍去)\n泰铢参考：${thbAmount.toFixed(2)}\n玩家账户余额：${newBalance.toFixed(2)} ${currency}\n操作人：${adminName}`);
}

// ============================================================
// 出金功能 - 含權限檢查
// ============================================================

function doTableWithdraw(sessionId) {
    if (!checkActionPermission('tables', 'table_withdraw')) {
        showPermissionDenied('台桌出金');
        return;
    }
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) { alert('找不到玩家记录'); return; }
    const member = getMember(session.member_id);
    if (!member) { alert('找不到会员资料'); return; }
    const downRecords = DB.get('down_records', []).filter(r => r.session_id === sessionId);
    if (downRecords.length === 0) {
        alert(`⚠️ 玩家 ${member.name} 尚未下桌，请先执行下分操作！`);
        return;
    }
    const tableBalance = (session.down_amount || 0) - (session.up_amount || 0);
    const currencies = DB.get('currencies', []);
    const memberAccount = getMemberAccount(session.member_id);
    const memberBalances = memberAccount.balances || {};
    let totalAccountValue = 0;
    const balanceDetails = [];
    currencies.forEach(c => {
        const balance = memberBalances[c.currency] || 0;
        const rate = getBuyRate(c.currency);
        const thbValue = balance * rate;
        totalAccountValue += thbValue;
        balanceDetails.push({ currency: c.currency, balance: balance, rate: rate, thbValue: thbValue });
    });
    if (totalAccountValue <= 0) {
        alert(`⚠️ 玩家 ${member.name} 的账户总余额为 ${totalAccountValue.toFixed(2)} 泰铢\n账户余额需大于 0 才能出金`);
        return;
    }
    if (tableBalance <= 0) {
        alert(`⚠️ 玩家 ${member.name} 的当桌结余为 ${tableBalance.toFixed(2)}，无法出金\n当桌结余需大于 0 才能出金`);
        return;
    }
    const maxWithdraw = Math.min(tableBalance, totalAccountValue);
    if (maxWithdraw <= 0) {
        alert(`⚠️ 玩家 ${member.name} 无可出金金额\n当桌结余：${tableBalance.toFixed(2)}\n账户总余额：${totalAccountValue.toFixed(2)}`);
        return;
    }
    doWithdrawFromTable(member.id, member.name, sessionId, tableBalance, totalAccountValue, maxWithdraw, balanceDetails);
}

function doWithdrawFromTable(memberId, memberName, sessionId, tableBalance, totalAccountValue, maxWithdraw, balanceDetails) {
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    const memberAccount = getMemberAccount(memberId);
    const memberBalances = memberAccount.balances || {};
    const availableCurrencies = currencies.filter(c => (memberBalances[c.currency] || 0) > 0);
    const accountOptions = get_account_currency_options();
    const availableAccounts = accountOptions.filter(a => a.balance > 0);
    const balanceDisplay = balanceDetails.map(d => {
        const hasBalance = d.balance > 0;
        return `<span style="margin:0 5px;${hasBalance ? 'font-weight:bold;color:#2196F3;' : 'color:#ccc;'}">${d.currency}: ${d.balance.toFixed(2)} (≈${d.thbValue.toFixed(2)}泰铢)</span>`;
    }).join(' | ');
    const html = `
        <div class="modal-title">📤 出金 - ${memberName}</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <div><div style="font-size:12px;color:#666;">当桌结余</div><div style="font-size:20px;font-weight:bold;color:#4CAF50;">${tableBalance.toFixed(2)}</div></div>
                <div><div style="font-size:12px;color:#666;">账户总余额</div><div style="font-size:20px;font-weight:bold;color:#2196F3;">${totalAccountValue.toFixed(2)}</div></div>
                <div><div style="font-size:12px;color:#666;">最大可出金</div><div style="font-size:20px;font-weight:bold;color:#ff6b6b;">${maxWithdraw.toFixed(2)}</div></div>
            </div>
        </div>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;text-align:center;border:1px solid #e8e8e8;">${balanceDisplay}</div>
        <div class="form-group">
            <label>出金来源 *</label>
            <select id="withdrawSource" onchange="toggleWithdrawSource()">
                <option value="table">🎯 台桌盈余（从当桌结余扣除）</option>
                <option value="account">🏦 账户余额（从玩家账户扣除）</option>
            </select>
        </div>
        <div id="withdrawAccountGroup" style="display:none;">
            <div class="form-group">
                <label>扣款币别 *</label>
                <select id="withdrawAccountCurrency">
                    ${availableCurrencies.length === 0 ? '<option value="">⚠️ 玩家账户无余额</option>' :
                    availableCurrencies.map(c => {
                        const balance = memberBalances[c.currency] || 0;
                        const thbValue = balance * getBuyRate(c.currency);
                        return `<option value="${c.currency}" ${balance > 0 ? 'selected' : ''}>${c.currency} (余额：${balance.toFixed(2)} ≈ ${thbValue.toFixed(2)}泰铢)</option>`;
                    }).join('')}
                </select>
            </div>
            <div style="padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;margin-bottom:10px;text-align:center;">
                <span style="color:#1565C0;">💡 将从玩家账户的所选币别扣除等值泰铢金额，使用<b>卖出价</b>换算（无条件舍去）</span>
            </div>
        </div>
        <div class="form-group">
            <label>出金金额 (泰铢) *</label>
            <input type="number" id="tableWithdrawAmount" step="0.01" min="0.01" max="${maxWithdraw}" value="${maxWithdraw}" oninput="updateWithdrawPreview()">
            <div style="font-size:12px;color:#999;margin-top:4px;">最大可出金：${maxWithdraw.toFixed(2)} 泰铢</div>
        </div>
        <div id="withdrawPreview" style="margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;display:none;">
            <span style="color:#e65100;">💡 将从 <span id="previewSource">台桌盈余</span> 扣除 <span id="previewAmount">0.00</span> 泰铢</span>
        </div>
        <div class="form-group">
            <label>支付账户 *</label>
            <select id="withdrawPaymentAccount">
                ${availableAccounts.length === 0 ? '<option value="">⚠️ 暂无可用账户（请先充值往来账户）</option>' :
                availableAccounts.map(a => `<option value="${a.id}|${a.currency}">${a.name} - ${a.currency} (余额：${a.balance.toFixed(2)})</option>`).join('')}
            </select>
            ${availableAccounts.length === 0 ? '<div style="font-size:12px;color:#ff6b6b;margin-top:4px;">⚠️ 请先到「往来账款」页面为账户充值</div>' : ''}
        </div>
        <div class="form-group"><label>备注</label><input type="text" id="tableWithdrawNote"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-warning" onclick="submitTableWithdraw(${memberId}, ${sessionId})">确认出金</button>
        </div>
    `;
    const overlay = showModal(html);
    window.updateWithdrawPreview = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        const sourceSelect = overlayEl.querySelector('#withdrawSource');
        const amountInput = overlayEl.querySelector('#tableWithdrawAmount');
        const previewDiv = overlayEl.querySelector('#withdrawPreview');
        const previewSource = overlayEl.querySelector('#previewSource');
        const previewAmount = overlayEl.querySelector('#previewAmount');
        const source = sourceSelect.value;
        const amount = parseFloat(amountInput.value) || 0;
        previewDiv.style.display = 'block';
        previewSource.textContent = source === 'table' ? '台桌盈余' : '玩家账户余额';
        previewAmount.textContent = amount.toFixed(2);
        if (amount > maxWithdraw) {
            previewDiv.style.background = '#ffebee';
            previewDiv.style.borderColor = '#ef9a9a';
            previewDiv.innerHTML = `<span style="color:#c62828;">⚠️ 金额超过最大可出金 (${maxWithdraw.toFixed(2)})</span>`;
        } else {
            previewDiv.style.background = '#fff8e1';
            previewDiv.style.borderColor = '#ffcc80';
            previewDiv.innerHTML = `<span style="color:#e65100;">💡 将从 <span id="previewSource">${source === 'table' ? '台桌盈余' : '玩家账户余额'}</span> 扣除 <span id="previewAmount">${amount.toFixed(2)}</span> 泰铢</span>`;
        }
    };
    window.toggleWithdrawSource = function() {
        const source = overlay.querySelector('#withdrawSource').value;
        const accountGroup = overlay.querySelector('#withdrawAccountGroup');
        if (source === 'account') {
            accountGroup.style.display = 'block';
        } else {
            accountGroup.style.display = 'none';
        }
        if (window.updateWithdrawPreview) window.updateWithdrawPreview();
    };
    setTimeout(() => {
        if (window.updateWithdrawPreview) window.updateWithdrawPreview();
    }, 50);
}

function submitTableWithdraw(memberId, sessionId) {
    const overlay = document.querySelector('.modal-overlay');
    const amount = parseFloat(overlay.querySelector('#tableWithdrawAmount').value);
    if (!amount || amount <= 0) { alert('请输入有效金额'); return; }
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) { alert('找不到玩家台桌记录'); return; }
    const member = getMember(memberId);
    if (!member) { alert('找不到会员资料'); return; }
    const tableBalance = (session.down_amount || 0) - (session.up_amount || 0);
    const currencies = DB.get('currencies', []);
    const memberAccount = getMemberAccount(memberId);
    const memberBalances = memberAccount.balances || {};
    let totalAccountValue = 0;
    currencies.forEach(c => {
        const balance = memberBalances[c.currency] || 0;
        totalAccountValue += balance * getBuyRate(c.currency);
    });
    const maxWithdraw = Math.min(tableBalance, totalAccountValue);
    if (amount > maxWithdraw) {
        alert(`⚠️ 出金金额超过最大可出金金额！\n最大可出金：${maxWithdraw.toFixed(2)}\n当桌结余：${tableBalance.toFixed(2)}\n账户总余额：${totalAccountValue.toFixed(2)}`);
        return;
    }
    const withdrawSource = overlay.querySelector('#withdrawSource').value;
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const paymentAccountStr = overlay.querySelector('#withdrawPaymentAccount').value;
    if (!paymentAccountStr) { alert('请选择支付账户'); return; }
    const [accountId, accountCurrency] = paymentAccountStr.split('|');
    const accountBalance = get_account_balance(parseInt(accountId), accountCurrency);
    if (accountBalance < amount) {
        alert(`⚠️ 账户 ${accountCurrency} 余额不足！\n当前余额：${accountBalance.toFixed(2)}\n需要：${amount.toFixed(2)}`);
        return;
    }
    let sourceText = '';
    let sourceCurrency = 'THB';
    let sourceAmount = amount;
    if (withdrawSource === 'account') {
        sourceText = '账户余额';
        sourceCurrency = overlay.querySelector('#withdrawAccountCurrency').value;
        const sellRate = getSellRate(sourceCurrency);
        const deductAmount = convertFromTHB(amount, sourceCurrency);
        if (deductAmount < 1) {
            alert(`⚠️ 兑换金额不足 1 ${sourceCurrency}！\n泰铢：${amount} / 卖出价 ${sellRate} = ${(amount/sellRate).toFixed(4)} ${sourceCurrency}\n请增加出金金额。`);
            return;
        }
        const currentBalance = memberBalances[sourceCurrency] || 0;
        if (currentBalance < deductAmount) {
            if (!confirm(`⚠️ 玩家 ${sourceCurrency} 账户余额不足！\n当前余额：${currentBalance.toFixed(2)}\n需要：${deductAmount.toFixed(2)}\n是否继续（余额将变为负值）？`)) { return; }
        }
        updateMemberAccountBalance(memberId, sourceCurrency, -deductAmount);
        sourceAmount = deductAmount;
        const memberAccountTx = DB.get('member_account_transactions', []);
        memberAccountTx.push({
            id: DB.getNextId('member_account_transactions'),
            member_id: memberId,
            currency: sourceCurrency,
            amount: deductAmount,
            type: 'out',
            note: `出金扣除 - 来源：账户余额 (${sourceCurrency}: ${deductAmount.toFixed(2)}) - 卖出价 ${sellRate} (舍去) - 操作人：${adminName}`,
            admin_id: adminId,
            admin_name: adminName,
            created_at: now()
        });
        DB.set('member_account_transactions', memberAccountTx);
        const members = DB.get('members', []);
        const m = members.find(x => x.id === memberId);
        if (m) {
            m.balance -= amount;
            DB.set('members', members);
        }
    } else {
        sourceText = '台桌盈余';
        session.down_amount = (session.down_amount || 0) - amount;
        session.profit = (session.down_amount || 0) - (session.up_amount || 0);
        DB.set('sessions', sessions);
    }
    update_account_balance(parseInt(accountId), accountCurrency, -amount);
    const accountTx = DB.get('account_transactions', []);
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: parseInt(accountId),
        currency: accountCurrency,
        amount: amount,
        type: 'out',
        reference_type: 'withdraw_payment',
        reference_id: memberId,
        note: `出金支付 - 玩家 ${member.name} - 来源：${sourceText} - 金额：${amount} ${accountCurrency} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: memberId,
        type: 'refund',
        amount: amount,
        note: `出金 - 玩家 ${member.name} - 来源：${sourceText} - 支付账户：${accountCurrency} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('transactions', transactions);
    const withdraws = DB.get('withdraw_records', []);
    withdraws.push({
        id: DB.getNextId('withdraw_records'),
        member_id: memberId,
        amount: amount,
        currency: accountCurrency,
        thb_amount: amount,
        sender: `${sourceText} (${accountCurrency})`,
        note: overlay.querySelector('#tableWithdrawNote').value.trim() || `出金 - 来源：${sourceText} - 支付账户：${accountCurrency}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('withdraw_records', withdraws);
    addOperationLog('台桌看板', '出金', member ? member.name : '未知',
        `${member ? member.name : '未知'} 出金 ${amount} 泰铢 - ${currentTable}`, memberId);
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    const newTableBalance = (session.down_amount || 0) - (session.up_amount || 0);
    const updatedAccount = getMemberAccount(memberId);
    const updatedBalances = updatedAccount.balances || {};
    let newTotalValue = 0;
    currencies.forEach(c => {
        const balance = updatedBalances[c.currency] || 0;
        newTotalValue += balance * getBuyRate(c.currency);
    });
    alert(`✅ 出金完成！\n\n金额：${amount.toFixed(2)} 泰铢\n出金来源：${sourceText}\n支付账户：${accountCurrency}\n剩余当桌结余：${newTableBalance.toFixed(2)}\n账户总余额：${newTotalValue.toFixed(2)} 泰铢\n操作人：${adminName}`);
}

// ============================================================
// 換幣功能 - 含權限檢查
// ============================================================

function doTableExchange(sessionId) {
    if (!checkActionPermission('tables', 'table_exchange')) {
        showPermissionDenied('台桌換幣');
        return;
    }
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) { alert('找不到玩家记录'); return; }
    const member = getMember(session.member_id);
    if (!member) { alert('找不到会员资料'); return; }
    showTableExchange(member.id, member.name, session.table_type, session.id);
}

function showTableExchange(memberId, memberName, tableType, sessionId) {
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    const memberAccount = getMemberAccount(memberId);
    const balances = memberAccount.balances || {};
    const availableFromCurrencies = currencies.filter(c => (balances[c.currency] || 0) > 0);
    if (availableFromCurrencies.length === 0) {
        alert(`⚠️ ${memberName} 所有币种余额均为 0，无法换币`);
        return;
    }
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
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" data-buy="${getBuyRate(c.currency)}" data-sell="${getSellRate(c.currency)}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    const fromCurrencyOptions = availableFromCurrencies.map(c => 
        `<option value="${c.currency}" data-balance="${balances[c.currency] || 0}" data-buy="${getBuyRate(c.currency)}" data-sell="${getSellRate(c.currency)}">${c.currency} (余额: ${(balances[c.currency] || 0).toFixed(2)})</option>`
    ).join('');
    const html = `
        <div class="modal-title" style="font-size:20px;">🔄 换币 - ${memberName}</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;font-size:14px;">💡 换币规则：所有换汇结果均<b>无条件舍去到整数位</b></span>
            <span style="color:#1565C0;font-size:12px;display:block;margin-top:4px;">📍 桌号：${tableType}</span>
        </div>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;text-align:center;border:1px solid #e8e8e8;">
            ${currencies.map((c, index) => {
                const balance = balances[c.currency] || 0;
                const buyRate = getBuyRate(c.currency);
                const sellRate = getSellRate(c.currency);
                return `<span style="margin:0 8px;${balance > 0 ? 'font-weight:bold;color:#2196F3;' : 'color:#ccc;'}">${c.currency}: ${balance.toFixed(2)} (买入${buyRate}/卖出${sellRate})</span>${index < currencies.length - 1 ? ' | ' : ''}`;
            }).join('')}
        </div>
        <div style="margin-bottom:15px;padding:12px;background:#ffebee;border-radius:8px;border:1px solid #ef9a9a;">
            <h4 style="margin:0 0 10px 0;color:#c62828;font-size:14px;">📤 出金（從玩家帳戶扣除 → 存入出金帳戶）</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>出金幣種（玩家扣除）*</label>
                    <select id="tableExchangeFromCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onchange="updateTableExchangePreview()">${fromCurrencyOptions}</select>
                    <div style="font-size:11px;color:#666;margin-top:4px;">玩家餘額：<strong id="tableFromBalanceAmount" style="color:#2196F3;">0.00</strong></div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>出金金額 *</label>
                    <input type="number" id="tableExchangeAmount" step="0.01" min="0.01" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" oninput="updateTableExchangePreview()" placeholder="请输入要兑换的金额">
                </div>
            </div>
            <div style="margin-top:8px;">
                <label style="font-size:12px;color:#666;">📥 存入出金帳戶 *</label>
                <select id="tableExchangeFromAccount" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-top:2px;" onchange="updateTableExchangePreview()">${accountOptions}</select>
                <div id="tableFromAccountBalanceDisplay" style="font-size:11px;color:#666;margin-top:4px;">帳戶餘額：<strong id="tableFromAccountBalance" style="color:#2196F3;">0.00</strong></div>
            </div>
        </div>
        <div style="margin-bottom:15px;padding:12px;background:#e8f5e9;border-radius:8px;border:1px solid #a5d6a7;">
            <h4 style="margin:0 0 10px 0;color:#2e7d32;font-size:14px;">📥 入金（從入金帳戶扣除 → 存入玩家帳戶）</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>入金幣種（玩家存入）*</label>
                    <select id="tableExchangeToCurrency" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onchange="updateTableExchangePreview()">${currencyOptions}</select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>入金金額（自動計算）</label>
                    <div id="tableExchangeResultDisplay" style="width:100%;padding:8px 12px;border:1px solid #e0e0e0;border-radius:6px;font-size:16px;font-weight:bold;color:#1b5e20;background:#f5f5f5;text-align:center;min-height:40px;display:flex;align-items:center;justify-content:center;">0.00</div>
                </div>
            </div>
            <div style="margin-top:8px;">
                <label style="font-size:12px;color:#666;">📤 從入金帳戶扣除 *</label>
                <select id="tableExchangeToAccount" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-top:2px;" onchange="updateTableExchangePreview()">${accountOptions}</select>
                <div id="tableToAccountBalanceDisplay" style="font-size:11px;color:#666;margin-top:4px;">帳戶餘額：<strong id="tableToAccountBalance" style="color:#4CAF50;">0.00</strong></div>
            </div>
        </div>
        <div id="tableExchangePreview" style="margin-bottom:15px;padding:15px;background:#e8f5e9;border-radius:8px;border:1px solid #a5d6a7;text-align:center;">
            <div style="font-size:14px;color:#2e7d32;">💱 兑换后可获得：<span id="tableExchangeResultAmount" style="font-size:24px;font-weight:bold;color:#1b5e20;">0.00</span> <span id="tableExchangeResultCurrency" style="font-size:18px;font-weight:bold;color:#1b5e20;">-</span></div>
            <div style="font-size:12px;color:#666;margin-top:5px;"><span id="tableExchangeDirection" style="font-weight:bold;">-</span></div>
            <div id="tableExchangeDetail" style="font-size:12px;color:#888;margin-top:3px;"></div>
        </div>
        <div style="padding:10px;background:#fff3e0;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">⚠️ 所有换汇结果均无条件舍去到整数位</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitTableExchange(${memberId}, '${tableType}', ${sessionId ? sessionId : 'null'})">✅ 确认兑换</button>
        </div>
    `;
    const overlay = showModal(html);
    window.updateTableExchangePreview = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        const fromSelect = overlayEl.querySelector('#tableExchangeFromCurrency');
        const toSelect = overlayEl.querySelector('#tableExchangeToCurrency');
        const amountInput = overlayEl.querySelector('#tableExchangeAmount');
        const fromAccountSelect = overlayEl.querySelector('#tableExchangeFromAccount');
        const toAccountSelect = overlayEl.querySelector('#tableExchangeToAccount');
        const resultAmount = overlayEl.querySelector('#tableExchangeResultAmount');
        const resultCurrency = overlayEl.querySelector('#tableExchangeResultCurrency');
        const resultDisplay = overlayEl.querySelector('#tableExchangeResultDisplay');
        const directionSpan = overlayEl.querySelector('#tableExchangeDirection');
        const detailSpan = overlayEl.querySelector('#tableExchangeDetail');
        const fromBalanceAmount = overlayEl.querySelector('#tableFromBalanceAmount');
        const fromAccountBalance = overlayEl.querySelector('#tableFromAccountBalance');
        const toAccountBalance = overlayEl.querySelector('#tableToAccountBalance');
        const fromCurrency = fromSelect.value;
        const toCurrency = toSelect.value;
        const amount = parseFloat(amountInput.value) || 0;
        const selectedFromOption = fromSelect.options[fromSelect.selectedIndex];
        const fromBalance = parseFloat(selectedFromOption?.dataset?.balance || 0);
        if (fromBalanceAmount) fromBalanceAmount.textContent = fromBalance.toFixed(2);
        const selectedFromAccount = fromAccountSelect.options[fromAccountSelect.selectedIndex];
        const selectedToAccount = toAccountSelect.options[toAccountSelect.selectedIndex];
        if (selectedFromAccount && fromAccountBalance) {
            const fromAccBalance = parseFloat(selectedFromAccount.dataset.balance || 0);
            const fromAccCurrency = selectedFromAccount.dataset.currency || 'THB';
            fromAccountBalance.textContent = fromAccBalance.toFixed(2) + ' ' + fromAccCurrency;
            fromAccountBalance.style.color = fromAccBalance >= 0 ? '#2196F3' : '#c62828';
        }
        if (selectedToAccount && toAccountBalance) {
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
        if (resultDisplay) { resultDisplay.textContent = result.toFixed(2) + ' ' + toCurrency; }
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
        if (window.updateTableExchangePreview) window.updateTableExchangePreview();
    }, 50);
}

function submitTableExchange(memberId, tableType, sessionId) {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    const fromSelect = overlay.querySelector('#tableExchangeFromCurrency');
    const toSelect = overlay.querySelector('#tableExchangeToCurrency');
    const amountInput = overlay.querySelector('#tableExchangeAmount');
    const fromAccountSelect = overlay.querySelector('#tableExchangeFromAccount');
    const toAccountSelect = overlay.querySelector('#tableExchangeToAccount');
    const fromCurrency = fromSelect.value;
    const toCurrency = toSelect.value;
    const amount = parseFloat(amountInput.value);
    const fromAccountStr = fromAccountSelect.value;
    const toAccountStr = toAccountSelect.value;
    if (!amount || amount <= 0) { alert('请输入有效的兑换金额'); return; }
    if (fromCurrency === toCurrency) { alert('出金币种和入金币种不能相同'); return; }
    const fromBalance = parseFloat(fromSelect.options[fromSelect.selectedIndex]?.dataset?.balance || 0);
    if (amount > fromBalance) {
        alert(`⚠️ ${fromCurrency} 玩家余额不足！\n当前余额：${fromBalance.toFixed(2)}\n需要：${amount.toFixed(2)}`);
        return;
    }
    if (!fromAccountStr) { alert('請選擇有效的出金帳戶'); return; }
    const [fromAccountIdStr] = fromAccountStr.split('|');
    const fromAccountId = parseInt(fromAccountIdStr);
    if (!fromAccountId) { alert('請選擇有效的出金帳戶'); return; }
    if (!toAccountStr) { alert('請選擇有效的入金帳戶'); return; }
    const [toAccountIdStr] = toAccountStr.split('|');
    const toAccountId = parseInt(toAccountIdStr);
    if (!toAccountId) { alert('請選擇有效的入金帳戶'); return; }
    
    const fromBuy = getBuyRate(fromCurrency);
    const fromSell = getSellRate(fromCurrency);
    const toBuy = getBuyRate(toCurrency);
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
        if (!confirm(`⚠️ 出金帳戶 ${fromCurrency} 餘額不足！\n當前餘額：${fromAccountBalance.toFixed(2)} ${fromCurrency}\n需要：${amount.toFixed(2)} ${fromCurrency}\n是否仍要繼續？（餘額將變為負值）`)) { return; }
    }
    const toAccountBalance = get_account_balance(toAccountId, toCurrency);
    if (toAccountBalance < toAmount) {
        if (!confirm(`⚠️ 入金帳戶 ${toCurrency} 餘額不足！\n當前餘額：${toAccountBalance.toFixed(2)} ${toCurrency}\n需要：${toAmount.toFixed(2)} ${toCurrency}\n是否仍要繼續？（餘額將變為負值）`)) { return; }
    }
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const member = getMember(memberId);
    let confirmMsg = `确认兑换？\n\n📤 出金（玩家扣除 → 出金帳戶）：\n   從玩家帳戶扣除：${amount.toFixed(2)} ${fromCurrency}\n   存入出金帳戶：${amount.toFixed(2)} ${fromCurrency}\n   出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId}\n\n📥 入金（入金帳戶 → 玩家存入）：\n   從入金帳戶扣除：${toAmount.toFixed(2)} ${toCurrency}\n   存入玩家帳戶：${toAmount.toFixed(2)} ${toCurrency}\n   入金帳戶：${getAccount(toAccountId)?.name || toAccountId}\n\n汇率方向：${directionLabel}\n买入价：${buyRate}\n卖出价：${sellRate}\n会员：${member ? member.name : '未知'}\n桌号：${tableType}\n\n`;
    if (fromCurrency === 'THB') {
        confirmMsg += `计算：${amount} 泰铢 ÷ 卖出价 ${sellRate} = ${toAmount} ${toCurrency}`;
    } else if (toCurrency === 'THB') {
        confirmMsg += `计算：${amount} ${fromCurrency} × 买入价 ${buyRate} = ${(amount * buyRate).toFixed(4)} → 舍去 = ${toAmount} 泰铢`;
    } else {
        const thbValue = convertToTHB(amount, fromCurrency);
        confirmMsg += `计算：${amount} ${fromCurrency} × 买入价 ${buyRate} = ${thbValue} 泰铢 → ${thbValue} ÷ 卖出价 ${sellRate} = ${toAmount} ${toCurrency}`;
    }
    if (!confirm(confirmMsg)) return;
    
    // 執行換幣
    updateMemberAccountBalance(memberId, fromCurrency, -amount);
    const memberAccountTx = DB.get('member_account_transactions', []);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: memberId,
        currency: fromCurrency,
        amount: amount,
        type: 'out',
        note: `台桌换币出金 - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel}) - 桌号：${tableType} - 出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
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
        note: `台桌换币出金存入 - 會員 ${member ? member.name : '未知'} - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel}) - 桌号：${tableType} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    update_account_balance(toAccountId, toCurrency, -toAmount);
    accountTx.push({
        id: DB.getNextId('account_transactions'),
        account_id: toAccountId,
        currency: toCurrency,
        amount: toAmount,
        type: 'out',
        reference_type: 'exchange_deposit',
        reference_id: memberId,
        note: `台桌换币入金扣除 - 會員 ${member ? member.name : '未知'} - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel}) - 桌号：${tableType} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('account_transactions', accountTx);
    updateMemberAccountBalance(memberId, toCurrency, toAmount);
    memberAccountTx.push({
        id: DB.getNextId('member_account_transactions'),
        member_id: memberId,
        currency: toCurrency,
        amount: toAmount,
        type: 'in',
        note: `台桌换币入金 - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel}) - 桌号：${tableType} - 入金帳戶：${getAccount(toAccountId)?.name || toAccountId} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('member_account_transactions', memberAccountTx);
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
        note: `🔄 台桌换币 - ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (${directionLabel}) - 桌号：${tableType}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('transactions', transactions);
    if (typeof addExchangeRecord === 'function') {
        addExchangeRecord(
            memberId,
            member ? member.name : '未知',
            tableType,
            fromCurrency,
            amount,
            toCurrency,
            toAmount,
            direction,
            buyRate,
            sellRate,
            sessionId,
            `台桌换币 - ${tableType} - 方向：${directionLabel} - 出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId} → 入金帳戶：${getAccount(toAccountId)?.name || toAccountId} - 操作人：${adminName}`
        );
    }
    addOperationLog('台桌看板', '换币', member ? member.name : '未知',
        `${member ? member.name : '未知'} 台桌换币：${amount} ${fromCurrency} → ${toAmount} ${toCurrency} (${directionLabel}) - ${tableType} - 出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId} → 入金帳戶：${getAccount(toAccountId)?.name || toAccountId}`, memberId);
    overlay.remove();
    const newFromBalance = getMemberAccountBalance(memberId, fromCurrency);
    const newToBalance = getMemberAccountBalance(memberId, toCurrency);
    const newFromAccountBalance = get_account_balance(fromAccountId, fromCurrency);
    const newToAccountBalance = get_account_balance(toAccountId, toCurrency);
    alert(`✅ 换币完成！\n\n📤 出金（玩家 → 出金帳戶）：\n   玩家扣除：-${amount.toFixed(2)} ${fromCurrency}（剩餘：${newFromBalance.toFixed(2)}）\n   出金帳戶存入：+${amount.toFixed(2)} ${fromCurrency}（餘額：${newFromAccountBalance.toFixed(2)}）\n   出金帳戶：${getAccount(fromAccountId)?.name || fromAccountId}\n\n📥 入金（入金帳戶 → 玩家）：\n   入金帳戶扣除：-${toAmount.toFixed(2)} ${toCurrency}（餘額：${newToAccountBalance.toFixed(2)}）\n   玩家存入：+${toAmount.toFixed(2)} ${toCurrency}（餘額：${newToBalance.toFixed(2)}）\n   入金帳戶：${getAccount(toAccountId)?.name || toAccountId}\n\n汇率方向：${directionLabel}\n买入价：${buyRate}\n卖出价：${sellRate}\n桌号：${tableType}\n操作人：${adminName}`);
    renderTables(document.getElementById('mainContent'));
}

// ============================================================
// 歷史紀錄 - 含權限檢查
// ============================================================

function showTableHistory() {
    if (!checkActionPermission('tables', 'view_history')) {
        showPermissionDenied('查看歷史紀錄');
        return;
    }
    const settlements = DB.get('daily_settlements', []);
    const filtered = settlements.filter(s => s.table_type === currentTable);
    filtered.sort((a, b) => new Date(b.settle_time) - new Date(a.settle_time));
    let html = `
        <div class="modal-title">📜 ${currentTable} 历史纪录</div>
        <div style="max-height:500px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">开桌时间</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">结算时间</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">玩家数</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">总上分</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">总下分</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">总盈亏</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">总抽水</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">总退水</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">抽水扣费</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">保险次数</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">保险收益</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">保险扣费</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">小费总额</th>
                    <th style="padding:8px;border-bottom:2px solid #eee;text-align:center;">操作</th>
                </tr></thead>
                <tbody>
                    ${filtered.length === 0 ? '<tr><td colspan="14" style="text-align:center;padding:20px;color:#999;">暂无历史纪录</td></tr>' :
                    filtered.slice(0, 30).map(s => {
                        const profit = (s.total_down || 0) - (s.total_up || 0);
                        const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
                        const profitColor = profit >= 0 ? '#4CAF50' : '#ff6b6b';
                        return `<tr>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(s.open_time)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(s.settle_time)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${s.player_count}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${(s.total_up || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${(s.total_down || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;color:${profitColor};font-weight:bold;">${profitDisplay}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${(s.total_water || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${(s.total_rebate || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;color:#c62828;font-weight:bold;">${(s.water_fee || s.fee || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">${(s.insurance_count || 0)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;color:#1b5e20;">${(s.insurance_earnings || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;color:#c62828;font-weight:bold;">${(s.insurance_fee || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;color:#ffa726;font-weight:bold;">${(s.tips_total || 0).toFixed(2)}</td>
                            <td style="padding:6px;border-bottom:1px solid #f0f0f0;text-align:center;">
                                <button class="btn btn-info btn-sm" onclick="viewSettlementDetail(${s.id})">详情</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModal(html);
}

function viewSettlementDetail(id) {
    const settlements = DB.get('daily_settlements', []);
    const settlement = settlements.find(s => s.id === id);
    if (!settlement) { alert('找不到记录'); return; }
    let playerDetails = [];
    let rebateDetails = [];
    let tipsDetails = [];
    try {
        playerDetails = JSON.parse(settlement.player_details || '[]');
        rebateDetails = JSON.parse(settlement.rebate_details || '[]');
        tipsDetails = JSON.parse(settlement.tips_details || '[]');
    } catch(e) {}
    let html = `
        <div class="modal-title">📊 ${settlement.table_type} 结算详情</div>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:8px;font-size:14px;text-align:center;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
                <div><strong>开桌时间：</strong>${settlement.open_time}</div>
                <div><strong>结算时间：</strong>${settlement.settle_time}</div>
                <div><strong>玩家数：</strong>${settlement.player_count}</div>
                <div><strong>总上分：</strong>${(settlement.total_up || 0).toFixed(2)}</div>
                <div><strong>总下分：</strong>${(settlement.total_down || 0).toFixed(2)}</div>
                <div><strong>总盈亏：</strong>${(settlement.total_profit || 0).toFixed(2)}</div>
                <div><strong>总抽水：</strong>${(settlement.total_water || 0).toFixed(2)}</div>
                <div><strong>总退水：</strong>${(settlement.total_rebate || 0).toFixed(2)}</div>
                <div><strong>抽水扣费：</strong><span style="color:#c62828;font-weight:bold;">${(settlement.water_fee || settlement.fee || 0).toFixed(2)}</span></div>
                <div><strong>总时长：</strong>${formatDuration(settlement.total_duration || 0)}</div>
                ${settlement.insurance_earnings !== undefined ? `<div><strong>保险收益：</strong><span style="color:#1b5e20;">${(settlement.insurance_earnings || 0).toFixed(2)}</span></div>` : ''}
                ${settlement.insurance_fee !== undefined ? `<div><strong>保险扣费：</strong><span style="color:#c62828;font-weight:bold;">${(settlement.insurance_fee || 0).toFixed(2)}</span></div>` : ''}
                ${settlement.insurance_count !== undefined ? `<div><strong>保险次数：</strong>${settlement.insurance_count || 0}</div>` : ''}
                ${settlement.tips_total !== undefined ? `<div><strong>小费总额：</strong><span style="color:#ffa726;font-weight:bold;">${(settlement.tips_total || 0).toFixed(2)}</span></div>` : ''}
                ${settlement.negative_count > 0 ? `<div><strong>负值玩家：</strong>${settlement.negative_count} 人</div>` : ''}
                ${settlement.rebate_account_id ? `<div><strong>退水出款帳戶：</strong>${getAccount(settlement.rebate_account_id)?.name || settlement.rebate_account_id} (${settlement.rebate_currency || 'THB'})</div>` : ''}
                ${settlement.rebate_total ? `<div><strong>退水總額：</strong>${settlement.rebate_total.toFixed(2)}</div>` : ''}
            </div>
        </div>
        ${tipsDetails.length > 0 ? `
            <h4 style="text-align:center;margin-bottom:10px;">💰 小费明细</h4>
            <div style="max-height:200px;overflow-y:auto;margin-bottom:10px;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">员工</th>
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">金额</th>
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">时间</th>
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">备注</th>
                    </tr></thead>
                    <tbody>
                        ${tipsDetails.map(r => `
                            <tr>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;"><strong>${r.employee_name}</strong></td>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;color:#ffa726;font-weight:bold;">${r.amount.toFixed(2)}</td>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:11px;">${formatDate(r.created_at)}</td>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:11px;color:#666;">${r.note || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
        ${rebateDetails.length > 0 ? `
            <h4 style="text-align:center;margin-bottom:10px;">📊 退水明细</h4>
            <div style="max-height:200px;overflow-y:auto;margin-bottom:10px;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">玩家</th>
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">介绍人</th>
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">退水率</th>
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">时长</th>
                        <th style="padding:4px;border-bottom:2px solid #eee;text-align:center;">退水金额</th>
                    </tr></thead>
                    <tbody>
                        ${rebateDetails.map(r => `
                            <tr>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.memberName}</td>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.agentName}</td>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.rebateRate}%</td>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDuration(r.duration)}</td>
                                <td style="padding:3px;border-bottom:1px solid #f0f0f0;text-align:center;color:#4CAF50;font-weight:bold;">${r.rebateAmount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
        ${playerDetails.length > 0 ? `
            <h4 style="text-align:center;margin-bottom:10px;">👤 玩家列表</h4>
            <div style="max-height:200px;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                        <th style="padding:6px;border-bottom:2px solid #eee;text-align:center;">玩家</th>
                        <th style="padding:6px;border-bottom:2px solid #eee;text-align:center;">介绍人</th>
                        <th style="padding:6px;border-bottom:2px solid #eee;text-align:center;">上分</th>
                        <th style="padding:6px;border-bottom:2px solid #eee;text-align:center;">下分</th>
                        <th style="padding:6px;border-bottom:2px solid #eee;text-align:center;">盈亏</th>
                        <th style="padding:6px;border-bottom:2px solid #eee;text-align:center;">时长</th>
                        <th style="padding:6px;border-bottom:2px solid #eee;text-align:center;">退水</th>
                    </tr></thead>
                    <tbody>
                        ${playerDetails.map(p => {
                            const profit = (p.down_amount || 0) - (p.up_amount || 0);
                            const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
                            const profitColor = profit >= 0 ? '#4CAF50' : '#ff6b6b';
                            return `<tr>
                                <td style="padding:4px;border-bottom:1px solid #f0f0f0;text-align:center;">${p.name}</td>
                                <td style="padding:4px;border-bottom:1px solid #f0f0f0;text-align:center;">${p.agent}</td>
                                <td style="padding:4px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.up_amount || 0).toFixed(2)}</td>
                                <td style="padding:4px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.down_amount || 0).toFixed(2)}</td>
                                <td style="padding:4px;border-bottom:1px solid #f0f0f0;text-align:center;color:${profitColor};font-weight:bold;">${profitDisplay}</td>
                                <td style="padding:4px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDuration(p.duration || 0)}</td>
                                <td style="padding:4px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.rebate || 0).toFixed(2)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p style="text-align:center;color:#999;">暂无玩家详情</p>'}
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModal(html);
}

// ============================================================
// 查看所有玩家明细
// ============================================================

function showAllSessionDetails() {
    const sessions = DB.get('sessions', []);
    const members = DB.get('members', []);
    const agents = DB.get('agents', []);
    const playerSessions = sessions.filter(s => s.table_type === currentTable && s.session_type === 'player');
    if (playerSessions.length === 0) { alert('当前桌没有玩家'); return; }
    let html = `
        <div class="modal-title">📋 ${currentTable} - 所有玩家明细</div>
        <div style="max-height:500px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">序号</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">玩家</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">介绍人</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">上分</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">下分</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">盈亏</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">时长</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">状态</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;">操作</th>
                </tr></thead>
                <tbody>
                    ${playerSessions.map((s, i) => {
                        const member = members.find(m => m.id === s.member_id);
                        const agent = agents.find(a => a.id === s.agent_id);
                        const profit = (s.down_amount || 0) - (s.up_amount || 0);
                        const duration = calculatePlayerDuration(s.id);
                        const playerUpRecords = DB.get('up_records', []).filter(r => r.session_id === s.id);
                        const playerDownRecords = DB.get('down_records', []).filter(r => r.session_id === s.id);
                        const timeline = [];
                        playerUpRecords.forEach(r => { timeline.push({ type: '上分', time: r.up_time }); });
                        playerDownRecords.forEach(r => { timeline.push({ type: '下分', time: r.down_time }); });
                        timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
                        const lastRecord = timeline.length > 0 ? timeline[timeline.length - 1] : null;
                        const isLastDown = lastRecord && lastRecord.type === '下分';
                        const isOffTable = isLastDown;
                        const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
                        const profitColor = profit >= 0 ? '#4CAF50' : '#ff6b6b';
                        return `<tr>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${i + 1}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;"><strong>${member ? member.name : '未知'}</strong></td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${agent ? agent.name : '-'}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${(s.up_amount || 0).toFixed(2)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${(s.down_amount || 0).toFixed(2)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:${profitColor};font-weight:bold;">${profitDisplay}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDuration(duration)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;"><span class="badge ${isOffTable ? 'badge-danger' : 'badge-success'}">${isOffTable ? '🔴 已下桌' : '🟢 进行中'}</span></td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">
                                <button class="btn btn-info btn-sm" onclick="closeModal(this.closest('.modal-overlay'));showSessionDetail(${s.id})">📋 明细</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-top:10px;font-size:13px;color:#666;text-align:center;">📌 共 ${playerSessions.length} 位玩家</div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModal(html);
}

// ============================================================
// 显示玩家台桌明细 - 含權限檢查
// ============================================================

function showSessionDetail(sessionId) {
    if (!checkActionPermission('tables', 'view_detail')) {
        showPermissionDenied('查看玩家明細');
        return;
    }
    const sessions = DB.get('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) { alert('找不到玩家记录'); return; }
    const member = getMember(session.member_id);
    const agent = getAgent(session.agent_id);
    const memberName = member ? member.name : '未知';
    const agentName = agent ? agent.name : '无';
    const currencies = DB.get('currencies', []);
    const memberAccount = getMemberAccount(session.member_id);
    const memberBalances = memberAccount.balances || {};
    let totalAccountBalance = 0;
    let balanceDetails = [];
    currencies.forEach(c => {
        const balance = memberBalances[c.currency] || 0;
        const rate = getBuyRate(c.currency);
        const thbValue = balance * rate;
        totalAccountBalance += thbValue;
        balanceDetails.push({ currency: c.currency, balance: balance, rate: rate, thbValue: thbValue });
    });
    const upRecords = DB.get('up_records', []).filter(r => r.session_id === sessionId);
    const downRecords = DB.get('down_records', []).filter(r => r.session_id === sessionId);
    const rechargeRecords = DB.get('recharge_records', []).filter(r => r.member_id === session.member_id);
    const withdrawRecords = DB.get('withdraw_records', []).filter(r => r.member_id === session.member_id);
    const admins = getAdmins();
    const timeline = [];
    upRecords.forEach(r => {
        timeline.push({
            type: '上分',
            time: r.up_time,
            displayTime: r.up_time,
            amount: r.amount,
            currency: r.currency || 'THB',
            thbAmount: r.thb_amount || r.amount,
            paymentStatus: r.payment_status,
            adminName: r.admin_name || '系统',
            raw: r
        });
    });
    downRecords.forEach(r => {
        timeline.push({
            type: '下分',
            time: r.down_time,
            displayTime: r.down_time,
            amount: r.amount,
            currency: r.currency || 'THB',
            thbAmount: r.amount,
            adminName: r.admin_name || '系统',
            raw: r,
            isZeroDown: r.amount === 0
        });
    });
    timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
    const rechargeTimeline = rechargeRecords.map(r => ({
        type: '充值',
        time: r.created_at,
        displayTime: r.created_at,
        amount: r.amount,
        currency: r.currency || 'THB',
        thbAmount: r.thb_amount || r.amount,
        adminName: r.admin_name || '系统',
        raw: r
    }));
    rechargeTimeline.sort((a, b) => new Date(a.time) - new Date(b.time));
    const withdrawTimeline = withdrawRecords.map(r => ({
        type: '出金',
        time: r.created_at,
        displayTime: r.created_at,
        amount: r.amount,
        currency: r.currency || 'THB',
        thbAmount: r.thb_amount || r.amount,
        sender: r.sender || '',
        adminName: r.admin_name || '系统',
        raw: r
    }));
    withdrawTimeline.sort((a, b) => new Date(a.time) - new Date(b.time));
    const duration = calculatePlayerDuration(sessionId);
    const profit = (session.down_amount || 0) - (session.up_amount || 0);
    const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
    const profitColor = profit >= 0 ? '#4CAF50' : '#ff6b6b';
    const lastRecord = timeline.length > 0 ? timeline[timeline.length - 1] : null;
    const isLastDown = lastRecord && lastRecord.type === '下分';
    const isOffTable = isLastDown;
    const isPaid = totalAccountBalance >= 0;
    let paymentStatusText = '';
    let paymentStatusClass = '';
    if (isPaid) {
        if (totalAccountBalance > 0) {
            paymentStatusText = `✅ 已支付 (余额：${totalAccountBalance.toFixed(2)})`;
            paymentStatusClass = 'badge-success';
        } else {
            paymentStatusText = '✅ 已支付 (0.00)';
            paymentStatusClass = 'badge-success';
        }
    } else {
        const debtAmount = Math.abs(totalAccountBalance);
        paymentStatusText = `❌ 未支付 (尚欠：${debtAmount.toFixed(2)})`;
        paymentStatusClass = 'badge-danger';
    }
    const balanceDisplay = balanceDetails.map(d => {
        const hasBalance = d.balance > 0;
        return `<span style="margin:0 5px;${hasBalance ? 'font-weight:bold;color:#2196F3;' : 'color:#ccc;'}">${d.currency}: ${d.balance.toFixed(2)} (≈${d.thbValue.toFixed(2)}泰铢)</span>`;
    }).join(' | ');
    
    let html = `
        <div class="modal-title" style="font-size:22px;text-align:center;">📋 ${memberName} - 台桌明细</div>
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, ${totalAccountBalance >= 0 ? '#4CAF50' : '#ff6b6b'}, ${totalAccountBalance >= 0 ? '#2E7D32' : '#c62828'});border-radius:8px;text-align:center;">
            <div style="color:rgba(255,255,255,0.85);font-size:13px;">💰 玩家账户总余额（即时）</div>
            <div style="color:#fff;font-size:28px;font-weight:bold;">${totalAccountBalance.toFixed(2)} 泰铢</div>
            <div style="color:rgba(255,255,255,0.8);font-size:11px;">${balanceDisplay}</div>
        </div>
        <div style="margin-bottom:15px;padding:12px 15px;background:#f8f9fc;border-radius:8px;font-size:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;">
                <div><strong>桌号：</strong>${session.table_type}</div>
                <div><strong>介绍人：</strong>${agentName}</div>
                <div><strong>状态：</strong><span class="badge ${isOffTable ? 'badge-danger' : 'badge-success'}">${isOffTable ? '🔴 已下桌' : '🟢 进行中'}</span></div>
                <div><strong>上分总金额：</strong><span style="color:#2196F3;font-weight:bold;">${(session.up_amount || 0).toFixed(2)}</span></div>
                <div><strong>下分总金额：</strong><span style="color:#ff6b6b;font-weight:bold;">${(session.down_amount || 0).toFixed(2)}</span></div>
                <div><strong>盈亏：</strong><span style="color:${profitColor};font-weight:bold;font-size:16px;">${profitDisplay}</span></div>
                <div><strong>游戏时长：</strong>${formatDuration(duration)}</div>
                <div><strong>付款状态：</strong><span class="badge ${paymentStatusClass}">${paymentStatusText}</span></div>
                <div><strong>已出金：</strong><span style="color:#ff6b6b;font-weight:bold;">${withdrawRecords.reduce((sum, r) => sum + (r.thb_amount || r.amount || 0), 0).toFixed(2)}</span></div>
                <div><strong>总充值：</strong><span style="color:#4CAF50;font-weight:bold;">${rechargeRecords.reduce((sum, r) => sum + (r.thb_amount || r.amount || 0), 0).toFixed(2)}</span></div>
                <div><strong>最后操作：</strong>${lastRecord ? lastRecord.type + ' (' + formatDate(lastRecord.time) + ')' : '无记录'}</div>
            </div>
        </div>
        <h4 style="margin-bottom:10px;text-align:center;font-size:16px;">⏱️ 操作时间线</h4>
        <div style="max-height:300px;overflow-y:auto;margin-bottom:15px;border:1px solid #e0e0e0;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead><tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;width:40px;">#</th>
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:60px;">操作</th>
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">金额</th>
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:60px;">币别</th>
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">泰铢</th>
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:100px;">状态/方式</th>
                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">操作人</th>
                </tr></thead>
                <tbody>
                    ${timeline.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:15px;color:#999;">暂无操作记录</td></tr>' :
                    timeline.map((r, index) => {
                        const isLast = index === timeline.length - 1;
                        const isDown = r.type === '下分';
                        const isZeroDown = r.isZeroDown || false;
                        const rowStyle = (isLast && isDown) ? 'background:#fff0f0;' : '';
                        let statusText = '';
                        if (r.type === '上分') {
                            statusText = r.paymentStatus === 'paid' ? `✅ 已付` : '⏳ 未付';
                        } else if (isLast && isDown) {
                            statusText = '🔴 已下桌';
                        } else if (isDown) {
                            statusText = '⬇️ 下分' + (isZeroDown ? ' (0)' : '');
                        }
                        const statusClass = r.type === '上分' ? (r.paymentStatus === 'paid' ? 'badge-success' : 'badge-danger') : (isLast && isDown ? 'badge-danger' : 'badge-warning');
                        return `<tr style="${rowStyle}">
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:${isLast && isDown ? '#d32f2f' : '#333'};">${index + 1}</td>
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(r.displayTime)}</td>
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:${isLast && isDown ? 'bold' : 'normal'};color:${isLast && isDown ? '#d32f2f' : '#333'};">${r.type}</td>
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:${isLast && isDown ? 'bold' : 'normal'};color:${isLast && isDown ? '#d32f2f' : (isZeroDown ? '#999' : '#333')};">${r.amount.toFixed(2)}</td>
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.currency}</td>
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:${isLast && isDown ? 'bold' : 'normal'};color:${isLast && isDown ? '#d32f2f' : (isZeroDown ? '#999' : '#333')};">${r.thbAmount.toFixed(2)}</td>
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;"><span class="badge ${statusClass}">${statusText}</span></td>
                            <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.adminName}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="display:flex;gap:20px;margin-bottom:15px;padding:8px 12px;background:#f8f9fc;border-radius:6px;font-size:13px;color:#666;flex-wrap:wrap;justify-content:center;">
            <span>📌 共 ${timeline.length} 笔操作</span>
            <span>⬆️ 上分 ${upRecords.length} 笔</span>
            <span>⬇️ 下分 ${downRecords.length} 笔</span>
            <span>📤 出金 ${withdrawRecords.length} 笔</span>
            ${isLastDown ? '<span style="color:#d32f2f;font-weight:bold;">🔴 最后操作为下分 - 已下桌</span>' : ''}
            ${downRecords.some(r => r.amount === 0) ? '<span style="color:#999;">⚠️ 包含金额为0的下分记录</span>' : ''}
        </div>
        ${rechargeTimeline.length > 0 ? `
            <h4 style="margin-bottom:10px;text-align:center;font-size:16px;">💰 充值记录</h4>
            <div style="max-height:150px;overflow-y:auto;margin-bottom:15px;border:1px solid #e0e0e0;border-radius:6px;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead><tr style="background:#e3f2fd;position:sticky;top:0;z-index:1;">
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">金额</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:60px;">币别</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">泰铢</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">操作人</th>
                    </tr></thead>
                    <tbody>
                        ${rechargeTimeline.map(r => `
                            <tr>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(r.time)}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.amount.toFixed(2)}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.currency}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.thbAmount.toFixed(2)}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.adminName}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
        ${withdrawTimeline.length > 0 ? `
            <h4 style="margin-bottom:10px;text-align:center;font-size:16px;">📤 出金记录</h4>
            <div style="max-height:150px;overflow-y:auto;margin-bottom:15px;border:1px solid #e0e0e0;border-radius:6px;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead><tr style="background:#ffebee;position:sticky;top:0;z-index:1;">
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">金额</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:60px;">币别</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">泰铢</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:100px;">方式</th>
                        <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">操作人</th>
                    </tr></thead>
                    <tbody>
                        ${withdrawTimeline.map(r => `
                            <tr>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(r.time)}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#ff6b6b;font-weight:bold;">-${r.amount.toFixed(2)}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.currency || 'THB'}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.thbAmount.toFixed(2)}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;">${r.sender || '现金'}</td>
                                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.adminName}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
        <div style="padding:12px 15px;background:#f5f5f5;border-radius:6px;font-size:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;">
                <div><strong>总上分：</strong><span style="color:#2196F3;">${(session.up_amount || 0).toFixed(2)}</span></div>
                <div><strong>账户总余额：</strong><span style="color:${totalAccountBalance >= 0 ? '#4CAF50' : '#d32f2f'};font-weight:bold;">${totalAccountBalance.toFixed(2)}</span></div>
                <div><strong>付款状态：</strong><span class="badge ${paymentStatusClass}">${paymentStatusText}</span></div>
                <div><strong>状态：</strong><span class="badge ${isLastDown ? 'badge-danger' : 'badge-success'}">${isLastDown ? '🔴 已下桌' : '🟢 进行中'}</span></div>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModalWide(html);
}

// ============================================================
// 整桌結算 - 修正：完整保存保險記錄
// ============================================================

function settleTable() {
    if (!checkActionPermission('tables', 'settle_table')) {
        showPermissionDenied('整桌結算');
        return;
    }
    
    // ============================================================
    // 步驟1：獲取該桌所有資料
    // ============================================================
    
    const sessions = DB.get('sessions', []);
    const members = DB.get('members', []);
    const agents = DB.get('agents', []);
    const agentLevels = DB.get('agent_levels', []);
    const currencies = DB.get('currencies', []);
    const accounts = DB.get('accounts', []);
    const waterRecords = DB.get('water_records', []);
    const insuranceRecords = DB.get('insurance_records', []);
    const tipsRecords = DB.get('tips_records', []);
    const upRecords = DB.get('up_records', []);
    const downRecords = DB.get('down_records', []);
    
    // 獲取該桌的開桌記錄
    const tableOpen = sessions.find(s => s.table_type === currentTable && s.session_type === 'table_open' && s.status === 'active');
    if (!tableOpen) {
        alert(`⚠️「${currentTable}」尚未開桌，請先開桌！`);
        return;
    }
    
    // 獲取該桌的玩家會話
    const playerSessions = sessions.filter(s => s.table_type === currentTable && s.session_type === 'player');
    
    if (playerSessions.length === 0) {
        alert(`⚠️「${currentTable}」目前沒有玩家，無需結算！`);
        return;
    }
    
    // ============================================================
    // 步驟2：確認所有玩家皆為已下桌狀態
    // ============================================================
    
    let notDownPlayers = [];
    
    playerSessions.forEach(s => {
        const member = members.find(m => m.id === s.member_id);
        const memberName = member ? member.name : '未知(ID:' + s.member_id + ')';
        
        const playerUpRecords = upRecords.filter(r => r.session_id === s.id);
        const playerDownRecords = downRecords.filter(r => r.session_id === s.id);
        
        let isDown = false;
        if (playerDownRecords.length > 0) {
            const lastDown = playerDownRecords[playerDownRecords.length - 1];
            const lastUp = playerUpRecords.length > 0 ? playerUpRecords[playerUpRecords.length - 1] : null;
            if (lastUp) {
                isDown = new Date(lastDown.down_time) > new Date(lastUp.up_time);
            } else {
                isDown = true;
            }
        } else {
            isDown = false;
        }
        
        if (!isDown) {
            const memberAccount = getMemberAccount(s.member_id);
            const balances = memberAccount.balances || {};
            let totalBalance = 0;
            currencies.forEach(c => {
                const balance = balances[c.currency] || 0;
                totalBalance += balance * getBuyRate(c.currency);
            });
            
            notDownPlayers.push({
                sessionId: s.id,
                memberId: s.member_id,
                memberName: memberName,
                upAmount: s.up_amount || 0,
                downAmount: s.down_amount || 0,
                profit: (s.down_amount || 0) - (s.up_amount || 0),
                balance: totalBalance
            });
        }
    });
    
    if (notDownPlayers.length > 0) {
        let warningMsg = '❌ 以下玩家尚未下分（進行中），請先執行下分操作後再結算！\n\n';
        notDownPlayers.forEach((p, index) => {
            warningMsg += `  ${index + 1}. ${p.memberName}\n`;
            warningMsg += `     上分：${p.upAmount.toFixed(2)} 泰銖\n`;
            warningMsg += `     下分：${p.downAmount.toFixed(2)} 泰銖\n`;
            warningMsg += `     盈虧：${p.profit.toFixed(2)} 泰銖\n`;
            warningMsg += `     帳戶餘額：${p.balance.toFixed(2)} 泰銖\n\n`;
        });
        warningMsg += `共 ${notDownPlayers.length} 位玩家未下分，請先執行下分操作！`;
        alert(warningMsg);
        return;
    }
    
    // ============================================================
    // 步驟3：確認玩家帳戶餘額是否大於等於0
    // ============================================================
    
    let negativePlayers = [];
    let playerBalances = [];
    
    playerSessions.forEach(s => {
        const member = members.find(m => m.id === s.member_id);
        const memberAccount = getMemberAccount(s.member_id);
        const balances = memberAccount.balances || {};
        
        let totalBalance = 0;
        const balanceDetails = [];
        currencies.forEach(c => {
            const balance = balances[c.currency] || 0;
            const rate = getBuyRate(c.currency);
            const thbValue = balance * rate;
            totalBalance += thbValue;
            if (balance !== 0) {
                balanceDetails.push(`${c.currency}: ${balance.toFixed(2)} (≈${thbValue.toFixed(2)}泰銖)`);
            }
        });
        
        const memberName = member ? member.name : '未知(ID:' + s.member_id + ')';
        playerBalances.push({
            session: s,
            memberName: memberName,
            totalBalance: totalBalance,
            balanceDetails: balanceDetails,
            upAmount: s.up_amount || 0,
            downAmount: s.down_amount || 0,
            profit: (s.down_amount || 0) - (s.up_amount || 0)
        });
        
        if (totalBalance < 0) {
            negativePlayers.push({
                memberName: memberName,
                balance: totalBalance,
                balanceDetails: balanceDetails,
                upAmount: s.up_amount || 0,
                downAmount: s.down_amount || 0,
                profit: (s.down_amount || 0) - (s.up_amount || 0)
            });
        }
    });
    
    if (negativePlayers.length > 0) {
        let warningMsg = '❌ 以下玩家帳戶餘額為負值（未付款），請先確認付款！\n\n';
        negativePlayers.forEach((p, index) => {
            warningMsg += `  ${index + 1}. ${p.memberName}\n`;
            warningMsg += `     帳戶餘額：${p.balance.toFixed(2)} 泰銖\n`;
            warningMsg += `     上分總額：${p.upAmount.toFixed(2)} 泰銖\n`;
            warningMsg += `     下分總額：${p.downAmount.toFixed(2)} 泰銖\n`;
            warningMsg += `     桌台盈虧：${p.profit.toFixed(2)} 泰銖\n`;
            if (p.balanceDetails.length > 0) {
                warningMsg += `     幣別明細：${p.balanceDetails.join('、')}\n`;
            }
            warningMsg += `\n`;
        });
        warningMsg += `共 ${negativePlayers.length} 位玩家未付款，請先確認付款後再結算！`;
        alert(warningMsg);
        return;
    }
    
    // ============================================================
    // 步驟4：計算各項數據
    // ============================================================
    
    // 計算總時長
    let totalHours = 0;
    playerSessions.forEach(s => {
        totalHours += calculatePlayerDuration(s.id);
    });
    
    const totalUp = playerSessions.reduce((sum, s) => sum + (s.up_amount || 0), 0);
    const totalDown = playerSessions.reduce((sum, s) => sum + (s.down_amount || 0), 0);
    const totalProfit = totalDown - totalUp;
    
    // ★ 獲取該桌的抽水記錄
    const tableWaterRecords = waterRecords.filter(w => w.table_type === currentTable);
    const totalWater = tableWaterRecords.reduce((sum, w) => sum + w.amount, 0);
    const waterCount = tableWaterRecords.length;
    
    // ★ 獲取該桌的保險記錄（結算前先保存完整數據）
    const tableInsuranceRecords = insuranceRecords.filter(i => i.table_type === currentTable);
    const totalInsurance = tableInsuranceRecords.reduce((sum, i) => sum + i.amount, 0);
    const insuranceCount = tableInsuranceRecords.length;
    
    // ★ 獲取該桌的小費記錄
    const tableTipsRecords = tipsRecords.filter(t => t.table_type === currentTable);
    const totalTips = tableTipsRecords.reduce((sum, t) => sum + t.amount, 0);
    const tipsCount = tableTipsRecords.length;
    
    // 計算退水（四捨五入到百位）
    const playerRebateResults = [];
    let totalRebateAmount = 0;
    
    if (totalHours > 0 && totalWater > 0) {
        playerSessions.forEach(s => {
            const member = members.find(m => m.id === s.member_id);
            const agent = agents.find(a => a.id === s.agent_id);
            const duration = calculatePlayerDuration(s.id);
            const percentage = totalHours > 0 ? duration / totalHours : 0;
            
            let rebateRate = 0;
            if (agent) {
                const level = agentLevels.find(l => l.id === agent.level_id);
                if (level) {
                    rebateRate = level.rate;
                } else {
                    rebateRate = agent.rebate_rate || 0;
                }
            }
            
            const rawRebateAmount = totalWater * percentage * (rebateRate / 100);
            const rebateAmount = Math.round(rawRebateAmount / 100) * 100;
            totalRebateAmount += rebateAmount;
            
            playerRebateResults.push({
                sessionId: s.id,
                memberId: s.member_id,
                memberName: member ? member.name : '未知',
                agentId: s.agent_id,
                agentName: agent ? agent.name : '無介紹人',
                rebateRate: rebateRate,
                duration: duration,
                percentage: percentage,
                rebateAmount: rebateAmount,
                rawRebateAmount: rawRebateAmount
            });
        });
    }
    
    const waterFee = totalWater - totalRebateAmount;
    
    // 保險收益
    const insuranceEarnings = totalInsurance > 0 ? totalInsurance * (insuranceRate / 100) : 0;
    const insuranceFee = totalInsurance - insuranceEarnings;
    
    // ============================================================
    // ★★★ 步驟5：驗證總盈餘 + 總抽水 + 總保險 + 總小費 = 0 ★★★
    // ============================================================
    
    const checkSum = totalProfit + totalWater + totalInsurance + totalTips;
    const checkSumDisplay = checkSum.toFixed(2);
    const verificationPassed = Math.abs(checkSum) < 0.01;
    
    let verifyMsg = '📊 結算驗證（公式：總盈餘 + 總抽水 + 總保險 + 總小費 = 0）\n\n';
    verifyMsg += `總盈餘（總下分 - 總上分）：${totalProfit.toFixed(2)}\n`;
    verifyMsg += `  總上分：${totalUp.toFixed(2)}\n`;
    verifyMsg += `  總下分：${totalDown.toFixed(2)}\n`;
    verifyMsg += `總抽水：${totalWater.toFixed(2)}\n`;
    verifyMsg += `總保險：${totalInsurance.toFixed(2)}\n`;
    verifyMsg += `總小費：${totalTips.toFixed(2)}\n`;
    verifyMsg += `─────────────────\n`;
    verifyMsg += `總盈餘 + 總抽水 + 總保險 + 總小費 = ${checkSumDisplay}\n\n`;
    
    verifyMsg += `📌 附加資訊（不影響驗證）：\n`;
    verifyMsg += `  總退水：${totalRebateAmount.toFixed(2)}\n`;
    verifyMsg += `  抽水扣費：${waterFee.toFixed(2)}\n`;
    verifyMsg += `  保險收益：${insuranceEarnings.toFixed(2)} (${insuranceRate}%)\n`;
    verifyMsg += `  保險扣費：${insuranceFee.toFixed(2)}\n\n`;
    
    if (Math.abs(checkSum) < 0.01) {
        verifyMsg += `✅ 驗證通過！總和為 0\n\n`;
    } else {
        verifyMsg += `❌ 驗證不通過！總和為 ${checkSumDisplay}\n\n`;
        verifyMsg += `請檢查以下數據：\n`;
        verifyMsg += `  - 總盈餘：${totalProfit.toFixed(2)}\n`;
        verifyMsg += `  - 總抽水：${totalWater.toFixed(2)}\n`;
        verifyMsg += `  - 總保險：${totalInsurance.toFixed(2)}\n`;
        verifyMsg += `  - 總小費：${totalTips.toFixed(2)}\n`;
        verifyMsg += `  - 差異：${checkSumDisplay}\n\n`;
        verifyMsg += `是否仍要繼續結算？\n（結算後將無法修正此差異）`;
        
        if (!confirm(verifyMsg)) {
            return;
        }
    }
    
    // ============================================================
    // 步驟6：顯示結算確認訊息
    // ============================================================
    
    let confirmMsg = '✅ 整桌結算確認\n\n';
    confirmMsg += `桌號：${currentTable}\n`;
    confirmMsg += `開桌時間：${formatDate(tableOpen.start_time)}\n`;
    confirmMsg += `玩家數量：${playerSessions.length} 人\n`;
    confirmMsg += `總時長：${formatDuration(totalHours)}\n\n`;
    
    confirmMsg += `📊 數據統計：\n`;
    confirmMsg += `  總上分：${totalUp.toFixed(2)}\n`;
    confirmMsg += `  總下分：${totalDown.toFixed(2)}\n`;
    confirmMsg += `  總盈餘：${totalProfit.toFixed(2)}\n`;
    confirmMsg += `  總抽水：${totalWater.toFixed(2)} (${waterCount} 筆)\n`;
    confirmMsg += `  總退水：${totalRebateAmount.toFixed(2)}\n`;
    confirmMsg += `  抽水扣費：${waterFee.toFixed(2)}\n`;
    confirmMsg += `  總保險：${totalInsurance.toFixed(2)} (${insuranceCount} 筆)\n`;
    confirmMsg += `  保險收益：${insuranceEarnings.toFixed(2)} (${insuranceRate}%)\n`;
    confirmMsg += `  保險扣費：${insuranceFee.toFixed(2)}\n`;
    confirmMsg += `  總小費：${totalTips.toFixed(2)} (${tipsCount} 筆)\n`;
    confirmMsg += `  驗證結果：${verificationPassed ? '✅ 通過 (0)' : '⚠️ 不通過 (' + checkSumDisplay + ')'}\n\n`;
    
    confirmMsg += `👤 玩家明細：\n`;
    playerBalances.forEach((p, index) => {
        const profit = p.profit;
        const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
        confirmMsg += `  ${index + 1}. ${p.memberName}：盈虧 ${profitDisplay} | 餘額 ${p.totalBalance.toFixed(2)}\n`;
    });
    
    const rebateWithAgent = playerRebateResults.filter(r => r.rebateAmount > 0 && r.agentId);
    if (rebateWithAgent.length > 0) {
        confirmMsg += `\n📊 退水明細：\n`;
        rebateWithAgent.forEach((r, index) => {
            confirmMsg += `  ${index + 1}. ${r.memberName} → ${r.agentName}：${r.rebateAmount.toFixed(2)} 泰銖 (${r.rebateRate}%)\n`;
        });
    }
    
    if (negativePlayers.length > 0) {
        confirmMsg += `\n⚠️ 負值玩家（${negativePlayers.length} 人）：\n`;
        negativePlayers.forEach((p, index) => {
            confirmMsg += `  ${index + 1}. ${p.memberName}：${p.balance.toFixed(2)} 泰銖\n`;
        });
    }
    
    confirmMsg += `\n📌 結算後將清除該桌所有資料（玩家、上分、抽水、保險、小費等）`;
    confirmMsg += `\n📌 結算後可前往「每日台帳」查看完整紀錄（含抽水、保險、小費明細）`;
    confirmMsg += `\n📌 歷史紀錄中也可查詢該筆結算`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    // ============================================================
    // 步驟7：執行結算 - ★ 完整保存所有數據
    // ============================================================
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const nowTime = now();
    
    const settlements = DB.get('daily_settlements', []);
    
    // 建立玩家詳情
    const playerDetails = playerSessions.map(s => {
        const member = members.find(m => m.id === s.member_id);
        const agent = agents.find(a => a.id === s.agent_id);
        const duration = calculatePlayerDuration(s.id);
        const rebateInfo = playerRebateResults.find(r => r.sessionId === s.id);
        const rebate = rebateInfo ? rebateInfo.rebateAmount : 0;
        const profit = (s.down_amount || 0) - (s.up_amount || 0);
        return {
            name: member ? member.name : '未知',
            agent: agent ? agent.name : '-',
            up_amount: s.up_amount || 0,
            down_amount: s.down_amount || 0,
            profit: profit,
            duration: duration,
            rebate: rebate
        };
    });
    
    const negativePlayerNames = negativePlayers.map(p => p.memberName).join('、');
    
    // ★★★ 關鍵修正：保存保險記錄的完整數據（不僅僅是 ID） ★★★
    // 將保險記錄轉換為可序列化的格式，包含所有欄位
    const insuranceData = tableInsuranceRecords.map(i => ({
        id: i.id,
        table_type: i.table_type,
        amount: i.amount,
        admin_id: i.admin_id,
        admin_name: i.admin_name,
        created_at: i.created_at
    }));
    
    // ★★★ 保存抽水記錄的完整數據 ★★★
    const waterData = tableWaterRecords.map(w => ({
        id: w.id,
        table_type: w.table_type,
        amount: w.amount,
        note: w.note || '',
        admin_id: w.admin_id,
        admin_name: w.admin_name,
        created_at: w.created_at
    }));
    
    // ★★★ 保存小費記錄的完整數據 ★★★
    const tipsData = tableTipsRecords.map(t => ({
        id: t.id,
        table_type: t.table_type,
        employee_id: t.employee_id,
        employee_name: t.employee_name,
        amount: t.amount,
        note: t.note || '',
        admin_id: t.admin_id,
        admin_name: t.admin_name,
        created_at: t.created_at,
        withdrawn: t.withdrawn || false,
        withdrawn_at: t.withdrawn_at || null,
        withdrawn_amount: t.withdrawn_amount || null,
        withdrawn_admin_name: t.withdrawn_admin_name || null
    }));
    
    // 保存保險記錄ID列表（用於快速查詢）
    const insuranceIds = tableInsuranceRecords.map(i => i.id);
    const tipsIds = tableTipsRecords.map(t => t.id);
    
    // ★ 創建完整的結算記錄
    const newSettlement = {
        id: DB.getNextId('daily_settlements'),
        table_type: currentTable,
        open_time: tableOpen.start_time,
        settle_time: nowTime,
        player_count: playerSessions.length,
        total_duration: totalHours,
        total_up: totalUp,
        total_down: totalDown,
        total_profit: totalProfit,
        total_water: totalWater,
        total_rebate: totalRebateAmount,
        water_fee: waterFee,
        fee: waterFee,
        total_insurance: totalInsurance,
        insurance_count: insuranceCount,
        insurance_rate: insuranceRate,
        insurance_earnings: insuranceEarnings,
        insurance_fee: insuranceFee,
        total_tips: totalTips,
        tips_count: tipsCount,
        // ★★★ 保存完整數據 ★★★
        tips_details: JSON.stringify(tipsData),
        water_details: JSON.stringify(waterData),
        insurance_details: JSON.stringify(insuranceData),  // ★ 新增：完整保險記錄
        negative_players: negativePlayerNames || '無',
        negative_count: negativePlayers.length,
        insurance_ids: insuranceIds,
        tips_ids: tipsIds,
        player_details: JSON.stringify(playerDetails),
        rebate_details: JSON.stringify(playerRebateResults.filter(r => r.rebateAmount > 0)),
        rebate_account_id: null,
        rebate_currency: null,
        rebate_total: playerRebateResults.filter(r => r.rebateAmount > 0 && r.agentId).reduce((sum, r) => sum + r.rebateAmount, 0),
        rebate_paid: false,
        rebate_paid_at: null,
        rebate_paid_method: null,
        rebate_paid_amount: 0,
        rebate_paid_admin: null,
        verification_sum: checkSum,
        verification_passed: verificationPassed,
        created_at: nowTime
    };
    
    settlements.push(newSettlement);
    DB.set('daily_settlements', settlements);
    
    // ============================================================
    // 步驟8：清除該桌所有資料
    // ============================================================
    
    // 清除玩家會話
    const remainingSessions = sessions.filter(s => !(s.table_type === currentTable && s.session_type === 'player'));
    DB.set('sessions', remainingSessions);
    
    // 清除開桌記錄
    const finalSessions = remainingSessions.filter(s => !(s.table_type === currentTable && s.session_type === 'table_open'));
    DB.set('sessions', finalSessions);
    
    // 清除抽水記錄
    const remainingWater = waterRecords.filter(w => w.table_type !== currentTable);
    DB.set('water_records', remainingWater);
    
    // 清除保險記錄
    const remainingInsurance = insuranceRecords.filter(i => i.table_type !== currentTable);
    DB.set('insurance_records', remainingInsurance);
    
    // 清除小費記錄
    const remainingTips = tipsRecords.filter(t => t.table_type !== currentTable);
    DB.set('tips_records', remainingTips);
    
    // 清除上分記錄
    const playerSessionIds = playerSessions.map(s => s.id);
    const remainingUp = upRecords.filter(r => !playerSessionIds.includes(r.session_id));
    DB.set('up_records', remainingUp);
    
    // 清除下分記錄
    const remainingDown = downRecords.filter(r => !playerSessionIds.includes(r.session_id));
    DB.set('down_records', remainingDown);
    
    // 清除兌匯記錄
    const exchangeRecords = DB.get('exchange_records', []);
    const remainingExchange = exchangeRecords.filter(e => e.table_type !== currentTable);
    DB.set('exchange_records', remainingExchange);
    
    // ============================================================
    // 步驟9：記錄操作日誌
    // ============================================================
    
    addOperationLog('台桌看板', '结算', currentTable, 
        `${currentTable} 結算完成 - 玩家 ${playerSessions.length} 人，總盈餘 ${totalProfit.toFixed(2)}，總抽水 ${totalWater.toFixed(2)}，總保險 ${totalInsurance.toFixed(2)}，總小費 ${totalTips.toFixed(2)}，驗證 ${verificationPassed ? '通過' : '不通過 (' + checkSumDisplay + ')'}`);
    
    // ============================================================
    // 步驟10：顯示結算結果
    // ============================================================
    
    let resultMsg = `✅「${currentTable}」已結算完成！\n\n`;
    resultMsg += `📊 結算摘要：\n`;
    resultMsg += `  玩家數量：${playerSessions.length} 人\n`;
    resultMsg += `  總時長：${formatDuration(totalHours)}\n`;
    resultMsg += `  總上分：${totalUp.toFixed(2)}\n`;
    resultMsg += `  總下分：${totalDown.toFixed(2)}\n`;
    resultMsg += `  總盈餘：${totalProfit.toFixed(2)}\n`;
    resultMsg += `  總抽水：${totalWater.toFixed(2)} (${waterCount} 筆)\n`;
    resultMsg += `  總退水：${totalRebateAmount.toFixed(2)}\n`;
    resultMsg += `  抽水扣費：${waterFee.toFixed(2)}\n`;
    resultMsg += `  總保險：${totalInsurance.toFixed(2)} (${insuranceCount} 筆)\n`;
    resultMsg += `  保險收益：${insuranceEarnings.toFixed(2)} (${insuranceRate}%)\n`;
    resultMsg += `  保險扣費：${insuranceFee.toFixed(2)}\n`;
    resultMsg += `  總小費：${totalTips.toFixed(2)} (${tipsCount} 筆)\n\n`;
    
    resultMsg += `📌 驗證結果：${verificationPassed ? '✅ 通過 (0)' : '⚠️ 不通過 (' + checkSumDisplay + ')'}\n`;
    resultMsg += `   公式：總盈餘 + 總抽水 + 總保險 + 總小費 = ${checkSumDisplay}\n\n`;
    
    if (negativePlayers.length > 0) {
        resultMsg += `⚠️ 以下 ${negativePlayers.length} 位玩家帳戶為負值，請注意追討：\n`;
        negativePlayers.forEach((p, index) => {
            resultMsg += `  ${index + 1}. ${p.memberName}：${p.balance.toFixed(2)} 泰銖\n`;
        });
        resultMsg += `\n`;
    }
    
    resultMsg += `📌 該桌所有資料已清除\n`;
    resultMsg += `📌 可前往「每日台帳」查看完整結算紀錄（含抽水、保險、小費明細）`;
    resultMsg += `\n📌 歷史紀錄中也可查詢該筆結算`;
    
    renderTables(document.getElementById('mainContent'));
    alert(resultMsg);
}

// ============================================================
// 保險收益比例設定 - 含權限檢查
// ============================================================

function showInsuranceRateSetting() {
    if (!checkActionPermission('tables', 'view')) {
        showPermissionDenied('查看保險收益比例');
        return;
    }
    const totalInsurance = getTotalInsurance(currentTable);
    const earnings = totalInsurance > 0 ? totalInsurance * (insuranceRate / 100) : 0;
    const html = `
        <div class="modal-title">📊 保险收益比例设定</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 保险收益 = 累计总保险 × 收益百分比</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;text-align:center;">
            <div style="padding:10px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">当前总保险</div>
                <div style="font-size:18px;font-weight:bold;color:#2196F3;">${totalInsurance.toFixed(2)}</div>
            </div>
            <div style="padding:10px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">当前收益比例</div>
                <div style="font-size:18px;font-weight:bold;color:#4CAF50;">${insuranceRate}%</div>
            </div>
        </div>
        <div class="form-group">
            <label>保险收益百分比 (%) *</label>
            <input type="number" id="insuranceRateInput" step="0.1" min="0" max="100" value="${insuranceRate}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        <div style="padding:10px;background:#e8f5e9;border-radius:6px;margin-bottom:15px;text-align:center;border:1px solid #a5d6a7;">
            <span style="color:#2e7d32;">💡 保险收益：</span>
            <span id="insuranceRatePreview" style="font-size:20px;font-weight:bold;color:#1b5e20;">${earnings.toFixed(2)}</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitInsuranceRateSetting()">确认设定</button>
        </div>
    `;
    showModal(html);
    const rateInput = document.getElementById('insuranceRateInput');
    const previewSpan = document.getElementById('insuranceRatePreview');
    function updatePreview() {
        const rate = parseFloat(rateInput.value) || 0;
        const total = getTotalInsurance(currentTable);
        const earning = total > 0 ? total * rate / 100 : 0;
        previewSpan.textContent = earning.toFixed(2);
    }
    rateInput.addEventListener('input', updatePreview);
}

function submitInsuranceRateSetting() {
    const overlay = document.querySelector('.modal-overlay');
    const rate = parseFloat(overlay.querySelector('#insuranceRateInput').value) || 0;
    if (rate < 0 || rate > 100) {
        alert('收益百分比请输入 0-100 之间的数值');
        return;
    }
    const beforeData = { insuranceRate: insuranceRate };
    insuranceRate = rate;
    const afterData = { insuranceRate: insuranceRate };
    addOperationLog('台桌看板', '设定', '保险收益比例', `保险收益比例更新为 ${insuranceRate}%`, null, beforeData, afterData);
    overlay.remove();
    renderTables(document.getElementById('mainContent'));
    alert(`✅ 保险收益比例已更新为 ${insuranceRate}%`);
}

// ============================================================
// 抽水明细、保险明细、小费明细 - 含權限檢查
// ============================================================

function showWaterDetail() {
    if (!checkActionPermission('tables', 'view')) {
        showPermissionDenied('查看抽水明細');
        return;
    }
    const waterRecords = DB.get('water_records', []);
    const filtered = waterRecords.filter(w => w.table_type === currentTable);
    if (filtered.length === 0) { alert(`当前桌「${currentTable}」暂无抽水记录`); return; }
    const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);
    let detailHtml = '';
    filtered.slice().reverse().forEach((r, index) => {
        detailHtml += `
            <tr>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${filtered.length - index}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#e65100;font-weight:bold;">${r.amount.toFixed(2)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;">${formatDate(r.created_at)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.note || '-'}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.admin_name || '系统'}</td>
            </tr>
        `;
    });
    const html = `
        <div class="modal-title" style="font-size:20px;">📊 抽水明细 - ${currentTable}</div>
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #e65100, #bf360c);border-radius:8px;text-align:center;color:#fff;">
            <div style="font-size:13px;opacity:0.9;">💰 总抽水金额</div>
            <div style="font-size:32px;font-weight:bold;">${totalAmount.toFixed(2)} 泰铢</div>
            <div style="font-size:12px;opacity:0.8;">共 ${filtered.length} 笔记录</div>
        </div>
        <div style="max-height:400px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;width:40px;">#</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:100px;">备注</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">操作人</th>
                </tr></thead>
                <tbody>${detailHtml}</tbody>
            </table>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModalWide(html);
}

function showInsuranceDetail() {
    if (!checkActionPermission('tables', 'view')) {
        showPermissionDenied('查看保險明細');
        return;
    }
    const insuranceRecords = getInsuranceRecords(currentTable);
    if (insuranceRecords.length === 0) { alert(`当前桌「${currentTable}」暂无保险记录`); return; }
    const totalAmount = insuranceRecords.reduce((sum, r) => sum + r.amount, 0);
    const earnings = totalAmount > 0 ? totalAmount * (insuranceRate / 100) : 0;
    let detailHtml = '';
    insuranceRecords.slice().reverse().forEach((r, index) => {
        detailHtml += `
            <tr>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${insuranceRecords.length - index}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#2196F3;font-weight:bold;">${r.amount.toFixed(2)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;">${formatDate(r.created_at)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.admin_name || '系统'}</td>
            </tr>
        `;
    });
    const html = `
        <div class="modal-title" style="font-size:20px;">📋 保险明细 - ${currentTable}</div>
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #1565C0, #0d47a1);border-radius:8px;text-align:center;color:#fff;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <div><div style="font-size:11px;opacity:0.8;">总保险</div><div style="font-size:20px;font-weight:bold;">${totalAmount.toFixed(2)}</div></div>
                <div><div style="font-size:11px;opacity:0.8;">收益比例</div><div style="font-size:20px;font-weight:bold;">${insuranceRate}%</div></div>
                <div><div style="font-size:11px;opacity:0.8;">保险收益</div><div style="font-size:20px;font-weight:bold;color:#ffd54f;">${earnings.toFixed(2)}</div></div>
            </div>
            <div style="font-size:11px;opacity:0.7;margin-top:5px;">共 ${insuranceRecords.length} 笔记录</div>
        </div>
        <div style="max-height:350px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;width:40px;">#</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">操作人</th>
                </tr></thead>
                <tbody>${detailHtml}</tbody>
            </table>
        </div>
        <div style="padding:10px;background:#e8f5e9;border-radius:6px;margin-top:10px;text-align:center;font-size:13px;">
            💡 保险收益 = 总保险 × ${insuranceRate}% = ${earnings.toFixed(2)} 泰铢
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModalWide(html);
}

function showTipsDetail() {
    if (!checkActionPermission('tables', 'view')) {
        showPermissionDenied('查看小費明細');
        return;
    }
    initTipsRecords();
    const records = getTipsRecords(currentTable);
    const employees = DB.get('employees', []);
    const summary = getEmployeeTipsSummary(currentTable);
    const totalTips = getTotalTips(currentTable);
    const withdrawnTotal = records.filter(r => r.withdrawn).reduce((sum, r) => sum + (r.withdrawn_amount || r.amount || 0), 0);
    if (records.length === 0) { alert(`当前桌「${currentTable}」暂无小费记录`); return; }
    let detailHtml = '';
    records.slice().reverse().forEach((r, index) => {
        const emp = employees.find(e => e.id === r.employee_id);
        const empName = emp ? emp.name : r.employee_name;
        const withdrawnStatus = r.withdrawn ? '✅ 已出款' : '⏳ 待出款';
        const withdrawnAmount = r.withdrawn ? (r.withdrawn_amount || r.amount || 0).toFixed(2) : '-';
        detailHtml += `
            <tr>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${records.length - index}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;"><strong>${empName}</strong></td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#4CAF50;font-weight:bold;">${r.amount.toFixed(2)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;">${formatDate(r.created_at)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:${r.withdrawn ? '#4CAF50' : '#ffa726'};">${withdrawnStatus}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${withdrawnAmount}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.note || '-'}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.admin_name || '系统'}</td>
            </tr>
        `;
    });
    let summaryHtml = '';
    const employeeKeys = Object.keys(summary);
    employeeKeys.forEach(key => {
        const data = summary[key];
        const status = data.withdrawn ? '✅' : '⏳';
        summaryHtml += `
            <div style="display:flex;justify-content:space-between;padding:4px 12px;border-bottom:1px solid #f0f0f0;">
                <span><strong>${data.employee_name}</strong> (${data.count}笔) ${status}</span>
                <span style="color:#4CAF50;font-weight:bold;">${data.total_amount.toFixed(2)} 泰铢</span>
            </div>
        `;
    });
    const html = `
        <div class="modal-title" style="font-size:20px;">💰 小费明细 - ${currentTable}</div>
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #ffa726, #f57c00);border-radius:8px;text-align:center;color:#fff;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <div><div style="font-size:11px;opacity:0.8;">总小费</div><div style="font-size:20px;font-weight:bold;">${totalTips.toFixed(2)}</div></div>
                <div><div style="font-size:11px;opacity:0.8;">已出款</div><div style="font-size:20px;font-weight:bold;color:#ffd54f;">${withdrawnTotal.toFixed(2)}</div></div>
                <div><div style="font-size:11px;opacity:0.8;">待出款</div><div style="font-size:20px;font-weight:bold;color:#ffab91;">${(totalTips - withdrawnTotal).toFixed(2)}</div></div>
            </div>
            <div style="font-size:11px;opacity:0.7;margin-top:5px;">共 ${records.length} 笔记录 | 已出款 ${records.filter(r => r.withdrawn).length} 笔</div>
        </div>
        <h4 style="margin-bottom:10px;text-align:center;font-size:15px;">👥 员工小费汇总</h4>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;border:1px solid #eee;max-height:150px;overflow-y:auto;">
            ${summaryHtml || '<div style="text-align:center;color:#999;padding:10px;">暂无员工汇总</div>'}
        </div>
        <h4 style="margin-bottom:10px;text-align:center;font-size:15px;">📋 详细记录</h4>
        <div style="max-height:350px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;width:40px;">#</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">员工</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">出款状态</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">提領金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:100px;">备注</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">操作人</th>
                </tr></thead>
                <tbody>${detailHtml}</tbody>
            </table>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModalWide(html);
}

// ============================================================
// 切換台桌
// ============================================================

function switchTable(table) {
    currentTable = table;
    renderTables(document.getElementById('mainContent'));
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

function formatNumber(num) {
    if (num === undefined || num === null) return '0.00';
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function closeModal(overlay) {
    if (overlay) overlay.remove();
}

function get_table_open_record(tableType) {
    const sessions = DB.get('sessions', []);
    return sessions.find(s => s.table_type === tableType && s.session_type === 'table_open');
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