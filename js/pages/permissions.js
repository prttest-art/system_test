// ============================================================
// permissions.js - 完整版（权限管理 + 权限检查函数 + 權限控制）
// ============================================================

// 頁面模組定義
const MODULES = {
    dashboard: { name: '會員中心', icon: '🏠', pages: ['dashboard'] },
    members: { name: '來客管理', icon: '📋', pages: ['members'] },
    agents: { name: '介紹人', icon: '👤', pages: ['agents'] },
    agent_stay: { name: '代理住宿', icon: '🏨', pages: ['agent_stay'] },
    transactions: { name: '每日台帳', icon: '📊', pages: ['transactions'] },
    flow: { name: '充值/退費/借款流水', icon: '💳', pages: ['flow'] },
    accounts: { name: '往來賬款', icon: '📒', pages: ['accounts'] },
    tables: { name: '台桌看板', icon: '🎯', pages: ['tables'] },
    currency: { name: '幣種匯率', icon: '💱', pages: ['currency'] },
    exchange: { name: '兌匯紀錄', icon: '💱', pages: ['exchange'] },
    employees: { name: '員工管理', icon: '👥', pages: ['employees'] },
    attendance: { name: '員工出勤', icon: '👥', pages: ['attendance'] },
    salary: { name: '員工工資', icon: '💰', pages: ['salary'] },
    expenses: { name: '費用報銷', icon: '🧾', pages: ['expenses'] },
    permissions: { name: '權限管理', icon: '⚙️', pages: ['permissions'] },
    backup: { name: '資料備份', icon: '💾', pages: ['backup'] },
    operation_log: { name: '操作紀錄', icon: '📋', pages: ['operation_log'] }
};

// 各頁面按鈕權限定義
const PAGE_ACTIONS = {
    members: {
        view: '瀏覽會員',
        add: '新增會員',
        edit: '修改會員',
        delete: '刪除會員',
        recharge: '充值',
        withdraw: '出金',
        exchange: '換幣',
        view_account: '查看帳戶'
    },
    agents: {
        view: '瀏覽介紹人',
        add: '新增介紹人',
        edit: '修改介紹人',
        delete: '刪除介紹人',
        view_stats: '查看統計'
    },
    agent_stay: {
        view: '瀏覽代理住宿',
        add_expense: '新增住宿費用',
        add_payment: '住宿還款',
        delete: '刪除記錄',
        view_unpaid: '查看未付款'
    },
    transactions: {
        view: '瀏覽每日台帳',
        view_detail: '查看明細'
    },
    flow: {
        view: '瀏覽流水'
    },
    accounts: {
        view: '瀏覽往來賬款',
        add_account: '新增帳戶',
        delete_account: '刪除帳戶',
        add_currency: '新增幣種',
        remove_currency: '移除幣種',
        deposit: '入金',
        withdraw: '出金'
    },
    tables: {
        view: '瀏覽台桌看板',
        open_table: '開桌',
        settle_table: '整桌結算',
        add_player: '新增玩家',
        add_water: '抽水',
        add_insurance: '保險',
        add_tips: '小費',
        tips_withdraw: '小費出金',
        rebate_payment: '退水付款',
        up: '上分',
        down: '下分',
        recharge: '充值',
        table_withdraw: '出金',
        table_exchange: '換幣',
        view_history: '歷史紀錄',
        view_detail: '查看明細'
    },
    currency: {
        view: '瀏覽幣種匯率',
        update: '更新匯率',
        add: '新增幣種',
        delete: '刪除幣種'
    },
    exchange: {
        view: '瀏覽兌匯紀錄'
    },
    employees: {
        view: '瀏覽員工',
        add: '新增員工',
        edit: '修改員工',
        delete: '刪除員工',
        manage_department: '部門管理',
        manage_position: '職位管理'
    },
    attendance: {
        view: '瀏覽出勤',
        check_in: '到班',
        check_out: '簽退',
        set_status: '設定狀態',
        clear_status: '清除狀態',
        view_history: '查看歷史',
        view_monthly: '月統計',
        settings: '出勤設定'
    },
    salary: {
        view: '瀏覽工資',
        generate: '產生工資',
        add: '新增工資',
        edit: '修改工資',
        pay: '發放工資',
        delete: '刪除工資',
        view_detail: '查看明細'
    },
    expenses: {
        view: '瀏覽報銷',
        add: '新增報銷',
        edit: '修改報銷',
        delete: '刪除報銷',
        approve: '核准報銷',
        pay: '付款',
        view_detail: '查看明細',
        view_summary: '查看匯總'
    },
    permissions: {
        view: '瀏覽權限管理',
        manage_admins: '管理管理員',
        manage_levels: '管理等級',
        system_maintenance: '系統維護'
    },
    backup: {
        view: '瀏覽備份',
        backup: '創建備份',
        upload: '上傳備份',
        restore: '還原備份',
        delete: '刪除備份'
    },
    operation_log: {
        view: '瀏覽操作紀錄',
        view_detail: '查看詳情'
    }
};

// ============================================================
// 預設權限設定
// ============================================================

