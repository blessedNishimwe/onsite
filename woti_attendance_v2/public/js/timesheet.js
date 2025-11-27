// public/js/timesheet.js
/**
 * Timesheet Page JavaScript
 * Handles timesheet display, activity updates, and PDF generation
 */

(function() {
    'use strict';

    // State
    let currentUser = null;
    let activities = [];
    let timesheetData = null;

    // DOM Elements
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const loadBtn = document.getElementById('loadBtn');
    const previewBtn = document.getElementById('previewBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const alertContainer = document.getElementById('alertContainer');
    const loadingContainer = document.getElementById('loadingContainer');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('tableContainer');
    const summaryCard = document.getElementById('summaryCard');
    const timesheetBody = document.getElementById('timesheetBody');

    /**
     * Initialize the page
     */
    function init() {
        if (!checkAuth()) return;

        populateYearSelect();
        setCurrentMonthYear();
        loadActivities();
    }

    /**
     * Check authentication
     */
    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            window.location.href = '/index.html';
            return false;
        }

        try {
            currentUser = JSON.parse(user);
            document.getElementById('userNameBadge').textContent = 
                `${currentUser.first_name} ${currentUser.last_name}`;
            document.getElementById('userFacilityBadge').textContent = 
                currentUser.facility_name || 'No facility';
            document.getElementById('userRole').textContent = 
                (currentUser.role || 'user').toUpperCase();

            if (currentUser.role === 'admin') {
                document.getElementById('adminLink').style.display = 'inline';
            }

            return true;
        } catch (e) {
            console.error('Error parsing user data:', e);
            logout();
            return false;
        }
    }

    /**
     * Populate year dropdown
     */
    function populateYearSelect() {
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear - 1, currentYear - 2];
        
        yearSelect.innerHTML = years.map(year => 
            `<option value="${year}">${year}</option>`
        ).join('');
    }

    /**
     * Set current month and year in selectors
     */
    function setCurrentMonthYear() {
        const now = new Date();
        monthSelect.value = now.getMonth() + 1;
        yearSelect.value = now.getFullYear();
    }

    /**
     * Load activities for dropdown
     */
    async function loadActivities() {
        try {
            const response = await fetch('/api/timesheet/activities');
            const data = await response.json();

            if (response.ok && data.success) {
                activities = data.data.activities;
            }
        } catch (error) {
            console.error('Error loading activities:', error);
        }
    }

    /**
     * Load timesheet data
     */
    window.loadTimesheet = async function() {
        const month = monthSelect.value;
        const year = yearSelect.value;

        showLoading(true);
        hideAlert();

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `/api/timesheet/monthly?month=${month}&year=${year}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load timesheet');
            }

            timesheetData = data.data;
            renderTimesheet();
            renderSummary();
            enableButtons(true);

        } catch (error) {
            console.error('Error loading timesheet:', error);
            showAlert(error.message, 'error');
            enableButtons(false);
        } finally {
            showLoading(false);
        }
    };

    /**
     * Render timesheet table
     */
    function renderTimesheet() {
        if (!timesheetData || !timesheetData.days) {
            emptyState.style.display = 'block';
            tableContainer.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        tableContainer.style.display = 'block';

        const rows = timesheetData.days.map(day => {
            if (day.isSunday) {
                return renderSundayRow(day);
            }
            if (day.attendance) {
                return renderAttendanceRow(day);
            }
            return renderEmptyRow(day);
        });

        timesheetBody.innerHTML = rows.join('');
    }

    /**
     * Render Sunday row (non-working day)
     */
    function renderSundayRow(day) {
        return `
            <tr class="sunday-row">
                <td><strong>${day.day.toUpperCase()}</strong></td>
                <td>${day.date}</td>
                <td>--:--</td>
                <td>--:--</td>
                <td>--</td>
                <td>--</td>
                <td>(Sunday - Non-working)</td>
                <td>--</td>
            </tr>
        `;
    }

    /**
     * Render row with attendance data
     */
    function renderAttendanceRow(day) {
        const att = day.attendance;
        const activityOptions = activities.map(a => 
            `<option value="${a.id}" ${a.id === att.activityId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`
        ).join('');

        let statusBadge = '';
        if (!att.clockOut) {
            statusBadge = '<span class="status-badge status-active">Active</span>';
        } else if (!att.activityId) {
            statusBadge = '<span class="status-badge status-missing">No Activity</span>';
        } else {
            statusBadge = '<span class="status-badge status-complete">Complete</span>';
        }

        return `
            <tr>
                <td><strong>${day.day}</strong></td>
                <td>${day.date}</td>
                <td>${att.clockIn || '--:--'}</td>
                <td>${att.clockOut || '--:--'}</td>
                <td>${att.hoursWorked || '0.00'}</td>
                <td>
                    <select class="activity-select" 
                            data-attendance-id="${att.id}"
                            onchange="updateActivity(this)">
                        <option value="">-- Select Activity --</option>
                        ${activityOptions}
                    </select>
                </td>
                <td>
                    <input type="text" 
                           class="description-input" 
                           placeholder="Description..."
                           value="${escapeHtml(att.activityDescription || '')}"
                           data-attendance-id="${att.id}"
                           onchange="updateDescription(this)">
                </td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }

    /**
     * Render row without attendance
     */
    function renderEmptyRow(day) {
        return `
            <tr class="no-attendance">
                <td><strong>${day.day}</strong></td>
                <td>${day.date}</td>
                <td>--:--</td>
                <td>--:--</td>
                <td>0.00</td>
                <td>--</td>
                <td>(No attendance)</td>
                <td>--</td>
            </tr>
        `;
    }

    /**
     * Render summary section
     */
    function renderSummary() {
        if (!timesheetData || !timesheetData.summary) return;

        const summary = timesheetData.summary;
        const period = timesheetData.period;

        summaryCard.style.display = 'block';
        document.getElementById('periodLabel').textContent = 
            `${period.monthName} ${period.year}`;
        document.getElementById('workingDays').textContent = summary.workingDays;
        document.getElementById('daysAttended').textContent = summary.daysAttended;
        document.getElementById('totalHours').textContent = summary.totalHours;

        const missingClockOutItem = document.getElementById('missingClockOutItem');
        if (summary.missingClockOut > 0) {
            missingClockOutItem.style.display = 'block';
            document.getElementById('missingClockOut').textContent = summary.missingClockOut;
        } else {
            missingClockOutItem.style.display = 'none';
        }

        const missingActivityItem = document.getElementById('missingActivityItem');
        if (summary.missingActivity > 0) {
            missingActivityItem.style.display = 'block';
            document.getElementById('missingActivity').textContent = summary.missingActivity;
        } else {
            missingActivityItem.style.display = 'none';
        }
    }

    /**
     * Update activity for attendance record
     */
    window.updateActivity = async function(selectElement) {
        const attendanceId = selectElement.dataset.attendanceId;
        const activityId = selectElement.value;
        
        // Find the description input in the same row
        const row = selectElement.closest('tr');
        const descInput = row.querySelector('.description-input');
        const description = descInput ? descInput.value : '';

        await saveActivity(attendanceId, activityId, description);
    };

    /**
     * Update description for attendance record
     */
    window.updateDescription = async function(inputElement) {
        const attendanceId = inputElement.dataset.attendanceId;
        const description = inputElement.value;
        
        // Find the activity select in the same row
        const row = inputElement.closest('tr');
        const activitySelect = row.querySelector('.activity-select');
        const activityId = activitySelect ? activitySelect.value : '';

        await saveActivity(attendanceId, activityId, description);
    };

    /**
     * Save activity to server
     */
    async function saveActivity(attendanceId, activityId, description) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/timesheet/attendance/${attendanceId}/activity`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    activity_id: activityId || null,
                    activity_description: description || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update activity');
            }

            showAlert('Activity updated successfully', 'success');
            
            // Update local data and re-render summary
            updateLocalData(attendanceId, activityId, description);
            renderSummary();

        } catch (error) {
            console.error('Error updating activity:', error);
            showAlert(error.message, 'error');
        }
    }

    /**
     * Update local timesheet data after save
     */
    function updateLocalData(attendanceId, activityId, description) {
        if (!timesheetData) return;

        for (const day of timesheetData.days) {
            if (day.attendance && day.attendance.id === attendanceId) {
                day.attendance.activityId = activityId;
                day.attendance.activityDescription = description;
                
                // Update activity name
                const activity = activities.find(a => a.id === activityId);
                day.attendance.activityName = activity ? activity.name : null;
                break;
            }
        }

        // Recalculate missing activity count
        timesheetData.summary.missingActivity = timesheetData.days.filter(d => 
            d.attendance && d.attendance.clockIn && !d.attendance.activityId
        ).length;
    }

    /**
     * Preview timesheet HTML
     */
    window.previewTimesheet = async function() {
        if (!timesheetData) return;

        const month = monthSelect.value;
        const year = yearSelect.value;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/timesheet/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    month: parseInt(month, 10),
                    year: parseInt(year, 10),
                    format: 'html'
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to generate preview');
            }

            const html = await response.text();
            const previewWindow = window.open('', '_blank');
            previewWindow.document.write(html);
            previewWindow.document.close();

        } catch (error) {
            console.error('Error generating preview:', error);
            showAlert(error.message, 'error');
        }
    };

    /**
     * Download PDF
     */
    window.downloadPDF = async function() {
        if (!timesheetData) return;

        const month = monthSelect.value;
        const year = yearSelect.value;

        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '⏳ Generating...';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/timesheet/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    month: parseInt(month, 10),
                    year: parseInt(year, 10),
                    format: 'pdf'
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timesheet_${timesheetData.period.monthName}_${year}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showAlert('PDF downloaded successfully', 'success');

        } catch (error) {
            console.error('Error downloading PDF:', error);
            showAlert(error.message, 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '📥 Download PDF';
        }
    };

    /**
     * Show/hide loading state
     */
    function showLoading(show) {
        loadingContainer.style.display = show ? 'block' : 'none';
        if (show) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'none';
        }
        loadBtn.disabled = show;
    }

    /**
     * Enable/disable action buttons
     */
    function enableButtons(enable) {
        previewBtn.disabled = !enable;
        downloadBtn.disabled = !enable;
    }

    /**
     * Show alert message
     */
    function showAlert(message, type = 'info') {
        alertContainer.className = `alert alert-${type}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';

        if (type !== 'error') {
            setTimeout(hideAlert, 5000);
        }
    }

    /**
     * Hide alert message
     */
    function hideAlert() {
        alertContainer.style.display = 'none';
    }

    /**
     * Escape HTML special characters
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Logout function
     */
    window.logout = function() {
        const token = localStorage.getItem('token');
        
        if (token) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).catch(() => {});
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    };

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
