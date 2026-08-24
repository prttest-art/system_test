// ============================================================
// 资料备份（完整版 - 含权限控制）
// ============================================================

// ============================================================
// 渲染资料备份页面 - 含权限检查
// ============================================================

function renderBackup(el) {
    // ✅ 检查浏览权限
    if (!checkActionPermission('backup', 'view')) {
        el.innerHTML = `
            <div class="page-header">
                <h1>💾 资料备份</h1>
                <p class="breadcrumb">系统设置 > 资料备份</p>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;color:#ff6b6b;font-size:16px;">
                <div style="font-size:48px;margin-bottom:15px;">⛔</div>
                <h2 style="color:#ff6b6b;">权限不足</h2>
                <p style="color:#999;font-size:14px;margin-top:10px;">您没有浏览「资料备份」的权限</p>
            </div>
        `;
        return;
    }
    
    // ✅ 检查各操作权限
    const canBackup = checkActionPermission('backup', 'backup');
    const canUpload = checkActionPermission('backup', 'upload');
    const canRestore = checkActionPermission('backup', 'restore');
    const canDelete = checkActionPermission('backup', 'delete');
    
    // 获取备份文件列表
    const backupFiles = getBackupFileList();
    
    // 计算数据统计
    const stats = getDataStats();
    
    // 构建备份文件列表HTML
    let fileListHtml = '';
    if (backupFiles.length === 0) {
        fileListHtml = `
            <tr class="empty-row">
                <td colspan="6" style="text-align:center;padding:30px;color:#999;">
                    📭 暂无备份文件
                </td>
            </tr>
        `;
    } else {
        fileListHtml = backupFiles.map((file, index) => {
            const fileSize = formatFileSize(file.size);
            const isCurrent = file.isCurrent || false;
            
            return `
                <tr style="${isCurrent ? 'background:#e8f5e9;' : ''}">
                    <td style="text-align:center;">${index + 1}</td>
                    <td style="text-align:center;">
                        <strong>${file.name}</strong>
                        ${isCurrent ? '<span class="badge badge-success" style="margin-left:8px;">当前</span>' : ''}
                    </td>
                    <td style="text-align:center;font-size:12px;color:#666;">${fileSize}</td>
                    <td style="text-align:center;font-size:12px;color:#666;">${formatDate(file.created_at)}</td>
                    <td style="text-align:center;font-size:12px;color:#666;">${file.admin_name || '系统'}</td>
                    <td style="text-align:center;">
                        <div class="btn-group" style="justify-content:center;flex-wrap:wrap;">
                            ${canRestore ? `<button class="btn btn-success btn-sm" onclick="restoreBackup('${file.id}')">🔄 还原</button>` : ''}
                            ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteBackup('${file.id}')">🗑️ 删除</button>` : ''}
                            <button class="btn btn-info btn-sm" onclick="downloadBackup('${file.id}')">📥 下载</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // 计算备份数量
    const totalBackups = backupFiles.length;
    const totalSize = backupFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSizeDisplay = formatFileSize(totalSize);
    
    el.innerHTML = `
        <div class="page-header">
            <h1>💾 资料备份</h1>
            <p class="breadcrumb">系统设置 > 资料备份</p>
        </div>
        
        <!-- 统计卡片 -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
            <div class="stat-card" style="border-left:4px solid #2196F3;">
                <div class="stat-label">📊 备份总数</div>
                <div class="stat-value" style="color:#2196F3;">${totalBackups}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #4CAF50;">
                <div class="stat-label">💾 总大小</div>
                <div class="stat-value" style="color:#4CAF50;">${totalSizeDisplay}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ffa726;">
                <div class="stat-label">👤 会员数</div>
                <div class="stat-value" style="color:#ffa726;">${stats.members}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #26c6da;">
                <div class="stat-label">📋 数据表</div>
                <div class="stat-value" style="color:#26c6da;">${stats.tables}</div>
            </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="toolbar">
            <div class="search-box">
                ${canBackup ? `<button class="btn btn-primary" onclick="createBackup()">📦 立即备份</button>` : ''}
                ${canUpload ? `<button class="btn btn-success" onclick="showUploadBackup()">📤 上传备份</button>` : ''}
                <span style="font-size:12px;color:#999;margin-left:5px;">
                    💡 备份文件存储在浏览器本地 (localStorage)
                </span>
            </div>
            <button class="btn" onclick="renderBackup(document.getElementById('mainContent'))">🔄 刷新</button>
        </div>
        
        <!-- 操作说明 -->
        <div style="background:#e3f2fd;border-radius:8px;padding:12px 15px;margin-bottom:15px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px;color:#1565C0;">
            <span>💡 <strong>备份说明：</strong></span>
            <span>• 备份包含：会员、介绍人、员工、台桌记录、交易流水、保险、小费、兑汇等所有数据</span>
            <span>• 备份文件为 JSON 格式，可下载保存到本地</span>
            <span>• 上传备份可还原系统数据（会覆盖当前数据）</span>
        </div>
        
        <!-- 备份文件列表 -->
        <div class="table-container">
            <h3 style="padding:12px 15px;margin:0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                <span>📋 备份文件列表</span>
                <span style="font-size:12px;color:#999;font-weight:normal;">
                    共 ${totalBackups} 个文件 | 总大小 ${totalSizeDisplay}
                </span>
            </h3>
            <table>
                <thead>
                    <tr>
                        <th style="text-align:center;width:50px;">#</th>
                        <th style="text-align:center;min-width:200px;">文件名</th>
                        <th style="text-align:center;min-width:100px;">大小</th>
                        <th style="text-align:center;min-width:160px;">备份时间</th>
                        <th style="text-align:center;min-width:100px;">操作人</th>
                        <th style="text-align:center;min-width:250px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${fileListHtml}
                </tbody>
            </table>
        </div>
        
        <!-- 数据统计详情 -->
        <div style="margin-top:15px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;padding:15px;background:#fff;border-radius:10px;border:1px solid #eee;">
            <h4 style="grid-column:1/-1;margin:0;font-size:14px;color:#555;">📊 当前数据统计</h4>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">会员</div>
                <div style="font-size:20px;font-weight:bold;color:#2196F3;">${stats.members}</div>
            </div>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">介绍人</div>
                <div style="font-size:20px;font-weight:bold;color:#4CAF50;">${stats.agents}</div>
            </div>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">员工</div>
                <div style="font-size:20px;font-weight:bold;color:#ffa726;">${stats.employees}</div>
            </div>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">台桌会话</div>
                <div style="font-size:20px;font-weight:bold;color:#26c6da;">${stats.sessions}</div>
            </div>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">交易记录</div>
                <div style="font-size:20px;font-weight:bold;color:#e65100;">${stats.transactions}</div>
            </div>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">保险记录</div>
                <div style="font-size:20px;font-weight:bold;color:#0d47a1;">${stats.insurance}</div>
            </div>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">小费记录</div>
                <div style="font-size:20px;font-weight:bold;color:#ffa726;">${stats.tips}</div>
            </div>
            <div style="text-align:center;padding:8px;background:#f8f9fc;border-radius:6px;">
                <div style="font-size:11px;color:#888;">操作日志</div>
                <div style="font-size:20px;font-weight:bold;color:#ab47bc;">${stats.operation_logs}</div>
            </div>
        </div>
    `;
}

// ============================================================
// 获取数据统计
// ============================================================

function getDataStats() {
    return {
        members: DB.get('members', []).length,
        agents: DB.get('agents', []).length,
        employees: DB.get('employees', []).length,
        sessions: DB.get('sessions', []).length,
        transactions: DB.get('transactions', []).length,
        insurance: DB.get('insurance_records', []).length,
        tips: DB.get('tips_records', []).length,
        operation_logs: DB.get('operation_logs', []).length,
        tables: 8 // 数据表数量
    };
}

// ============================================================
// 获取备份文件列表
// ============================================================

function getBackupFileList() {
    const files = DB.get('backup_files', []);
    // 按时间倒序排列
    files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return files;
}

// ============================================================
// 格式化文件大小
// ============================================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================
// 创建备份（含权限检查）
// ============================================================

function createBackup() {
    if (!checkActionPermission('backup', 'backup')) {
        showPermissionDenied('创建备份');
        return;
    }
    
    if (!confirm('确定要创建当前系统数据的完整备份吗？')) {
        return;
    }
    
    const adminName = getCurrentAdminName();
    const adminId = getCurrentAdminId();
    const nowTime = now();
    const timestamp = nowTime.replace(/[-: ]/g, '').slice(0, 14);
    const fileName = `RPT_Backup_${timestamp}.json`;
    
    try {
        // 收集所有数据
        const backupData = {
            version: '1.0',
            created_at: nowTime,
            admin_name: adminName,
            admin_id: adminId,
            data: {
                admins: DB.get('admins', []),
                currencies: DB.get('currencies', []),
                agent_levels: DB.get('agent_levels', []),
                members: DB.get('members', []),
                agents: DB.get('agents', []),
                accounts: DB.get('accounts', []),
                member_accounts: DB.get('member_accounts', []),
                member_account_transactions: DB.get('member_account_transactions', []),
                sessions: DB.get('sessions', []),
                transactions: DB.get('transactions', []),
                water_records: DB.get('water_records', []),
                daily_settlements: DB.get('daily_settlements', []),
                up_records: DB.get('up_records', []),
                down_records: DB.get('down_records', []),
                recharge_records: DB.get('recharge_records', []),
                withdraw_records: DB.get('withdraw_records', []),
                account_transactions: DB.get('account_transactions', []),
                insurance_records: DB.get('insurance_records', []),
                exchange_records: DB.get('exchange_records', []),
                tips_records: DB.get('tips_records', []),
                attendance_records: DB.get('attendance_records', []),
                attendance_settings: DB.get('attendance_settings', {}),
                expense_records: DB.get('expense_records', []),
                agent_stay_records: DB.get('agent_stay_records', []),
                salary_records: DB.get('salary_records', []),
                employees: DB.get('employees', []),
                departments: DB.get('departments', []),
                positions: DB.get('positions', []),
                operation_logs: DB.get('operation_logs', []),
                backup_files: DB.get('backup_files', [])
            }
        };
        
        // 计算数据大小
        const jsonStr = JSON.stringify(backupData);
        const size = new Blob([jsonStr]).size;
        
        // 保存备份文件信息
        const backupFiles = DB.get('backup_files', []);
        const fileId = 'backup_' + Date.now();
        
        // 将备份数据存储到 localStorage（为了跨页面访问）
        localStorage.setItem('rpt_backup_data_' + fileId, jsonStr);
        
        backupFiles.push({
            id: fileId,
            name: fileName,
            size: size,
            created_at: nowTime,
            admin_name: adminName,
            admin_id: adminId,
            isCurrent: true
        });
        
        // 标记之前的备份为非当前
        backupFiles.forEach(f => {
            if (f.id !== fileId) {
                f.isCurrent = false;
            }
        });
        
        DB.set('backup_files', backupFiles);
        
        // 记录操作日志
        addOperationLog('资料备份', '备份', '系统数据', 
            `创建备份：${fileName} (${formatFileSize(size)})`, null, null, { fileName, size });
        
        renderBackup(document.getElementById('mainContent'));
        alert(`✅ 备份创建成功！\n\n文件名：${fileName}\n大小：${formatFileSize(size)}\n操作人：${adminName}`);
        
    } catch(e) {
        console.error('备份失败:', e);
        alert('❌ 备份失败：' + e.message);
    }
}

// ============================================================
// 下载备份（含权限检查）
// ============================================================

function downloadBackup(fileId) {
    if (!checkActionPermission('backup', 'view')) {
        showPermissionDenied('下载备份');
        return;
    }
    
    const backupFiles = DB.get('backup_files', []);
    const file = backupFiles.find(f => f.id === fileId);
    if (!file) {
        alert('找不到备份文件');
        return;
    }
    
    try {
        const jsonStr = localStorage.getItem('rpt_backup_data_' + fileId);
        if (!jsonStr) {
            alert('备份数据已丢失，请重新创建备份');
            return;
        }
        
        // 创建下载链接
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addOperationLog('资料备份', '下载', file.name, `下载备份：${file.name}`, null, null, { fileName: file.name });
        
    } catch(e) {
        console.error('下载失败:', e);
        alert('❌ 下载失败：' + e.message);
    }
}

// ============================================================
// 删除备份（含权限检查）
// ============================================================

function deleteBackup(fileId) {
    if (!checkActionPermission('backup', 'delete')) {
        showPermissionDenied('删除备份');
        return;
    }
    
    const backupFiles = DB.get('backup_files', []);
    const file = backupFiles.find(f => f.id === fileId);
    if (!file) {
        alert('找不到备份文件');
        return;
    }
    
    if (!confirm(`确定要删除备份「${file.name}」吗？\n（此操作不可恢复）`)) {
        return;
    }
    
    try {
        // 删除备份数据
        localStorage.removeItem('rpt_backup_data_' + fileId);
        
        // 从列表中移除
        const newFiles = backupFiles.filter(f => f.id !== fileId);
        DB.set('backup_files', newFiles);
        
        addOperationLog('资料备份', '删除', file.name, `删除备份：${file.name}`, null, null, { fileName: file.name });
        
        renderBackup(document.getElementById('mainContent'));
        alert('✅ 备份已删除');
        
    } catch(e) {
        console.error('删除失败:', e);
        alert('❌ 删除失败：' + e.message);
    }
}

// ============================================================
// 还原备份（含权限检查）
// ============================================================

function restoreBackup(fileId) {
    if (!checkActionPermission('backup', 'restore')) {
        showPermissionDenied('还原备份');
        return;
    }
    
    const backupFiles = DB.get('backup_files', []);
    const file = backupFiles.find(f => f.id === fileId);
    if (!file) {
        alert('找不到备份文件');
        return;
    }
    
    if (!confirm(`⚠️ 确定要还原备份「${file.name}」吗？\n\n这将覆盖当前所有数据，此操作不可恢复！\n\n建议先创建当前数据的备份。`)) {
        return;
    }
    
    if (!confirm(`⚠️ 再次确认：还原备份将覆盖所有现有数据！`)) {
        return;
    }
    
    try {
        const jsonStr = localStorage.getItem('rpt_backup_data_' + fileId);
        if (!jsonStr) {
            alert('备份数据已丢失');
            return;
        }
        
        const backupData = JSON.parse(jsonStr);
        
        // 验证备份数据格式
        if (!backupData.data || typeof backupData.data !== 'object') {
            alert('备份文件格式无效');
            return;
        }
        
        // 还原数据
        const data = backupData.data;
        
        // 保存所有数据（保留备份文件列表和当前备份记录）
        const currentBackupFiles = DB.get('backup_files', []);
        
        Object.keys(data).forEach(key => {
            if (key !== 'backup_files') {
                DB.set(key, data[key]);
            }
        });
        
        // 保留备份文件列表，但标记所有为已还原
        currentBackupFiles.forEach(f => {
            f.isCurrent = false;
            if (f.id === fileId) {
                f.isCurrent = true;
            }
        });
        DB.set('backup_files', currentBackupFiles);
        
        // 记录操作日志
        addOperationLog('资料备份', '还原', file.name, 
            `还原备份：${file.name} - 备份时间：${file.created_at}`, null, null, { fileName: file.name, restoredAt: now() });
        
        // 重新加载页面
        alert(`✅ 备份还原成功！\n\n文件名：${file.name}\n备份时间：${file.created_at}\n\n页面将重新加载以应用数据。`);
        
        // 强制刷新页面
        setTimeout(() => {
            location.reload();
        }, 1000);
        
    } catch(e) {
        console.error('还原失败:', e);
        alert('❌ 还原失败：' + e.message);
    }
}

// ============================================================
// 显示上传备份对话框（含权限检查）
// ============================================================

function showUploadBackup() {
    if (!checkActionPermission('backup', 'upload')) {
        showPermissionDenied('上传备份');
        return;
    }
    
    const html = `
        <div class="modal-title" style="font-size:20px;">📤 上传备份</div>
        
        <div style="margin-bottom:15px;padding:12px;background:#fff3e0;border-radius:8px;border:1px solid #ffcc80;text-align:center;">
            <span style="color:#e65100;">⚠️ 上传备份将覆盖当前所有数据，请谨慎操作！</span>
        </div>
        
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 请选择之前导出的 JSON 备份文件</span>
        </div>
        
        <div class="form-group">
            <label>选择备份文件 *</label>
            <input type="file" id="backupFileInput" accept=".json" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
            <div style="font-size:12px;color:#999;margin-top:4px;">仅支持 .json 格式的备份文件</div>
        </div>
        
        <div id="uploadPreview" style="display:none;margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;border:1px solid #eee;">
            <div style="font-size:13px;color:#666;">
                <strong>文件信息：</strong><br>
                <span id="uploadFileName">-</span><br>
                <span id="uploadFileSize">-</span><br>
                <span id="uploadFileDate">-</span>
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-success" onclick="submitUploadBackup()">📤 确认上传</button>
        </div>
    `;
    showModal(html);
    
    // 文件选择预览
    const fileInput = document.getElementById('backupFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const previewDiv = document.getElementById('uploadPreview');
            const fileNameSpan = document.getElementById('uploadFileName');
            const fileSizeSpan = document.getElementById('uploadFileSize');
            const fileDateSpan = document.getElementById('uploadFileDate');
            
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                previewDiv.style.display = 'block';
                fileNameSpan.textContent = '📄 文件名：' + file.name;
                fileSizeSpan.textContent = '💾 大小：' + formatFileSize(file.size);
                
                // 尝试读取文件获取备份时间
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = JSON.parse(e.target.result);
                        if (data.created_at) {
                            fileDateSpan.textContent = '📅 备份时间：' + formatDate(data.created_at);
                        } else {
                            fileDateSpan.textContent = '📅 备份时间：未知';
                        }
                    } catch(err) {
                        fileDateSpan.textContent = '📅 备份时间：无法解析';
                    }
                };
                reader.readAsText(file);
            } else {
                previewDiv.style.display = 'none';
            }
        });
    }
}