function getDefaultPermissions() {
    const permissions = {};
    
    Object.keys(MODULES).forEach(moduleKey => {
        const page = MODULES[moduleKey].pages[0];
        permissions[page] = {
            view: true,
            actions: {}
        };
        
        const actions = PAGE_ACTIONS[page] || {};
        Object.keys(actions).forEach(actionKey => {
            permissions[page].actions[actionKey] = true;
        });
    });
    
    return permissions;
}

// ============================================================
// 權限檢查函數
// ============================================================

function hasPagePermission(page) {
    const admin = getCurrentAdmin();
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    
    const perms = admin.permissions || {};
    if (!perms[page]) return false;
    return perms[page].view === true;
}

function hasActionPermission(page, action) {
    const admin = getCurrentAdmin();
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    
    const perms = admin.permissions || {};
    if (!perms[page]) return false;
    if (perms[page].view !== true) return false;
    
    const actions = perms[page].actions || {};
    return actions[action] === true;
}

function hasAnyActionPermission(page) {
    const admin = getCurrentAdmin();
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    
    const perms = admin.permissions || {};
    if (!perms[page]) return false;
    if (perms[page].view !== true) return false;
    
    const actions = perms[page].actions || {};
    return Object.values(actions).some(v => v === true);
}

function getVisiblePages() {
    const admin = getCurrentAdmin();
    if (!admin) return [];
    if (admin.role === 'super_admin') {
        return Object.keys(MODULES).map(k => MODULES[k].pages[0]);
    }
    
    const perms = admin.permissions || {};
    const visiblePages = [];
    Object.keys(perms).forEach(page => {
        if (perms[page] && perms[page].view === true) {
            visiblePages.push(page);
        }
    });
    return visiblePages;
}

function getVisibleMenuItems() {
    const admin = getCurrentAdmin();
    if (!admin) return [];
    if (admin.role === 'super_admin') {
        return [
            { id: 'dashboard', name: '会员中心', icon: '🏠' },
            { id: 'members', name: '来客管理', icon: '📋' },
            { id: 'agents', name: '介绍人', icon: '👤' },
            { id: 'agent_stay', name: '代理住宿', icon: '🏨' },
            { id: 'transactions', name: '每日台帐', icon: '📊' },
            { id: 'flow', name: '充值/退费/借款流水', icon: '💳' },
            { id: 'accounts', name: '往来账款', icon: '📒' },
            { id: 'tables', name: '台桌看板', icon: '🎯' },
            { id: 'currency', name: '币种汇率', icon: '💱' },
            { id: 'exchange', name: '兑汇纪录', icon: '💱' },
            { id: 'employees', name: '员工管理', icon: '👥' },
            { id: 'attendance', name: '员工出勤', icon: '👥' },
            { id: 'salary', name: '员工工资', icon: '💰' },
            { id: 'expenses', name: '费用报销', icon: '🧾' },
            { id: 'permissions', name: '权限管理', icon: '⚙️' },
            { id: 'backup', name: '资料备份', icon: '💾' },
            { id: 'operation_log', name: '操作纪录', icon: '📋' }
        ];
    }
    
    const perms = admin.permissions || {};
    const nameMap = {
        dashboard: '会员中心',
        members: '来客管理',
        agents: '介绍人',
        agent_stay: '代理住宿',
        transactions: '每日台帐',
        flow: '充值/退费/借款流水',
        accounts: '往来账款',
        tables: '台桌看板',
        currency: '币种汇率',
        exchange: '兑汇纪录',
        employees: '员工管理',
        attendance: '员工出勤',
        salary: '员工工资',
        expenses: '费用报销',
        permissions: '权限管理',
        backup: '资料备份',
        operation_log: '操作纪录'
    };
    const iconMap = {
        dashboard: '🏠',
        members: '📋',
        agents: '👤',
        agent_stay: '🏨',
        transactions: '📊',
        flow: '💳',
        accounts: '📒',
        tables: '🎯',
        currency: '💱',
        exchange: '💱',
        employees: '👥',
        attendance: '👥',
        salary: '💰',
        expenses: '🧾',
        permissions: '⚙️',
        backup: '💾',
        operation_log: '📋'
    };
    
    const visiblePages = [];
    Object.keys(perms).forEach(page => {
        if (perms[page] && perms[page].view === true) {
            visiblePages.push({
                id: page,
                name: nameMap[page] || page,
                icon: iconMap[page] || '📄'
            });
        }
    });
    return visiblePages;
}

// ============================================================
// 顯示新增管理員對話框 - 含權限檢查
// ============================================================

