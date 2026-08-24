// ============================================================
// 11. 员工出勤管理（完整版 - 含月统计 + 操作日志 + 寬版固定欄位 + 完整權限控制）
// ============================================================

// 初始化出勤记录存储
function initAttendanceRecords() {
    if (!localStorage.getItem('rpt_attendance_records')) {
        DB.set('attendance_records', []);
        DB.set('attendance_records_next', 1);
    }
    if (!localStorage.getItem('rpt_attendance_settings')) {
        DB.set('attendance_settings', {
            work_start_time: '09:00',
            work_end_time: '18:00',
            late_threshold: 15
        });
    }
}

/**
 * 获取员工出勤记录
 * @param {number} employeeId - 员工ID（可选，不传则返回所有）
 * @param {string} date - 日期（可选）
 */
function getAttendanceRecords(employeeId, date) {
    initAttendanceRecords();
    let records = DB.get('attendance_records', []);
    
    if (employeeId) {
        records = records.filter(r => r.employee_id === employeeId);
    }
    if (date) {
        records = records.filter(r => r.date === date);
    }
    
    records.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.check_in_time || '').localeCompare(a.check_in_time || '');
    });
    
    return records;
}

/**
 * 获取某日所有员工的出勤状态
 */
function getDailyAttendance(date) {
    initAttendanceRecords();
    const employees = DB.get('employees', []);
    const records = getAttendanceRecords(null, date);
    const settings = DB.get('attendance_settings', { work_start_time: '09:00', late_threshold: 15 });
    
    const result = {};
    employees.forEach(emp => {
        const record = records.find(r => r.employee_id === emp.id);
        if (record) {
            result[emp.id] = {
                employee: emp,
                record: record,
                status: record.status,
                check_in_time: record.check_in_time,
                check_out_time: record.check_out_time,
                work_duration: record.work_duration,
                is_late: record.is_late || false,
                note: record.note || ''
            };
        } else {
            result[emp.id] = {
                employee: emp,
                record: null,
                status: '未到班',
                check_in_time: null,
                check_out_time: null,
                work_duration: null,
                is_late: false,
                note: ''
            };
        }
    });
    
    return result;
}

/**
 * 员工到班（签到）
 */
