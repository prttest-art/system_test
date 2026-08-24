// ============================================================
// 3. 每日台帐（含詳細明細 - 五頁籤 + 時段查詢 + 權限控制）
// ============================================================

// ============================================================
// 渲染每日台帳頁面
// ============================================================

function renderTransactions(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('transactions', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>📊 每日台帐</h1>
                <p class="breadcrumb">营运管理 > 每日台帐</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「每日台帐」的权限</p>
            </div>
        `;
        return;
    }
    
    const settlements = DB.get('daily_settlements', []);
    
    // 獲取查詢參數
    const searchDate = document.getElementById('reportDate')?.value || '';
    const searchDateStart = document.getElementById('reportDateStart')?.value || '';
    const searchDateEnd = document.getElementById('reportDateEnd')?.value || '';
    const searchTable = document.getElementById('reportTable')?.value || '';
    
    // ===== 過濾結算記錄 =====
    let filtered = [...settlements];
    
    // 按時段過濾
    if (searchDateStart && searchDateEnd) {
        filtered = filtered.filter(s => {
            if (!s.settle_time) return false;
            const dateStr = s.settle_time.split(' ')[0];
            return dateStr >= searchDateStart && dateStr <= searchDateEnd;
        });
    } else if (searchDateStart) {
        filtered = filtered.filter(s => {
            if (!s.settle_time) return false;
            return s.settle_time.startsWith(searchDateStart);
        });
    } else if (searchDate) {
        filtered = filtered.filter(s => {
            if (!s.settle_time) return false;
            return s.settle_time.startsWith(searchDate);
        });
    }
    
    // 按桌號過濾
    if (searchTable) {
        filtered = filtered.filter(s => s.table_type === searchTable);
    }
    
    // 按時間排序（最新的在前）
    filtered.sort((a, b) => new Date(b.settle_time) - new Date(a.settle_time));
    
    // 只顯示最近100筆
    filtered = filtered.slice(0, 100);
    
    // ===== 計算統計 =====
    const summary = {
        total_tables: filtered.length,
        total_players: filtered.reduce((sum, s) => sum + (s.player_count || 0), 0),
        total_up: filtered.reduce((sum, s) => sum + (s.total_up || 0), 0),
        total_down: filtered.reduce((sum, s) => sum + (s.total_down || 0), 0),
        total_profit: filtered.reduce((sum, s) => sum + (s.total_profit || 0), 0),
        total_water: filtered.reduce((sum, s) => sum + (s.total_water || 0), 0),
        total_rebate: filtered.reduce((sum, s) => sum + (s.total_rebate || 0), 0),
        total_water_fee: filtered.reduce((sum, s) => sum + (s.water_fee || s.fee || 0), 0),
        total_insurance: filtered.reduce((sum, s) => sum + (s.total_insurance || 0), 0),
        total_insurance_earnings: filtered.reduce((sum, s) => sum + (s.insurance_earnings || 0), 0),
        total_insurance_fee: filtered.reduce((sum, s) => sum + (s.insurance_fee || 0), 0),
        total_tips: filtered.reduce((sum, s) => sum + (s.total_tips || 0), 0)
    };
    
    // 獲取所有桌號選項
    const allTables = [...new Set(settlements.map(s => s.table_type).filter(Boolean))];
    const defaultTables = ['决赛桌', 'VIP包1', 'VIP包2', '大厅1', '大厅2'];
    const tableOptions = [...new Set([...defaultTables, ...allTables])];
    
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
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // ✅ 檢查查看明細權限
    const canViewDetail = checkActionPermission('transactions', 'view_detail');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>📊 每日台帐</h1>
            <p class="breadcrumb">营运管理 > 每日台帐</p>
        </div>
        
        <!-- 查詢工具欄 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;">
            <!-- 第一排：時段查詢 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding-bottom:10px;border-bottom:1px solid #f0f0f0;margin-bottom:10px;">
                <span style="font-weight:500;font-size:13px;color:#555;">📅 時段查詢：</span>
                <input type="date" id="reportDateStart" value="${searchDateStart}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <span style="color:#999;">～</span>
                <input type="date" id="reportDateEnd" value="${searchDateEnd}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                <button class="btn btn-primary" onclick="renderTransactions(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('reportDateStart').value='';document.getElementById('reportDateEnd').value='';document.getElementById('reportDate').value='';document.getElementById('reportTable').value='';renderTransactions(document.getElementById('mainContent'))">✕ 清除</button>
                <button class="btn" onclick="document.getElementById('reportDateStart').value='${todayStr}';document.getElementById('reportDateEnd').value='${todayStr}';document.getElementById('reportDate').value='';renderTransactions(document.getElementById('mainContent'))">📅 今天</button>
                <button class="btn" onclick="document.getElementById('reportDateStart').value='';document.getElementById('reportDateEnd').value='';document.getElementById('reportDate').value='${todayStr}';renderTransactions(document.getElementById('mainContent'))">📅 單日</button>
                <span style="font-size:12px;color:#999;margin-left:auto;">${timeRangeLabel}</span>
            </div>
            
            <!-- 第二排：桌號查詢 + 操作 -->
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                <span style="font-weight:500;font-size:13px;color:#555;">🎯 桌號：</span>
                <select id="reportTable" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部桌號</option>
                    ${tableOptions.map(t => `<option value="${t}" ${t === searchTable ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <button class="btn btn-primary" onclick="renderTransactions(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('reportTable').value='';renderTransactions(document.getElementById('mainContent'))">✕ 清除桌號</button>
                <button class="btn" onclick="renderTransactions(document.getElementById('mainContent'))">🔄 刷新</button>
                <span style="font-size:13px;color:#999;margin-left:auto;">共 ${filtered.length} 筆結算記錄</span>
            </div>
        </div>
        
        <!-- 統計卡片 -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
            <div class="stat-card"><div class="stat-label">開桌數</div><div class="stat-value">${summary.total_tables}</div></div>
            <div class="stat-card"><div class="stat-label">玩家數</div><div class="stat-value">${summary.total_players}</div></div>
            <div class="stat-card"><div class="stat-label">總盈虧</div><div class="stat-value" style="color:${summary.total_profit >= 0 ? '#4CAF50' : '#ff6b6b'}">${summary.total_profit.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">總抽水</div><div class="stat-value" style="color:#e65100;">${summary.total_water.toFixed(2)}</div></div>
        </div>
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-top:5px;">
            <div class="stat-card" style="background:#fff3e0;border-color:#ffcc80;"><div class="stat-label">總退水</div><div class="stat-value" style="color:#e65100;">${summary.total_rebate.toFixed(2)}</div></div>
            <div class="stat-card" style="background:#ffebee;border-color:#ef9a9a;"><div class="stat-label">抽水扣費</div><div class="stat-value" style="color:#c62828;">${summary.total_water_fee.toFixed(2)}</div></div>
            <div class="stat-card" style="background:#e3f2fd;border-color:#90caf9;"><div class="stat-label">保險扣費</div><div class="stat-value" style="color:#0d47a1;">${summary.total_insurance_fee.toFixed(2)}</div></div>
            <div class="stat-card" style="background:#e8f5e9;border-color:#a5d6a7;"><div class="stat-label">保險收益</div><div class="stat-value" style="color:#1b5e20;">${summary.total_insurance_earnings.toFixed(2)}</div></div>
        </div>
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-top:5px;">
            <div class="stat-card" style="background:#fff8e1;border-color:#ffcc80;"><div class="stat-label">總小費</div><div class="stat-value" style="color:#ffa726;">${summary.total_tips.toFixed(2)}</div></div>
        </div>
        
        ${filtered.length === 0 ? `
            <div style="text-align:center;padding:40px;background:#fff;border-radius:10px;border:1px solid #eee;margin-top:15px;color:#999;">
                📭 ${searchDateStart || searchDateEnd || searchDate || searchTable ? '該條件下暫無結算記錄' : '暫無結算記錄，請先進行台桌結算'}
                ${(searchDateStart || searchDateEnd || searchDate) ? '<br><span style="font-size:12px;">💡 提示：可調整查詢時段以查看更多記錄</span>' : ''}
            </div>
        ` : `
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>桌号</th>
                        <th>开桌时间</th>
                        <th>结算时间</th>
                        <th>玩家数</th>
                        <th>总上分</th>
                        <th>总下分</th>
                        <th>总盈亏</th>
                        <th>总抽水</th>
                        <th>总退水</th>
                        <th>抽水扣费</th>
                        <th>保险次数</th>
                        <th>保险收益</th>
                        <th>保险扣费</th>
                        <th>小费总额</th>
                        <th>操作</th>
                    </tr></thead>
                    <tbody>
                        ${filtered.map(s => `
                            <tr>
                                <td><strong>${s.table_type}</strong></td>
                                <td>${formatDate(s.open_time)}</td>
                                <td>${formatDate(s.settle_time)}</td>
                                <td>${s.player_count}</td>
                                <td>${(s.total_up || 0).toFixed(2)}</td>
                                <td>${(s.total_down || 0).toFixed(2)}</td>
                                <td style="color:${(s.total_profit || 0) >= 0 ? '#4CAF50' : '#ff6b6b'}">${(s.total_profit || 0).toFixed(2)}</td>
                                <td>${(s.total_water || 0).toFixed(2)}</td>
                                <td>${(s.total_rebate || 0).toFixed(2)}</td>
                                <td style="color:#c62828;font-weight:bold;">${(s.water_fee || s.fee || 0).toFixed(2)}</td>
                                <td>${(s.insurance_count || 0)}</td>
                                <td style="color:#1b5e20;">${(s.insurance_earnings || 0).toFixed(2)}</td>
                                <td style="color:#c62828;font-weight:bold;">${(s.insurance_fee || 0).toFixed(2)}</td>
                                <td style="color:#ffa726;font-weight:bold;">${(s.total_tips || 0).toFixed(2)}</td>
                                <td>
                                    ${canViewDetail ? `<button class="btn btn-info btn-sm" onclick="showSettlementDetail(${s.id})">📋 明細</button>` : '<span style="color:#999;font-size:11px;">無權限</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${filtered.length > 0 ? `
                <div style="margin-top:10px;display:flex;gap:15px;flex-wrap:wrap;font-size:12px;color:#999;padding:8px 12px;background:#f8f9fc;border-radius:6px;">
                    <span>📊 總計：<strong>${filtered.length}</strong> 筆結算記錄</span>
                    ${searchDateStart && searchDateEnd ? `<span>📅 時段：${searchDateStart} ~ ${searchDateEnd}</span>` : ''}
                    ${searchDate ? `<span>📅 日期：${searchDate}</span>` : ''}
                    ${searchTable ? `<span>🎯 桌號：${searchTable}</span>` : ''}
                </div>
            ` : ''}
        `}
    `;
}


// ============================================================
// 顯示結算明細（五頁籤）- 含權限檢查
// 修正：確保抽水、保險、小費明細正確從結算記錄讀取
// ============================================================

function showSettlementDetail(settlementId) {
    // ✅ 檢查查看明細權限
    if (!checkActionPermission('transactions', 'view_detail')) {
        showPermissionDenied('查看結算明細');
        return;
    }
    
    const settlements = DB.get('daily_settlements', []);
    const settlement = settlements.find(s => s.id === settlementId);
    if (!settlement) { 
        alert('找不到结算记录'); 
        return; 
    }
    
    // 解析所有詳情
    let playerDetails = [];
    let rebateDetails = [];
    let tipsDetails = [];
    let waterDetails = [];
    let insuranceDetails = [];
    try {
        playerDetails = JSON.parse(settlement.player_details || '[]');
        rebateDetails = JSON.parse(settlement.rebate_details || '[]');
        tipsDetails = JSON.parse(settlement.tips_details || '[]');
        waterDetails = JSON.parse(settlement.water_details || '[]');
        // ★ 從 settlement 讀取保險記錄
        insuranceDetails = JSON.parse(settlement.insurance_details || '[]');
    } catch(e) {
        console.warn('解析結算明細失敗:', e);
    }
    
    // ★★★ 優先從 insurance_details 讀取保險記錄 ★★★
    let insuranceRecords = insuranceDetails;
    
    // 如果 insurance_details 為空，嘗試從 insurance_ids 查詢（向後兼容）
    if (!insuranceRecords || insuranceRecords.length === 0) {
        const insuranceIds = settlement.insurance_ids || [];
        const allInsuranceRecords = DB.get('insurance_records', []);
        insuranceRecords = allInsuranceRecords.filter(r => insuranceIds.includes(r.id));
    }
    
    // 獲取抽水記錄（如果 water_details 有數據則使用，否則從 DB 查詢）
    let waterRecords = waterDetails;
    if (!waterRecords || waterRecords.length === 0) {
        const allWaterRecords = DB.get('water_records', []);
        waterRecords = allWaterRecords.filter(w => w.table_type === settlement.table_type);
    }
    
    // 獲取小費記錄（從 tips_details 或從 DB 查詢）
    let tipsRecords = tipsDetails;
    if (!tipsRecords || tipsRecords.length === 0) {
        const allTipsRecords = DB.get('tips_records', []);
        tipsRecords = allTipsRecords.filter(t => t.table_type === settlement.table_type);
    }
    
    const tableName = settlement.table_type;
    const settleTime = settlement.settle_time;
    
    // ✅ 檢查小費提款權限
    const canTipsWithdraw = checkActionPermission('tables', 'tips_withdraw');
    const canRebatePayment = checkActionPermission('tables', 'rebate_payment');
    
    const html = `
        <div class="modal-title" style="font-size:20px;text-align:center;">📋 ${tableName} - 结算明细</div>
        
        <!-- 摘要資訊 -->
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:8px;font-size:13px;text-align:center;display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:5px;">
            <div><strong>结算时间：</strong>${formatDate(settleTime)}</div>
            <div><strong>玩家数：</strong>${settlement.player_count || 0}</div>
            <div><strong>总盈亏：</strong><span style="color:${(settlement.total_profit || 0) >= 0 ? '#4CAF50' : '#ff6b6b'}">${(settlement.total_profit || 0).toFixed(2)}</span></div>
            <div><strong>总抽水：</strong>${(settlement.total_water || 0).toFixed(2)}</div>
            <div><strong>总保险：</strong>${(settlement.total_insurance || 0).toFixed(2)}</div>
        </div>
        <div style="margin-bottom:15px;padding:6px 10px;background:#f8f9fc;border-radius:6px;font-size:12px;text-align:center;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;">
            <div><strong>保险收益：</strong><span style="color:#1b5e20;">${(settlement.insurance_earnings || 0).toFixed(2)}</span></div>
            <div><strong>保险扣费：</strong><span style="color:#c62828;">${(settlement.insurance_fee || 0).toFixed(2)}</span></div>
            <div><strong>总小费：</strong><span style="color:#ffa726;">${(settlement.total_tips || 0).toFixed(2)}</span></div>
            <div><strong>抽水扣费：</strong><span style="color:#c62828;">${(settlement.water_fee || settlement.fee || 0).toFixed(2)}</span></div>
        </div>
        
        <!-- 頁籤 -->
        <div style="display:flex;gap:2px;margin-bottom:15px;border-bottom:2px solid #e0e0e0;flex-wrap:wrap;">
            <button class="btn tab-btn active" data-tab="tab1" onclick="switchSettlementTab('tab1')" style="border-radius:6px 6px 0 0;background:#2196F3;color:#fff;padding:8px 20px;">👤 玩家</button>
            <button class="btn tab-btn" data-tab="tab2" onclick="switchSettlementTab('tab2')" style="border-radius:6px 6px 0 0;background:#f5f5f5;color:#333;padding:8px 20px;">👥 介绍人</button>
            <button class="btn tab-btn" data-tab="tab3" onclick="switchSettlementTab('tab3')" style="border-radius:6px 6px 0 0;background:#f5f5f5;color:#333;padding:8px 20px;">💰 抽水</button>
            <button class="btn tab-btn" data-tab="tab4" onclick="switchSettlementTab('tab4')" style="border-radius:6px 6px 0 0;background:#f5f5f5;color:#333;padding:8px 20px;">🛡️ 保险</button>
            <button class="btn tab-btn" data-tab="tab5" onclick="switchSettlementTab('tab5')" style="border-radius:6px 6px 0 0;background:#f5f5f5;color:#333;padding:8px 20px;">💵 小费</button>
        </div>
        
        <!-- 頁籤內容 -->
        <div id="settlementTabContent" style="max-height:500px;overflow-y:auto;">
            <!-- Tab 1: 玩家明細 -->
            <div id="tab1" class="tab-content" style="display:block;">
                ${renderPlayerTab(playerDetails, settlement)}
            </div>
            <!-- Tab 2: 介紹人明細 -->
            <div id="tab2" class="tab-content" style="display:none;">
                ${renderAgentTab(playerDetails, rebateDetails, settlement, settlementId, canRebatePayment)}
            </div>
            <!-- Tab 3: 抽水紀錄 -->
            <div id="tab3" class="tab-content" style="display:none;">
                ${renderWaterTab(waterRecords, settlement)}
            </div>
            <!-- Tab 4: 保險紀錄 -->
            <div id="tab4" class="tab-content" style="display:none;">
                ${renderInsuranceTab(insuranceRecords, settlement)}
            </div>
            <!-- Tab 5: 小費紀錄 -->
            <div id="tab5" class="tab-content" style="display:none;">
                ${renderTipsTab(tipsRecords, settlement, settlementId, canTipsWithdraw)}
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModalWide(html);
}


// ============================================================
// Tab 1: 玩家明細
// ============================================================

function renderPlayerTab(playerDetails, settlement) {
    if (!playerDetails || playerDetails.length === 0) {
        return '<div style="text-align:center;padding:30px;color:#999;">暂无玩家数据</div>';
    }
    
    // 計算總計
    const totalUp = playerDetails.reduce((sum, p) => sum + (p.up_amount || 0), 0);
    const totalDown = playerDetails.reduce((sum, p) => sum + (p.down_amount || 0), 0);
    const totalProfit = totalDown - totalUp;
    const totalRebate = playerDetails.reduce((sum, p) => sum + (p.rebate || 0), 0);
    
    let html = `
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;font-size:13px;">
            <div><strong>总上分：</strong><span style="color:#2196F3;">${totalUp.toFixed(2)}</span></div>
            <div><strong>总下分：</strong><span style="color:#ff6b6b;">${totalDown.toFixed(2)}</span></div>
            <div><strong>总盈亏：</strong><span style="color:${totalProfit >= 0 ? '#4CAF50' : '#ff6b6b'}">${totalProfit.toFixed(2)}</span></div>
            <div><strong>总退水：</strong><span style="color:#e65100;">${totalRebate.toFixed(2)}</span></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">玩家</th>
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">介绍人</th>
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:70px;">上分</th>
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:70px;">下分</th>
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:70px;">盈亏</th>
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">时长</th>
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:70px;">退水</th>
                <th style="padding:6px 8px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">操作</th>
            </tr></thead>
            <tbody>
                ${playerDetails.map((p, index) => {
                    const profit = (p.down_amount || 0) - (p.up_amount || 0);
                    const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
                    const profitColor = profit >= 0 ? '#4CAF50' : '#ff6b6b';
                    
                    let accountBalance = 0;
                    const member = getMemberByName(p.name);
                    if (member) {
                        const memberAccount = getMemberAccount(member.id);
                        const balances = memberAccount.balances || {};
                        const currencies = DB.get('currencies', []);
                        currencies.forEach(c => {
                            const balance = balances[c.currency] || 0;
                            accountBalance += balance * getCurrencyRate(c.currency);
                        });
                    }
                    
                    return `<tr>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;"><strong>${p.name}</strong></td>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${p.agent || '-'}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.up_amount || 0).toFixed(2)}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.down_amount || 0).toFixed(2)}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;color:${profitColor};font-weight:bold;">${profitDisplay}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDuration(p.duration || 0)}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.rebate || 0).toFixed(2)}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">
                            <button class="btn btn-info btn-sm" onclick="showPlayerDetail('${p.name}', ${settlement.id})">📋 明細</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
    return html;
}


// ============================================================
// Tab 2: 介紹人明細（含提款功能）
// ============================================================

function renderAgentTab(playerDetails, rebateDetails, settlement, settlementId, canRebatePayment) {
    // 按介紹人分組
    const agentMap = {};
    playerDetails.forEach(p => {
        const agentName = p.agent || '無介紹人';
        if (!agentMap[agentName]) {
            agentMap[agentName] = {
                players: [],
                totalRebate: 0,
                totalDuration: 0,
                agentId: null
            };
        }
        if (p.agent && p.agent !== '無介紹人') {
            const agent = DB.get('agents', []).find(a => a.name === p.agent);
            if (agent) {
                agentMap[agentName].agentId = agent.id;
            }
        }
        agentMap[agentName].players.push({
            name: p.name,
            upAmount: p.up_amount || 0,
            downAmount: p.down_amount || 0,
            duration: p.duration || 0,
            rebate: p.rebate || 0
        });
        agentMap[agentName].totalRebate += (p.rebate || 0);
        agentMap[agentName].totalDuration += (p.duration || 0);
    });
    
    const agentNames = Object.keys(agentMap);
    if (agentNames.length === 0 || (agentNames.length === 1 && agentNames[0] === '無介紹人')) {
        return '<div style="text-align:center;padding:30px;color:#999;">暂无介绍人数据</div>';
    }
    
    // 檢查退水是否已全部提款
    const allRebatePaid = settlement.rebate_paid || false;
    
    let html = `
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;font-size:13px;">
            <div><strong>介绍人数：</strong>${agentNames.filter(n => n !== '無介紹人').length}</div>
            <div><strong>总退水：</strong><span style="color:#e65100;">${(settlement.total_rebate || 0).toFixed(2)}</span></div>
            <div><strong>总时长：</strong>${formatDuration(settlement.total_duration || 0)}</div>
            <div>
                ${allRebatePaid ? 
                    '<span style="color:#4CAF50;">✅ 已提款</span>' : 
                    (canRebatePayment ? `<button class="btn btn-success btn-sm" onclick="showAgentWithdrawDialog('${settlementId}')">💵 介紹人提款</button>` : 
                    '<span style="color:#999;font-size:11px;">無提款權限</span>')}
            </div>
        </div>
    `;
    
    agentNames.forEach(agentName => {
        if (agentName === '無介紹人') return;
        const data = agentMap[agentName];
        const totalRebate = data.totalRebate;
        // ★ 四捨五入到百位顯示
        const displayRebate = Math.round(totalRebate / 100) * 100;
        const isPaid = allRebatePaid;
        
        html += `
            <div style="margin-bottom:10px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
                <div style="background:#e3f2fd;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:14px;">
                    <span>👤 ${agentName}</span>
                    <span>
                        退水：${displayRebate.toFixed(2)} 泰銖
                        ${isPaid ? '<span style="color:#4CAF50;font-size:12px;">✅ 已提款</span>' : 
                          (canRebatePayment ? `<button class="btn btn-success btn-sm" onclick="showAgentWithdraw('${settlementId}', '${agentName}', ${data.agentId || 'null'}, ${displayRebate})" style="margin-left:10px;">💵 提款</button>` : '')}
                    </span>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead><tr style="background:#f5f5f5;">
                        <th style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center;">玩家</th>
                        <th style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center;">上分</th>
                        <th style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center;">下分</th>
                        <th style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center;">盈亏</th>
                        <th style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center;">时长</th>
                        <th style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center;">退水</th>
                        <th style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center;">账户余额</th>
                    </tr></thead>
                    <tbody>
                        ${data.players.map(p => {
                            const profit = (p.downAmount || 0) - (p.upAmount || 0);
                            const profitDisplay = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
                            const profitColor = profit >= 0 ? '#4CAF50' : '#ff6b6b';
                            
                            let accountBalance = 0;
                            const member = getMemberByName(p.name);
                            if (member) {
                                const memberAccount = getMemberAccount(member.id);
                                const balances = memberAccount.balances || {};
                                const currencies = DB.get('currencies', []);
                                currencies.forEach(c => {
                                    const balance = balances[c.currency] || 0;
                                    accountBalance += balance * getCurrencyRate(c.currency);
                                });
                            }
                            
                            return `<tr>
                                <td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;text-align:center;"><strong>${p.name}</strong></td>
                                <td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.upAmount || 0).toFixed(2)}</td>
                                <td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.downAmount || 0).toFixed(2)}</td>
                                <td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;text-align:center;color:${profitColor};font-weight:bold;">${profitDisplay}</td>
                                <td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDuration(p.duration || 0)}</td>
                                <td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${(p.rebate || 0).toFixed(2)}</td>
                                <td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;text-align:center;color:${accountBalance >= 0 ? '#4CAF50' : '#ff6b6b'};font-weight:bold;">${accountBalance.toFixed(2)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });
    
    return html;
}