function showAddAdmin() {
    // ✅ 檢查管理管理員權限
    if (!checkActionPermission('permissions', 'manage_admins')) {
        showPermissionDenied('新增管理員');
        return;
    }
    
    const currentAdmin = getCurrentAdmin();
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
    
    if (!isSuperAdmin) {
        alert('只有總管理員可以新增管理員');
        return;
    }
    
    const html = `
        <div class="modal-title">👤 新增管理員</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 新增管理員後可設定專屬權限</span>
        </div>
        <div class="form-group">
            <label>登錄帳號 *</label>
            <input type="text" id="newAdminUsername" placeholder="請輸入登錄帳號（至少3個字符）" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        <div class="form-group">
            <label>密碼 *</label>
            <input type="password" id="newAdminPassword" placeholder="請輸入密碼（至少4個字符）" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        <div class="form-group">
            <label>確認密碼 *</label>
            <input type="password" id="newAdminPassword2" placeholder="請再次輸入密碼" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        <div class="form-group">
            <label>顯示名稱</label>
            <input type="text" id="newAdminDisplayName" placeholder="請輸入顯示名稱（留空使用帳號）" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        <div class="form-group">
            <label>角色</label>
            <select id="newAdminRole" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                <option value="admin">管理員</option>
                <option value="super_admin">總管理員</option>
            </select>
        </div>
        <div class="form-group" style="border-top:1px solid #eee;padding-top:10px;margin-top:10px;">
            <label style="font-weight:bold;">權限設定</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px;max-height:200px;overflow-y:auto;padding:5px;border:1px solid #eee;border-radius:6px;">
                ${Object.keys(MODULES).map(moduleKey => {
                    const page = MODULES[moduleKey].pages[0];
                    return `<label style="font-size:13px;padding:2px 4px;"><input type="checkbox" class="new-perm-view" data-page="${page}" checked> ${MODULES[moduleKey].icon} ${MODULES[moduleKey].name}</label>`;
                }).join('')}
            </div>
            <div style="font-size:11px;color:#999;margin-top:4px;">💡 勾選表示該頁面可瀏覽，操作權限預設全部開啟</div>
        </div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;border:1px solid #ffcc80;margin-bottom:10px;font-size:12px;color:#e65100;">
            ⚠️ 新增管理員後，請使用新帳號密碼登錄測試
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddAdmin()">✅ 確認新增</button>
        </div>
    `;
    showModal(html);
}

function submitAddAdmin() {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) {
        alert('系統錯誤，請重新操作');
        return;
    }
    
    const username = overlay.querySelector('#newAdminUsername').value.trim();
    const password = overlay.querySelector('#newAdminPassword').value;
    const password2 = overlay.querySelector('#newAdminPassword2').value;
    const displayName = overlay.querySelector('#newAdminDisplayName').value.trim();
    const role = overlay.querySelector('#newAdminRole').value;
    
    if (!username) { alert('請輸入登錄帳號'); return; }
    if (username.length < 3) { alert('帳號長度至少3個字符'); return; }
    if (!password) { alert('請輸入密碼'); return; }
    if (password.length < 4) { alert('密碼長度至少4個字符'); return; }
    if (password !== password2) { alert('兩次輸入的密碼不一致'); return; }
    if (password.includes('"') || password.includes("'") || password.includes('\\')) {
        alert('密碼不能包含引號或反斜杠等特殊字符');
        return;
    }
    
    if (getAdminByUsername(username)) {
        alert('該帳號已存在，請使用其他帳號');
        return;
    }
    
    const permissions = {};
    document.querySelectorAll('.new-perm-view').forEach(el => {
        const page = el.dataset.page;
        permissions[page] = {
            view: el.checked,
            actions: {}
        };
        
        if (el.checked) {
            const actions = PAGE_ACTIONS[page] || {};
            Object.keys(actions).forEach(actionKey => {
                permissions[page].actions[actionKey] = true;
            });
        }
    });
    
    const success = addAdmin(username, password, displayName || username, role, permissions);
    
    if (success) {
        overlay.remove();
        renderPermissions(document.getElementById('mainContent'));
        
        alert(`✅ 管理員「${displayName || username}」已新增！\n\n🔐 登錄信息：\n   帳號：${username}\n   密碼：${password}\n\n⚠️ 請使用新帳號密碼登錄測試。`);
    } else {
        alert('新增失敗，請重試');
    }
}

// ============================================================
// 渲染權限管理頁面 - 含權限檢查
// ============================================================