function employeeCheckIn(employeeId, date, time, note) {
    initAttendanceRecords();
    const records = DB.get('attendance_records', []);
    const settings = DB.get('attendance_settings', { work_start_time: '09:00', late_threshold: 15 });
    
    const existing = records.find(r => r.employee_id === employeeId && r.date === date);
    if (existing && existing.status !== '休假' && existing.status !== '请假') {
        return { success: false, message: '该员工今天已有出勤记录' };
    }
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) {
        return { success: false, message: '员工不存在' };
    }
    
    const workStart = settings.work_start_time || '09:00';
    const [startHour, startMinute] = workStart.split(':').map(Number);
    const [checkHour, checkMinute] = time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const checkMinutes = checkHour * 60 + checkMinute;
    const isLate = checkMinutes - startMinutes > (settings.late_threshold || 15);
    
    const record = {
        id: DB.getNextId('attendance_records'),
        employee_id: employeeId,
        employee_name: employee.name,
        date: date,
        check_in_time: time,
        check_out_time: null,
        status: isLate ? '迟到' : '已到班',
        is_late: isLate,
        work_duration: null,
        note: note || '',
        created_at: now(),
        updated_at: now()
    };
    
    if (existing) {
        const index = records.indexOf(existing);
        records[index] = { ...records[index], ...record, id: records[index].id };
        DB.set('attendance_records', records);
        
        addOperationLog('员工出勤', '到班', employee.name, 
            `${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, employeeId);
        
        return { success: true, message: `✅ ${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, record: records[index] };
    } else {
        records.push(record);
        DB.set('attendance_records', records);
        
        addOperationLog('员工出勤', '到班', employee.name, 
            `${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, employeeId);
        
        return { success: true, message: `✅ ${employee.name} 到班成功！${isLate ? ' (迟到)' : ''}`, record: record };
    }
}

/**
 * 员工下班（签退）
 */
function employeeCheckOut(employeeId, date, time, note) {
    initAttendanceRecords();
    const records = DB.get('attendance_records', []);
    const settings = DB.get('attendance_settings', { work_end_time: '18:00' });
    
    const record = records.find(r => r.employee_id === employeeId && r.date === date);
    if (!record) {
        return { success: false, message: '该员工今天没有到班记录' };
    }
    if (record.check_out_time) {
        return { success: false, message: '该员工今天已签退' };
    }
    if (record.status === '休假' || record.status === '请假') {
        return { success: false, message: '该员工今天为休假/请假状态，无需签退' };
    }
    
    const [inHour, inMinute] = record.check_in_time.split(':').map(Number);
    const [outHour, outMinute] = time.split(':').map(Number);
    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;
    let durationMinutes = outMinutes - inMinutes;
    if (durationMinutes < 0) durationMinutes += 1440;
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const durationStr = `${hours}时${minutes}分`;
    
    const beforeData = { ...record };
    record.check_out_time = time;
    record.work_duration = durationStr;
    record.duration_minutes = durationMinutes;
    record.status = '已签退';
    record.updated_at = now();
    if (note) record.note = (record.note || '') + ' | 签退备注：' + note;
    
    DB.set('attendance_records', records);
    
    addOperationLog('员工出勤', '签退', record.employee_name, 
        `${record.employee_name} 签退成功！工作时长：${durationStr}`, employeeId, beforeData, record);
    
    return { success: true, message: `✅ ${record.employee_name} 签退成功！工作时长：${durationStr}`, record: record };
}

/**
 * 设置员工状态（休假/请假）
 */
function setEmployeeStatus(employeeId, date, status, note) {
    initAttendanceRecords();
    const records = DB.get('attendance_records', []);
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) {
        return { success: false, message: '员工不存在' };
    }
    
    const validStatuses = ['休假', '请假'];
    if (!validStatuses.includes(status)) {
        return { success: false, message: '无效状态' };
    }
    
    const existing = records.find(r => r.employee_id === employeeId && r.date === date);
    if (existing) {
        const beforeData = { ...existing };
        existing.status = status;
        existing.note = note || existing.note || status;
        existing.updated_at = now();
        DB.set('attendance_records', records);
        
        addOperationLog('员工出勤', status, employee.name, 
            `${employee.name} 已设为「${status}」`, employeeId, beforeData, existing);
        
        return { success: true, message: `✅ ${employee.name} 已设为「${status}」`, record: existing };
    } else {
        const record = {
            id: DB.getNextId('attendance_records'),
            employee_id: employeeId,
            employee_name: employee.name,
            date: date,
            check_in_time: null,
            check_out_time: null,
            status: status,
            is_late: false,
            work_duration: null,
            note: note || status,
            created_at: now(),
            updated_at: now()
        };
        records.push(record);
        DB.set('attendance_records', records);
        
        addOperationLog('员工出勤', status, employee.name, 
            `${employee.name} 已设为「${status}」`, employeeId);
        
        return { success: true, message: `✅ ${employee.name} 已设为「${status}」`, record: record };
    }
}

/**
 * 清除员工状态
 */
function clearEmployeeStatus(employeeId, date) {
    initAttendanceRecords();
    const records = DB.get('attendance_records', []);
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) {
        return { success: false, message: '员工不存在' };
    }
    
    const existing = records.find(r => r.employee_id === employeeId && r.date === date);
    if (!existing) {
        return { success: false, message: '该员工当天没有记录' };
    }
    
    const beforeData = { ...existing };
    const filtered = records.filter(r => !(r.employee_id === employeeId && r.date === date));
    DB.set('attendance_records', filtered);
    
    addOperationLog('员工出勤', '清除', employee.name, 
        `${employee.name} 已清除出勤状态`, employeeId, beforeData, null);
    
    return { success: true, message: `✅ ${employee.name} 已清除状态` };
}

// ============================================================
// 月统计功能（寬版 + 固定欄位）
// ============================================================

function getMonthlyAttendance(yearMonth) {
    initAttendanceRecords();
    const employees = DB.get('employees', []);
    const allRecords = DB.get('attendance_records', []);
    
    // 过滤该月的记录
    const monthRecords = allRecords.filter(r => r.date && r.date.startsWith(yearMonth));
    
    // 获取该月的天数
    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = yearMonth + '-' + String(d).padStart(2, '0');
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        days.push({
            date: dateStr,
            day: d,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            dayOfWeek: dayOfWeek
        });
    }
    
    // 统计每个员工的出勤
    const result = employees.map(emp => {
        const empRecords = monthRecords.filter(r => r.employee_id === emp.id);
        const dailyStatus = {};
        let totalDays = 0;
        let presentDays = 0;
        let lateDays = 0;
        let leaveDays = 0;
        let vacationDays = 0;
        let absentDays = 0;
        let totalWorkMinutes = 0;
        
        days.forEach(day => {
            const record = empRecords.find(r => r.date === day.date);
            let status = '未到班';
            if (record) {
                status = record.status;
                if (status === '已到班' || status === '已签退' || status === '迟到') {
                    presentDays++;
                    if (status === '迟到') lateDays++;
                    if (record.duration_minutes) {
                        totalWorkMinutes += record.duration_minutes;
                    }
                } else if (status === '休假') {
                    vacationDays++;
                } else if (status === '请假') {
                    leaveDays++;
                }
                totalDays++;
            } else {
                // 周末不计算为缺席
                if (!day.isWeekend) {
                    absentDays++;
                }
                totalDays++;
            }
            dailyStatus[day.date] = status;
        });
        
        // 计算实际出勤天数（排除周末）
        const workDays = days.filter(d => !d.isWeekend).length;
        const attendanceRate = workDays > 0 ? ((presentDays / workDays) * 100) : 0;
        
        return {
            employee: emp,
            dailyStatus: dailyStatus,
            totalDays: totalDays,
            presentDays: presentDays,
            lateDays: lateDays,
            leaveDays: leaveDays,
            vacationDays: vacationDays,
            absentDays: absentDays,
            attendanceRate: attendanceRate,
            totalWorkHours: Math.floor(totalWorkMinutes / 60),
            totalWorkMinutes: totalWorkMinutes,
            workDays: workDays
        };
    });
    
    return {
        yearMonth: yearMonth,
        days: days,
        employees: result,
        summary: {
            totalEmployees: employees.length,
            totalPresent: result.reduce((sum, r) => sum + r.presentDays, 0),
            totalLate: result.reduce((sum, r) => sum + r.lateDays, 0),
            totalLeave: result.reduce((sum, r) => sum + r.leaveDays, 0),
            totalVacation: result.reduce((sum, r) => sum + r.vacationDays, 0),
            totalAbsent: result.reduce((sum, r) => sum + r.absentDays, 0)
        }
    };
}

// ============================================================
// 月统计弹窗（寬版 - 1.5倍寬度 + 固定欄位）- 含權限檢查
// ============================================================

function showMonthlyAttendance() {
    // ✅ 检查查看月统计权限
    if (!checkActionPermission('attendance', 'view_monthly')) {
        showPermissionDenied('查看月统计');
        return;
    }
    
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    
    const html = `
        <div class="modal-title" style="font-size:20px;">📊 月出勤统计</div>
        <div style="margin-bottom:15px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <span style="font-weight:500;font-size:14px;">📅 月份：</span>
            <input type="month" id="monthlyDate" value="${currentMonth}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
            <button class="btn btn-primary" onclick="renderMonthlyStats()">📊 查询</button>
            <button class="btn" onclick="document.getElementById('monthlyDate').value='${currentMonth}';renderMonthlyStats()">本月</button>
            <span style="font-size:13px;color:#999;margin-left:auto;">点击「查询」查看该月统计</span>
        </div>
        <div id="monthlyStatsContent" style="max-height:600px;overflow:auto;">
            <div style="text-align:center;padding:40px;color:#999;">请选择月份后点击「查询」</div>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    const overlay = showModalWide(html);
    
    window._monthlyStatsOverlay = overlay;
    
    window.renderMonthlyStats = function() {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) {
            showMonthlyAttendance();
            return;
        }
        const monthInput = overlayEl.querySelector('#monthlyDate');
        const contentDiv = overlayEl.querySelector('#monthlyStatsContent');
        if (!monthInput || !contentDiv) return;
        
        const yearMonth = monthInput.value;
        if (!yearMonth) {
            contentDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#ff6b6b;">请选择月份</div>';
            return;
        }
        
        const data = getMonthlyAttendance(yearMonth);
        contentDiv.innerHTML = renderMonthlyStatsContent(data);
    };
    
    setTimeout(() => {
        if (window.renderMonthlyStats) window.renderMonthlyStats();
    }, 100);
}

function renderMonthlyStatsContent(data) {
    if (!data || data.employees.length === 0) {
        return '<div style="text-align:center;padding:40px;color:#999;">该月份暂无员工出勤数据</div>';
    }
    
    const { yearMonth, days, employees, summary } = data;
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    
    // 构建日历头
    let calendarHeader = '<tr>';
    // 員工姓名 - 固定
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:80px;background:#f5f5f5;position:sticky;left:0;z-index:30;border-right:2px solid #999;font-size:12px;">员工</th>`;
    
    // 日期欄位
    days.forEach(day => {
        const isWeekend = day.isWeekend;
        const bgColor = isWeekend ? '#ffebee' : '#f5f5f5';
        calendarHeader += `<th style="padding:4px 4px;border:1px solid #ddd;text-align:center;min-width:32px;background:${bgColor};font-size:11px;white-space:nowrap;">
            ${day.day}<br><span style="font-size:8px;color:#999;">${weekDays[day.dayOfWeek]}</span>
        </th>`;
    });
    
    // ===== 右側固定欄位（出勤率 + 統計） =====
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:60px;background:#e8f5e9;position:sticky;right:0;z-index:30;border-left:2px solid #999;font-size:11px;">出勤率</th>`;
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:50px;background:#e3f2fd;position:sticky;right:60px;z-index:30;border-left:1px solid #ddd;font-size:11px;">出勤</th>`;
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:50px;background:#fff3e0;position:sticky;right:110px;z-index:30;border-left:1px solid #ddd;font-size:11px;">迟到</th>`;
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:50px;background:#fff8e1;position:sticky;right:160px;z-index:30;border-left:1px solid #ddd;font-size:11px;">请假</th>`;
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:50px;background:#e0f7fa;position:sticky;right:210px;z-index:30;border-left:1px solid #ddd;font-size:11px;">休假</th>`;
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:50px;background:#ffebee;position:sticky;right:260px;z-index:30;border-left:1px solid #ddd;font-size:11px;">缺席</th>`;
    calendarHeader += `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:65px;background:#e8eaf6;position:sticky;right:310px;z-index:30;border-left:1px solid #ddd;font-size:11px;">总工时</th>`;
    calendarHeader += '</tr>';
    
    // 构建每个员工的日历行
    let calendarRows = '';
    employees.forEach((empData, rowIndex) => {
        const emp = empData.employee;
        const isEven = rowIndex % 2 === 0;
        const rowBg = isEven ? '#ffffff' : '#fafafa';
        
        let row = `<tr style="background:${rowBg};">`;
        
        // 員工姓名 - 固定
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-weight:bold;font-size:12px;background:${rowBg};position:sticky;left:0;z-index:10;border-right:2px solid #999;">${emp.name}</td>`;
        
        // 日期欄位
        days.forEach(day => {
            const status = empData.dailyStatus[day.date] || '未到班';
            let bgColor = '#fff';
            let textColor = '#333';
            let symbol = '-';
            
            switch(status) {
                case '已到班':
                    bgColor = '#e8f5e9';
                    textColor = '#2e7d32';
                    symbol = '✅';
                    break;
                case '已签退':
                    bgColor = '#e3f2fd';
                    textColor = '#0d47a1';
                    symbol = '✅';
                    break;
                case '迟到':
                    bgColor = '#fff3e0';
                    textColor = '#e65100';
                    symbol = '⚠️';
                    break;
                case '休假':
                    bgColor = '#e0f7fa';
                    textColor = '#00695c';
                    symbol = '🏖️';
                    break;
                case '请假':
                    bgColor = '#fff8e1';
                    textColor = '#f57f17';
                    symbol = '📝';
                    break;
                default:
                    if (day.isWeekend) {
                        bgColor = '#fce4ec';
                        textColor = '#c62828';
                        symbol = '休';
                    } else {
                        bgColor = '#ffebee';
                        textColor = '#c62828';
                        symbol = '✗';
                    }
            }
            
            row += `<td style="padding:2px 4px;border:1px solid #ddd;text-align:center;font-size:13px;background:${bgColor};color:${textColor};">${symbol}</td>`;
        });
        
        // ===== 右側固定欄位 =====
        const rateColor = empData.attendanceRate >= 90 ? '#4CAF50' : (empData.attendanceRate >= 70 ? '#ffa726' : '#ff6b6b');
        const totalHours = Math.floor(empData.totalWorkMinutes / 60);
        const totalMins = empData.totalWorkMinutes % 60;
        const timeStr = totalHours > 0 ? `${totalHours}h${totalMins > 0 ? totalMins + 'm' : ''}` : (totalMins > 0 ? totalMins + 'm' : '0h');
        
        // 出勤率
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-weight:bold;color:${rateColor};font-size:13px;background:${rowBg};position:sticky;right:0;z-index:10;border-left:2px solid #999;">${empData.attendanceRate.toFixed(1)}%</td>`;
        // 出勤
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#2196F3;font-weight:bold;background:${rowBg};position:sticky;right:60px;z-index:10;border-left:1px solid #ddd;">${empData.presentDays}</td>`;
        // 迟到
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#ffa726;background:${rowBg};position:sticky;right:110px;z-index:10;border-left:1px solid #ddd;">${empData.lateDays}</td>`;
        // 请假
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#f57f17;background:${rowBg};position:sticky;right:160px;z-index:10;border-left:1px solid #ddd;">${empData.leaveDays}</td>`;
        // 休假
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#00695c;background:${rowBg};position:sticky;right:210px;z-index:10;border-left:1px solid #ddd;">${empData.vacationDays}</td>`;
        // 缺席
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#ff6b6b;background:${rowBg};position:sticky;right:260px;z-index:10;border-left:1px solid #ddd;">${empData.absentDays}</td>`;
        // 总工时
        row += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#4CAF50;font-weight:bold;font-size:12px;background:${rowBg};position:sticky;right:310px;z-index:10;border-left:1px solid #ddd;">${timeStr}</td>`;
        
        row += '</tr>';
        calendarRows += row;
    });
    
    // 汇总行
    let summaryRow = `<tr style="background:#e8e8e8;font-weight:bold;">`;
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;background:#e8e8e8;position:sticky;left:0;z-index:10;border-right:2px solid #999;font-size:12px;">合计</td>`;
    days.forEach(() => {
        summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:11px;color:#999;background:#e8e8e8;">-</td>`;
    });
    // 右側固定欄位 - 合計
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#4CAF50;background:#e8e8e8;position:sticky;right:0;z-index:10;border-left:2px solid #999;font-size:12px;">-</td>`;
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#2196F3;background:#e8e8e8;position:sticky;right:60px;z-index:10;border-left:1px solid #ddd;font-size:12px;">${summary.totalPresent}</td>`;
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#ffa726;background:#e8e8e8;position:sticky;right:110px;z-index:10;border-left:1px solid #ddd;font-size:12px;">${summary.totalLate}</td>`;
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#f57f17;background:#e8e8e8;position:sticky;right:160px;z-index:10;border-left:1px solid #ddd;font-size:12px;">${summary.totalLeave}</td>`;
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#00695c;background:#e8e8e8;position:sticky;right:210px;z-index:10;border-left:1px solid #ddd;font-size:12px;">${summary.totalVacation}</td>`;
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#ff6b6b;background:#e8e8e8;position:sticky;right:260px;z-index:10;border-left:1px solid #ddd;font-size:12px;">${summary.totalAbsent}</td>`;
    summaryRow += `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;color:#4CAF50;background:#e8e8e8;position:sticky;right:310px;z-index:10;border-left:1px solid #ddd;font-size:12px;">-</td>`;
    summaryRow += '</tr>';
    
    const legend = `
        <div style="display:flex;gap:15px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #eee;margin-bottom:10px;font-size:12px;">
            <span><span style="display:inline-block;width:20px;height:20px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:3px;vertical-align:middle;"></span> ✅ 已到班</span>
            <span><span style="display:inline-block;width:20px;height:20px;background:#e3f2fd;border:1px solid #90caf9;border-radius:3px;vertical-align:middle;"></span> ✅ 已签退</span>
            <span><span style="display:inline-block;width:20px;height:20px;background:#fff3e0;border:1px solid #ffcc80;border-radius:3px;vertical-align:middle;"></span> ⚠️ 迟到</span>
            <span><span style="display:inline-block;width:20px;height:20px;background:#e0f7fa;border:1px solid #80deea;border-radius:3px;vertical-align:middle;"></span> 🏖️ 休假</span>
            <span><span style="display:inline-block;width:20px;height:20px;background:#fff8e1;border:1px solid #ffd54f;border-radius:3px;vertical-align:middle;"></span> 📝 请假</span>
            <span><span style="display:inline-block;width:20px;height:20px;background:#ffebee;border:1px solid #ef9a9a;border-radius:3px;vertical-align:middle;"></span> ✗ 缺席</span>
            <span><span style="display:inline-block;width:20px;height:20px;background:#fce4ec;border:1px solid #f48fb1;border-radius:3px;vertical-align:middle;"></span> 休 周末</span>
        </div>
    `;
    
    const fixedHint = `
        <div style="font-size:11px;color:#999;text-align:right;padding:4px 0;">
            📌 員工姓名及統計欄位已固定，橫向滾動時保持可見
        </div>
    `;
    
    return `
        <div style="font-size:14px;font-weight:bold;text-align:center;margin-bottom:10px;color:#333;">
            📊 ${yearMonth} 月出勤统计
            <span style="font-size:12px;font-weight:normal;color:#999;margin-left:10px;">共 ${employees.length} 位员工 | ${days.length} 天</span>
        </div>
        ${legend}
        ${fixedHint}
        <div style="overflow:auto;max-height:500px;border:1px solid #ddd;border-radius:4px;position:relative;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #ddd;min-width:${60 + days.length * 38 + 380}px;table-layout:fixed;">
                <thead style="position:sticky;top:0;z-index:40;">
                    ${calendarHeader}
                </thead>
                <tbody>
                    ${calendarRows}
                    ${summaryRow}
                </tbody>
            </table>
        </div>
        <div style="margin-top:10px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:12px;color:#666;text-align:center;border:1px solid #eee;">
            💡 出勤率 = 出勤天数 ÷ 工作日天数 × 100% | 周末不计入缺席
        </div>
    `;
}

// ============================================================
// 员工个人月统计（寬版 + 固定欄位）- 含權限檢查
// ============================================================

function showEmployeeMonthlyStats(employeeId) {
    // ✅ 检查查看月统计权限
    if (!checkActionPermission('attendance', 'view_monthly')) {
        showPermissionDenied('查看员工月统计');
        return;
    }
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) { alert('员工不存在'); return; }
    
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    
    const html = `
        <div class="modal-title" style="font-size:20px;">📊 ${employee.name} - 月出勤统计</div>
        <div style="margin-bottom:15px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <span style="font-weight:500;font-size:14px;">📅 月份：</span>
            <input type="month" id="empMonthlyDate" value="${currentMonth}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
            <button class="btn btn-primary" onclick="renderEmployeeMonthlyStats(${employeeId})">📊 查询</button>
            <button class="btn" onclick="document.getElementById('empMonthlyDate').value='${currentMonth}';renderEmployeeMonthlyStats(${employeeId})">本月</button>
        </div>
        <div id="empMonthlyStatsContent" style="max-height:500px;overflow:auto;">
            <div style="text-align:center;padding:40px;color:#999;">请选择月份后点击「查询」</div>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    const overlay = showModalWide(html);
    
    window.renderEmployeeMonthlyStats = function(empId) {
        const overlayEl = document.querySelector('.modal-overlay');
        if (!overlayEl) return;
        const monthInput = overlayEl.querySelector('#empMonthlyDate');
        const contentDiv = overlayEl.querySelector('#empMonthlyStatsContent');
        if (!monthInput || !contentDiv) return;
        
        const yearMonth = monthInput.value;
        if (!yearMonth) {
            contentDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#ff6b6b;">请选择月份</div>';
            return;
        }
        
        const data = getMonthlyAttendance(yearMonth);
        const empData = data.employees.find(e => e.employee.id === empId);
        if (!empData) {
            contentDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#999;">该员工在 ${yearMonth} 暂无出勤记录</div>`;
            return;
        }
        
        contentDiv.innerHTML = renderEmployeeMonthlyStatsContent(empData, data.days);
    };
    
    setTimeout(() => {
        if (window.renderEmployeeMonthlyStats) window.renderEmployeeMonthlyStats(employeeId);
    }, 100);
}