// ============================================================
// Tab 3: 抽水紀錄
// ============================================================

function renderWaterTab(waterRecords, settlement) {
    if (!waterRecords || waterRecords.length === 0) {
        return '<div style="text-align:center;padding:30px;color:#999;">暂无抽水记录</div>';
    }
    
    const totalWater = waterRecords.reduce((sum, r) => sum + r.amount, 0);
    
    let html = `
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;font-size:13px;">
            <div><strong>抽水笔数：</strong>${waterRecords.length}</div>
            <div><strong>总抽水：</strong><span style="color:#e65100;">${totalWater.toFixed(2)}</span></div>
            <div><strong>总退水：</strong><span style="color:#4CAF50;">${(settlement.total_rebate || 0).toFixed(2)}</span></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;width:40px;">#</th>
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;min-width:140px;">时间</th>
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">金额</th>
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;min-width:100px;">备注</th>
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">操作人</th>
            </tr></thead>
            <tbody>
                ${waterRecords.map((r, index) => `
                    <tr>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${index + 1}</td>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(r.created_at)}</td>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:#e65100;">${r.amount.toFixed(2)}</td>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.note || '-'}</td>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.admin_name || '系统'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    return html;
}


// ============================================================
// Tab 4: 保險紀錄（修正版 - 從 settlement 讀取）
// ============================================================