function renderPermissions(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('permissions', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>🔐 權限管理</h1>
                <p class="breadcrumb">系統設置 > 權限管理</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「權限管理」的权限</p>
            </div>
        `;
        return;
    }
    
    const levels = DB.get('agent_levels', []);
    const members = DB.get('members', []);
    const agents = DB.get('agents', []);
    const sessions = DB.get('sessions', []);
    const admins = getAdmins();
    const currentAdmin = getCurrentAdmin();
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
    
    // 檢查是否有權限管理權限
    const hasManageAdmins = checkActionPermission('permissions', 'manage_admins');
    const hasManageLevels = checkActionPermission('permissions', 'manage_levels');
    const hasSystemMaintenance = checkActionPermission('permissions', 'system_maintenance');
    
    // 如果當前用戶不是超級管理員，檢查是否有權限管理權限
    if (!isSuperAdmin && !hasManageAdmins) {
        el.innerHTML = `
            <div class="page-header">
                <h1>🔐 權限管理</h1>
                <p class="breadcrumb">系統設置 > 權限管理</p>
            </div>
            <div style="text-align:center;padding:60px 20px;background:#fff;border-radius:10px;border:1px solid #eee;">
                <div style="font-size:48px;margin-bottom:20px;">⛔</div>
                <h2 style="color:#ff6b6b;">權限不足</h2>
                <p style="color:#999;">您沒有權限管理權限，請聯繫系統管理員</p>
            </div>
        `;
        return;
    }
    
    const editAdminId = window._editAdminId || null;
    let editAdmin = null;
    if (editAdminId) {
        editAdmin = admins.find(a => a.id === editAdminId);
    }
    
    if (!editAdmin && isSuperAdmin) {
        const firstNonSuper = admins.find(a => a.role !== 'super_admin');
        if (firstNonSuper) {
            editAdmin = firstNonSuper;
            window._editAdminId = firstNonSuper.id;
        } else if (admins.length > 0) {
            editAdmin = admins[0];
            window._editAdminId = admins[0].id;
        }
    } else if (!editAdmin && !isSuperAdmin) {
        editAdmin = currentAdmin;
        window._editAdminId = currentAdmin ? currentAdmin.id : null;
    }
    
    const adminOptions = admins.map(a => {
        const isSelected = editAdmin && a.id === editAdmin.id;
        const roleLabel = a.role === 'super_admin' ? '👑 總管理員' : '👤 管理員';
        return `<option value="${a.id}" ${isSelected ? 'selected' : ''}>${a.display_name || a.username} (${roleLabel})</option>`;
    }).join('');
    
    let adminListHtml = '';
    if (admins.length === 0) {
        adminListHtml = '<tr class="empty-row"><td colspan="5">暫無管理員</td></tr>';
    } else {
        adminListHtml = admins.map(a => {
            const isSelected = editAdmin && a.id === editAdmin.id;
            const roleBadge = a.role === 'super_admin' ? 
                '<span class="badge badge-success">總管理員</span>' : 
                '<span class="badge badge-info">管理員</span>';
            return `<tr style="${isSelected ? 'background:#e3f2fd;' : ''}">
                <td style="text-align:center;">${a.id}</td>
                <td style="text-align:center;"><strong>${a.display_name || a.username}</strong></td>
                <td style="text-align:center;">${a.username}</td>
                <td style="text-align:center;">${roleBadge}</td>
                <td style="text-align:center;">
                    ${hasManageAdmins ? `<button class="btn btn-primary btn-sm" onclick="selectPermissionAdmin(${a.id})">📊 權限</button>` : ''}
                    ${a.role !== 'super_admin' && hasManageAdmins ? `<button class="btn btn-danger btn-sm" onclick="deleteAdminAccount(${a.id})">刪除</button>` : a.role === 'super_admin' ? '<span style="color:#999;font-size:11px;">不可刪除</span>' : ''}
                </td>
            </tr>`;
        }).join('');
    }
    
    let permissionsHtml = '';
    if (editAdmin) {
        const isEditingSuper = editAdmin.role === 'super_admin';
        const perms = editAdmin.permissions || getDefaultPermissions();
        
        if (isEditingSuper) {
            permissionsHtml = `
                <div style="padding:20px;background:#fff3e0;border-radius:8px;border:1px solid #ffcc80;text-align:center;color:#e65100;">
                    <div style="font-size:24px;margin-bottom:10px;">👑</div>
                    <h3>總管理員擁有所有權限</h3>
                    <p>總管理員可以瀏覽所有頁面並執行所有操作，無需設定權限</p>
                </div>
            `;
        } else {
            let tableRows = '';
            Object.keys(MODULES).forEach(moduleKey => {
                const module = MODULES[moduleKey];
                const page = module.pages[0];
                const pagePerm = perms[page] || { view: true, actions: {} };
                const actions = PAGE_ACTIONS[page] || {};
                
                let actionCheckboxes = '';
                const actionKeys = Object.keys(actions);
                if (actionKeys.length > 0) {
                    actionCheckboxes = `
                        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;padding-left:20px;">
                            ${actionKeys.map(actionKey => {
                                const actionLabel = actions[actionKey];
                                const isChecked = pagePerm.actions && pagePerm.actions[actionKey] !== false;
                                return `
                                    <label style="font-size:12px;display:flex;align-items:center;gap:3px;background:#f5f5f5;padding:2px 8px;border-radius:4px;cursor:pointer;">
                                        <input type="checkbox" class="perm-action" data-page="${page}" data-action="${actionKey}" ${isChecked ? 'checked' : ''} ${!pagePerm.view ? 'disabled' : ''}>
                                        ${actionLabel}
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    `;
                }
                
                tableRows += `
                    <tr>
                        <td style="text-align:center;font-weight:bold;white-space:nowrap;padding:6px 10px;">
                            ${module.icon} ${module.name}
                        </td>
                        <td style="text-align:center;padding:6px 10px;">
                            <label style="display:flex;justify-content:center;align-items:center;gap:5px;cursor:pointer;">
                                <input type="checkbox" class="perm-view" data-page="${page}" ${pagePerm.view !== false ? 'checked' : ''}>
                                <span style="font-size:13px;">${pagePerm.view !== false ? '✅ 可瀏覽' : '❌ 不可瀏覽'}</span>
                            </label>
                        </td>
                        <td style="padding:6px 10px;">
                            ${actionCheckboxes}
                            ${actionKeys.length === 0 ? '<span style="color:#999;font-size:12px;">無操作權限設定</span>' : ''}
                        </td>
                    </tr>
                `;
            });
            
            if (tableRows) {
                permissionsHtml = `
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                            <thead>
                                <tr style="background:#f5f5f5;">
                                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:120px;">模組</th>
                                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;min-width:120px;">瀏覽權限</th>
                                    <th style="padding:8px 12px;border-bottom:2px solid #ddd;text-align:center;">操作權限</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top:10px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;color:#666;text-align:center;border:1px solid #eee;">
                        💡 <strong>可瀏覽</strong>：該頁面在選單中可見并可進入<br>
                        💡 <strong>不可瀏覽</strong>：該頁面在選單中隱藏，所有操作權限自動失效<br>
                        💡 取消「可瀏覽」後，所有操作權限會自動取消
                    </div>
                `;
            } else {
                permissionsHtml = `
                    <div style="padding:20px;text-align:center;color:#999;">
                        暫無可設定的權限模組
                    </div>
                `;
            }
        }
    } else {
        permissionsHtml = `
            <div style="padding:20px;text-align:center;color:#999;">
                請選擇一個管理員進行權限設定
            </div>
        `;
    }
    
    el.innerHTML = `
        <div class="page-header">
            <h1>🔐 權限管理</h1>
            <p class="breadcrumb">系統設置 > 權限管理</p>
            ${currentAdmin ? `<div style="margin-top:5px;color:#666;font-size:13px;">當前管理員：<strong>${currentAdmin.display_name || currentAdmin.username}</strong> (${currentAdmin.role === 'super_admin' ? '總管理員' : '管理員'})</div>` : ''}
        </div>
        
        <!-- 管理員管理 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:15px;">
                <h3 style="margin:0;font-size:16px;">👤 管理員管理</h3>
                ${hasManageAdmins && isSuperAdmin ? `<button class="btn btn-primary btn-sm" onclick="showAddAdmin()">➕ 新增管理員</button>` : ''}
            </div>
            
            ${hasManageAdmins ? `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:#f5f5f5;">
                                <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;width:50px;">ID</th>
                                <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">名稱</th>
                                <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">帳號</th>
                                <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;">角色</th>
                                <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:150px;">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${adminListHtml}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="padding:15px;background:#f8f9fc;border-radius:8px;text-align:center;color:#999;">
                    ⚠️ 您沒有管理管理員的權限
                </div>
            `}
        </div>
        
        <!-- 管理員選擇（權限設定） -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:15px;margin-bottom:20px;">
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                <span style="font-weight:500;font-size:14px;color:#555;">📊 選擇管理員設定權限：</span>
                <select id="permissionAdminSelect" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;min-width:200px;" onchange="selectPermissionAdmin(this.value)">
                    ${adminOptions}
                    ${admins.length === 0 ? '<option value="">暫無管理員</option>' : ''}
                </select>
                ${hasManageAdmins ? `
                    <button class="btn btn-primary" onclick="savePermissions()">💾 儲存權限</button>
                    <button class="btn" onclick="resetPermissions()">🔄 重設權限</button>
                ` : ''}
                <span style="font-size:12px;color:#999;margin-left:auto;">
                    ${editAdmin ? `編輯：<strong>${editAdmin.display_name || editAdmin.username}</strong>` : ''}
                </span>
            </div>
        </div>
        
        <!-- 權限設定表格 -->
        <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:15px;">
                <h3 style="margin:0;font-size:16px;">📋 權限設定 - ${editAdmin ? editAdmin.display_name || editAdmin.username : '未選擇'}</h3>
                ${!isSuperAdmin && !hasManageAdmins ? `
                    <span style="font-size:12px;color:#999;">💡 如需修改權限，請聯繫總管理員</span>
                ` : ''}
            </div>
            ${permissionsHtml}
        </div>
        
        <!-- 系統維護 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <!-- 介紹人等級設定 -->
            <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:20px;">
                <h3>⭐ 介紹人等級設定</h3>
                ${hasManageLevels ? `
                    <div class="table-container" style="margin-top:15px;">
                        <table>
                            <thead><tr><th>ID</th><th>等級名稱</th><th>退水(%)</th><th>操作</th></tr></thead>
                            <tbody>
                                ${levels.map(l => `
                                    <tr>
                                        <td>${l.id}</td>
                                        <td><input type="text" id="levelName_${l.id}" value="${l.name}" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;width:100px;"></td>
                                        <td><input type="number" id="levelRate_${l.id}" value="${l.rate}" step="0.1" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;width:70px;"></td>
                                        <td>
                                            <button class="btn btn-primary btn-sm" onclick="updateLevel(${l.id})">更新</button>
                                            <button class="btn btn-danger btn-sm" onclick="deleteLevel(${l.id})">刪除</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                        <input type="text" id="newLevelName" placeholder="等級名稱" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;width:120px;">
                        <input type="number" id="newLevelRate" placeholder="退水%" step="0.1" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;width:80px;">
                        <button class="btn btn-primary" onclick="addLevel()">新增等級</button>
                    </div>
                ` : `
                    <div style="padding:15px;background:#f8f9fc;border-radius:6px;text-align:center;color:#999;">
                        ⚠️ 您沒有管理等級的權限
                    </div>
                `}
            </div>
            
            <!-- 系統維護 -->
            <div style="background:#fff;border-radius:10px;border:1px solid #eee;padding:20px;">
                <h3>🗑️ 系統維護</h3>
                ${hasSystemMaintenance ? `
                    <div style="margin-top:15px;padding:15px;background:#f8f9fc;border-radius:8px;">
                        <p style="color:#666;font-size:14px;">清除所有紀錄（保留會員、介紹人、匯率設定、管理員帳號）</p>
                        <button class="btn btn-danger" onclick="clearAllRecords()" style="margin-top:10px;">🗑️ 清除紀錄</button>
                    </div>
                    <div style="margin-top:15px;padding:15px;background:#fff3e0;border-radius:8px;border:1px solid #ffcc80;">
                        <p style="color:#e65100;font-size:14px;"><strong>⚠️ 初始化系統</strong><br>清除所有數據（包含會員、介紹人、匯率、管理員等全部資料）</p>
                        <button class="btn btn-danger" onclick="initAllSystem()" style="margin-top:10px;background:#ff6b6b;">🔄 初始化</button>
                    </div>
                ` : `
                    <div style="padding:15px;background:#f8f9fc;border-radius:6px;text-align:center;color:#999;">
                        ⚠️ 您沒有系統維護的權限
                    </div>
                `}
                <div style="margin-top:15px;padding:15px;background:#f8f9fc;border-radius:8px;">
                    <h4 style="font-size:14px;color:#555;">📊 數據統計</h4>
                    <div style="font-size:13px;color:#666;margin-top:8px;">
                        <div>• 會員：${members.length} 人</div>
                        <div>• 介紹人：${agents.length} 人</div>
                        <div>• 台桌會話：${sessions.length} 筆</div>
                        <div>• 每日台帳：${DB.get('daily_settlements', []).length} 筆</div>
                        <div>• 管理員：${admins.length} 人</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 綁定瀏覽權限變更事件
    document.querySelectorAll('.perm-view').forEach(el => {
        el.addEventListener('change', function() {
            const page = this.dataset.page;
            const isChecked = this.checked;
            
            document.querySelectorAll(`.perm-action[data-page="${page}"]`).forEach(actionEl => {
                actionEl.disabled = !isChecked;
                if (!isChecked) {
                    actionEl.checked = false;
                }
            });
            
            const label = this.closest('label');
            if (label) {
                const span = label.querySelector('span');
                if (span) {
                    span.textContent = isChecked ? '✅ 可瀏覽' : '❌ 不可瀏覽';
                }
            }
        });
    });
}

