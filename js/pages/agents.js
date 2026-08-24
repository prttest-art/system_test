// ============================================================
// 5. 介绍人（完整版 - 支援ID/姓名搜尋 + 操作紀錄 + 權限控制）
// ============================================================

// ============================================================
// 渲染介紹人列表
// ============================================================

function renderAgents(el) {
    // ✅ 檢查瀏覽權限
    if (!checkActionPermission('agents', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>👤 介绍人管理</h1>
                <p class="breadcrumb">会员中心 > 介绍人</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「介绍人」的权限</p>
            </div>
        `;
        return;
    }
    
    const agents = DB.get('agents', []);
    const members = DB.get('members', []);
    const levels = DB.get('agent_levels', []);
    
    // 獲取搜尋關鍵字
    const searchKeyword = document.getElementById('agentSearch')?.value?.trim() || '';
    
    // 過濾介紹人：支援姓名或會員編號搜尋
    let filteredAgents = agents;
    if (searchKeyword) {
        const isNumeric = /^\d+$/.test(searchKeyword);
        filteredAgents = agents.filter(a => {
            const nameMatch = a.name.toLowerCase().includes(searchKeyword.toLowerCase());
            const idMatch = isNumeric && a.id.toString().includes(searchKeyword);
            return nameMatch || idMatch;
        });
    }
    
    // 获取当前选中的介绍人ID（用于右侧显示）
    const selectedAgentId = window._selectedAgentId || null;
    
    // 計算每個介紹人的統計
    const agentStats = filteredAgents.map(a => {
        const memberList = members.filter(m => m.intermediary_id === a.id);
        const level = levels.find(l => l.id === a.level_id);
        const effectiveRate = level ? level.rate : (a.rebate_rate || 0);
        return {
            ...a,
            effectiveRate: effectiveRate,
            memberCount: memberList.length,
            totalBalance: memberList.reduce((sum, m) => sum + m.balance, 0),
            totalLoan: memberList.reduce((sum, m) => sum + m.unpaid_loan, 0),
            memberList: memberList
        };
    });
    
    // 获取当前选中介绍人的详细信息
    let selectedAgent = null;
    let selectedMemberList = [];
    if (selectedAgentId) {
        selectedAgent = agentStats.find(a => a.id === selectedAgentId);
        if (selectedAgent) {
            selectedMemberList = selectedAgent.memberList;
        }
    }
    
    // 顯示搜尋結果數量
    const resultCount = agentStats.length;
    const totalCount = agents.length;
    const searchInfo = searchKeyword ? `找到 ${resultCount} 笔结果（共 ${totalCount} 位介绍人）` : `共 ${totalCount} 位介绍人`;
    
    // 檢查各操作權限
    const canAdd = checkActionPermission('agents', 'add');
    const canEdit = checkActionPermission('agents', 'edit');
    const canDelete = checkActionPermission('agents', 'delete');
    const canViewStats = checkActionPermission('agents', 'view_stats');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>👤 介绍人管理</h1>
            <p class="breadcrumb">会员中心 > 介绍人</p>
        </div>
        <div class="toolbar">
            <div class="search-box">
                <input type="text" id="agentSearch" placeholder="输入姓名或会员编号..." value="${searchKeyword}" onkeydown="if(event.key==='Enter') renderAgents(document.getElementById('mainContent'))">
                <button class="btn btn-primary" onclick="renderAgents(document.getElementById('mainContent'))">🔍 搜索</button>
                ${searchKeyword ? `<button class="btn" onclick="document.getElementById('agentSearch').value='';renderAgents(document.getElementById('mainContent'))">✕ 清除</button>` : ''}
                <span style="font-size:13px;color:#999;margin-left:5px;">${searchInfo}</span>
            </div>
            ${canAdd ? `<button class="btn btn-primary" onclick="showAddAgent()">➕ 新增介绍人</button>` : ''}
            <button class="btn" onclick="renderAgents(document.getElementById('mainContent'))">🔄 刷新</button>
        </div>
        <div class="flex-grid">
            <div class="table-container">
                <h3 style="padding:12px 15px;margin:0;border-bottom:1px solid #eee;">介绍人列表</h3>
                <table>
                    <thead><tr>
                        <th>ID</th><th>姓名</th><th>退水(%)</th><th>等级</th><th>带客数</th><th>总余额</th><th>总借款</th><th>操作</th>
                    </tr></thead>
                    <tbody>
                        ${agentStats.length === 0 ? `<tr class="empty-row"><td colspan="8">${searchKeyword ? '未找到匹配的介绍人' : '暂无介绍人'}</td></tr>` :
                        agentStats.map(a => {
                            const level = levels.find(l => l.id === a.level_id);
                            const isSelected = selectedAgentId === a.id;
                            let displayName = a.name;
                            if (searchKeyword) {
                                const regex = new RegExp(`(${searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                                displayName = a.name.replace(regex, '<mark style="background:#ffeb3b;padding:0 2px;border-radius:2px;">$1</mark>');
                            }
                            
                            // 構建操作按鈕（根據權限顯示）
                            let actionButtons = '';
                            if (canEdit) {
                                actionButtons += `<button class="btn btn-primary btn-sm" onclick="showEditAgent(${a.id})">修改</button>`;
                            }
                            if (canDelete) {
                                actionButtons += `<button class="btn btn-danger btn-sm" onclick="deleteAgent(${a.id})">删除</button>`;
                            }
                            if (canViewStats) {
                                actionButtons += `<button class="btn btn-info btn-sm" onclick="selectAgent(${a.id})">📊 统计</button>`;
                            }
                            
                            return `<tr style="${isSelected ? 'background:#e3f2fd;' : ''}">
                                <td><strong>${a.id}</strong> ${searchKeyword && a.id.toString().includes(searchKeyword) ? '🔍' : ''}</td>
                                <td><strong>${displayName}</strong></td>
                                <td>${a.effectiveRate}%</td>
                                <td>${level ? level.name : '-'}</td>
                                <td>${a.memberCount}</td>
                                <td>${a.totalBalance.toFixed(2)}</td>
                                <td>${a.totalLoan.toFixed(2)}</td>
                                <td>
                                    <div class="btn-group">
                                        ${actionButtons}
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="table-container">
                <h3 style="padding:12px 15px;margin:0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                    <span>👥 旗下玩家</span>
                    ${selectedAgent ? `<span style="font-size:13px;color:#2196F3;font-weight:normal;">${selectedAgent.name} - 共 ${selectedMemberList.length} 人</span>` : ''}
                </h3>
                ${selectedAgent ? `
                    <!-- 統計摘要 -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;padding:10px 15px;background:#f8f9fc;border-bottom:1px solid #eee;">
                        <div style="text-align:center;">
                            <div style="font-size:12px;color:#888;">带客人数</div>
                            <div style="font-size:18px;font-weight:bold;color:#2196F3;">${selectedAgent.memberCount}</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:12px;color:#888;">总余额</div>
                            <div style="font-size:18px;font-weight:bold;color:#4CAF50;">${selectedAgent.totalBalance.toFixed(2)}</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:12px;color:#888;">总借款</div>
                            <div style="font-size:18px;font-weight:bold;color:#ff6b6b;">${selectedAgent.totalLoan.toFixed(2)}</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:12px;color:#888;">退水率</div>
                            <div style="font-size:18px;font-weight:bold;color:#ffa726;">${selectedAgent.effectiveRate}%</div>
                        </div>
                    </div>
                ` : ''}
                <table>
                    <thead><tr>
                        <th>ID</th><th>姓名</th><th>手机</th><th>余额</th><th>借款</th>
                    </tr></thead>
                    <tbody id="agentMemberBody">
                        ${selectedAgent ? 
                            (selectedMemberList.length === 0 ? 
                                '<tr class="empty-row"><td colspan="5">该介绍人暂无旗下玩家</td></tr>' :
                                selectedMemberList.map(m => `
                                    <tr>
                                        <td>${m.id}</td>
                                        <td><strong>${m.name}</strong></td>
                                        <td>${m.phone || '-'}</td>
                                        <td style="color:#2196F3;font-weight:bold;">${m.balance.toFixed(2)}</td>
                                        <td style="color:#ff6b6b;">${m.unpaid_loan.toFixed(2)}</td>
                                    </tr>
                                `).join('')
                            )
                        : '<tr class="empty-row"><td colspan="5">请点击「统计」按钮查看介绍人旗下玩家</td></tr>'
                        }
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ============================================================
// 選擇介紹人（點擊統計按鈕時調用）
// ============================================================

function selectAgent(id) {
    // ✅ 檢查查看統計權限
    if (!checkActionPermission('agents', 'view_stats')) {
        showPermissionDenied('查看介紹人統計');
        return;
    }
    
    window._selectedAgentId = id;
    renderAgents(document.getElementById('mainContent'));
}

// ============================================================
// 显示介绍人统计（保留原函數供其他調用）
// ============================================================

function showAgentStats(id) {
    selectAgent(id);
}

// ============================================================
// 新增介绍人
// ============================================================

function showAddAgent() {
    // ✅ 檢查新增權限
    if (!checkActionPermission('agents', 'add')) {
        showPermissionDenied('新增介紹人');
        return;
    }
    
    const members = DB.get('members', []);
    const levels = DB.get('agent_levels', []);
    const agents = DB.get('agents', []);
    const agentIds = agents.map(a => a.id);
    
    const html = `
        <div class="modal-title">👤 新增介绍人</div>
        
        <div style="margin-bottom:15px;padding:10px;background:#e3f2fd;border-radius:6px;font-size:13px;text-align:center;">
            <span style="color:#1565C0;">💡 请输入会员ID或姓名搜索，系统将自动读取会员资料</span>
        </div>
        
        <div style="display:flex;gap:10px;margin-bottom:15px;align-items:center;">
            <input type="text" id="searchMemberInput" placeholder="输入会员ID或姓名" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onkeydown="if(event.key==='Enter') searchMemberForAgent()">
            <button class="btn btn-primary" onclick="searchMemberForAgent()" style="white-space:nowrap;">🔍 搜索</button>
        </div>
        
        <div id="memberSearchResult" style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;text-align:center;color:#999;font-size:14px;border:1px dashed #ddd;">
            请输入会员ID或姓名进行搜索
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>会员ID</label>
                <input type="text" id="newAgentMemberId" readonly style="width:100%;padding:8px 12px;border:1px solid #e0e0e0;border-radius:6px;font-size:14px;background:#f5f5f5;color:#999;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>会员姓名</label>
                <input type="text" id="newAgentMemberName" readonly style="width:100%;padding:8px 12px;border:1px solid #e0e0e0;border-radius:6px;font-size:14px;background:#f5f5f5;color:#999;">
            </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:0;">
                <label>手机</label>
                <input type="text" id="newAgentPhone" readonly style="width:100%;padding:8px 12px;border:1px solid #e0e0e0;border-radius:6px;font-size:14px;background:#f5f5f5;color:#999;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>等级</label>
                <select id="newAgentLevel" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" onchange="updateAgentRateFromLevel()">
                    <option value="">无</option>
                    ${levels.map(l => `<option value="${l.id}" data-rate="${l.rate}">${l.name} (${l.rate}%)</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>退水(%) <span style="color:#999;font-size:12px;">(自动带出)</span></label>
                <input type="number" id="newAgentRate" value="0" step="0.1" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" readonly>
            </div>
        </div>
        
        <div class="form-group">
            <label>备注</label>
            <input type="text" id="newAgentRemark" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;" placeholder="请输入备注">
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAddAgent()">确认新增</button>
        </div>
    `;
    showModal(html);
    
    window.updateAgentRateFromLevel = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const levelSelect = overlay.querySelector('#newAgentLevel');
        const rateInput = overlay.querySelector('#newAgentRate');
        const selectedOption = levelSelect.options[levelSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            const rate = parseFloat(selectedOption.dataset.rate) || 0;
            rateInput.value = rate;
        } else {
            rateInput.value = 0;
        }
    };
    
    window.searchMemberForAgent = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        
        const searchInput = overlay.querySelector('#searchMemberInput');
        const resultDiv = overlay.querySelector('#memberSearchResult');
        const memberIdInput = overlay.querySelector('#newAgentMemberId');
        const memberNameInput = overlay.querySelector('#newAgentMemberName');
        const phoneInput = overlay.querySelector('#newAgentPhone');
        
        const keyword = searchInput.value.trim();
        if (!keyword) {
            resultDiv.innerHTML = '⚠️ 请输入会员ID或姓名';
            resultDiv.style.color = '#ff6b6b';
            return;
        }
        
        const members = DB.get('members', []);
        const agents = DB.get('agents', []);
        const agentIds = agents.map(a => a.id);
        
        let foundMember = null;
        
        if (!isNaN(parseInt(keyword))) {
            foundMember = members.find(m => m.id === parseInt(keyword));
        }
        
        if (!foundMember) {
            const matches = members.filter(m => m.name.includes(keyword));
            if (matches.length === 1) {
                foundMember = matches[0];
            } else if (matches.length > 1) {
                resultDiv.innerHTML = `⚠️ 找到 ${matches.length} 位会员，请更精确输入<br>${matches.map(m => `${m.id}. ${m.name}`).join('、')}`;
                resultDiv.style.color = '#ffa726';
                return;
            }
        }
        
        if (!foundMember) {
            resultDiv.innerHTML = '❌ 找不到该会员，请确认ID或姓名是否正确';
            resultDiv.style.color = '#ff6b6b';
            memberIdInput.value = '';
            memberNameInput.value = '';
            phoneInput.value = '';
            return;
        }
        
        if (agentIds.includes(foundMember.id)) {
            resultDiv.innerHTML = `⚠️ 会员 ${foundMember.name} (ID: ${foundMember.id}) 已经是介绍人`;
            resultDiv.style.color = '#ff6b6b';
            memberIdInput.value = foundMember.id;
            memberNameInput.value = foundMember.name;
            phoneInput.value = foundMember.phone || '';
            return;
        }
        
        resultDiv.innerHTML = `✅ 找到会员：<strong>${foundMember.name}</strong> (ID: ${foundMember.id})`;
        resultDiv.style.color = '#4CAF50';
        memberIdInput.value = foundMember.id;
        memberNameInput.value = foundMember.name;
        phoneInput.value = foundMember.phone || '';
    };
}

function submitAddAgent() {
    const overlay = document.querySelector('.modal-overlay');
    const memberIdInput = overlay.querySelector('#newAgentMemberId');
    const memberNameInput = overlay.querySelector('#newAgentMemberName');
    const phoneInput = overlay.querySelector('#newAgentPhone');
    const rateInput = overlay.querySelector('#newAgentRate');
    const levelSelect = overlay.querySelector('#newAgentLevel');
    const remarkInput = overlay.querySelector('#newAgentRemark');
    
    const memberId = parseInt(memberIdInput.value);
    const memberName = memberNameInput.value.trim();
    
    if (!memberId || !memberName) {
        alert('请先搜索并选择一位会员');
        return;
    }
    
    const member = getMember(memberId);
    if (!member) {
        alert('会员不存在，请重新搜索');
        return;
    }
    
    const agents = DB.get('agents', []);
    if (agents.find(a => a.id === memberId)) {
        alert(`会员 ${memberName} 已经是介绍人`);
        return;
    }
    
    const rate = parseFloat(rateInput.value) || 0;
    const levelId = parseInt(levelSelect.value) || null;
    const remark = remarkInput.value.trim() || `由会员 ${memberName} (ID: ${memberId}) 新增为介绍人`;
    
    agents.push({
        id: memberId,
        name: memberName,
        phone: phoneInput.value.trim() || member.phone || '',
        rebate_rate: rate,
        level_id: levelId,
        remark: remark,
        created_at: now()
    });
    DB.set('agents', agents);
    
    const members = DB.get('members', []);
    const m = members.find(x => x.id === memberId);
    if (m) {
        m.intermediary_id = memberId;
        DB.set('members', members);
    }
    
    addOperationLog('介绍人', '新增', memberName, 
        `新增介绍人：${memberName} (ID: ${memberId}) - 退水率：${rate}%${levelId ? ' - 等级：' + (DB.get('agent_levels', []).find(l => l.id === levelId)?.name || '') : ''}`, memberId);
    
    overlay.remove();
    renderAgents(document.getElementById('mainContent'));
    alert(`✅ 介绍人已新增！\n介绍人ID：${memberId}\n姓名：${memberName}\n退水率：${rate}%\n📌 原会员仍保留，同时具有介绍人身份`);
}

// ============================================================
// 修改介绍人
// ============================================================

function showEditAgent(id) {
    // ✅ 檢查修改權限
    if (!checkActionPermission('agents', 'edit')) {
        showPermissionDenied('修改介紹人');
        return;
    }
    
    const agent = getAgent(id);
    if (!agent) return;
    const levels = DB.get('agent_levels', []);
    
    const html = `
        <div class="modal-title">✏️ 修改介绍人 - ${agent.name}</div>
        <div class="form-group"><label>姓名</label><input type="text" id="editAgentName" value="${agent.name}"></div>
        <div class="form-group"><label>手机</label><input type="text" id="editAgentPhone" value="${agent.phone || ''}"></div>
        <div class="form-group">
            <label>等级</label>
            <select id="editAgentLevel" onchange="updateEditAgentRateFromLevel()">
                <option value="">无</option>
                ${levels.map(l => `<option value="${l.id}" data-rate="${l.rate}" ${l.id === agent.level_id ? 'selected' : ''}>${l.name} (${l.rate}%)</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>退水(%) <span style="color:#999;font-size:12px;">(自动带出)</span></label>
            <input type="number" id="editAgentRate" value="${agent.rebate_rate || 0}" step="0.1" readonly style="background:#f5f5f5;">
        </div>
        <div class="form-group"><label>备注</label><input type="text" id="editAgentRemark" value="${agent.remark || ''}"></div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;color:#e65100;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            💡 退水率由等级自动决定，修改等级将自动更新退水率
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitEditAgent(${id})">确认修改</button>
        </div>
    `;
    showModal(html);
    
    window.updateEditAgentRateFromLevel = function() {
        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;
        const levelSelect = overlay.querySelector('#editAgentLevel');
        const rateInput = overlay.querySelector('#editAgentRate');
        const selectedOption = levelSelect.options[levelSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            const rate = parseFloat(selectedOption.dataset.rate) || 0;
            rateInput.value = rate;
        } else {
            rateInput.value = 0;
        }
    };
    
    setTimeout(() => {
        if (window.updateEditAgentRateFromLevel) window.updateEditAgentRateFromLevel();
    }, 50);
}

function submitEditAgent(id) {
    const overlay = document.querySelector('.modal-overlay');
    const agents = DB.get('agents', []);
    const a = agents.find(x => x.id === id);
    if (a) {
        const beforeData = { ...a };
        const oldName = a.name;
        const oldRate = a.rebate_rate;
        const oldLevelId = a.level_id;
        
        a.name = overlay.querySelector('#editAgentName').value.trim();
        a.phone = overlay.querySelector('#editAgentPhone').value.trim();
        a.level_id = parseInt(overlay.querySelector('#editAgentLevel').value) || null;
        
        const levelSelect = overlay.querySelector('#editAgentLevel');
        const selectedOption = levelSelect.options[levelSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            a.rebate_rate = parseFloat(selectedOption.dataset.rate) || 0;
        } else {
            a.rebate_rate = 0;
        }
        a.remark = overlay.querySelector('#editAgentRemark').value.trim();
        DB.set('agents', agents);
        
        let changes = [];
        if (a.name !== oldName) changes.push(`姓名：${oldName} → ${a.name}`);
        if (a.rebate_rate !== oldRate) changes.push(`退水率：${oldRate}% → ${a.rebate_rate}%`);
        if (a.level_id !== oldLevelId) {
            const oldLevel = DB.get('agent_levels', []).find(l => l.id === oldLevelId);
            const newLevel = DB.get('agent_levels', []).find(l => l.id === a.level_id);
            changes.push(`等级：${oldLevel?.name || '無'} → ${newLevel?.name || '無'}`);
        }
        
        addOperationLog('介绍人', '修改', a.name, 
            `修改介绍人：${a.name} (ID: ${id}) - ${changes.join('；')}`, id, beforeData, a);
    }
    overlay.remove();
    renderAgents(document.getElementById('mainContent'));
    alert('✅ 介绍人已更新');
}

// ============================================================
// 删除介绍人
// ============================================================

function deleteAgent(id) {
    // ✅ 檢查刪除權限
    if (!checkActionPermission('agents', 'delete')) {
        showPermissionDenied('刪除介紹人');
        return;
    }
    
    const agent = getAgent(id);
    if (!agent) return;
    if (!confirm(`确定要删除介绍人「${agent.name}」吗？`)) return;
    
    const agents = DB.get('agents', []).filter(a => a.id !== id);
    DB.set('agents', agents);
    
    const members = DB.get('members', []);
    members.forEach(m => {
        if (m.intermediary_id === id) m.intermediary_id = null;
    });
    DB.set('members', members);
    
    addOperationLog('介绍人', '删除', agent.name, `删除介绍人：${agent.name} (ID: ${id})`, id, agent, null);
    
    if (window._selectedAgentId === id) {
        window._selectedAgentId = null;
    }
    
    renderAgents(document.getElementById('mainContent'));
    alert('✅ 介绍人已删除');
}

// ============================================================
// 介紹人等級相關函數（已有操作紀錄）
// ============================================================

function addAgentLevel(name, rate) {
    const levels = DB.get('agent_levels', []);
    const newLevel = { id: DB.getNextId('agent_levels'), name: name, rate: rate };
    levels.push(newLevel);
    DB.set('agent_levels', levels);
    
    addOperationLog('介绍人等级', '新增', name, `新增介绍人等级：${name} (退水 ${rate}%)`, newLevel.id);
    
    return true;
}

function updateAgentLevel(id, name, rate) {
    const levels = DB.get('agent_levels', []);
    const l = levels.find(x => x.id === id);
    if (!l) return false;
    
    const beforeData = { ...l };
    l.name = name;
    l.rate = rate;
    DB.set('agent_levels', levels);
    
    addOperationLog('介绍人等级', '修改', name, `修改介绍人等级：${name} (退水 ${rate}%)`, id, beforeData, l);
    
    return true;
}

function deleteAgentLevel(id) {
    const levels = DB.get('agent_levels', []);
    const l = levels.find(x => x.id === id);
    if (!l) return false;
    
    const levelName = l.name;
    const newLevels = levels.filter(l => l.id !== id);
    DB.set('agent_levels', newLevels);
    
    addOperationLog('介绍人等级', '删除', levelName, `删除介绍人等级：${levelName}`, id, l, null);
    
    return true;
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
// 權限檢查函數暴露（確保 router.js 可用）
// ============================================================

// 確保 checkActionPermission 和 showPermissionDenied 可用
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