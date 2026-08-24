// ============================================================
// 1. 仪表板
// ============================================================

function renderDashboard(el) {
    const members = DB.get('members', []);
    const transactions = DB.get('transactions', []);
    const sessions = DB.get('sessions', []);
    
    let totalRecharge = 0, totalRefund = 0, totalLoan = 0, totalRepay = 0, totalRebate = 0;
    transactions.forEach(t => {
        if (t.type === 'recharge') totalRecharge += t.amount;
        else if (t.type === 'refund') totalRefund += t.amount;
        else if (t.type === 'loan') totalLoan += t.amount;
        else if (t.type === 'repay') totalRepay += t.amount;
        else if (t.type === 'rebate') totalRebate += t.amount;
    });
    
    const activeSessions = sessions.filter(s => s.status === 'active' && s.session_type === 'player');
    const totalBalance = members.reduce((sum, m) => sum + m.balance, 0);
    const totalLoanAmount = members.reduce((sum, m) => sum + m.unpaid_loan, 0);
    const actualRevenue = totalRecharge - totalRefund + totalRepay - totalLoan - totalRebate;
    
    const tables = ['决赛桌', 'VIP包1', 'VIP包2', '大厅1', '大厅2'];
    const tableStats = {};
    tables.forEach(t => {
        tableStats[t] = sessions.filter(s => s.table_type === t && s.status === 'active' && s.session_type === 'player').length;
    });
    
    el.innerHTML = `
        <div class="page-header">
            <h1>🏠 会员中心首页</h1>
            <p class="breadcrumb">会员中心 > 首页</p>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">充值总额</div><div class="stat-value">${totalRecharge.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">出金总额</div><div class="stat-value">${totalRefund.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">借款总额</div><div class="stat-value">${totalLoan.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">还款总额</div><div class="stat-value">${totalRepay.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">返点总额</div><div class="stat-value">${totalRebate.toFixed(2)}</div></div>
            <div class="stat-card highlight"><div class="stat-label">💰 实际营收</div><div class="stat-value">${actualRevenue.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">👤 会员总数</div><div class="stat-value">${members.length}</div></div>
            <div class="stat-card"><div class="stat-label">🎯 活跃台桌</div><div class="stat-value">${activeSessions.length}</div></div>
        </div>
        <div class="table-stats">
            <h3>📋 各桌人数</h3>
            ${Object.entries(tableStats).map(([k, v]) => `<div class="table-stat-item"><span>${k}</span><span>${v} 人</span></div>`).join('')}
        </div>
    `;
}