// ============================================================
// 選擇管理員進行權限設定 - 含權限檢查
// ============================================================

function selectPermissionAdmin(adminId) {
    // ✅ 檢查管理管理員權限
    if (!checkActionPermission('permissions', 'manage_admins')) {
        showPermissionDenied('選擇管理員');
        return;
    }
    
    window._editAdminId = parseInt(adminId);
    renderPermissions(document.getElementById('mainContent'));
}

// ============================================================
// 儲存權限設定 - 含權限檢查
// ============================================================

function savePermissions() {
    // ✅ 檢查管理管理員權限
    if (!checkActionPermission('permissions', 'manage_admins')) {
        showPermissionDenied('儲存權限設定');
        return;
    }
    
    const adminId = window._editAdminId;
    if (!adminId) {
        alert('請先選擇管理員');
        return;
    }
    
    const admin = getAdmin(adminId);
    if (!admin) {
        alert('管理員不存在');
        return;
    }
    
    if (admin.role === 'super_admin') {
        alert('總管理員擁有所有權限，無需設定');
        return;
    }
    
    const currentAdmin = getCurrentAdmin();
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
    
    if (!isSuperAdmin) {
        alert('只有總管理員可以修改權限設定');
        return;
    }
    
    const permissions = {};
    
    document.querySelectorAll('.perm-view').forEach(viewEl => {
        const page = viewEl.dataset.page;
        const viewChecked = viewEl.checked;
        
        permissions[page] = {
            view: viewChecked,
            actions: {}
        };
        
        document.querySelectorAll(`.perm-action[data-page="${page}"]`).forEach(actionEl => {
            const action = actionEl.dataset.action;
            permissions[page].actions[action] = actionEl.checked;
        });
    });
    
    const admins = getAdmins();
    const targetAdmin = admins.find(a => a.id === adminId);
    if (targetAdmin) {
        targetAdmin.permissions = permissions;
        DB.set('admins', admins);
        
        const current = getCurrentAdmin();
        if (current && current.id === adminId) {
            setCurrentAdmin(targetAdmin);
            document.getElementById('userInfo').textContent = targetAdmin.display_name || targetAdmin.username;
        }
        
        addOperationLog('權限管理', '修改', targetAdmin.username || '', 
            `更新管理員 ${targetAdmin.display_name || targetAdmin.username} 的權限設定`, adminId);
        
        alert('✅ 權限設定已儲存');
        renderPermissions(document.getElementById('mainContent'));
    } else {
        alert('儲存失敗，請重試');
    }
}

