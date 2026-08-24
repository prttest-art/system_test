// ============================================================
// app.js - 完整版（包含动态菜单渲染）
// ============================================================

// ============================================================
// 动态渲染侧边栏菜单（根据权限）
// ============================================================

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    const admin = getCurrentAdmin();
    if (!admin) {
        sidebar.innerHTML = `
            <div style="padding:20px;text-align:center;color:#999;font-size:14px;">
                🔐 请登录
            </div>
        `;
        return;
    }
    
    // 获取可见菜单项
    const visibleItems = getVisibleMenuItems();
    
    // 菜单分组定义（顺序按此显示）
    const menuGroups = [
        {
            name: '会员中心',
            items: [
                { id: 'dashboard', icon: '🏠', name: '会员中心' },
                { id: 'members', icon: '📋', name: '来客管理' },
                { id: 'agents', icon: '👤', name: '介绍人' },
                { id: 'agent_stay', icon: '🏨', name: '代理住宿' }
            ]
        },
        {
            name: '营运管理',
            items: [
                { id: 'transactions', icon: '📊', name: '每日台帐' },
                { id: 'flow', icon: '💳', name: '充值/退费/借款流水' },
                { id: 'accounts', icon: '📒', name: '往来账款' },
                { id: 'tables', icon: '🎯', name: '台桌看板' },
                { id: 'currency', icon: '💱', name: '币种汇率' },
                { id: 'exchange', icon: '💱', name: '兑汇纪录' },
                { id: 'employees', icon: '👥', name: '员工管理' },
                { id: 'attendance', icon: '👥', name: '员工出勤' },
                { id: 'salary', icon: '💰', name: '员工工资' },
                { id: 'expenses', icon: '🧾', name: '费用报销' }
            ]
        },
        {
            name: '系统设置',
            items: [
                { id: 'permissions', icon: '⚙️', name: '权限管理' },
                { id: 'backup', icon: '💾', name: '资料备份' },
                { id: 'operation_log', icon: '📋', name: '操作纪录' }
            ]
        }
    ];
    
    let html = '';
    let hasVisibleItems = false;
    
    menuGroups.forEach(group => {
        // 检查该组是否有可见页面
        const visibleInGroup = group.items.filter(item => 
            visibleItems.some(v => v.id === item.id)
        );
        if (visibleInGroup.length === 0) return;
        
        hasVisibleItems = true;
        html += `<div class="sidebar-title">${group.name}</div>`;
        
        visibleInGroup.forEach(item => {
            const isActive = (currentPage === item.id);
            html += `
                <div class="nav-item ${isActive ? 'active' : ''}" data-page="${item.id}">
                    ${item.icon} ${item.name}
                </div>
            `;
        });
    });
    
    if (!hasVisibleItems) {
        html = `
            <div style="padding:20px;text-align:center;color:#999;font-size:14px;">
                ⛔ 您没有可访问的页面
            </div>
        `;
    }
    
    sidebar.innerHTML = html;
    
    // 绑定点击事件
    sidebar.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) navigateTo(page);
        });
    });
}

// ============================================================
// 檢查登錄狀態
// ============================================================

function checkLogin() {
    const currentAdmin = getCurrentAdmin();
    if (!currentAdmin) {
        showLoginDialog();
        return false;
    }
    return true;
}

// ============================================================
// 顯示登錄對話框
// ============================================================

