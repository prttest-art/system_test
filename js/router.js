// ============================================================
// router.js - 完整版（含权限检查）
// ============================================================

let currentPage = 'dashboard';

// 页面渲染器映射
const pageRenderers = {
    dashboard: renderDashboard,
    members: renderMembers,
    agent_stay: renderAgentStay, 
    transactions: renderTransactions,
    flow: renderFlow,
    agents: renderAgents,
    accounts: renderAccounts,
    tables: renderTables,
    currency: renderCurrency,
    exchange: renderExchange,
    employees: renderEmployees,
    attendance: renderAttendance,
    salary: renderSalary,
    expenses: renderExpenses,
    permissions: renderPermissions,
    backup: renderBackup,
    operation_log: renderOperationLog
};

// ============================================================
// 安全权限检查
// ============================================================

function checkPagePermission(page) {
    try {
        if (typeof hasPagePermission === 'function') {
            return hasPagePermission(page);
        }
        console.warn('⚠️ hasPagePermission 函数未定义，默认允许访问');
        return true;
    } catch(e) {
        console.warn('⚠️ 权限检查失败，默认允许访问:', e.message);
        return true;
    }
}

function checkActionPermission(page, action) {
    try {
        if (typeof hasActionPermission === 'function') {
            return hasActionPermission(page, action);
        }
        console.warn('⚠️ hasActionPermission 函数未定义，默认允许访问');
        return true;
    } catch(e) {
        console.warn('⚠️ 操作权限检查失败，默认允许访问:', e.message);
        return true;
    }
}

// ============================================================
// 获取页面显示名称
// ============================================================

function getPageDisplayName(page) {
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
        operation_log: '操作纪录'
    };
    return nameMap[page] || page;
}

// ============================================================
// 导航到指定页面
// ============================================================

function navigateTo(page) {
    const content = document.getElementById('mainContent');
    if (!content) {
        console.error('❌ 找不到 mainContent 元素');
        return;
    }
    
    // 檢查登入狀態
    const admin = getCurrentAdmin();
    
    if (!admin) {
        console.warn('未登入，無法導航到:', page);
        content.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:60vh;color:#999;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">🔐</div>
                <p style="font-size:18px;color:#555;">請先登錄</p>
                <button class="btn btn-primary" onclick="showLoginDialog()" style="margin-top:15px;padding:10px 30px;">前往登錄</button>
            </div>
        `;
        setTimeout(function() {
            if (typeof showLoginDialog === 'function') {
                showLoginDialog();
            } else {
                showSimpleLogin();
            }
        }, 200);
        return;
    }
    
    // 检查页面权限
    if (!checkPagePermission(page)) {
        console.warn('⚠️ 权限不足，无法访问:', page);
        content.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:60vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有访问「${getPageDisplayName(page)}」的权限</p>
                <button class="btn btn-primary" onclick="navigateTo('dashboard')" style="margin-top:15px;padding:10px 30px;">🏠 返回首页</button>
            </div>
        `;
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
        });
        return;
    }
    
    currentPage = page;
    
    // 更新菜单高亮
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });
    
    // 渲染页面
    renderPage(page);
}

// ============================================================
// 顯示權限不足訊息（用於按鈕操作）
// ============================================================

function showPermissionDenied(actionName) {
    alert(`⛔ 权限不足！\n\n您没有「${actionName}」的操作权限，请联系系统管理员。`);
}

// ============================================================
// 簡單登錄框（備用方案）
// ============================================================

function showSimpleLogin() {
    if (document.querySelector('.simple-login-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'simple-login-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:30px;max-width:400px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
            <div style="text-align:center;margin-bottom:20px;">
                <span style="font-size:28px;font-weight:700;color:#2196F3;">RPT</span>
                <span style="font-size:18px;color:#555;margin-left:5px;">會員管理系統</span>
            </div>
            <div style="text-align:center;font-size:18px;font-weight:600;margin-bottom:20px;">🔐 管理員登錄</div>
            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:500;font-size:14px;color:#444;margin-bottom:4px;">帳號</label>
                <input type="text" id="simpleLoginUsername" placeholder="請輸入帳號" value="admin" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:500;font-size:14px;color:#444;margin-bottom:4px;">密碼</label>
                <input type="password" id="simpleLoginPassword" placeholder="請輸入密碼" value="admin123" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
            </div>
            <div id="simpleLoginError" style="color:#ff6b6b;font-size:13px;display:none;margin-bottom:10px;">帳號或密碼錯誤，請重試</div>
            <button class="btn btn-primary" onclick="submitSimpleLogin()" style="width:100%;padding:10px;background:#2196F3;color:#fff;border:none;border-radius:6px;font-size:16px;cursor:pointer;">登 錄</button>
            <div style="text-align:center;margin-top:15px;font-size:12px;color:#999;">默認帳號：admin / 密碼：admin123</div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#simpleLoginPassword').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submitSimpleLogin();
    });
    overlay.querySelector('#simpleLoginUsername').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') submitSimpleLogin();
    });
}

