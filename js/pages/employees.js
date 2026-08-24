// ============================================================
// 员工管理（完整版 - 支持部门/职位管理 + 操作日志 + 權限控制）
// ============================================================

// 初始化部門和職位資料
function initEmployeeData() {
    if (!localStorage.getItem('rpt_departments')) {
        DB.set('departments', ['管理部', '業務部', '財務部', '人事部', '資訊部']);
    }
    if (!localStorage.getItem('rpt_positions')) {
        DB.set('positions', ['經理', '副理', '主任', '員工', '助理']);
    }
    if (!localStorage.getItem('rpt_employees')) {
        DB.set('employees', [
            { id: 1, name: '張三', phone: '0912345678', position: '經理', department: '管理部', salary: 50000, hire_date: '2023-01-01', status: '在職', remark: '' },
            { id: 2, name: '李四', phone: '0923456789', position: '員工', department: '業務部', salary: 35000, hire_date: '2023-06-01', status: '在職', remark: '' }
        ]);
        DB.set('employees_next', 3);
    }
}

// ============================================================
// 渲染員工列表 - 含權限檢查
// ============================================================

function renderEmployees(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('employees', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>👥 員工管理</h1>
                <p class="breadcrumb">營運管理 > 員工管理</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「員工管理」的权限</p>
            </div>
        `;
        return;
    }
    
    initEmployeeData();
    
    const employees = DB.get('employees', []);
    const departments = DB.get('departments', []);
    const positions = DB.get('positions', []);
    
    // 获取搜索关键词
    const searchKeyword = document.getElementById('employeeSearch')?.value?.trim() || '';
    const statusFilter = document.getElementById('employeeStatusFilter')?.value || '';
    const deptFilter = document.getElementById('employeeDeptFilter')?.value || '';
    
    // 过滤员工
    let filteredEmployees = employees;
    if (searchKeyword) {
        filteredEmployees = filteredEmployees.filter(e => 
            e.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            e.id.toString().includes(searchKeyword)
        );
    }
    if (statusFilter) {
        filteredEmployees = filteredEmployees.filter(e => e.status === statusFilter);
    }
    if (deptFilter) {
        filteredEmployees = filteredEmployees.filter(e => e.department === deptFilter);
    }
    
    // 统计
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === '在職').length;
    const inactiveEmployees = employees.filter(e => e.status === '離職').length;
    
    // ✅ 檢查各操作權限
    const canAdd = checkActionPermission('employees', 'add');
    const canEdit = checkActionPermission('employees', 'edit');
    const canDelete = checkActionPermission('employees', 'delete');
    const canManageDept = checkActionPermission('employees', 'manage_department');
    const canManagePosition = checkActionPermission('employees', 'manage_position');
    const canViewAttendance = checkActionPermission('employees', 'view');
    
    // 部门下拉选项
    const deptOptions = departments.map(d => 
        `<option value="${d}" ${d === deptFilter ? 'selected' : ''}>${d}</option>`
    ).join('');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>👥 員工管理</h1>
            <p class="breadcrumb">營運管理 > 員工管理</p>
        </div>
        
        <!-- 统计卡片 -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
            <div class="stat-card" style="border-left:4px solid #2196F3;">
                <div class="stat-label">👤 總員工</div>
                <div class="stat-value" style="color:#2196F3;">${totalEmployees}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #4CAF50;">
                <div class="stat-label">✅ 在職</div>
                <div class="stat-value" style="color:#4CAF50;">${activeEmployees}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ff6b6b;">
                <div class="stat-label">❌ 離職</div>
                <div class="stat-value" style="color:#ff6b6b;">${inactiveEmployees}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ffa726;">
                <div class="stat-label">🏢 部門數</div>
                <div class="stat-value" style="color:#ffa726;">${departments.length}</div>
            </div>
        </div>
        
        <div class="toolbar">
            <div class="search-box">
                <input type="text" id="employeeSearch" placeholder="姓名或ID..." value="${searchKeyword}" onkeydown="if(event.key==='Enter') renderEmployees(document.getElementById('mainContent'))" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:150px;">
                <select id="employeeStatusFilter" onchange="renderEmployees(document.getElementById('mainContent'))" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部狀態</option>
                    <option value="在職" ${statusFilter === '在職' ? 'selected' : ''}>在職</option>
                    <option value="離職" ${statusFilter === '離職' ? 'selected' : ''}>離職</option>
                </select>
                <select id="employeeDeptFilter" onchange="renderEmployees(document.getElementById('mainContent'))" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                    <option value="">全部部門</option>
                    ${deptOptions}
                </select>
                <button class="btn btn-primary" onclick="renderEmployees(document.getElementById('mainContent'))">🔍 搜索</button>
                ${(searchKeyword || statusFilter || deptFilter) ? `<button class="btn" onclick="document.getElementById('employeeSearch').value='';document.getElementById('employeeStatusFilter').value='';document.getElementById('employeeDeptFilter').value='';renderEmployees(document.getElementById('mainContent'))">✕ 清除</button>` : ''}
                <span style="font-size:13px;color:#999;margin-left:5px;">共 ${filteredEmployees.length} 位員工</span>
            </div>
            ${canAdd ? `<button class="btn btn-primary" onclick="showAddEmployee()">➕ 新增員工</button>` : ''}
            ${canManageDept ? `<button class="btn btn-warning" onclick="showDepartmentManager()">🏢 部門管理</button>` : ''}
            ${canManagePosition ? `<button class="btn btn-info" onclick="showPositionManager()">💼 職位管理</button>` : ''}
            <button class="btn" onclick="renderEmployees(document.getElementById('mainContent'))">🔄 刷新</button>
        </div>
        
        <div class="table-container">
            <table>
                <thead><tr>
                    <th style="text-align:center;">ID</th>
                    <th style="text-align:center;">姓名</th>
                    <th style="text-align:center;">手機</th>
                    <th style="text-align:center;">職位</th>
                    <th style="text-align:center;">部門</th>
                    <th style="text-align:center;">薪資</th>
                    <th style="text-align:center;">到職日</th>
                    <th style="text-align:center;">狀態</th>
                    <th style="text-align:center;">操作</th>
                </tr></thead>
                <tbody>
                    ${filteredEmployees.length === 0 ? '<tr class="empty-row"><td colspan="9">暫無員工</td></tr>' :
                    filteredEmployees.map(e => {
                        // 構建操作按鈕（根據權限顯示）
                        let actionButtons = '';
                        if (canEdit) {
                            actionButtons += `<button class="btn btn-primary btn-sm" onclick="showEditEmployee(${e.id})">修改</button>`;
                        }
                        if (canDelete) {
                            actionButtons += `<button class="btn btn-danger btn-sm" onclick="deleteEmployee(${e.id})">刪除</button>`;
                        }
                        if (canViewAttendance) {
                            actionButtons += `<button class="btn btn-info btn-sm" onclick="showEmployeeAttendanceHistory(${e.id})">📋 出勤</button>`;
                        }
                        
                        return `<tr>
                            <td style="text-align:center;"><strong>${e.id}</strong></td>
                            <td style="text-align:center;"><strong>${e.name}</strong></td>
                            <td style="text-align:center;">${e.phone || '-'}</td>
                            <td style="text-align:center;">${e.position || '-'}</td>
                            <td style="text-align:center;">${e.department || '-'}</td>
                            <td style="text-align:center;color:#2196F3;font-weight:bold;">${(e.salary || 0).toFixed(2)}</td>
                            <td style="text-align:center;">${e.hire_date || '-'}</td>
                            <td style="text-align:center;"><span class="badge ${e.status === '在職' ? 'badge-success' : 'badge-danger'}">${e.status || '在職'}</span></td>
                            <td style="text-align:center;">
                                <div class="btn-group" style="justify-content:center;">
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
// 部門管理 - 含權限檢查
// ============================================================

function showDepartmentManager() {
    // ✅ 檢查部門管理權限
    if (!checkActionPermission('employees', 'manage_department')) {
        showPermissionDenied('部門管理');
        return;
    }
    
    const departments = DB.get('departments', []);
    
    let listHtml = departments.map((d, index) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0;">
            <span><strong>${index + 1}.</strong> ${d}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteDepartment('${d}')">刪除</button>
        </div>
    `).join('');
    
    if (departments.length === 0) {
        listHtml = '<div style="padding:20px;text-align:center;color:#999;">暫無部門</div>';
    }
    
    const html = `
        <div class="modal-title">🏢 部門管理</div>
        
        <div style="display:flex;gap:10px;margin-bottom:15px;">
            <input type="text" id="newDepartmentInput" placeholder="請輸入部門名稱" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') submitAddDepartment()">
            <button class="btn btn-primary" onclick="submitAddDepartment()">➕ 新增</button>
        </div>
        
        <div style="max-height:300px;overflow-y:auto;border:1px solid #eee;border-radius:6px;">
            ${listHtml}
        </div>
        
        <div style="margin-top:10px;font-size:12px;color:#999;text-align:center;">
            💡 修改部門名稱請先刪除後重新新增
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
        </div>
    `;
    showModal(html);
}

function submitAddDepartment() {
    const overlay = document.querySelector('.modal-overlay');
    const input = overlay.querySelector('#newDepartmentInput');
    const name = input.value.trim();
    
    if (!name) { alert('請輸入部門名稱'); return; }
    
    const departments = DB.get('departments', []);
    if (departments.includes(name)) {
        alert('該部門已存在');
        return;
    }
    
    departments.push(name);
    DB.set('departments', departments);
    input.value = '';
    
    addOperationLog('員工管理', '新增', name, `新增部門：${name}`);
    
    showDepartmentManager();
    renderEmployees(document.getElementById('mainContent'));
    alert(`✅ 已新增部門：${name}`);
}

function deleteDepartment(name) {
    if (!confirm(`確定要刪除部門「${name}」嗎？\n（員工的部門資訊不會被刪除）`)) return;
    
    const departments = DB.get('departments', []).filter(d => d !== name);
    DB.set('departments', departments);
    
    addOperationLog('員工管理', '删除', name, `刪除部門：${name}`);
    
    showDepartmentManager();
    renderEmployees(document.getElementById('mainContent'));
    alert(`✅ 已刪除部門：${name}`);
}

// ============================================================
// 職位管理 - 含權限檢查
// ============================================================

function showPositionManager() {
    // ✅ 檢查職位管理權限
    if (!checkActionPermission('employees', 'manage_position')) {
        showPermissionDenied('職位管理');
        return;
    }
    
    const positions = DB.get('positions', []);
    
    let listHtml = positions.map((p, index) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0;">
            <span><strong>${index + 1}.</strong> ${p}</span>
            <button class="btn btn-danger btn-sm" onclick="deletePosition('${p}')">刪除</button>
        </div>
    `).join('');
    
    if (positions.length === 0) {
        listHtml = '<div style="padding:20px;text-align:center;color:#999;">暫無職位</div>';
    }
    
    const html = `
        <div class="modal-title">💼 職位管理</div>
        
        <div style="display:flex;gap:10px;margin-bottom:15px;">
            <input type="text" id="newPositionInput" placeholder="請輸入職位名稱" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') submitAddPosition()">
            <button class="btn btn-primary" onclick="submitAddPosition()">➕ 新增</button>
        </div>
        
        <div style="max-height:300px;overflow-y:auto;border:1px solid #eee;border-radius:6px;">
            ${listHtml}
        </div>
        
        <div style="margin-top:10px;font-size:12px;color:#999;text-align:center;">
            💡 修改職位名稱請先刪除後重新新增
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
        </div>
    `;
    showModal(html);
}

function submitAddPosition() {
    const overlay = document.querySelector('.modal-overlay');
    const input = overlay.querySelector('#newPositionInput');
    const name = input.value.trim();
    
    if (!name) { alert('請輸入職位名稱'); return; }
    
    const positions = DB.get('positions', []);
    if (positions.includes(name)) {
        alert('該職位已存在');
        return;
    }
    
    positions.push(name);
    DB.set('positions', positions);
    input.value = '';
    
    addOperationLog('員工管理', '新增', name, `新增職位：${name}`);
    
    showPositionManager();
    renderEmployees(document.getElementById('mainContent'));
    alert(`✅ 已新增職位：${name}`);
}

function deletePosition(name) {
    if (!confirm(`確定要刪除職位「${name}」嗎？\n（員工的職位資訊不會被刪除）`)) return;
    
    const positions = DB.get('positions', []).filter(p => p !== name);
    DB.set('positions', positions);
    
    addOperationLog('員工管理', '删除', name, `刪除職位：${name}`);
    
    showPositionManager();
    renderEmployees(document.getElementById('mainContent'));
    alert(`✅ 已刪除職位：${name}`);
}

// ============================================================
// 新增員工 - 含權限檢查
// ============================================================

function showAddEmployee() {
    // ✅ 檢查新增員工權限
    if (!checkActionPermission('employees', 'add')) {
        showPermissionDenied('新增員工');
        return;
    }
    
    const departments = DB.get('departments', []);
    const positions = DB.get('positions', []);
    
    const deptOptions = departments.map(d => `<option value="${d}">${d}</option>`).join('');
    const posOptions = positions.map(p => `<option value="${p}">${p}</option>`).join('');
    
    const html = `
        <div class="modal-title">👤 新增員工</div>
        <div class="form-group"><label>姓名 *</label><input type="text" id="empName" placeholder="請輸入姓名"></div>
        <div class="form-group"><label>手機</label><input type="text" id="empPhone" placeholder="請輸入手機"></div>
        <div class="form-group"><label>職位</label>
            <select id="empPosition">
                <option value="">請選擇</option>
                ${posOptions}
                ${positions.length === 0 ? '<option value="">⚠️ 請先到職位管理新增</option>' : ''}
            </select>
        </div>
        <div class="form-group"><label>部門</label>
            <select id="empDepartment">
                <option value="">請選擇</option>
                ${deptOptions}
                ${departments.length === 0 ? '<option value="">⚠️ 請先到部門管理新增</option>' : ''}
            </select>
        </div>
        <div class="form-group"><label>薪資</label><input type="number" id="empSalary" step="100" placeholder="請輸入薪資"></div>
        <div class="form-group"><label>到職日</label><input type="date" id="empHireDate"></div>
        <div class="form-group"><label>狀態</label>
            <select id="empStatus">
                <option value="在職">在職</option>
                <option value="離職">離職</option>
            </select>
        </div>
        <div class="form-group"><label>備註</label><input type="text" id="empRemark" placeholder="請輸入備註"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddEmployee()">確認新增</button>
        </div>
    `;
    showModal(html);
}

function submitAddEmployee() {
    const overlay = document.querySelector('.modal-overlay');
    const name = overlay.querySelector('#empName').value.trim();
    if (!name) { alert('請輸入姓名'); return; }
    
    const employees = DB.get('employees', []);
    const newEmployee = {
        id: DB.getNextId('employees'),
        name: name,
        phone: overlay.querySelector('#empPhone').value.trim(),
        position: overlay.querySelector('#empPosition').value,
        department: overlay.querySelector('#empDepartment').value,
        salary: parseFloat(overlay.querySelector('#empSalary').value) || 0,
        hire_date: overlay.querySelector('#empHireDate').value,
        status: overlay.querySelector('#empStatus').value,
        remark: overlay.querySelector('#empRemark').value.trim(),
        created_at: now()
    };
    employees.push(newEmployee);
    DB.set('employees', employees);
    
    addOperationLog('員工管理', '新增', name, 
        `新增員工：${name} (${newEmployee.position || '無職位'}, ${newEmployee.department || '無部門'})`, newEmployee.id);
    
    overlay.remove();
    renderEmployees(document.getElementById('mainContent'));
    alert('✅ 員工已新增');
}

// ============================================================
// 修改員工 - 含權限檢查
// ============================================================

function showEditEmployee(id) {
    // ✅ 檢查修改員工權限
    if (!checkActionPermission('employees', 'edit')) {
        showPermissionDenied('修改員工');
        return;
    }
    
    const employees = DB.get('employees', []);
    const emp = employees.find(e => e.id === id);
    if (!emp) { alert('員工不存在'); return; }
    
    const departments = DB.get('departments', []);
    const positions = DB.get('positions', []);
    
    const deptOptions = departments.map(d => 
        `<option value="${d}" ${d === emp.department ? 'selected' : ''}>${d}</option>`
    ).join('');
    
    const posOptions = positions.map(p => 
        `<option value="${p}" ${p === emp.position ? 'selected' : ''}>${p}</option>`
    ).join('');
    
    const html = `
        <div class="modal-title">✏️ 修改員工 - ${emp.name}</div>
        <div class="form-group"><label>姓名 *</label><input type="text" id="editEmpName" value="${emp.name}"></div>
        <div class="form-group"><label>手機</label><input type="text" id="editEmpPhone" value="${emp.phone || ''}"></div>
        <div class="form-group"><label>職位</label>
            <select id="editEmpPosition">
                <option value="">請選擇</option>
                ${posOptions}
                ${positions.length === 0 ? '<option value="">⚠️ 請先到職位管理新增</option>' : ''}
            </select>
        </div>
        <div class="form-group"><label>部門</label>
            <select id="editEmpDepartment">
                <option value="">請選擇</option>
                ${deptOptions}
                ${departments.length === 0 ? '<option value="">⚠️ 請先到部門管理新增</option>' : ''}
            </select>
        </div>
        <div class="form-group"><label>薪資</label><input type="number" id="editEmpSalary" step="100" value="${emp.salary || 0}"></div>
        <div class="form-group"><label>到職日</label><input type="date" id="editEmpHireDate" value="${emp.hire_date || ''}"></div>
        <div class="form-group"><label>狀態</label>
            <select id="editEmpStatus">
                <option value="在職" ${emp.status === '在職' ? 'selected' : ''}>在職</option>
                <option value="離職" ${emp.status === '離職' ? 'selected' : ''}>離職</option>
            </select>
        </div>
        <div class="form-group"><label>備註</label><input type="text" id="editEmpRemark" value="${emp.remark || ''}"></div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitEditEmployee(${id})">確認修改</button>
        </div>
    `;
    showModal(html);
}

function submitEditEmployee(id) {
    const overlay = document.querySelector('.modal-overlay');
    const name = overlay.querySelector('#editEmpName').value.trim();
    if (!name) { alert('請輸入姓名'); return; }
    
    const employees = DB.get('employees', []);
    const emp = employees.find(e => e.id === id);
    if (emp) {
        const beforeData = { ...emp };
        let changes = [];
        
        if (name !== emp.name) changes.push('姓名');
        const phone = overlay.querySelector('#editEmpPhone').value.trim();
        if (phone !== emp.phone) changes.push('手機');
        const position = overlay.querySelector('#editEmpPosition').value;
        if (position !== emp.position) changes.push('職位');
        const department = overlay.querySelector('#editEmpDepartment').value;
        if (department !== emp.department) changes.push('部門');
        const salary = parseFloat(overlay.querySelector('#editEmpSalary').value) || 0;
        if (salary !== emp.salary) changes.push('薪資');
        const hireDate = overlay.querySelector('#editEmpHireDate').value;
        if (hireDate !== emp.hire_date) changes.push('到職日');
        const status = overlay.querySelector('#editEmpStatus').value;
        if (status !== emp.status) changes.push('狀態');
        const remark = overlay.querySelector('#editEmpRemark').value.trim();
        if (remark !== emp.remark) changes.push('備註');
        
        emp.name = name;
        emp.phone = phone;
        emp.position = position;
        emp.department = department;
        emp.salary = salary;
        emp.hire_date = hireDate;
        emp.status = status;
        emp.remark = remark;
        DB.set('employees', employees);
        
        if (changes.length > 0) {
            addOperationLog('員工管理', '修改', emp.name, 
                `修改員工：${emp.name} (ID: ${id}) - 修改字段：${changes.join('、')}`, id, beforeData, emp);
        }
    }
    overlay.remove();
    renderEmployees(document.getElementById('mainContent'));
    alert('✅ 員工已更新');
}

// ============================================================
// 刪除員工 - 含權限檢查
// ============================================================

function deleteEmployee(id) {
    // ✅ 檢查刪除員工權限
    if (!checkActionPermission('employees', 'delete')) {
        showPermissionDenied('刪除員工');
        return;
    }
    
    const employees = DB.get('employees', []);
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    if (!confirm(`確定要刪除員工「${emp.name}」嗎？`)) return;
    
    const newEmployees = employees.filter(e => e.id !== id);
    DB.set('employees', newEmployees);
    
    addOperationLog('員工管理', '删除', emp.name, `刪除員工：${emp.name} (ID: ${id})`, id, emp, null);
    
    renderEmployees(document.getElementById('mainContent'));
    alert('✅ 員工已刪除');
}

// ============================================================
// 员工出勤历史（从出勤模块引用）- 含權限檢查
// ============================================================

function showEmployeeAttendanceHistory(employeeId) {
    // ✅ 檢查查看出勤權限（使用 view 權限）
    if (!checkActionPermission('employees', 'view')) {
        showPermissionDenied('查看員工出勤');
        return;
    }
    
    // 检查 attendance 模块是否已加载
    if (typeof getAttendanceRecords === 'function') {
        // 调用 attendance 模块的函数
        if (typeof window.showEmployeeAttendanceHistory === 'function' && 
            window.showEmployeeAttendanceHistory !== showEmployeeAttendanceHistory) {
            // 使用 attendance 模块的函数
            window.showEmployeeAttendanceHistory(employeeId);
        } else {
            // 简单显示
            const employee = DB.get('employees', []).find(e => e.id === employeeId);
            if (!employee) { alert('员工不存在'); return; }
            
            const records = getAttendanceRecords(employeeId);
            if (records.length === 0) {
                alert(`员工「${employee.name}」暂无出勤记录`);
                return;
            }
            // 显示简略信息
            let msg = `📋 ${employee.name} 出勤记录\n\n`;
            records.slice(0, 10).forEach(r => {
                msg += `${r.date} ${r.status} ${r.check_in_time || ''} ${r.check_out_time || ''}\n`;
            });
            if (records.length > 10) msg += `\n... 共 ${records.length} 笔记录`;
            alert(msg);
        }
    } else {
        // attendance 模块未加载
        const employee = DB.get('employees', []).find(e => e.id === employeeId);
        alert(`员工「${employee ? employee.name : '未知'}」的出勤记录功能请先加载「员工出勤」模块`);
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