// ============================================================
// 重設權限設定 - 含權限檢查
// ============================================================

function resetPermissions() {
    // ✅ 檢查管理管理員權限
    if (!checkActionPermission('permissions', 'manage_admins')) {
        showPermissionDenied('重設權限設定');
        return;
    }
    
    const adminId = window._editAdminId;
    if (!adminId) {
        alert('請先選擇管理員');
        return;
    }
    
    const admin = getAdmin(adminId);
    if (!admin) {
        alert('管理員不存在');
        return;
    }
    
    if (admin.role === 'super_admin') {
        alert('總管理員擁有所有權限，無需重設');
        return;
    }
    
    const currentAdmin = getCurrentAdmin();
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
    
    if (!isSuperAdmin) {
        alert('只有總管理員可以重設權限');
        return;
    }
    
    if (!confirm(`確定要重設管理員「${admin.display_name || admin.username}」的權限為預設值嗎？`)) {
        return;
    }
    
    const defaultPerms = getDefaultPermissions();
    const admins = getAdmins();
    const targetAdmin = admins.find(a => a.id === adminId);
    if (targetAdmin) {
        targetAdmin.permissions = defaultPerms;
        DB.set('admins', admins);
        
        addOperationLog('權限管理', '修改', targetAdmin.username || '', 
            `重設管理員 ${targetAdmin.display_name || targetAdmin.username} 的權限為預設值`, adminId);
        
        alert('✅ 權限已重設為預設值');
        renderPermissions(document.getElementById('mainContent'));
    }
}

