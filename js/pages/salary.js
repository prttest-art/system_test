// ============================================================
// 员工工资（每个员工每月只能产生一次工资，绑定员工ID + 出款帳戶 + 狀態/ID/姓名查詢 + 權限控制）
// ============================================================

// ============================================================
// 渲染員工工資頁面 - 含權限檢查
// ============================================================

function renderSalary(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('salary', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>💰 員工工資</h1>
                <p class="breadcrumb">營運管理 > 員工工資</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「員工工資」的权限</p>
            </div>
        `;
        return;
    }
    
    // 初始化薪資記錄
    if (!localStorage.getItem('rpt_salary_records')) {
        DB.set('salary_records', []);
        DB.set('salary_records_next', 1);
    }
    
    const employees = DB.get('employees', []);
    const salaryRecords = DB.get('salary_records', []);
    const accounts = DB.get('accounts', []);
    const yearMonth = document.getElementById('salaryMonth')?.value || new Date().toISOString().slice(0, 7);
    
    // 獲取查詢參數
    const searchKeyword = document.getElementById('salarySearch')?.value?.trim() || '';
    const searchStatus = document.getElementById('salaryStatusFilter')?.value || '';
    
    // 過濾該月份的薪資記錄
    let monthRecords = salaryRecords.filter(r => r.year_month === yearMonth);
    
    // 按狀態過濾
    if (searchStatus) {
        monthRecords = monthRecords.filter(r => r.status === searchStatus);
    }
    
    // 按關鍵字過濾（ID或姓名）
    if (searchKeyword) {
        const isNumeric = /^\d+$/.test(searchKeyword);
        monthRecords = monthRecords.filter(r => {
            if (isNumeric) {
                return r.employee_id.toString().includes(searchKeyword);
            }
            const emp = employees.find(e => e.id === r.employee_id);
            return emp && emp.name.toLowerCase().includes(searchKeyword.toLowerCase());
        });
    }
    
    // 按員工ID排序
    monthRecords.sort((a, b) => a.employee_id - b.employee_id);
    
    // 計算總計
    const totalSalary = monthRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalBonus = monthRecords.reduce((sum, r) => sum + (r.bonus || 0), 0);
    const totalDeduction = monthRecords.reduce((sum, r) => sum + (r.deduction || 0), 0);
    const totalNetPay = monthRecords.reduce((sum, r) => sum + (r.net_pay || r.amount || 0), 0);
    
    // 檢查該月份是否已產生工資
    const hasGenerated = monthRecords.length > 0;
    
    // 獲取在職員工列表
    const activeEmployees = employees.filter(e => e.status === '在職');
    const generatedCount = monthRecords.length;
    const totalActiveCount = activeEmployees.length;
    
    // 計算各狀態數量
    const pendingCount = monthRecords.filter(r => r.status === '待發放').length;
    const paidCount = monthRecords.filter(r => r.status === '已發放').length;
    
    // 顯示搜尋結果數量
    const resultCount = monthRecords.length;
    const totalCount = salaryRecords.filter(r => r.year_month === yearMonth).length;
    const searchInfo = searchKeyword || searchStatus ? `找到 ${resultCount} 筆結果（共 ${totalCount} 筆）` : `共 ${totalCount} 筆`;
    
    // ✅ 檢查各操作權限
    const canGenerate = checkActionPermission('salary', 'generate');
    const canAdd = checkActionPermission('salary', 'add');
    const canEdit = checkActionPermission('salary', 'edit');
    const canPay = checkActionPermission('salary', 'pay');
    const canDelete = checkActionPermission('salary', 'delete');
    const canViewDetail = checkActionPermission('salary', 'view_detail');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>💰 員工工資</h1>
            <p class="breadcrumb">營運管理 > 員工工資</p>
        </div>
        
        <!-- 查詢工具欄 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:12px 15px;margin-bottom:15px;">
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                <span style="font-weight:500;font-size:13px;color:#555;">📅 月份：</span>
                <input type="month" id="salaryMonth" value="${yearMonth}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="renderSalary(document.getElementById('mainContent'))">
                
                <span style="font-weight:500;font-size:13px;color:#555;margin-left:5px;">🔍 搜尋：</span>
                <input type="text" id="salarySearch" placeholder="輸入ID或姓名..." value="${searchKeyword}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:150px;" onkeydown="if(event.key==='Enter') renderSalary(document.getElementById('mainContent'))">
                
                <span style="font-weight:500;font-size:13px;color:#555;">📊 狀態：</span>
                <select id="salaryStatusFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="renderSalary(document.getElementById('mainContent'))">
                    <option value="">全部</option>
                    <option value="待發放" ${searchStatus === '待發放' ? 'selected' : ''}>待發放</option>
                    <option value="已發放" ${searchStatus === '已發放' ? 'selected' : ''}>已發放</option>
                </select>
                
                <button class="btn btn-primary" onclick="renderSalary(document.getElementById('mainContent'))">🔍 查詢</button>
                <button class="btn" onclick="document.getElementById('salarySearch').value='';document.getElementById('salaryStatusFilter').value='';renderSalary(document.getElementById('mainContent'))">✕ 清除</button>
                
                <span style="font-size:12px;color:#999;margin-left:auto;">${searchInfo}</span>
            </div>
        </div>
        
        <!-- 操作按鈕 -->
        <div class="toolbar">
            <div class="search-box">
                ${canGenerate ? `<button class="btn btn-primary" onclick="generateSalary()">📋 產生工資</button>` : ''}
                ${canAdd ? `<button class="btn btn-success" onclick="showAddSalary()">➕ 新增工資</button>` : ''}
                ${hasGenerated ? `<span style="font-size:12px;color:#4CAF50;margin-left:5px;">✅ 已產生 ${generatedCount}/${totalActiveCount} 筆</span>` : ''}
                <span style="font-size:12px;color:#999;margin-left:5px;">待發放：${pendingCount} | 已發放：${paidCount}</span>
            </div>
            <button class="btn" onclick="renderSalary(document.getElementById('mainContent'))">🔄 刷新</button>
        </div>
        
        <!-- 統計卡片 -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
            <div class="stat-card"><div class="stat-label">總薪資</div><div class="stat-value" style="color:#2196F3;">${totalSalary.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">總獎金</div><div class="stat-value" style="color:#4CAF50;">${totalBonus.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">總扣款</div><div class="stat-value" style="color:#ff6b6b;">${totalDeduction.toFixed(2)}</div></div>
            <div class="stat-card highlight"><div class="stat-label">實發總額</div><div class="stat-value">${totalNetPay.toFixed(2)}</div></div>
        </div>
        
        <div class="table-container">
            <table>
                <thead><tr>
                    <th>員工ID</th>
                    <th>員工</th>
                    <th>部門</th>
                    <th>職位</th>
                    <th>底薪</th>
                    <th>獎金</th>
                    <th>扣款</th>
                    <th>實發金額</th>
                    <th>月份</th>
                    <th>狀態</th>
                    <th>出款帳戶</th>
                    <th>操作</th>
                </tr></thead>
                <tbody>
                    ${monthRecords.length === 0 ? '<tr class="empty-row"><td colspan="12">' + (searchKeyword || searchStatus ? '未找到匹配的工資記錄' : '該月份尚無薪資記錄') + '</td></tr>' :
                    monthRecords.map(r => {
                        const emp = employees.find(e => e.id === r.employee_id);
                        const account = accounts.find(a => a.id === r.account_id);
                        let displayName = emp ? emp.name : '未知';
                        if (searchKeyword && emp) {
                            const regex = new RegExp(`(${searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                            displayName = emp.name.replace(regex, '<mark style="background:#ffeb3b;padding:0 2px;border-radius:2px;">$1</mark>');
                        }
                        
                        // 構建操作按鈕（根據權限顯示）
                        let actionButtons = '';
                        if (canEdit && r.status !== '已發放') {
                            actionButtons += `<button class="btn btn-primary btn-sm" onclick="showEditSalary(${r.id})">修改</button>`;
                        }
                        if (canPay && r.status !== '已發放') {
                            actionButtons += `<button class="btn btn-success btn-sm" onclick="showPaySalary(${r.id})">💰 發放</button>`;
                        }
                        if (canDelete) {
                            actionButtons += `<button class="btn btn-danger btn-sm" onclick="deleteSalary(${r.id})">刪除</button>`;
                        }
                        if (canViewDetail) {
                            actionButtons += `<button class="btn btn-info btn-sm" onclick="showSalaryDetail(${r.id})">📋 明細</button>`;
                        }
                        
                        return `<tr>
                            <td style="text-align:center;"><strong>${r.employee_id}</strong> ${searchKeyword && r.employee_id.toString().includes(searchKeyword) ? '🔍' : ''}</td>
                            <td style="text-align:center;"><strong>${displayName}</strong></td>
                            <td style="text-align:center;">${emp ? emp.department || '-' : '-'}</td>
                            <td style="text-align:center;">${emp ? emp.position || '-' : '-'}</td>
                            <td style="text-align:center;">${(r.base_salary || r.amount || 0).toFixed(2)}</td>
                            <td style="text-align:center;color:#4CAF50;">${(r.bonus || 0).toFixed(2)}</td>
                            <td style="text-align:center;color:#ff6b6b;">${(r.deduction || 0).toFixed(2)}</td>
                            <td style="text-align:center;color:#2196F3;font-weight:bold;">${(r.net_pay || r.amount || 0).toFixed(2)}</td>
                            <td style="text-align:center;">${r.year_month || '-'}</td>
                            <td style="text-align:center;"><span class="badge ${r.status === '已發放' ? 'badge-success' : 'badge-warning'}">${r.status || '待發放'}</span></td>
                            <td style="text-align:center;font-size:12px;color:#666;">${account ? account.name : (r.account_name || '-')}</td>
                            <td style="text-align:center;">
                                <div class="btn-group" style="justify-content:center;flex-wrap:wrap;">
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
// 顯示薪資明細 - 含權限檢查
// ============================================================

function showSalaryDetail(id) {
    // ✅ 檢查查看明細權限
    if (!checkActionPermission('salary', 'view_detail')) {
        showPermissionDenied('查看薪資明細');
        return;
    }
    
    const salaryRecords = DB.get('salary_records', []);
    const r = salaryRecords.find(s => s.id === id);
    if (!r) { alert('記錄不存在'); return; }
    
    const employees = DB.get('employees', []);
    const accounts = DB.get('accounts', []);
    const emp = employees.find(e => e.id === r.employee_id);
    const account = accounts.find(a => a.id === r.account_id);
    
    const statusMap = {
        '待發放': '<span class="badge badge-warning">⏳ 待發放</span>',
        '已發放': '<span class="badge badge-success">💰 已發放</span>'
    };
    
    const html = `
        <div class="modal-title" style="font-size:20px;text-align:center;">📋 薪資明細 #${r.id}</div>
        
        <div style="text-align:center;margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            ${statusMap[r.status] || '未知'}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;padding:15px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            <div><strong>👤 員工：</strong>${emp ? emp.name : '未知'}</div>
            <div><strong>🏢 部門：</strong>${emp ? (emp.department || '-') : '-'}</div>
            <div><strong>💼 職位：</strong>${emp ? (emp.position || '-') : '-'}</div>
            <div><strong>📅 月份：</strong>${r.year_month || '-'}</div>
            <div><strong>💰 底薪：</strong>${(r.base_salary || r.amount || 0).toFixed(2)}</div>
            <div><strong>🎯 獎金：</strong><span style="color:#4CAF50;">${(r.bonus || 0).toFixed(2)}</span></div>
            <div><strong>📤 扣款：</strong><span style="color:#ff6b6b;">${(r.deduction || 0).toFixed(2)}</span></div>
            <div><strong>💵 實發金額：</strong><span style="color:#2196F3;font-weight:bold;font-size:18px;">${(r.net_pay || r.amount || 0).toFixed(2)}</span></div>
        </div>
        
        ${r.status === '已發放' && r.account_id ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px;padding:15px;background:#e3f2fd;border-radius:8px;border:1px solid #90caf9;">
                <div><strong>🏦 出款帳戶：</strong>${account ? account.name : (r.account_name || '-')}</div>
                <div><strong>📤 出款金額：</strong><span style="color:#ff6b6b;font-weight:bold;">${(r.net_pay || r.amount || 0).toFixed(2)}</span></div>
                <div><strong>📅 發放時間：</strong>${r.paid_at ? formatDate(r.paid_at) : '-'}</div>
                <div><strong>👤 操作人：</strong>${r.paid_admin_name || r.admin_name || '系統'}</div>
            </div>
        ` : ''}
        
        <div style="margin-bottom:15px;padding:15px;background:#f5f5f5;border-radius:8px;border:1px solid #e0e0e0;">
            <div style="margin-bottom:8px;"><strong>📝 備註：</strong></div>
            <div style="padding:8px 12px;background:#fff;border-radius:4px;border:1px solid #eee;min-height:40px;white-space:pre-wrap;word-break:break-word;">${r.remark || '（無備註）'}</div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:10px 15px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;font-size:12px;color:#888;">
            <div><strong>建立人：</strong>${r.admin_name || '系統'}</div>
            <div style="text-align:right;"><strong>建立時間：</strong>${formatDate(r.created_at)}</div>
        </div>
        
        <div class="modal-actions">
            ${r.status !== '已發放' && checkActionPermission('salary', 'pay') ? `<button class="btn btn-success" onclick="closeModal(this.closest('.modal-overlay'));showPaySalary(${r.id})">💰 發放</button>` : ''}
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
        </div>
    `;
    showModalWide(html);
}

// ============================================================
// 產生工資 - 含權限檢查
// ============================================================

function generateSalary() {
    // ✅ 檢查產生工資權限
    if (!checkActionPermission('salary', 'generate')) {
        showPermissionDenied('產生工資');
        return;
    }
    
    const employees = DB.get('employees', []).filter(e => e.status === '在職');
    if (employees.length === 0) {
        alert('沒有在職員工，請先新增員工');
        return;
    }
    
    const yearMonth = document.getElementById('salaryMonth')?.value || new Date().toISOString().slice(0, 7);
    const salaryRecords = DB.get('salary_records', []);
    
    const existing = salaryRecords.filter(r => r.year_month === yearMonth);
    
    if (existing.length > 0) {
        const existingIds = existing.map(r => r.employee_id);
        const existingNames = existing.map(r => {
            const emp = DB.get('employees', []).find(e => e.id === r.employee_id);
            return emp ? emp.name : '未知(ID:' + r.employee_id + ')';
        }).join('、');
        
        if (!confirm(`⚠️ ${yearMonth} 已有 ${existing.length} 筆薪資記錄，以下員工已產生：\n\n${existingNames}\n\n是否重新產生？\n（將刪除原有記錄並重新產生）`)) {
            return;
        }
        const newRecords = salaryRecords.filter(r => r.year_month !== yearMonth);
        DB.set('salary_records', newRecords);
        
        addOperationLog('員工工資', '删除', yearMonth, `重新產生工資 - 刪除 ${yearMonth} 舊記錄 (${existing.length} 筆)`);
    }
    
    let count = 0;
    let generatedList = [];
    employees.forEach(emp => {
        const baseSalary = emp.salary || 0;
        const newRecord = {
            id: DB.getNextId('salary_records'),
            employee_id: emp.id,
            employee_name: emp.name,
            year_month: yearMonth,
            base_salary: baseSalary,
            amount: baseSalary,
            bonus: 0,
            deduction: 0,
            net_pay: baseSalary,
            status: '待發放',
            account_id: null,
            account_name: null,
            admin_name: getCurrentAdminName(),
            created_at: now()
        };
        salaryRecords.push(newRecord);
        count++;
        generatedList.push(`${emp.name} (ID:${emp.id})`);
    });
    
    DB.set('salary_records', salaryRecords);
    
    addOperationLog('員工工資', '新增', yearMonth, `產生 ${yearMonth} 工資 - 共 ${count} 筆 (${generatedList.join('、')})`);
    
    renderSalary(document.getElementById('mainContent'));
    alert(`✅ 已產生 ${count} 筆薪資記錄（${yearMonth}）\n\n員工：${generatedList.join('、')}`);
}

// ============================================================
// 新增工資 - 含權限檢查
// ============================================================

function showAddSalary() {
    // ✅ 檢查新增工資權限
    if (!checkActionPermission('salary', 'add')) {
        showPermissionDenied('新增工資');
        return;
    }
    
    const employees = DB.get('employees', []);
    const yearMonth = document.getElementById('salaryMonth')?.value || new Date().toISOString().slice(0, 7);
    const salaryRecords = DB.get('salary_records', []);
    
    const existingIds = salaryRecords.filter(r => r.year_month === yearMonth).map(r => r.employee_id);
    const availableEmployees = employees.filter(e => e.status === '在職' && !existingIds.includes(e.id));
    
    if (availableEmployees.length === 0) {
        const allInactive = employees.every(e => e.status !== '在職');
        if (allInactive) {
            alert('沒有在職員工，請先新增員工或將員工狀態設為「在職」');
        } else {
            alert(`⚠️ ${yearMonth} 所有在職員工已有工資記錄\n\n如需要修改請使用「修改」功能，或重新「產生工資」`);
        }
        return;
    }
    
    const html = `
        <div class="modal-title">💰 新增工資</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 選擇員工新增 ${yearMonth} 的工資（每位員工每月只能有一筆）</span>
        </div>
        <div class="form-group"><label>選擇員工 *</label>
            <select id="salaryEmployee">
                ${availableEmployees.map(e => 
                    `<option value="${e.id}">${e.id}. ${e.name} (${e.position || '-'} / ${e.department || '-'})</option>`
                ).join('')}
                ${availableEmployees.length === 0 ? '<option value="">⚠️ 無可新增的員工</option>' : ''}
            </select>
        </div>
        <div class="form-group"><label>月份</label><input type="month" id="salaryMonthInput" value="${yearMonth}" readonly style="background:#f5f5f5;"></div>
        <div class="form-group"><label>底薪</label><input type="number" id="salaryBase" step="100" value="0"></div>
        <div class="form-group"><label>獎金</label><input type="number" id="salaryBonus" step="100" value="0"></div>
        <div class="form-group"><label>扣款</label><input type="number" id="salaryDeduction" step="100" value="0"></div>
        <div class="form-group"><label>備註</label><input type="text" id="salaryRemark" placeholder="請輸入備註"></div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 實發金額 = 底薪 + 獎金 - 扣款</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddSalary()">確認新增</button>
        </div>
    `;
    showModal(html);
}

function submitAddSalary() {
    const overlay = document.querySelector('.modal-overlay');
    const employeeId = parseInt(overlay.querySelector('#salaryEmployee').value);
    if (!employeeId) { alert('請選擇員工'); return; }
    
    const yearMonth = overlay.querySelector('#salaryMonthInput').value;
    const salaryRecords = DB.get('salary_records', []);
    
    const existing = salaryRecords.find(r => r.employee_id === employeeId && r.year_month === yearMonth);
    if (existing) {
        alert(`⚠️ 該員工 ${yearMonth} 已有工資記錄，無法重複新增`);
        overlay.remove();
        renderSalary(document.getElementById('mainContent'));
        return;
    }
    
    const baseSalary = parseFloat(overlay.querySelector('#salaryBase').value) || 0;
    const bonus = parseFloat(overlay.querySelector('#salaryBonus').value) || 0;
    const deduction = parseFloat(overlay.querySelector('#salaryDeduction').value) || 0;
    const netPay = baseSalary + bonus - deduction;
    const remark = overlay.querySelector('#salaryRemark').value.trim() || '';
    const adminName = getCurrentAdminName();
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    
    salaryRecords.push({
        id: DB.getNextId('salary_records'),
        employee_id: employeeId,
        employee_name: employee ? employee.name : '未知',
        year_month: yearMonth,
        base_salary: baseSalary,
        amount: baseSalary,
        bonus: bonus,
        deduction: deduction,
        net_pay: netPay,
        status: '待發放',
        account_id: null,
        account_name: null,
        remark: remark,
        admin_name: adminName,
        created_at: now()
    });
    DB.set('salary_records', salaryRecords);
    
    addOperationLog('員工工資', '新增', employee ? employee.name : '未知', 
        `新增工資 - ${employee ? employee.name : '未知'} (ID:${employeeId}) - ${yearMonth} - 實發 ${netPay} 泰銖`, employeeId);
    
    overlay.remove();
    renderSalary(document.getElementById('mainContent'));
    alert(`✅ 工資已新增\n\n員工：${employee ? employee.name : '未知'} (ID:${employeeId})\n月份：${yearMonth}\n實發金額：${netPay.toFixed(2)} 泰銖`);
}

// ============================================================
// 修改工資 - 含權限檢查
// ============================================================

function showEditSalary(id) {
    // ✅ 檢查修改工資權限
    if (!checkActionPermission('salary', 'edit')) {
        showPermissionDenied('修改工資');
        return;
    }
    
    const salaryRecords = DB.get('salary_records', []);
    const r = salaryRecords.find(s => s.id === id);
    if (!r) { alert('記錄不存在'); return; }
    
    if (r.status === '已發放') {
        alert('⚠️ 已發放的工資不能修改');
        return;
    }
    
    const employees = DB.get('employees', []);
    const emp = employees.find(e => e.id === r.employee_id);
    
    const html = `
        <div class="modal-title">✏️ 修改工資 - ${emp ? emp.name : '未知'} (ID:${r.employee_id})</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;font-size:13px;">
            <span style="color:#1565C0;">📌 月份：${r.year_month} | 員工：${emp ? emp.name : '未知'} (ID:${r.employee_id})</span>
        </div>
        <div class="form-group"><label>底薪</label><input type="number" id="editSalaryBase" step="100" value="${r.base_salary || r.amount || 0}"></div>
        <div class="form-group"><label>獎金</label><input type="number" id="editSalaryBonus" step="100" value="${r.bonus || 0}"></div>
        <div class="form-group"><label>扣款</label><input type="number" id="editSalaryDeduction" step="100" value="${r.deduction || 0}"></div>
        <div class="form-group"><label>備註</label><input type="text" id="editSalaryRemark" value="${r.remark || ''}"></div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 實發金額 = 底薪 + 獎金 - 扣款</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitEditSalary(${id})">確認修改</button>
        </div>
    `;
    showModal(html);
}

function submitEditSalary(id) {
    const overlay = document.querySelector('.modal-overlay');
    const salaryRecords = DB.get('salary_records', []);
    const r = salaryRecords.find(s => s.id === id);
    if (r) {
        const beforeData = { ...r };
        const baseSalary = parseFloat(overlay.querySelector('#editSalaryBase').value) || 0;
        const bonus = parseFloat(overlay.querySelector('#editSalaryBonus').value) || 0;
        const deduction = parseFloat(overlay.querySelector('#editSalaryDeduction').value) || 0;
        const remark = overlay.querySelector('#editSalaryRemark').value.trim() || '';
        
        r.base_salary = baseSalary;
        r.amount = baseSalary;
        r.bonus = bonus;
        r.deduction = deduction;
        r.net_pay = baseSalary + bonus - deduction;
        r.remark = remark;
        DB.set('salary_records', salaryRecords);
        
        addOperationLog('員工工資', '修改', r.employee_name || '未知', 
            `修改工資 - ${r.employee_name || '未知'} (ID:${r.employee_id}) - ${r.year_month} - 實發 ${r.net_pay} 泰銖`, r.employee_id, beforeData, r);
    }
    overlay.remove();
    renderSalary(document.getElementById('mainContent'));
    alert('✅ 工資已更新');
}

// ============================================================
// 發放工資（選擇出款帳戶）- 含權限檢查
// ============================================================

function showPaySalary(id) {
    // ✅ 檢查發放工資權限
    if (!checkActionPermission('salary', 'pay')) {
        showPermissionDenied('發放工資');
        return;
    }
    
    const salaryRecords = DB.get('salary_records', []);
    const r = salaryRecords.find(s => s.id === id);
    if (!r) { alert('記錄不存在'); return; }
    
    if (r.status === '已發放') {
        alert('⚠️ 此工資已發放');
        return;
    }
    
    const accounts = DB.get('accounts', []);
    if (accounts.length === 0) {
        alert('⚠️ 請先到「往來帳款」頁面新增帳戶');
        return;
    }
    
    const employees = DB.get('employees', []);
    const emp = employees.find(e => e.id === r.employee_id);
    const employeeName = emp ? emp.name : '未知';
    const payAmount = r.net_pay || r.amount || 0;
    
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
    
    const currencies = DB.get('currencies', []);
    const currencyOptions = currencies.map(c => 
        `<option value="${c.currency}">${c.currency} (${c.name || c.currency})</option>`
    ).join('');
    
    const html = `
        <div class="modal-title">💰 發放工資</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 選擇出款帳戶和幣種，從該帳戶扣除工資金額</span>
        </div>
        
        <div style="margin-bottom:15px;padding:12px;background:#f8f9fc;border-radius:8px;border:1px solid #eee;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;">
                <div><strong>員工：</strong>${employeeName}</div>
                <div><strong>月份：</strong>${r.year_month}</div>
                <div><strong>實發金額：</strong><span style="color:#2196F3;font-weight:bold;font-size:18px;">${payAmount.toFixed(2)} 泰銖</span></div>
                <div><strong>底薪：</strong>${(r.base_salary || r.amount || 0).toFixed(2)}</div>
                <div><strong>獎金：</strong><span style="color:#4CAF50;">${(r.bonus || 0).toFixed(2)}</span></div>
                <div><strong>扣款：</strong><span style="color:#ff6b6b;">${(r.deduction || 0).toFixed(2)}</span></div>
            </div>
            ${r.remark ? `<div style="grid-column:1/-1;margin-top:5px;"><strong>備註：</strong>${r.remark}</div>` : ''}
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>出款帳戶 *</label>
                <select id="payAccount" onchange="updatePayPreview()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                    ${accountOptions}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>出款幣種 *</label>
                <select id="payCurrency" onchange="updatePayPreview()" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                    ${currencyOptions}
                </select>
            </div>
        </div>
        
        <div id="payBalancePreview" style="margin-bottom:15px;padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;text-align:center;font-size:13px;display:none;">
            <span style="color:#e65100;">💡 出款後帳戶餘額：<strong id="payAfterBalance">0.00</strong> <span id="payAfterCurrency">THB</span></span>
            <span style="color:#e65100;margin-left:15px;">泰銖參考：<strong id="payTHBRef">0.00</strong></span>
        </div>
        
        <div id="payExchangeInfo" style="margin-bottom:15px;padding:10px;background:#e3f2fd;border-radius:6px;border:1px solid #90caf9;text-align:center;font-size:12px;display:none;">
            <span style="color:#1565C0;">💱 匯率：</span>
            <span id="payRateDisplay" style="color:#1565C0;font-weight:bold;">1 THB = 1 THB</span>
            <span style="color:#1565C0;margin-left:10px;">（使用賣出價，無條件舍去）</span>
        </div>
        
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 發放後工資狀態變更為「已發放」，並從所選帳戶扣款</span>
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitPaySalary(${id})">✅ 確認發放</button>
        </div>
    `;
    showModal(html);
    
    window.updatePayPreview = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        
        const accountSelect = overlayEl.querySelector('#payAccount');
        const currencySelect = overlayEl.querySelector('#payCurrency');
        const selectedOption = accountSelect.options[accountSelect.selectedIndex];
        const previewDiv = document.getElementById('payBalancePreview');
        const afterBalanceSpan = document.getElementById('payAfterBalance');
        const afterCurrencySpan = document.getElementById('payAfterCurrency');
        const thbRefSpan = document.getElementById('payTHBRef');
        const exchangeInfoDiv = document.getElementById('payExchangeInfo');
        const rateDisplaySpan = document.getElementById('payRateDisplay');
        
        const selectedCurrency = currencySelect.value;
        const currentBalance = parseFloat(selectedOption?.dataset?.balance || 0);
        const payAmount = r.net_pay || r.amount || 0;
        
        const sellRate = getSellRate(selectedCurrency);
        let deductAmount = 0;
        
        if (selectedCurrency === 'THB') {
            deductAmount = payAmount;
            rateDisplaySpan.textContent = `1 THB = 1 THB`;
        } else {
            deductAmount = convertFromTHB(payAmount, selectedCurrency);
            const thbToCurrency = 1 / sellRate;
            rateDisplaySpan.textContent = `1 THB = ${thbToCurrency.toFixed(4)} ${selectedCurrency} (賣出價 ${sellRate})`;
        }
        
        const afterBalance = currentBalance - deductAmount;
        
        previewDiv.style.display = 'block';
        afterBalanceSpan.textContent = afterBalance.toFixed(2);
        afterBalanceSpan.style.color = afterBalance >= 0 ? '#2e7d32' : '#c62828';
        afterCurrencySpan.textContent = selectedCurrency;
        thbRefSpan.textContent = payAmount.toFixed(2);
        
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
                <span style="color:#e65100;">💡 出款後帳戶餘額：<strong id="payAfterBalance" style="color:${afterBalance >= 0 ? '#2e7d32' : '#c62828'};">${afterBalance.toFixed(2)}</strong> <span id="payAfterCurrency">${selectedCurrency}</span></span>
                <span style="color:#e65100;margin-left:15px;">泰銖參考：<strong id="payTHBRef">${payAmount.toFixed(2)}</strong></span>
            `;
        }
    };
    
    document.getElementById('payAccount')?.addEventListener('change', updatePayPreview);
    document.getElementById('payCurrency')?.addEventListener('change', updatePayPreview);
    
    setTimeout(() => {
        if (window.updatePayPreview) window.updatePayPreview();
    }, 100);
}

function submitPaySalary(id) {
    const overlay = document.querySelector('.modal-overlay');
    const accountStr = overlay.querySelector('#payAccount').value;
    if (!accountStr) { alert('請選擇出款帳戶'); return; }
    
    const currency = overlay.querySelector('#payCurrency').value;
    if (!currency) { alert('請選擇出款幣種'); return; }
    
    const [accountIdStr] = accountStr.split('|');
    const accountId = parseInt(accountIdStr);
    if (!accountId) { alert('請選擇有效的出款帳戶'); return; }
    
    const salaryRecords = DB.get('salary_records', []);
    const r = salaryRecords.find(s => s.id === id);
    if (!r) { alert('記錄不存在'); return; }
    
    if (r.status === '已發放') {
        alert('⚠️ 此工資已發放');
        overlay.remove();
        renderSalary(document.getElementById('mainContent'));
        return;
    }
    
    const payAmount = r.net_pay || r.amount || 0;
    
    const sellRate = getSellRate(currency);
    let deductAmount = 0;
    let thbRef = payAmount;
    
    if (currency === 'THB') {
        deductAmount = payAmount;
    } else {
        deductAmount = convertFromTHB(payAmount, currency);
        if (deductAmount < 1) {
            alert(`⚠️ 換算後金額不足 1 ${currency}！\n泰銖：${payAmount} / 賣出價 ${sellRate} = ${(payAmount/sellRate).toFixed(4)} ${currency}\n請選擇其他幣種。`);
            return;
        }
    }
    
    const currentBalance = get_account_balance(accountId, currency);
    if (currentBalance < deductAmount) {
        if (!confirm(`⚠️ 帳戶 ${currency} 餘額不足！\n當前餘額：${currentBalance.toFixed(2)} ${currency}\n需要：${deductAmount.toFixed(2)} ${currency}\n是否仍要繼續？（餘額將變為負值）`)) {
            return;
        }
    }
    
    const account = getAccount(accountId);
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const beforeData = { ...r };
    
    r.status = '已發放';
    r.account_id = accountId;
    r.account_name = account ? account.name : '未知帳戶';
    r.currency = currency;
    r.deduct_amount = deductAmount;
    r.thb_reference = thbRef;
    r.sell_rate = sellRate;
    r.paid_at = now();
    r.paid_admin_name = adminName;
    r.paid_admin_id = adminId;
    
    DB.set('salary_records', salaryRecords);
    
    update_account_balance(accountId, currency, -deductAmount);
    
    add_account_transaction(
        accountId,
        currency,
        deductAmount,
        'out',
        'salary_payment',
        r.id,
        `工資發放 - ${r.employee_name || '未知'} - ${r.year_month} - ${deductAmount} ${currency} (泰銖參考：${thbRef.toFixed(2)}) - 賣出價 ${sellRate} - 操作人：${adminName}`
    );
    
    addOperationLog('員工工資', '發放', r.employee_name || '未知', 
        `發放工資 - ${r.employee_name || '未知'} (ID:${r.employee_id}) - ${r.year_month} - ${deductAmount} ${currency} (泰銖參考：${thbRef.toFixed(2)}) - 帳戶：${r.account_name} - 賣出價 ${sellRate}`, r.employee_id, beforeData, r);
    
    overlay.remove();
    renderSalary(document.getElementById('mainContent'));
    
    const newBalance = get_account_balance(accountId, currency);
    alert(`✅ 工資已發放！\n\n` +
        `員工：${r.employee_name || '未知'}\n` +
        `月份：${r.year_month}\n` +
        `實發金額：${thbRef.toFixed(2)} 泰銖\n` +
        `出款幣種：${currency}\n` +
        `出款金額：${deductAmount.toFixed(2)} ${currency}\n` +
        `賣出價：${sellRate}\n` +
        `出款帳戶：${r.account_name}\n` +
        `帳戶餘額：${newBalance.toFixed(2)} ${currency}\n` +
        `操作人：${adminName}`);
}

// ============================================================
// 刪除工資 - 含權限檢查
// ============================================================

function deleteSalary(id) {
    // ✅ 檢查刪除工資權限
    if (!checkActionPermission('salary', 'delete')) {
        showPermissionDenied('刪除工資');
        return;
    }
    
    const salaryRecords = DB.get('salary_records', []);
    const r = salaryRecords.find(s => s.id === id);
    if (!r) { alert('記錄不存在'); return; }
    
    if (r.status === '已發放' && r.account_id) {
        if (!confirm(`⚠️ 此工資已發放並從帳戶「${r.account_name}」扣款 ${r.deduct_amount || r.net_pay} ${r.currency || 'THB'} (泰銖參考：${r.thb_reference || r.net_pay})，刪除將退還金額。\n確定要刪除嗎？`)) {
            return;
        }
        const currency = r.currency || 'THB';
        const refundAmount = r.deduct_amount || r.net_pay || r.amount || 0;
        update_account_balance(r.account_id, currency, refundAmount);
        add_account_transaction(
            r.account_id,
            currency,
            refundAmount,
            'in',
            'salary_delete_refund',
            r.id,
            `刪除工資退款 - ${r.employee_name || '未知'} - ${refundAmount} ${currency} (泰銖參考：${r.thb_reference || r.net_pay}) - 操作人：${getCurrentAdminName()}`
        );
    }
    
    if (!confirm(`確定要刪除此筆工資記錄嗎？`)) return;
    
    addOperationLog('員工工資', '删除', r.employee_name || '未知', 
        `刪除工資 - ${r.employee_name || '未知'} (ID:${r.employee_id}) - ${r.year_month}`, r.employee_id);
    
    const newRecords = salaryRecords.filter(s => s.id !== id);
    DB.set('salary_records', newRecords);
    renderSalary(document.getElementById('mainContent'));
    alert('✅ 工資記錄已刪除');
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