// ============================================================
// 提交上传备份
// ============================================================

function submitUploadBackup() {
    const fileInput = document.getElementById('backupFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('请选择备份文件');
        return;
    }
    
    const file = fileInput.files[0];
    
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('请上传 JSON 格式的备份文件');
        return;
    }
    
    if (!confirm(`⚠️ 确定要上传并还原备份「${file.name}」吗？\n\n这将覆盖当前所有数据，此操作不可恢复！`)) {
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            // 验证备份数据格式
            if (!backupData.data || typeof backupData.data !== 'object') {
                alert('备份文件格式无效');
                return;
            }
            
            const adminName = getCurrentAdminName();
            const adminId = getCurrentAdminId();
            const nowTime = now();
            
            // 保存当前备份文件列表
            const currentBackupFiles = DB.get('backup_files', []);
            
            // 还原数据
            const data = backupData.data;
            Object.keys(data).forEach(key => {
                if (key !== 'backup_files') {
                    DB.set(key, data[key]);
                }
            });
            
            // 将上传的文件添加到备份列表
            const fileId = 'upload_' + Date.now();
            const timestamp = nowTime.replace(/[-: ]/g, '').slice(0, 14);
            const fileName = `RPT_Upload_${timestamp}.json`;
            
            // 保存上传的备份数据
            localStorage.setItem('rpt_backup_data_' + fileId, JSON.stringify(backupData));
            
            currentBackupFiles.push({
                id: fileId,
                name: fileName,
                size: file.size,
                created_at: nowTime,
                admin_name: adminName,
                admin_id: adminId,
                isCurrent: true,
                isUploaded: true,
                original_name: file.name
            });
            
            // 标记之前的备份为非当前
            currentBackupFiles.forEach(f => {
                if (f.id !== fileId) {
                    f.isCurrent = false;
                }
            });
            
            DB.set('backup_files', currentBackupFiles);
            
            // 记录操作日志
            addOperationLog('资料备份', '上传', file.name, 
                `上传并还原备份：${file.name} (${formatFileSize(file.size)})`, null, null, { fileName: file.name, size: file.size });
            
            // 关闭弹窗
            const overlay = document.querySelector('.modal-overlay');
            if (overlay) overlay.remove();
            
            alert(`✅ 备份上传并还原成功！\n\n文件名：${file.name}\n大小：${formatFileSize(file.size)}\n操作人：${adminName}\n\n页面将重新加载以应用数据。`);
            
            setTimeout(() => {
                location.reload();
            }, 1000);
            
        } catch(err) {
            console.error('上传失败:', err);
            alert('❌ 上传失败：' + err.message);
        }
    };
    
    reader.onerror = function() {
        alert('❌ 读取文件失败，请重试');
    };
    
    reader.readAsText(file);
}

// ============================================================
// 暴露函数到全局
// ============================================================

window.renderBackup = renderBackup;
window.createBackup = createBackup;
window.downloadBackup = downloadBackup;
window.deleteBackup = deleteBackup;
window.restoreBackup = restoreBackup;
window.showUploadBackup = showUploadBackup;
window.submitUploadBackup = submitUploadBackup;
window.getBackupFileList = getBackupFileList;
window.getDataStats = getDataStats;
window.formatFileSize = formatFileSize;