function showLoginDialog() {
    if (document.querySelector('.login-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay login-overlay';
    overlay.style.zIndex = '2000';
    overlay.innerHTML = `
        <div class="modal" style="max-width:400px;">
            <div style="text-align:center;margin-bottom:20px;">
                <span style="font-size:28px;font-weight:700;color:#2196F3;">RPT</span>
                <span style="font-size:18px;color:#555;margin-left:5px;">會員管理系統</span>
            </div>
            <div class="modal-title" style="text-align:center;font-size:18px;">🔐 管理員登錄</div>
            <div class="form-group">
                <label>帳號</label>
                <input type="text" id="loginUsername" placeholder="請輸入帳號" value="admin">
            </div>
            <div class="form-group">
                <label>密碼</label>
                <input type="password" id="loginPassword" placeholder="請輸入密碼" value="admin123">
            </div>
            <div id="loginError" style="color:#ff6b6b;font-size:13px;display:none;margin-bottom:10px;">帳號或密碼錯誤，請重試</div>
            <div class="modal-actions" style="justify-content:center;">
                <button class="btn btn-primary" onclick="submitLogin()" style="width:100%;padding:10px;">登 錄</button>
            </div>
            <div style="text-align:center;margin-top:15px;font-size:12px;color:#999;">
                默認帳號：admin / 密碼：admin123
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#loginPassword').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submitLogin();
    });
    overlay.querySelector('#loginUsername').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submitLogin();
    });
}

// ============================================================
// 提交登錄
// ============================================================

function submitLogin() {
    const overlay = document.querySelector('.login-overlay');
    if (!overlay) return;
    
    const username = overlay.querySelector('#loginUsername').value.trim();
    const password = overlay.querySelector('#loginPassword').value;
    const errorEl = overlay.querySelector('#loginError');
    
    if (!username || !password) {
        errorEl.textContent = '請輸入帳號和密碼';
        errorEl.style.display = 'block';
        return;
    }
    
    const admin = verifyAdmin(username, password);
    if (admin) {
        setCurrentAdmin(admin);
        overlay.remove();
        document.getElementById('userInfo').textContent = admin.display_name || admin.username;
        
        // 渲染菜单
        renderSidebar();
        
        addOperationLog('系統', '登录', admin.display_name || admin.username, 
            `管理員 ${admin.display_name || admin.username} 登錄成功`, admin.id);
        
        document.getElementById('mainContent').innerHTML = '<div style="text-align:center;padding:50px;color:#999;">加載中...</div>';
        navigateTo('dashboard');
        alert(`✅ 歡迎回來，${admin.display_name || admin.username}！`);
    } else {
        errorEl.textContent = '帳號或密碼錯誤，請重試';
        errorEl.style.display = 'block';
        
        const logs = DB.get('operation_logs', []);
        logs.push({
            id: DB.getNextId('operation_logs'),
            module: '系統',
            action: '登录失敗',
            target: username || '未知帳號',
            detail: `管理員登入失敗 - 帳號：${username || '未輸入'}`,
            target_id: null,
            admin_id: null,
            admin_name: '系統',
            before_data: null,
            after_data: null,
            created_at: now()
        });
        DB.set('operation_logs', logs);
    }
}

// ============================================================
// 登出
// ============================================================

function logout() {
    const admin = getCurrentAdmin();
    if (admin) {
        addOperationLog('系統', '登出', admin.display_name || admin.username, 
            `管理員 ${admin.display_name || admin.username} 登出`, admin.id);
    }
    
    if (confirm('確定要登出嗎？')) {
        clearCurrentAdmin();
        document.getElementById('userInfo').textContent = '未登錄';
        document.getElementById('sidebar').innerHTML = `
            <div style="padding:20px;text-align:center;color:#999;font-size:14px;">
                🔐 请登录
            </div>
        `;
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:60vh;color:#999;font-size:16px;">
                    🔐 請先登錄
                </div>
            `;
        }
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
        });
        showLoginDialog();
    }
}

// ============================================================
// 初始化
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    initData();
    
    const currentAdmin = getCurrentAdmin();
    console.log('🔍 當前管理員:', currentAdmin);
    
    if (currentAdmin) {
        document.getElementById('userInfo').textContent = currentAdmin.display_name || currentAdmin.username;
        renderSidebar();
        if (!currentPage) currentPage = 'dashboard';
        setTimeout(function() {
            navigateTo(currentPage);
        }, 50);
    } else {
        document.getElementById('userInfo').textContent = '未登錄';
        document.getElementById('sidebar').innerHTML = `
            <div style="padding:20px;text-align:center;color:#999;font-size:14px;">
                🔐 请登录
            </div>
        `;
        document.getElementById('mainContent').innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:60vh;color:#999;font-size:16px;">
                🔐 請先登錄
            </div>
        `;
        showLoginDialog();
    }
});

// ============================================================
// 強制重新整理
// ============================================================

function forceRefresh() {
    const admin = getCurrentAdmin();
    if (admin) {
        renderSidebar();
        const page = currentPage || 'dashboard';
        navigateTo(page);
    } else {
        location.reload();
    }
}

// ============================================================
// 全域變數
// ============================================================

window.checkLogin = checkLogin;
window.showLoginDialog = showLoginDialog;
window.submitLogin = submitLogin;
window.logout = logout;
window.forceRefresh = forceRefresh;
window.navigateTo = navigateTo;
window.renderSidebar = renderSidebar;
window.currentPage = currentPage;