// ============================================================
// 刪除管理員 - 含權限檢查
// ============================================================

function deleteAdminAccount(id) {
    // ✅ 檢查管理管理員權限
    if (!checkActionPermission('permissions', 'manage_admins')) {
        showPermissionDenied('刪除管理員');
        return;
    }
    
    const admin = getAdmin(id);
    if (!admin) {
        alert('管理員不存在');
        return;
    }
    if (admin.role === 'super_admin') {
        alert('不能刪除總管理員');
        return;
    }
    if (!confirm(`確定要刪除管理員「${admin.display_name || admin.username}」嗎？`)) {
        return;
    }
    
    const success = deleteAdmin(id);
    if (success) {
        if (window._editAdminId === id) {
            window._editAdminId = null;
        }
        renderPermissions(document.getElementById('mainContent'));
        alert('✅ 管理員已刪除');
    } else {
        alert('刪除失敗，請重試');
    }
}

// ============================================================
// 介紹人等級功能 - 含權限檢查
// ============================================================

function addLevel() {
    // ✅ 檢查管理等級權限
    if (!checkActionPermission('permissions', 'manage_levels')) {
        showPermissionDenied('新增等級');
        return;
    }
    
    const name = document.getElementById('newLevelName').value.trim();
    const rate = parseFloat(document.getElementById('newLevelRate').value);
    if (!name) { alert('請輸入等級名稱'); return; }
    if (isNaN(rate) || rate < 0) { alert('請輸入有效的退水比例'); return; }
    
    const levels = DB.get('agent_levels', []);
    levels.push({ id: DB.getNextId('agent_levels'), name: name, rate: rate });
    DB.set('agent_levels', levels);
    document.getElementById('newLevelName').value = '';
    document.getElementById('newLevelRate').value = '';
    renderPermissions(document.getElementById('mainContent'));
    alert('✅ 等級已新增');
}

function updateLevel(id) {
    // ✅ 檢查管理等級權限
    if (!checkActionPermission('permissions', 'manage_levels')) {
        showPermissionDenied('更新等級');
        return;
    }
    
    const name = document.getElementById('levelName_' + id).value.trim();
    const rate = parseFloat(document.getElementById('levelRate_' + id).value);
    if (!name) { alert('請輸入等級名稱'); return; }
    if (isNaN(rate) || rate < 0) { alert('請輸入有效的退水比例'); return; }
    
    const levels = DB.get('agent_levels', []);
    const l = levels.find(x => x.id === id);
    if (l) { l.name = name; l.rate = rate; DB.set('agent_levels', levels); }
    renderPermissions(document.getElementById('mainContent'));
    alert('✅ 等級已更新');
}

function deleteLevel(id) {
    // ✅ 檢查管理等級權限
    if (!checkActionPermission('permissions', 'manage_levels')) {
        showPermissionDenied('刪除等級');
        return;
    }
    
    if (!confirm('確定要刪除這個等級嗎？')) return;
    const levels = DB.get('agent_levels', []).filter(l => l.id !== id);
    DB.set('agent_levels', levels);
    renderPermissions(document.getElementById('mainContent'));
    alert('✅ 等級已刪除');
}