function renderEmployeeMonthlyStatsContent(empData, days) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const emp = empData.employee;
    
    let calendarHtml = `
        <div style="overflow:auto;max-height:400px;border:1px solid #ddd;border-radius:4px;position:relative;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #ddd;min-width:${30 + days.length * 38}px;">
                <thead style="position:sticky;top:0;z-index:10;">
                    <tr style="background:#f5f5f5;">
                        <th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:50px;background:#f5f5f5;position:sticky;left:0;z-index:20;border-right:2px solid #999;font-size:12px;">日期</th>
                        ${days.map(day => {
                            const isWeekend = day.isWeekend;
                            const bgColor = isWeekend ? '#ffebee' : '#f5f5f5';
                            return `<th style="padding:4px 6px;border:1px solid #ddd;text-align:center;min-width:32px;background:${bgColor};font-size:11px;white-space:nowrap;">
                                ${day.day}<br><span style="font-size:8px;color:#999;">${weekDays[day.dayOfWeek]}</span>
                            </th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-weight:bold;font-size:12px;background:#fafafa;position:sticky;left:0;z-index:10;border-right:2px solid #999;">${emp.name}</td>
                        ${days.map(day => {
                            const status = empData.dailyStatus[day.date] || '未到班';
                            let bgColor = '#fff';
                            let textColor = '#333';
                            let symbol = '-';
                            
                            switch(status) {
                                case '已到班':
                                    bgColor = '#e8f5e9';
                                    textColor = '#2e7d32';
                                    symbol = '✅';
                                    break;
                                case '已签退':
                                    bgColor = '#e3f2fd';
                                    textColor = '#0d47a1';
                                    symbol = '✅';
                                    break;
                                case '迟到':
                                    bgColor = '#fff3e0';
                                    textColor = '#e65100';
                                    symbol = '⚠️';
                                    break;
                                case '休假':
                                    bgColor = '#e0f7fa';
                                    textColor = '#00695c';
                                    symbol = '🏖️';
                                    break;
                                case '请假':
                                    bgColor = '#fff8e1';
                                    textColor = '#f57f17';
                                    symbol = '📝';
                                    break;
                                default:
                                    if (day.isWeekend) {
                                        bgColor = '#fce4ec';
                                        textColor = '#c62828';
                                        symbol = '休';
                                    } else {
                                        bgColor = '#ffebee';
                                        textColor = '#c62828';
                                        symbol = '✗';
                                    }
                            }
                            return `<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:16px;background:${bgColor};color:${textColor};">${symbol}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    
    const rateColor = empData.attendanceRate >= 90 ? '#4CAF50' : (empData.attendanceRate >= 70 ? '#ffa726' : '#ff6b6b');
    const totalHours = Math.floor(empData.totalWorkMinutes / 60);
    const totalMins = empData.totalWorkMinutes % 60;
    
    return `
        <div style="font-size:14px;font-weight:bold;text-align:center;margin-bottom:10px;color:#333;">
            ${emp.name} - ${empData.employee.department || ''} ${empData.employee.position || ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:15px;text-align:center;">
            <div style="padding:10px;background:#e8f5e9;border-radius:6px;">
                <div style="font-size:11px;color:#888;">出勤率</div>
                <div style="font-size:20px;font-weight:bold;color:${rateColor};">${empData.attendanceRate.toFixed(1)}%</div>
            </div>
            <div style="padding:10px;background:#e3f2fd;border-radius:6px;">
                <div style="font-size:11px;color:#888;">出勤天数</div>
                <div style="font-size:20px;font-weight:bold;color:#2196F3;">${empData.presentDays}</div>
            </div>
            <div style="padding:10px;background:#fff3e0;border-radius:6px;">
                <div style="font-size:11px;color:#888;">迟到次数</div>
                <div style="font-size:20px;font-weight:bold;color:#ffa726;">${empData.lateDays}</div>
            </div>
            <div style="padding:10px;background:#4CAF50;border-radius:6px;color:#fff;">
                <div style="font-size:11px;opacity:0.9;">总工时</div>
                <div style="font-size:20px;font-weight:bold;">${totalHours}h${totalMins > 0 ? totalMins + 'm' : ''}</div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px;text-align:center;">
            <div style="padding:8px;background:#fff8e1;border-radius:6px;border:1px solid #ffd54f;">
                <div style="font-size:11px;color:#888;">请假</div>
                <div style="font-size:16px;font-weight:bold;color:#f57f17;">${empData.leaveDays} 天</div>
            </div>
            <div style="padding:8px;background:#e0f7fa;border-radius:6px;border:1px solid #80deea;">
                <div style="font-size:11px;color:#888;">休假</div>
                <div style="font-size:16px;font-weight:bold;color:#00695c;">${empData.vacationDays} 天</div>
            </div>
            <div style="padding:8px;background:#ffebee;border-radius:6px;border:1px solid #ef9a9a;">
                <div style="font-size:11px;color:#888;">缺席</div>
                <div style="font-size:16px;font-weight:bold;color:#c62828;">${empData.absentDays} 天</div>
            </div>
        </div>
        <div style="font-size:12px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:8px;">
            工作日：${empData.workDays} 天 | 总记录：${empData.totalDays} 天
        </div>
        ${calendarHtml}
        <div style="margin-top:8px;font-size:11px;color:#999;text-align:center;">
            ✅ 已到班 | ⚠️ 迟到 | 🏖️ 休假 | 📝 请假 | ✗ 缺席 | 休 周末
        </div>
    `;
}

// ============================================================
// 渲染员工出勤页面（含完整權限控制）
// ============================================================

function renderAttendance(el) {
    initAttendanceRecords();
    initTipsRecords();
    
    const employees = DB.get('employees', []);
    const date = document.getElementById('attendanceDate')?.value || today();
    const searchKeyword = document.getElementById('attendanceSearch')?.value?.trim() || '';
    const statusFilter = document.getElementById('attendanceStatusFilter')?.value || '';
    
    const dailyData = getDailyAttendance(date);
    
    let filteredEmployees = employees;
    if (searchKeyword) {
        filteredEmployees = employees.filter(e => 
            e.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            e.id.toString().includes(searchKeyword)
        );
    }
    
    if (statusFilter) {
        filteredEmployees = filteredEmployees.filter(e => {
            const data = dailyData[e.id];
            if (!data) return statusFilter === '未到班';
            return data.status === statusFilter;
        });
    }
    
    const totalEmployees = employees.length;
    let checkedIn = 0, notCheckedIn = 0, onLeave = 0, onVacation = 0, late = 0;
    employees.forEach(e => {
        const data = dailyData[e.id];
        if (!data || data.status === '未到班') {
            notCheckedIn++;
        } else if (data.status === '休假') {
            onVacation++;
        } else if (data.status === '请假') {
            onLeave++;
        } else if (data.status === '迟到') {
            late++;
            checkedIn++;
        } else if (data.status === '已到班' || data.status === '已签退') {
            checkedIn++;
        }
    });
    
    let tableRows = '';
    if (filteredEmployees.length === 0) {
        tableRows = '<tr class="empty-row"><td colspan="10">暂无员工或没有匹配的记录</td></tr>';
    } else {
        tableRows = filteredEmployees.map(e => {
            const data = dailyData[e.id];
            const status = data ? data.status : '未到班';
            const checkInTime = data && data.check_in_time ? data.check_in_time : '-';
            const checkOutTime = data && data.check_out_time ? data.check_out_time : '-';
            const workDuration = data && data.work_duration ? data.work_duration : '-';
            const isLate = data ? data.is_late : false;
            const note = data && data.note ? data.note : '';
            
            let statusBadge = '';
            switch(status) {
                case '已到班': statusBadge = '<span class="badge badge-success">✅ 已到班</span>'; break;
                case '已签退': statusBadge = '<span class="badge badge-info">✅ 已签退</span>'; break;
                case '迟到': statusBadge = '<span class="badge badge-warning">⚠️ 迟到</span>'; break;
                case '休假': statusBadge = '<span class="badge badge-info">🏖️ 休假</span>'; break;
                case '请假': statusBadge = '<span class="badge badge-warning">📝 请假</span>'; break;
                default: statusBadge = '<span class="badge badge-danger">❌ 未到班</span>';
            }
            
            // ✅ 根據權限顯示操作按鈕
            const canCheckIn = checkActionPermission('attendance', 'check_in');
            const canCheckOut = checkActionPermission('attendance', 'check_out');
            const canSetStatus = checkActionPermission('attendance', 'set_status');
            const canClearStatus = checkActionPermission('attendance', 'clear_status');
            const canViewHistory = checkActionPermission('attendance', 'view_history');
            
            let actionButtons = '';
            
            // 到班按钮
            if ((status === '未到班' || status === '迟到') && canCheckIn) {
                actionButtons += `<button class="btn btn-success btn-sm" onclick="doCheckIn(${e.id}, '${date}')">到班</button>`;
            }
            
            // 下班按钮
            if ((status === '已到班' || status === '迟到') && canCheckOut) {
                actionButtons += `<button class="btn btn-warning btn-sm" onclick="doCheckOut(${e.id}, '${date}')">下班</button>`;
            }
            
            // 休假按钮
            if ((status === '未到班' || status === '已到班' || status === '迟到') && canSetStatus) {
                actionButtons += `<button class="btn btn-info btn-sm" onclick="setEmployeeStatusUI(${e.id}, '${date}', '休假')">休假</button>`;
            }
            
            // 请假按钮
            if ((status === '未到班' || status === '已到班' || status === '迟到') && canSetStatus) {
                actionButtons += `<button class="btn btn-info btn-sm" onclick="setEmployeeStatusUI(${e.id}, '${date}', '请假')">请假</button>`;
            }
            
            // 清除按钮
            if ((status === '休假' || status === '请假') && canClearStatus) {
                actionButtons += `<button class="btn btn-secondary btn-sm" onclick="doClearStatus(${e.id}, '${date}')">清除</button>`;
            }
            
            // 历史按钮
            if (canViewHistory) {
                actionButtons += `<button class="btn btn-secondary btn-sm" onclick="showEmployeeAttendanceHistory(${e.id})">📋 历史</button>`;
            }
            
            return `<tr>
                <td style="text-align:center;"><strong>${e.id}</strong></td>
                <td style="text-align:center;"><strong>${e.name}</strong></td>
                <td style="text-align:center;">${e.department || '-'}</td>
                <td style="text-align:center;">${e.position || '-'}</td>
                <td style="text-align:center;">${checkInTime}</td>
                <td style="text-align:center;">${checkOutTime}</td>
                <td style="text-align:center;">${workDuration}</td>
                <td style="text-align:center;">${statusBadge} ${isLate ? '🔴' : ''}</td>
                <td style="text-align:center;font-size:12px;color:#666;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${note || '-'}</td>
                <td style="text-align:center;">
                    <div class="btn-group" style="justify-content:center;flex-wrap:wrap;">
                        ${actionButtons}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }
    
    // ✅ 檢查各權限以顯示按鈕
    const canViewMonthly = checkActionPermission('attendance', 'view_monthly');
    const canSettings = checkActionPermission('attendance', 'settings');
    
    el.innerHTML = `
        <div class="page-header">
            <h1>👥 员工出勤</h1>
            <p class="breadcrumb">营运管理 > 员工出勤</p>
        </div>
        
        <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);">
            <div class="stat-card" style="border-left:4px solid #4CAF50;">
                <div class="stat-label">👤 总员工</div>
                <div class="stat-value" style="color:#4CAF50;">${totalEmployees}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #2196F3;">
                <div class="stat-label">✅ 已到班</div>
                <div class="stat-value" style="color:#2196F3;">${checkedIn}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ff6b6b;">
                <div class="stat-label">❌ 未到班</div>
                <div class="stat-value" style="color:#ff6b6b;">${notCheckedIn}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ffa726;">
                <div class="stat-label">⚠️ 迟到</div>
                <div class="stat-value" style="color:#ffa726;">${late}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #26c6da;">
                <div class="stat-label">🏖️ 休假</div>
                <div class="stat-value" style="color:#26c6da;">${onVacation}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ffa726;">
                <div class="stat-label">📝 请假</div>
                <div class="stat-value" style="color:#ffa726;">${onLeave}</div>
            </div>
        </div>
        
        <div class="toolbar" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:15px;background:#fff;padding:15px;border-radius:10px;border:1px solid #eee;">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                <span style="font-weight:500;font-size:13px;">📅 日期：</span>
                <input type="date" id="attendanceDate" value="${date}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="renderAttendance(document.getElementById('mainContent'))">
                <button class="btn btn-primary" onclick="document.getElementById('attendanceDate').value='${today()}';renderAttendance(document.getElementById('mainContent'))">今天</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                <span style="font-weight:500;font-size:13px;">🔍 搜索：</span>
                <input type="text" id="attendanceSearch" placeholder="姓名或ID" value="${searchKeyword}" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:120px;" onkeydown="if(event.key==='Enter') renderAttendance(document.getElementById('mainContent'))">
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                <span style="font-weight:500;font-size:13px;">📊 状态：</span>
                <select id="attendanceStatusFilter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;" onchange="renderAttendance(document.getElementById('mainContent'))">
                    <option value="">全部</option>
                    <option value="已到班" ${statusFilter === '已到班' ? 'selected' : ''}>已到班</option>
                    <option value="已签退" ${statusFilter === '已签退' ? 'selected' : ''}>已签退</option>
                    <option value="迟到" ${statusFilter === '迟到' ? 'selected' : ''}>迟到</option>
                    <option value="未到班" ${statusFilter === '未到班' ? 'selected' : ''}>未到班</option>
                    <option value="休假" ${statusFilter === '休假' ? 'selected' : ''}>休假</option>
                    <option value="请假" ${statusFilter === '请假' ? 'selected' : ''}>请假</option>
                </select>
            </div>
            <button class="btn" onclick="document.getElementById('attendanceSearch').value='';document.getElementById('attendanceStatusFilter').value='';renderAttendance(document.getElementById('mainContent'))">✕ 清除</button>
            <button class="btn" onclick="renderAttendance(document.getElementById('mainContent'))">🔄 刷新</button>
            ${canSettings ? `<button class="btn btn-success" onclick="showAttendanceSettings()">⚙️ 设定</button>` : ''}
            ${canViewMonthly ? `<button class="btn btn-primary" onclick="showMonthlyAttendance()">📊 月统计</button>` : ''}
            <span style="font-size:13px;color:#999;margin-left:auto;">共 ${filteredEmployees.length} 位员工</span>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="min-width:50px;text-align:center;">ID</th>
                        <th style="min-width:80px;text-align:center;">姓名</th>
                        <th style="min-width:80px;text-align:center;">部门</th>
                        <th style="min-width:80px;text-align:center;">职位</th>
                        <th style="min-width:100px;text-align:center;">签到时间</th>
                        <th style="min-width:100px;text-align:center;">签退时间</th>
                        <th style="min-width:80px;text-align:center;">工作时长</th>
                        <th style="min-width:100px;text-align:center;">状态</th>
                        <th style="min-width:100px;text-align:center;">备注</th>
                        <th style="min-width:280px;text-align:center;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================
// 到班功能 - 含權限檢查
// ============================================================

function doCheckIn(employeeId, date) {
    // ✅ 检查到班权限
    if (!checkActionPermission('attendance', 'check_in')) {
        showPermissionDenied('员工到班');
        return;
    }
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) { alert('员工不存在'); return; }
    
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const note = prompt(`员工：${employee.name}\n到班时间：${time}\n请输入备注（可选）：`);
    if (note === null) return;
    
    const result = employeeCheckIn(employeeId, date, time, note || '');
    if (result.success) {
        alert(result.message);
        renderAttendance(document.getElementById('mainContent'));
    } else {
        alert(result.message);
    }
}

// ============================================================
// 下班功能 - 含權限檢查
// ============================================================

function doCheckOut(employeeId, date) {
    // ✅ 检查签退权限
    if (!checkActionPermission('attendance', 'check_out')) {
        showPermissionDenied('员工签退');
        return;
    }
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) { alert('员工不存在'); return; }
    
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const note = prompt(`员工：${employee.name}\n签退时间：${time}\n请输入备注（可选）：`);
    if (note === null) return;
    
    const result = employeeCheckOut(employeeId, date, time, note || '');
    if (result.success) {
        alert(result.message);
        renderAttendance(document.getElementById('mainContent'));
    } else {
        alert(result.message);
    }
}

// ============================================================
// 设置员工状态UI（休假/请假）- 含權限檢查
// ============================================================

function setEmployeeStatusUI(employeeId, date, status) {
    // ✅ 检查设定状态权限
    if (!checkActionPermission('attendance', 'set_status')) {
        showPermissionDenied('设定员工状态');
        return;
    }
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) { alert('员工不存在'); return; }
    
    const statusMap = {
        '休假': '🏖️ 休假',
        '请假': '📝 请假'
    };
    
    const note = prompt(`员工：${employee.name}\n状态：${statusMap[status]}\n请输入备注（可选）：`);
    if (note === null) return;
    
    const result = setEmployeeStatus(employeeId, date, status, note || '');
    if (result.success) {
        alert(result.message);
        renderAttendance(document.getElementById('mainContent'));
    } else {
        alert(result.message);
    }
}

// ============================================================
// 清除员工状态 - 含權限檢查
// ============================================================

function doClearStatus(employeeId, date) {
    // ✅ 检查清除状态权限
    if (!checkActionPermission('attendance', 'clear_status')) {
        showPermissionDenied('清除员工状态');
        return;
    }
    
    if (!confirm('确定要清除该员工今天的出勤状态吗？')) return;
    
    const result = clearEmployeeStatus(employeeId, date);
    if (result.success) {
        alert(result.message);
        renderAttendance(document.getElementById('mainContent'));
    } else {
        alert(result.message);
    }
}

// ============================================================
// 出勤设定 - 含權限檢查
// ============================================================

function showAttendanceSettings() {
    // ✅ 检查出勤设定权限
    if (!checkActionPermission('attendance', 'settings')) {
        showPermissionDenied('出勤设定');
        return;
    }
    
    const settings = DB.get('attendance_settings', { 
        work_start_time: '09:00', 
        work_end_time: '18:00',
        late_threshold: 15
    });
    
    const html = `
        <div class="modal-title">⚙️ 出勤设定</div>
        <div style="margin-bottom:15px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center;">
            <span style="color:#1565C0;">💡 设定上班时间、下班时间和迟到判定标准</span>
        </div>
        <div class="form-group">
            <label>上班时间 *</label>
            <input type="time" id="workStartTime" value="${settings.work_start_time || '09:00'}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        <div class="form-group">
            <label>下班时间 *</label>
            <input type="time" id="workEndTime" value="${settings.work_end_time || '18:00'}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
        </div>
        <div class="form-group">
            <label>迟到判定（分钟）*</label>
            <input type="number" id="lateThreshold" value="${settings.late_threshold || 15}" min="0" max="120" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
            <div style="font-size:12px;color:#999;margin-top:4px;">超过此分钟数签到视为迟到</div>
        </div>
        <div style="padding:10px;background:#fff8e1;border-radius:6px;font-size:12px;text-align:center;border:1px solid #ffcc80;margin-bottom:10px;">
            <span style="color:#e65100;">📌 设定后会影响迟到判定</span>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="submitAttendanceSettings()">确认设定</button>
        </div>
    `;
    showModal(html);
}

function submitAttendanceSettings() {
    const overlay = document.querySelector('.modal-overlay');
    const startTime = overlay.querySelector('#workStartTime').value;
    const endTime = overlay.querySelector('#workEndTime').value;
    const threshold = parseInt(overlay.querySelector('#lateThreshold').value) || 15;
    
    if (!startTime) { alert('请输入上班时间'); return; }
    if (!endTime) { alert('请输入下班时间'); return; }
    if (threshold < 0) { alert('迟到判定请输入有效数字'); return; }
    
    const beforeData = DB.get('attendance_settings', {});
    const afterData = {
        work_start_time: startTime,
        work_end_time: endTime,
        late_threshold: threshold
    };
    DB.set('attendance_settings', afterData);
    
    addOperationLog('员工出勤', '设定', '出勤设定', 
        `更新出勤设定：上班 ${startTime}，下班 ${endTime}，迟到判定 ${threshold} 分钟`, null, beforeData, afterData);
    
    overlay.remove();
    alert('✅ 出勤设定已更新');
    renderAttendance(document.getElementById('mainContent'));
}

// ============================================================
// 查看员工出勤历史 - 含權限檢查
// ============================================================

function showEmployeeAttendanceHistory(employeeId) {
    // ✅ 检查查看历史权限
    if (!checkActionPermission('attendance', 'view_history')) {
        showPermissionDenied('查看出勤历史');
        return;
    }
    
    const employee = DB.get('employees', []).find(e => e.id === employeeId);
    if (!employee) { alert('员工不存在'); return; }
    
    const records = getAttendanceRecords(employeeId);
    const recentRecords = records.slice(0, 30);
    
    if (recentRecords.length === 0) {
        alert(`员工「${employee.name}」暂无出勤记录`);
        return;
    }
    
    let historyHtml = recentRecords.map(r => {
        let statusBadge = '';
        switch(r.status) {
            case '已到班': statusBadge = '<span class="badge badge-success">已到班</span>'; break;
            case '已签退': statusBadge = '<span class="badge badge-info">已签退</span>'; break;
            case '迟到': statusBadge = '<span class="badge badge-warning">迟到</span>'; break;
            case '休假': statusBadge = '<span class="badge badge-info">休假</span>'; break;
            case '请假': statusBadge = '<span class="badge badge-warning">请假</span>'; break;
            default: statusBadge = '<span class="badge badge-danger">未到班</span>';
        }
        return `
            <tr>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.date}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.check_in_time || '-'}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.check_out_time || '-'}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${r.work_duration || '-'}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${statusBadge}</td>
                <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:12px;color:#666;">${r.note || '-'}</td>
            </tr>
        `;
    }).join('');
    
    // ✅ 检查是否有查看月统计权限
    const canViewMonthly = checkActionPermission('attendance', 'view_monthly');
    
    const html = `
        <div class="modal-title" style="font-size:20px;">📋 ${employee.name} 出勤历史</div>
        <div style="margin-bottom:15px;padding:10px;background:#f8f9fc;border-radius:6px;font-size:13px;text-align:center;">
            <span>共 <strong>${records.length}</strong> 笔记录，显示最近30笔</span>
            ${canViewMonthly ? `<button class="btn btn-sm btn-info" onclick="closeModal(this.closest('.modal-overlay'));showEmployeeMonthlyStats(${employeeId})" style="margin-left:10px;">📊 月统计</button>` : ''}
        </div>
        <div style="max-height:400px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f5f5f5;position:sticky;top:0;z-index:1;">
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:100px;">日期</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">签到</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">签退</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">时长</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:80px;">状态</th>
                    <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:center;min-width:100px;">备注</th>
                </tr></thead>
                <tbody>
                    ${historyHtml}
                </tbody>
            </table>
        </div>
        <div class="modal-actions">
            <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
    `;
    showModalWide(html);
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
    overlay.innerHTML = '<div class="modal modal-wide" style="max-width:900px;width:95%;">' + html + '</div>';
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
// 小費相關函數（用於出勤頁面顯示小費統計）
// ============================================================

function initTipsRecords() {
    if (!localStorage.getItem('rpt_tips_records')) {
        DB.set('tips_records', []);
        DB.set('tips_records_next', 1);
    }
}

function getTipsRecords(tableType) {
    const records = DB.get('tips_records', []);
    if (tableType) {
        return records.filter(r => r.table_type === tableType);
    }
    return records;
}

function getTotalTips(tableType) {
    const records = getTipsRecords(tableType);
    return records.reduce((sum, r) => sum + r.amount, 0);
}