function renderInsuranceTab(insuranceRecords, settlement) {
    // ★ 優先從傳入的 insuranceRecords 讀取
    let records = insuranceRecords;
    
    // 如果傳入的為空，嘗試從 settlement.insurance_details 讀取
    if (!records || records.length === 0) {
        try {
            const details = JSON.parse(settlement.insurance_details || '[]');
            records = details;
        } catch(e) {}
    }
    
    // 如果 insurance_details 為空，嘗試從 insurance_ids 查詢（向後兼容）
    if (!records || records.length === 0) {
        const insuranceIds = settlement.insurance_ids || [];
        const allInsuranceRecords = DB.get('insurance_records', []);
        records = allInsuranceRecords.filter(r => insuranceIds.includes(r.id));
    }
    
    if (!records || records.length === 0) {
        return '<div style="text-align:center;padding:30px;color:#999;">暂无保险记录</div>';
    }
    
    const totalInsurance = records.reduce((sum, r) => sum + (r.amount || 0), 0);
    const earnings = settlement.insurance_earnings || 0;
    const fee = settlement.insurance_fee || 0;
    const rate = settlement.insurance_rate || 0;
    
    let html = `
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;font-size:13px;">
            <div><strong>保险次数：</strong>${records.length}</div>
            <div><strong>总保险：</strong><span style="color:#2196F3;">${totalInsurance.toFixed(2)}</span></div>
            <div><strong>保险收益：</strong><span style="color:#4CAF50;">${earnings.toFixed(2)}</span></div>
            <div><strong>保险扣费：</strong><span style="color:#c62828;">${fee.toFixed(2)}</span></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f8f9fc;position:sticky;top:0;z-index:1;">
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;width:40px;">#</th>
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;min-width:140px;">时间</th>
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">金额</th>
                <th style="padding:6px 10px;border-bottom:2px solid #eee;text-align:center;min-width:80px;">操作人</th>
            </tr></thead>
            <tbody>
                ${records.map((r, index) => `
                    <tr>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${index + 1}</td>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(r.created_at)}</td>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:#2196F3;">${(r.amount || 0).toFixed(2)}</td>
                        <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.admin_name || '系统'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div style="padding:10px;background:#e8f5e9;border-radius:6px;margin-top:10px;text-align:center;font-size:13px;">
            💡 收益比例：<strong>${rate}%</strong> 
            | 总保险 ${totalInsurance.toFixed(2)} × ${rate}% = ${earnings.toFixed(2)}
        </div>
    `;
    return html;
}


// ============================================================
// Tab 5: 小費紀錄
// ============================================================

function renderTipsTab(tipsRecords, settlement, settlementId, canTipsWithdraw) {
    if (!tipsRecords || tipsRecords.length === 0) {
        return '<div style="text-align:center;padding:30px;color:#999;">暂无小费记录</div>';
    }
    
    const totalTips = settlement.total_tips || 0;
    const employees = DB.get('employees', []);
    
    // 按員工分組統計
    const employeeMap = {};
    tipsRecords.forEach(t => {
        const empId = t.employee_id || 'unknown';
        if (!employeeMap[empId]) {
            employeeMap[empId] = {
                employee_id: empId,
                employee_name: t.employee_name || '未知員工',
                total: 0,
                count: 0,
                withdrawn: t.withdrawn || false,
                records: []
            };
        }
        employeeMap[empId].total += t.amount;
        employeeMap[empId].count++;
        employeeMap[empId].records.push(t);
        if (t.withdrawn) {
            employeeMap[empId].withdrawn = true;
        }
    });
    
    // 檢查是否全部已提款
    const allWithdrawn = tipsRecords.every(t => t.withdrawn === true);
    
    // 員工統計HTML
    let employeeStatsHtml = '';
    Object.keys(employeeMap).forEach(key => {
        const data = employeeMap[key];
        const status = data.withdrawn ? '✅ 已提款' : '⏳ 待提款';
        const statusColor = data.withdrawn ? '#4CAF50' : '#ffa726';
        employeeStatsHtml += `
            <div style="display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">
                <span><strong>${data.employee_name}</strong> (${data.count}筆)</span>
                <span style="color:#ffa726;font-weight:bold;">${data.total.toFixed(2)} 泰銖</span>
                <span style="color:${statusColor};font-size:12px;">${status}</span>
            </div>
        `;
    });
    
    // 詳細記錄表格
    let detailRows = '';
    tipsRecords.forEach((t, index) => {
        const emp = employees.find(e => e.id === t.employee_id);
        const empName = emp ? emp.name : (t.employee_name || '未知');
        const status = t.withdrawn ? '✅ 已提款' : '⏳ 待提款';
        const statusColor = t.withdrawn ? '#4CAF50' : '#ffa726';
        const withdrawnAmount = t.withdrawn_amount ? t.withdrawn_amount.toFixed(2) : '-';
        
        detailRows += `
            <tr>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${index + 1}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;"><strong>${empName}</strong></td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#ffa726;font-weight:bold;">${t.amount.toFixed(2)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${formatDate(t.created_at)}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:${statusColor};">${status}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${withdrawnAmount}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${t.note || '-'}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${t.admin_name || '系统'}</td>
            </tr>
        `;
    });
    
    let html = `
        <div style="padding:10px;background:#f8f9fc;border-radius:6px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;font-size:13px;">
            <div><strong>小费笔数：</strong>${tipsRecords.length}</div>
            <div><strong>总小费：</strong><span style="color:#ffa726;">${totalTips.toFixed(2)}</span></div>
            <div><strong>已提款：</strong><span style="color:#4CAF50;">${tipsRecords.filter(t => t.withdrawn).length} 筆</span></div>
            <div>
                ${allWithdrawn ? 
                    '<span style="color:#4CAF50;">✅ 全部已提款</span>' : 
                    (canTipsWithdraw ? `<button class="btn btn-success btn-sm" onclick="showTipsCashWithdraw('${settlementId}')">💵 現金提款</button>` : 
                    '<span style="color:#999;font-size:11px;">無提款權限</span>')}
            </div>
        </div>
        
        <h4 style="margin-bottom:10px;text-align:center;font-size:15px;">👥 員工小費統計</h4>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;border:1px solid #eee;max-height:200px;overflow-y:auto;">
            ${employeeStatsHtml}
            <div style="display:flex;justify-content:space-between;padding:6px 12px;font-weight:bold;border-top:2px solid #ddd;margin-top:4px;padding-top:6px;">
                <span>合計</span>
                <span style="color:#ffa726;">${totalTips.toFixed(2)} 泰銖</span>
                <span>${tipsRecords.length} 筆</span>
            </div>
        </div>
        
        <h4 style="margin-bottom:10px;text-align:center;font-size:15px;">📋 詳細記錄</h4>
        <div style="max-height:300px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;width:40px;">#</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">员工</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">提款状态</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">提款金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:100px;">备注</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">操作人</th>
                </tr></thead>
                <tbody>
                    ${detailRows}
                </tbody>
            </table>
        </div>
        <div style="padding:8px;background:#fff8e1;border-radius:6px;margin-top:10px;text-align:center;font-size:12px;color:#e65100;border:1px solid #ffcc80;">
            💡 小費提款為現金支付，不影響往來帳戶餘額
        </div>
    `;
    return html;
}


// ============================================================
// 頁籤切換函數
// ============================================================

function switchSettlementTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
    });
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.style.background = '#f5f5f5';
        btn.style.color = '#333';
    });
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) {
        activeBtn.style.background = '#2196F3';
        activeBtn.style.color = '#fff';
    }
}


// ============================================================
// 輔助函數：顯示單一玩家詳細操作記錄
// ============================================================

function showPlayerDetail(playerName, settlementId) {
    const members = DB.get('members', []);
    const member = members.find(m => m.name === playerName);
    if (!member) {
        alert('找不到该玩家的详细记录');
        return;
    }
    
    const sessions = DB.get('sessions', []);
    const upRecords = DB.get('up_records', []);
    const downRecords = DB.get('down_records', []);
    const rechargeRecords = DB.get('recharge_records', []);
    const withdrawRecords = DB.get('withdraw_records', []);
    
    const playerSessions = sessions.filter(s => s.member_id === member.id);
    const sessionIds = playerSessions.map(s => s.id);
    
    const playerUpRecords = upRecords.filter(r => sessionIds.includes(r.session_id));
    const playerDownRecords = downRecords.filter(r => sessionIds.includes(r.session_id));
    const playerRecharges = rechargeRecords.filter(r => r.member_id === member.id);
    const playerWithdraws = withdrawRecords.filter(r => r.member_id === member.id);
    
    const timeline = [];
    playerUpRecords.forEach(r => {
        timeline.push({
            type: '⬆️ 上分',
            time: r.up_time,
            amount: r.amount,
            currency: r.currency || 'THB',
            thbAmount: r.thb_amount || r.amount,
            detail: `付款状态：${r.payment_status === 'paid' ? '已付' : '未付'}${r.payment_method ? ' | 方式：' + r.payment_method : ''}`
        });
    });
    playerDownRecords.forEach(r => {
        timeline.push({
            type: '⬇️ 下分',
            time: r.down_time,
            amount: r.amount,
            currency: r.currency || 'THB',
            thbAmount: r.amount,
            detail: `存入币别：${r.converted_currency || r.currency || 'THB'} | 兑换：${(r.converted_amount || r.amount).toFixed(2)}`
        });
    });
    playerRecharges.forEach(r => {
        timeline.push({
            type: '💰 充值',
            time: r.created_at,
            amount: r.amount,
            currency: r.currency || 'THB',
            thbAmount: r.thb_amount || r.amount,
            detail: `收款账户：${r.receiver || '-'}`
        });
    });
    playerWithdraws.forEach(r => {
        timeline.push({
            type: '📤 出金',
            time: r.created_at,
            amount: r.amount,
            currency: r.currency || 'THB',
            thbAmount: r.thb_amount || r.amount,
            detail: `出金方式：${r.sender || '-'}`
        });
    });
    
    timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    const totalUp = playerUpRecords.reduce((sum, r) => sum + (r.thb_amount || r.amount || 0), 0);
    const totalDown = playerDownRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalRecharge = playerRecharges.reduce((sum, r) => sum + (r.thb_amount || r.amount || 0), 0);
    const totalWithdraw = playerWithdraws.reduce((sum, r) => sum + (r.thb_amount || r.amount || 0), 0);
    
    const memberAccount = getMemberAccount(member.id);
    const balances = memberAccount.balances || {};
    const currencies = DB.get('currencies', []);
    let accountBalance = 0;
    let balanceDetails = [];
    currencies.forEach(c => {
        const balance = balances[c.currency] || 0;
        const rate = getCurrencyRate(c.currency);
        const thbValue = balance * rate;
        accountBalance += thbValue;
        if (balance !== 0) {
            balanceDetails.push(`${c.currency}: ${balance.toFixed(2)} (≈${thbValue.toFixed(2)}泰铢)`);
        }
    });
    
    const html = `
        <div class="modal-title" style="font-size:18px;text-align:center;">📋 ${playerName} - 操作明细</div>
        
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;text-align:center;font-size:13px;">
            <div><strong>总上分：</strong><span style="color:#2196F3;">${totalUp.toFixed(2)}</span></div>
            <div><strong>总下分：</strong><span style="color:#ff6b6b;">${totalDown.toFixed(2)}</span></div>
            <div><strong>总充值：</strong><span style="color:#4CAF50;">${totalRecharge.toFixed(2)}</span></div>
            <div><strong>总出金：</strong><span style="color:#ff6b6b;">${totalWithdraw.toFixed(2)}</span></div>
        </div>
        <div style="margin-bottom:15px;padding:10px;background:linear-gradient(135deg, ${accountBalance >= 0 ? '#4CAF50' : '#ff6b6b'}, ${accountBalance >= 0 ? '#2E7D32' : '#c62828'});border-radius:6px;text-align:center;color:#fff;">
            <span style="font-size:13px;">💰 当前账户余额：</span>
            <span style="font-size:20px;font-weight:bold;">${accountBalance.toFixed(2)} 泰铢</span>
            ${balanceDetails.length > 0 ? `<div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:3px;">${balanceDetails.join(' | ')}</div>` : ''}
        </div>
        
        <div style="max-height:350px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">#</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:140px;">时间</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">操作</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">金额</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">币别</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">泰铢</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">备注</th>
                </tr></thead>
                <tbody>
                    ${timeline.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">暂无操作记录</td></tr>' :
                    timeline.map((r, index) => {
                        const isDown = r.type === '⬇️ 下分';
                        const isUp = r.type === '⬆️ 上分';
                        const isRecharge = r.type === '💰 充值';
                        const isWithdraw = r.type === '📤 出金';
                        let rowColor = '';
                        if (isDown) rowColor = '#e8f5e9';
                        else if (isUp) rowColor = '#fff3e0';
                        else if (isRecharge) rowColor = '#e3f2fd';
                        else if (isWithdraw) rowColor = '#ffebee';
                        return `<tr style="background:${rowColor};">
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${index + 1}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${formatDate(r.time)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;">${r.type}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.amount.toFixed(2)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.currency}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.thbAmount.toFixed(2)}</td>
                            <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.detail || '-'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="padding:8px;background:#f8f9fc;border-radius:6px;margin-top:10px;font-size:12px;color:#999;text-align:center;">
            📌 共 ${timeline.length} 笔操作记录
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModalWide(html);
}


// ============================================================
// 輔助函數：根據姓名查找會員
// ============================================================

function getMemberByName(name) {
    const members = DB.get('members', []);
    return members.find(m => m.name === name);
}


// ============================================================
// 介紹人提款相關函數
// ============================================================

function showAgentWithdrawDialog(settlementId) {
    if (!checkActionPermission('tables', 'rebate_payment')) {
        showPermissionDenied('介紹人提款');
        return;
    }
    
    const settlements = DB.get('daily_settlements', []);
    const settlement = settlements.find(s => s.id === parseInt(settlementId));
    if (!settlement) {
        alert('找不到結算記錄');
        return;
    }
    
    let rebateDetails = [];
    try {
        rebateDetails = JSON.parse(settlement.rebate_details || '[]');
    } catch(e) {}
    
    if (rebateDetails.length === 0) {
        alert('沒有退水記錄可提款');
        return;
    }
    
    if (settlement.rebate_paid) {
        alert('✅ 所有介紹人退水已提款');
        return;
    }
    
    // 按介紹人分組
    const agentMap = {};
    rebateDetails.forEach(r => {
        const key = r.agentId || r.agentName || '未知';
        if (!agentMap[key]) {
            agentMap[key] = {
                agentName: r.agentName || '未知',
                agentId: r.agentId || null,
                totalRebate: 0,
                players: []
            };
        }
        agentMap[key].totalRebate += r.rebateAmount;
        agentMap[key].players.push(r);
    });
    
    let agentHtml = '';
    let totalAllRebate = 0;
    Object.keys(agentMap).forEach(key => {
        const data = agentMap[key];
        totalAllRebate += data.totalRebate;
        // ★ 四捨五入到百位顯示
        const displayAmount = Math.round(data.totalRebate / 100) * 100;
        agentHtml += `
            <div style="display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;align-items:center;">
                <span>👤 <strong>${data.agentName}</strong> (${data.players.length}位玩家)</span>
                <span style="color:#4CAF50;font-weight:bold;">${displayAmount.toFixed(2)} 泰銖</span>
                <button class="btn btn-success btn-sm" onclick="closeModal(this.closest('.modal-overlay'));showAgentWithdraw('${settlementId}', '${data.agentName}', ${data.agentId || 'null'}, ${displayAmount})">💵 提款</button>
            </div>
        `;
    });
    
    // ★ 總退水也四捨五入到百位
    const totalDisplay = Math.round(totalAllRebate / 100) * 100;
    
    const html = `
        <div class="modal-title" style="font-size:20px;">💵 介紹人退水提款</div>
        
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #4CAF50, #2E7D32);border-radius:8px;text-align:center;color:#fff;">
            <div style="font-size:13px;opacity:0.9;">💰 總退水金額</div>
            <div style="font-size:28px;font-weight:bold;">${totalDisplay.toFixed(2)} 泰銖</div>
            <div style="font-size:12px;opacity:0.8;">共 ${Object.keys(agentMap).length} 位介紹人 | 已四舍五入到百位</div>
        </div>
        
        <h4 style="margin-bottom:10px;text-align:center;font-size:15px;">👥 介紹人退水明細</h4>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;border:1px solid #eee;max-height:300px;overflow-y:auto;">
            ${agentHtml}
        </div>
        
        <div style="padding:10px;background:#e3f2fd;border-radius:6px;font-size:12px;text-align:center;border:1px solid #90caf9;">
            💡 點擊各介紹人旁的「提款」按鈕進行個別提款
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
        </div>
    `;
    showModal(html);
}

function showAgentWithdraw(settlementId, agentName, agentId, totalRebate) {
    if (!checkActionPermission('tables', 'rebate_payment')) {
        showPermissionDenied('介紹人提款');
        return;
    }
    
    if (!agentId) {
        alert('找不到介紹人ID，無法進行提款');
        return;
    }
    
    if (totalRebate <= 0) {
        alert(`${agentName} 沒有退水金額可提款`);
        return;
    }
    
    const accounts = DB.get('accounts', []);
    const currencies = DB.get('currencies', []);
    
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
    
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}" ${c.currency === 'THB' ? 'selected' : ''}>${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    // ★ 確保顯示的金額是四捨五入到百位
    const displayAmount = Math.round(totalRebate / 100) * 100;
    
    const html = `
        <div class="modal-title" style="font-size:20px;">💵 介紹人提款 - ${agentName}</div>
        
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #4CAF50, #2E7D32);border-radius:8px;text-align:center;color:#fff;">
            <div style="font-size:13px;opacity:0.9;">💰 可提款金額</div>
            <div style="font-size:28px;font-weight:bold;">${displayAmount.toFixed(2)} 泰銖</div>
            <div style="font-size:12px;opacity:0.8;">（已四舍五入到百位）</div>
        </div>
        
        <div class="form-group">
            <label>提款方式 *</label>
            <select id="agentWithdrawMethod" onchange="toggleAgentWithdrawMethod()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                <option value="account">🏦 存入介紹人帳戶</option>
                <option value="cash">💵 提取現金（不入帳戶）</option>
            </select>
        </div>
        
        <div id="agentWithdrawAccountGroup">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>存入帳戶 *</label>
                    <select id="agentWithdrawAccount" onchange="updateAgentWithdrawPreview()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                        ${accountOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>存入幣種 *</label>
                    <select id="agentWithdrawCurrency" onchange="updateAgentWithdrawPreview()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                        ${currencyOptions}
                    </select>
                </div>
            </div>
            <div id="agentWithdrawPreview" style="margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;display:none;">
                <span style="color:#e65100;">💡 存入後帳戶餘額：<strong id="agentAfterBalance">0.00</strong> <span id="agentAfterCurrency">THB</span></span>
            </div>
        </div>
        
        <div id="agentWithdrawCashInfo" style="display:none;margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;">
            <span style="color:#e65100;">💵 現金提款 - 請確認已支付現金給介紹人 ${agentName}</span>
        </div>
        
        <div class="form-group">
            <label>備註</label>
            <input type="text" id="agentWithdrawNote" placeholder="請輸入備註（可選）" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitAgentWithdraw('${settlementId}', ${agentId}, '${agentName}', ${displayAmount})">✅ 確認提款</button>
        </div>
    `;
    showModal(html);
    
    window.toggleAgentWithdrawMethod = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const method = overlay.querySelector('#agentWithdrawMethod').value;
        const accountGroup = overlay.querySelector('#agentWithdrawAccountGroup');
        const cashInfo = overlay.querySelector('#agentWithdrawCashInfo');
        
        if (method === 'account') {
            accountGroup.style.display = 'block';
            cashInfo.style.display = 'none';
        } else {
            accountGroup.style.display = 'none';
            cashInfo.style.display = 'block';
        }
    };
    
    window.updateAgentWithdrawPreview = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const accountSelect = overlay.querySelector('#agentWithdrawAccount');
        const currencySelect = overlay.querySelector('#agentWithdrawCurrency');
        const selectedOption = accountSelect.options[accountSelect.selectedIndex];
        const previewDiv = document.getElementById('agentWithdrawPreview');
        const afterBalanceSpan = document.getElementById('agentAfterBalance');
        const afterCurrencySpan = document.getElementById('agentAfterCurrency');
        
        const selectedCurrency = currencySelect.value;
        const currentBalance = parseFloat(selectedOption?.dataset?.balance || 0);
        const amount = displayAmount;
        
        const sellRate = getSellRate(selectedCurrency);
        let deductAmount = 0;
        if (selectedCurrency === 'THB') {
            deductAmount = amount;
        } else {
            deductAmount = convertFromTHB(amount, selectedCurrency);
        }
        const afterBalance = currentBalance + deductAmount;
        
        previewDiv.style.display = 'block';
        afterBalanceSpan.textContent = afterBalance.toFixed(2);
        afterBalanceSpan.style.color = afterBalance >= 0 ? '#2e7d32' : '#c62828';
        afterCurrencySpan.textContent = selectedCurrency;
    };
    
    document.getElementById('agentWithdrawAccount')?.addEventListener('change', updateAgentWithdrawPreview);
    document.getElementById('agentWithdrawCurrency')?.addEventListener('change', updateAgentWithdrawPreview);
    
    setTimeout(() => {
        if (window.toggleAgentWithdrawMethod) window.toggleAgentWithdrawMethod();
        if (window.updateAgentWithdrawPreview) window.updateAgentWithdrawPreview();
    }, 100);
}

function submitAgentWithdraw(settlementId, agentId, agentName, amount) {
    const overlay = document.querySelector('.modal-overlay');
    const method = overlay.querySelector('#agentWithdrawMethod').value;
    const note = overlay.querySelector('#agentWithdrawNote').value.trim() || '';
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const nowTime = now();
    
    const settlements = DB.get('daily_settlements', []);
    const settlement = settlements.find(s => s.id === parseInt(settlementId));
    if (!settlement) {
        alert('找不到結算記錄');
        return;
    }
    
    if (settlement.rebate_paid) {
        alert('⚠️ 此介紹人的退水已提款');
        overlay.remove();
        return;
    }
    
    let accountId = null;
    let currency = 'THB';
    let deductAmount = amount;
    
    if (method === 'account') {
        const accountStr = overlay.querySelector('#agentWithdrawAccount').value;
        if (!accountStr) {
            alert('請選擇存入帳戶');
            return;
        }
        const [accId, cur] = accountStr.split('|');
        accountId = parseInt(accId);
        currency = overlay.querySelector('#agentWithdrawCurrency').value;
        
        if (!accountId) {
            alert('請選擇有效的帳戶');
            return;
        }
        
        update_account_balance(accountId, currency, deductAmount);
        
        add_account_transaction(
            accountId,
            currency,
            deductAmount,
            'in',
            'agent_rebate_withdraw',
            settlement.id,
            `介紹人退水提款 - ${agentName} - ${amount} 泰銖 (${deductAmount} ${currency}) - ${note} - 操作人：${adminName}`
        );
    }
    
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: null,
        type: 'refund',
        amount: amount,
        note: `介紹人退水提款 - ${agentName} - ${amount} 泰銖 - 方式：${method === 'account' ? '帳戶存入' : '現金'} - ${note} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: nowTime
    });
    DB.set('transactions', transactions);
    
    settlement.rebate_paid = true;
    settlement.rebate_paid_at = nowTime;
    settlement.rebate_paid_method = method === 'account' ? `帳戶存入 (${currency})` : '現金';
    settlement.rebate_paid_amount = amount;
    settlement.rebate_paid_admin = adminName;
    settlement.rebate_account_id = accountId;
    settlement.rebate_currency = currency;
    
    const idx = settlements.findIndex(s => s.id === settlement.id);
    if (idx !== -1) {
        settlements[idx] = settlement;
        DB.set('daily_settlements', settlements);
    }
    
    addOperationLog('每日台帳', '介紹人提款', agentName, 
        `${agentName} 退水提款 ${amount} 泰銖 - 方式：${method === 'account' ? '帳戶存入' : '現金'}${note ? ' - ' + note : ''}`, agentId);
    
    overlay.remove();
    
    const currentTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tab2';
    showSettlementDetail(settlement.id);
    setTimeout(() => {
        switchSettlementTab(currentTab);
    }, 100);
    
    alert(`✅ 介紹人退水提款完成！\n\n介紹人：${agentName}\n金額：${amount.toFixed(2)} 泰銖\n方式：${method === 'account' ? '🏦 帳戶存入' : '💵 現金'}\n操作人：${adminName}`);
}


// ============================================================
// 小費現金提款
// ============================================================

function showTipsCashWithdraw(settlementId) {
    if (!checkActionPermission('tables', 'tips_withdraw')) {
        showPermissionDenied('小費現金提款');
        return;
    }
    
    const settlements = DB.get('daily_settlements', []);
    const settlement = settlements.find(s => s.id === parseInt(settlementId));
    if (!settlement) {
        alert('找不到結算記錄');
        return;
    }
    
    let tipsDetails = [];
    try {
        tipsDetails = JSON.parse(settlement.tips_details || '[]');
    } catch(e) {}
    
    if (tipsDetails.length === 0) {
        alert('沒有小費記錄可提款');
        return;
    }
    
    const allWithdrawn = tipsDetails.every(t => t.withdrawn === true);
    if (allWithdrawn) {
        alert('✅ 所有小費已提款');
        return;
    }
    
    const totalTips = settlement.total_tips || 0;
    const employees = DB.get('employees', []);
    
    let employeeHtml = '';
    const employeeMap = {};
    tipsDetails.forEach(t => {
        const key = t.employee_id || 'unknown';
        if (!employeeMap[key]) {
            employeeMap[key] = {
                employee_name: t.employee_name || '未知員工',
                total: 0,
                count: 0,
                withdrawn: t.withdrawn || false
            };
        }
        employeeMap[key].total += t.amount;
        employeeMap[key].count++;
        if (t.withdrawn) {
            employeeMap[key].withdrawn = true;
        }
    });
    
    Object.keys(employeeMap).forEach(key => {
        const data = employeeMap[key];
        const status = data.withdrawn ? '✅ 已提款' : '⏳ 待提款';
        const statusColor = data.withdrawn ? '#4CAF50' : '#ffa726';
        employeeHtml += `
            <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #f0f0f0;font-size:13px;">
                <span>👤 ${data.employee_name} (${data.count}筆)</span>
                <span style="color:#ffa726;font-weight:bold;">${data.total.toFixed(2)} 泰銖</span>
                <span style="color:${statusColor};font-size:12px;">${status}</span>
            </div>
        `;
    });
    
    const html = `
        <div class="modal-title" style="font-size:20px;">💵 小費現金提款</div>
        
        <div style="margin-bottom:15px;padding:12px;background:linear-gradient(135deg, #ffa726, #f57c00);border-radius:8px;text-align:center;color:#fff;">
            <div style="font-size:13px;opacity:0.9;">💰 總小費金額</div>
            <div style="font-size:28px;font-weight:bold;">${totalTips.toFixed(2)} 泰銖</div>
            <div style="font-size:12px;opacity:0.8;">共 ${tipsDetails.length} 筆記錄</div>
        </div>
        
        <h4 style="margin-bottom:10px;text-align:center;font-size:15px;">👥 員工小費明細</h4>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;border:1px solid #eee;max-height:200px;overflow-y:auto;">
            ${employeeHtml}
        </div>
        
        <div style="padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;margin-bottom:15px;">
            <span style="color:#e65100;">💵 現金提款 - 請確認已支付現金給員工</span>
        </div>
        
        <div class="form-group">
            <label>備註</label>
            <input type="text" id="tipsCashNote" placeholder="請輸入備註（可選）" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitTipsCashWithdraw('${settlementId}')">✅ 確認現金提款</button>
        </div>
    `;
    showModal(html);
}

function submitTipsCashWithdraw(settlementId) {
    const overlay = document.querySelector('.modal-overlay');
    const note = overlay.querySelector('#tipsCashNote').value.trim() || '';
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const nowTime = now();
    
    const settlements = DB.get('daily_settlements', []);
    const settlement = settlements.find(s => s.id === parseInt(settlementId));
    if (!settlement) {
        alert('找不到結算記錄');
        return;
    }
    
    let tipsDetails = [];
    try {
        tipsDetails = JSON.parse(settlement.tips_details || '[]');
    } catch(e) {}
    
    if (tipsDetails.length === 0) {
        alert('沒有小費記錄可提款');
        return;
    }
    
    const allWithdrawn = tipsDetails.every(t => t.withdrawn === true);
    if (allWithdrawn) {
        alert('✅ 所有小費已提款');
        overlay.remove();
        return;
    }
    
    const totalTips = settlement.total_tips || 0;
    
    const allTipsRecords = DB.get('tips_records', []);
    tipsDetails.forEach(t => {
        const record = allTipsRecords.find(r => r.id === t.id);
        if (record && !record.withdrawn) {
            record.withdrawn = true;
            record.withdrawn_at = nowTime;
            record.withdrawn_amount = t.amount;
            record.withdrawn_admin_name = adminName;
        }
    });
    DB.set('tips_records', allTipsRecords);
    
    const updatedTipsDetails = tipsDetails.map(t => ({
        ...t,
        withdrawn: true,
        withdrawn_at: nowTime,
        withdrawn_amount: t.amount,
        withdrawn_admin_name: adminName
    }));
    settlement.tips_details = JSON.stringify(updatedTipsDetails);
    settlement.tips_withdrawn = true;
    settlement.tips_withdrawn_at = nowTime;
    settlement.tips_withdrawn_admin = adminName;
    
    const idx = settlements.findIndex(s => s.id === settlement.id);
    if (idx !== -1) {
        settlements[idx] = settlement;
        DB.set('daily_settlements', settlements);
    }
    
    const transactions = DB.get('transactions', []);
    transactions.push({
        id: DB.getNextId('transactions'),
        member_id: null,
        type: 'refund',
        amount: totalTips,
        note: `小費現金提款 - ${totalTips.toFixed(2)} 泰銖 - ${note} - 操作人：${adminName}`,
        admin_id: adminId,
        admin_name: adminName,
        created_at: nowTime
    });
    DB.set('transactions', transactions);
    
    addOperationLog('每日台帳', '小費現金提款', settlement.table_type, 
        `${settlement.table_type} 小費現金提款 ${totalTips.toFixed(2)} 泰銖${note ? ' - ' + note : ''}`);
    
    overlay.remove();
    
    const currentTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tab5';
    showSettlementDetail(settlement.id);
    setTimeout(() => {
        switchSettlementTab(currentTab);
    }, 100);
    
    alert(`✅ 小費現金提款完成！\n\n桌號：${settlement.table_type}\n總金額：${totalTips.toFixed(2)} 泰銖\n操作人：${adminName}`);
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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