// ============================================================
// 系統維護功能 - 含權限檢查
// ============================================================

function clearAllRecords() {
    // ✅ 檢查系統維護權限
    if (!checkActionPermission('permissions', 'system_maintenance')) {
        showPermissionDenied('清除紀錄');
        return;
    }
    
    if (!confirm('⚠️ 確定要清除所有紀錄嗎？\n（將保留會員、介紹人、匯率設定、管理員帳號）')) return;
    
    const admins = DB.get('admins', []);
    const currencies = DB.get('currencies', []);
    const agentLevels = DB.get('agent_levels', []);
    const agents = DB.get('agents', []);
    const members = DB.get('members', []);
    const accounts = DB.get('accounts', []);
    const departments = DB.get('departments', []);
    const positions = DB.get('positions', []);
    const employees = DB.get('employees', []);
    const attendanceSettings = DB.get('attendance_settings', {});
    
    DB.set('sessions', []);
    DB.set('transactions', []);
    DB.set('water_records', []);
    DB.set('daily_settlements', []);
    DB.set('up_records', []);
    DB.set('down_records', []);
    DB.set('recharge_records', []);
    DB.set('withdraw_records', []);
    DB.set('account_transactions', []);
    DB.set('insurance_records', []);
    DB.set('exchange_records', []);
    DB.set('tips_records', []);
    DB.set('attendance_records', []);
    DB.set('expense_records', []);
    DB.set('agent_stay_records', []);
    DB.set('salary_records', []);
    DB.set('member_account_transactions', []);
    DB.set('operation_logs', []);
    
    members.forEach(m => { 
        m.balance = 0; 
        m.unpaid_loan = 0; 
    });
    DB.set('members', members);
    
    const memberAccounts = DB.get('member_accounts', []);
    memberAccounts.forEach(a => {
        if (a.balances) {
            Object.keys(a.balances).forEach(key => { a.balances[key] = 0; });
        }
    });
    DB.set('member_accounts', memberAccounts);
    
    accounts.forEach(a => {
        if (a.balances) {
            Object.keys(a.balances).forEach(key => { a.balances[key] = 0; });
        }
    });
    DB.set('accounts', accounts);
    
    DB.set('sessions_next', 1);
    DB.set('transactions_next', 1);
    DB.set('water_records_next', 1);
    DB.set('daily_settlements_next', 1);
    DB.set('up_records_next', 1);
    DB.set('down_records_next', 1);
    DB.set('recharge_records_next', 1);
    DB.set('withdraw_records_next', 1);
    DB.set('account_transactions_next', 1);
    DB.set('insurance_records_next', 1);
    DB.set('exchange_records_next', 1);
    DB.set('tips_records_next', 1);
    DB.set('attendance_records_next', 1);
    DB.set('expense_records_next', 1);
    DB.set('agent_stay_records_next', 1);
    DB.set('salary_records_next', 1);
    DB.set('member_account_transactions_next', 1);
    DB.set('operation_logs_next', 1);
    
    addOperationLog('系統維護', '清除紀錄', '全部', '清除所有紀錄（保留基礎資料）');
    renderPermissions(document.getElementById('mainContent'));
    alert('✅ 所有紀錄已清除\n\n保留項目：\n• 會員資料\n• 介紹人資料\n• 匯率設定\n• 管理員帳號\n• 員工資料\n• 往來帳戶');
}

function initAllSystem() {
    // ✅ 檢查系統維護權限
    if (!checkActionPermission('permissions', 'system_maintenance')) {
        showPermissionDenied('初始化系統');
        return;
    }
    
    if (!confirm('⚠️ 確定要初始化系統嗎？\n這將清除所有數據（包含會員、介紹人、匯率、管理員等全部資料）！')) return;
    if (!confirm('⚠️ 再次確認：所有數據將被清除，此操作不可復原！')) return;
    if (!confirm('⚠️ 最後確認：您確定要初始化整個系統嗎？')) return;
    
    localStorage.clear();
    initData();
    
    addOperationLog('系統維護', '初始化', '全部', '初始化整個系統（清除所有數據）');
    
    renderPermissions(document.getElementById('mainContent'));
    alert('✅ 系統已初始化完成\n\n所有數據已清除，系統恢復為初始狀態。\n預設管理員帳號：admin / 密碼：admin123');
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
// 確保權限檢查函數在全局可用
// ============================================================

window.hasPagePermission = hasPagePermission;
window.hasActionPermission = hasActionPermission;
window.getVisibleMenuItems = getVisibleMenuItems;
window.getVisiblePages = getVisiblePages;
window.selectPermissionAdmin = selectPermissionAdmin;
window.savePermissions = savePermissions;
window.resetPermissions = resetPermissions;
window.deleteAdminAccount = deleteAdminAccount;
window.showAddAdmin = showAddAdmin;
window.addLevel = addLevel;
window.updateLevel = updateLevel;
window.deleteLevel = deleteLevel;
window.clearAllRecords = clearAllRecords;
window.initAllSystem = initAllSystem;

// ============================================================
// 權限檢查函數暴露（備用）
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