function submitSimpleLogin() {
    const overlay = document.querySelector('.simple-login-overlay');
    if (!overlay) return;
    
    const username = overlay.querySelector('#simpleLoginUsername').value.trim();
    const password = overlay.querySelector('#simpleLoginPassword').value;
    const errorEl = overlay.querySelector('#simpleLoginError');
    
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
        
        if (typeof renderSidebar === 'function') {
            renderSidebar();
        }
        
        addOperationLog('系統', '登录', admin.display_name || admin.username, 
            `管理員 ${admin.display_name || admin.username} 登錄成功`, admin.id);
        
        const page = currentPage || 'dashboard';
        document.getElementById('mainContent').innerHTML = '<div style="text-align:center;padding:50px;color:#999;">加載中...</div>';
        navigateTo(page);
        alert(`✅ 歡迎回來，${admin.display_name || admin.username}！`);
    } else {
        errorEl.textContent = '帳號或密碼錯誤，請重試';
        errorEl.style.display = 'block';
    }
}

// ============================================================
// 渲染页面内容
// ============================================================

function renderPage(page) {
    const content = document.getElementById('mainContent');
    if (!content) {
        console.error('❌ 找不到 mainContent 元素');
        return;
    }
    
    const admin = getCurrentAdmin();
    if (!admin) {
        content.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:60vh;color:#999;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">🔐</div>
                <p style="font-size:18px;color:#555;">請先登錄</p>
                <button class="btn btn-primary" onclick="showLoginDialog()" style="margin-top:15px;padding:10px 30px;">前往登錄</button>
            </div>
        `;
        if (typeof showLoginDialog === 'function') {
            showLoginDialog();
        } else {
            showSimpleLogin();
        }
        return;
    }
    
    const renderer = pageRenderers[page];
    
    if (typeof renderer === 'function') {
        try {
            console.log('📄 渲染頁面:', page);
            renderer(content);
        } catch(e) {
            console.error('❌ 渲染頁面失敗:', e);
            content.innerHTML = `
                <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:60vh;color:#ff6b6b;font-size:16px;">
                    <div style="font-size:48px;margin-bottom:15px;">⚠️</div>
                    <h2 style="color:#ff6b6b;">頁面加載失敗</h2>
                    <p style="color:#999;font-size:14px;margin-top:10px;">${e.message}</p>
                    <button class="btn btn-primary" onclick="forceRefresh()" style="margin-top:15px;padding:10px 30px;">🔄 重新加載</button>
                </div>
            `;
        }
    } else {
        content.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:60vh;color:#999;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">📄</div>
                <h2>頁面 "${page}" 未找到</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">請檢查頁面名稱是否正確</p>
                <button class="btn btn-primary" onclick="forceRefresh()" style="margin-top:15px;padding:10px 30px;">🔄 重新加載</button>
            </div>
        `;
    }
}

// ============================================================
// 強制重新整理
// ============================================================

function forceRefresh() {
    console.log('🔄 強制重新整理...');
    const admin = getCurrentAdmin();
    if (admin) {
        if (typeof renderSidebar === 'function') {
            renderSidebar();
        }
        const page = currentPage || 'dashboard';
        navigateTo(page);
    } else {
        location.reload();
    }
}

// ============================================================
// 绑定导航事件
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) {
                navigateTo(page);
            }
        });
    });
});

// ============================================================
// 暴露到全域
// ============================================================

window.forceRefresh = forceRefresh;
window.navigateTo = navigateTo;
window.currentPage = currentPage;
window.getPageDisplayName = getPageDisplayName;
window.renderPage = renderPage;
window.checkPagePermission = checkPagePermission;
window.checkActionPermission = checkActionPermission;
window.showPermissionDenied = showPermissionDenied;
window.showSimpleLogin = showSimpleLogin;
window.submitSimpleLogin = submitSimpleLogin;