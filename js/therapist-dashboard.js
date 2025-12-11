// AuraTheracare - Therapist Dashboard
// Manages therapist interface, client management, and attendance logging

let currentUser = null;
let calendar = null;
let selectedCustomer = null;

document.addEventListener('DOMContentLoaded', function() {
    // Protect page - only therapists can access
    currentUser = protectPage('therapist');
    if (!currentUser) return;

    // Display therapist name
    document.getElementById('therapistName').textContent = currentUser.name;

    // Initialize dashboard
    initializeDashboard();

    // Setup event listeners
    setupEventListeners();

    // Load initial view
    loadClientsView();

    setupLiveUpdates();
});

function initializeDashboard() {
    // Update stats
    updateStats();
    
    // Setup month selector for revenue view
    const revenueMonth = document.getElementById('revenueMonth');
    const today = new Date();
    revenueMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function setupEventListeners() {
    // Sidebar navigation
    const sidebarItems = document.querySelectorAll('.sidebar-menu li');
    console.log('Found sidebar items:', sidebarItems.length);
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            console.log('Clicked on view:', view);
            switchView(view);
        });
    });
    
    // Client search
    document.getElementById('clientSearch').addEventListener('input', filterClients);
    
    // Calendar client selector
    document.getElementById('calendarClientSelect').addEventListener('change', function() {
        selectedCustomer = this.value;
        if (selectedCustomer && calendar) {
            loadCalendarEvents();
        }
    });
    
    // Revenue month selector
    document.getElementById('revenueMonth').addEventListener('change', loadRevenueData);
    
    // Attendance form
    document.getElementById('attendanceForm').addEventListener('submit', handleAttendanceSave);
}

function setupLiveUpdates() {
    const es = new EventSource('/api/events');
    es.addEventListener('attendance_added', function(e) {
        try {
            JSON.parse(e.data);
        } catch (err) {}
        updateStats();
        loadClientsView();
        if (selectedCustomer) {
            loadCalendarEvents();
        }
        loadRevenueData();
    });
    es.addEventListener('user_registered', function(e) {
        updateStats();
        loadClientsView();
    });
    es.addEventListener('user_deleted', function(e) {
        updateStats();
        loadClientsView();
        loadRevenueData();
    });
}

function switchView(view) {
    // Update sidebar active state
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected view
    const viewId = view + 'View';
    document.getElementById(viewId).classList.add('active');
    
    // Load view-specific data
    switch(view) {
        case 'clients':
            loadClientsView();
            break;
        case 'calendar':
            loadCalendarView();
            break;
        case 'revenue':
            loadRevenueData();
            break;
    }
}

async function updateStats() {
    const stats = await getTherapistStats();

    document.getElementById('totalClients').textContent = stats.totalClients;
    document.getElementById('totalSessionsMonth').textContent = stats.totalSessions;
    document.getElementById('monthlyRevenue').textContent = formatCurrency(stats.totalRevenue);
}

// ===== CLIENTS VIEW =====
async function loadClientsView() {
    const customers = await getAllCustomers();
    const tbody = document.getElementById('clientsTableBody');

    tbody.innerHTML = '';

    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-users"></i><br>No clients found</td></tr>';
        return;
    }

    for (const customer of customers) {
        const stats = await getCustomerStats(customer._id || customer.id);

        const row = document.createElement('tr');
        const cid = customer._id || customer.id;
        const todayStr = new Date().toISOString().split('T')[0];
        row.innerHTML = `
            <td><strong>${customer.name}</strong></td>
            <td>${customer.email}</td>
            <td>${customer.phone || 'N/A'}</td>
            <td>${stats.lastVisit ? formatDate(stats.lastVisit) : 'N/A'}</td>
            <td>${stats.totalSessions}</td>
            <td><strong>${formatCurrency(stats.totalCost)}</strong></td>
            <td>
                <div class="actions-menu">
                    <button class="action-btn actions-trigger" aria-label="Actions" onclick="toggleActionsMenu('actions-${cid}')">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                    <div class="actions-dropdown" id="actions-${cid}">
                        <button class="menu-item" onclick="viewClientAttendance('${cid}')"><i class="fas fa-eye"></i> View Attendance</button>
                        <button class="menu-item" onclick="openAttendanceModal('${cid}', '${todayStr}')"><i class="fas fa-plus"></i> Add Attendance</button>
                        <button class="menu-item" onclick="downloadCustomerPdf('${cid}')"><i class="fas fa-file-pdf"></i> Download PDF</button>
                        <button class="menu-item danger" onclick="deleteCustomer('${cid}')"><i class="fas fa-user-slash"></i> Delete Customer</button>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    }
}

async function downloadCustomerPdf(customerId) {
    const monthInputEl = document.getElementById('revenueMonth');
    const today = new Date();
    const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthInput = monthInputEl ? monthInputEl.value || fallback : fallback;
    const [yearStr, monthStr] = monthInput.split('-');
    const year = parseInt(yearStr);
    const monthIdx = parseInt(monthStr) - 1;

    const invoice = await getMonthlyInvoiceData(customerId, monthIdx, year);
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        alert('PDF library not loaded. Please check your network connection.');
        return;
    }

    const doc = new jsPDF();
    const title = `AuraTherapyCare Monthly Invoice`;
    const sub = `${getMonthName(monthIdx)} ${year}`;
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.text(`Client: ${invoice.customer.name}`, 14, 28);
    doc.text(`Email: ${invoice.customer.email || ''}`, 14, 34);
    doc.text(`Period: ${sub}`, 14, 40);

    let y = 50;
    doc.setFontSize(12);
    doc.text('Date', 14, y);
    doc.text('Therapy', 60, y);
    doc.text('Price (₹)', 140, y);
    y += 6;

    invoice.records.forEach(r => {
        const therapy = r.therapyType || r.therapy_type;
        doc.text(formatDate(r.date), 14, y);
        doc.text(String(therapy), 60, y);
        doc.text(String(r.price), 140, y);
        y += 6;
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    });

    y += 6;
    doc.setFontSize(13);
    doc.text(`Total Sessions: ${invoice.totalSessions}`, 14, y);
    doc.text(`Total Amount: ${formatCurrency(invoice.totalAmount)}`, 110, y);

    const fileName = `Invoice_${invoice.customer.name.replace(/\s+/g,'_')}_${year}-${String(monthIdx+1).padStart(2,'0')}.pdf`;
    doc.save(fileName);
}

async function deleteCustomer(userId) {
    if (!confirm('Delete this customer and all their attendance records?')) return;
    const result = await deleteUser(userId);
    if (result.success) {
        await updateStats();
        await loadClientsView();
        alert('Customer deleted successfully');
    } else {
        alert(result.message);
    }
}

function toggleActionsMenu(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isOpen = el.classList.contains('show');
    document.querySelectorAll('.actions-dropdown.show').forEach(d => d.classList.remove('show'));
    if (!isOpen) {
        el.classList.add('show');
        requestAnimationFrame(() => adjustActionsDropdown(id));
    }
}

function showActionsMenu(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('show');
        requestAnimationFrame(() => adjustActionsDropdown(id));
    }
}

function hideActionsMenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
}

document.addEventListener('click', function(e) {
    const isTrigger = e.target.closest('.actions-trigger');
    const isMenu = e.target.closest('.actions-menu');
    if (!isTrigger && !isMenu) {
        document.querySelectorAll('.actions-dropdown.show').forEach(d => d.classList.remove('show'));
    }
});

function adjustActionsDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.top;
    const estimated = Math.max(180, Math.min(el.scrollHeight || 220, 300));
    if (spaceBelow < estimated) {
        el.classList.add('up');
    } else {
        el.classList.remove('up');
    }
}

function filterClients() {
    const searchTerm = document.getElementById('clientSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#clientsTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function viewClientAttendance(customerId) {
    const customer = await getUserById(customerId);
    const records = await getAttendanceRecords({ customerId });
    
    const modal = document.getElementById('viewAttendanceModal');
    const content = document.getElementById('attendanceRecordsContent');
    
    if (records.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>No attendance records found for ${customer.name}</p>
            </div>
        `;
    } else {
        let html = `<h4>${customer.name}'s Attendance History</h4>`;
        
        // Group records by month
        const recordsByMonth = {};
        records.forEach(record => {
            const date = new Date(record.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (!recordsByMonth[monthKey]) {
                recordsByMonth[monthKey] = [];
            }
            recordsByMonth[monthKey].push(record);
        });
        
        Object.keys(recordsByMonth).sort().reverse().forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthRecords = recordsByMonth[monthKey];
            const monthTotal = monthRecords.reduce((sum, r) => sum + r.price, 0);
            
            html += `
                <div style="margin: 20px 0;">
                    <h5>${getMonthName(parseInt(month))} ${year} - ${formatCurrency(monthTotal)}</h5>
            `;
            
            monthRecords.forEach(record => {
                html += `
                    <div class="attendance-record-item">
                        <div class="record-info">
                            <div class="record-date">${formatDate(record.date)}</div>
                            <div class="record-therapy">${record.therapyType} - ${formatCurrency(record.price)}</div>
                        </div>
                        <div class="record-actions">
                            <button class="action-btn delete" onclick="deleteRecord('${record.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        content.innerHTML = html;
    }
    
    modal.classList.add('show');
}

function closeViewAttendanceModal() {
    document.getElementById('viewAttendanceModal').classList.remove('show');
}

async function deleteRecord(recordId) {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        await deleteAttendanceRecord(recordId);
        await updateStats();
        await loadClientsView();
        closeViewAttendanceModal();
    }
}

// ===== CALENDAR VIEW =====
async function loadCalendarView() {
    // Populate customer selector
    const customers = await getAllCustomers();
    const select = document.getElementById('calendarClientSelect');

    select.innerHTML = '<option value="">-- Select a client --</option>';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer._id || customer.id;
        option.textContent = customer.name;
        select.appendChild(option);
    });

    // Initialize calendar if not already done
    if (!calendar) {
        initializeCalendar();
    }
}

function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');

    if (typeof FullCalendar === 'undefined') {
        console.error('FullCalendar is not loaded. Please check the CDN link.');
        calendarEl.innerHTML = '<p>Calendar could not be loaded. Please refresh the page.</p>';
        return;
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek'
        },
        events: [],
        dateClick: function(info) {
            if (selectedCustomer) {
                openAttendanceModal(selectedCustomer, info.dateStr);
            } else {
                alert('Please select a client first');
            }
        },
        eventClick: function(info) {
            // Show event details
            const event = info.event;
            alert(`${event.title}\nDate: ${formatDate(event.startStr)}`);
        }
    });

    calendar.render();
}

async function loadCalendarEvents() {
    if (!calendar || !selectedCustomer) return;

    const records = await getAttendanceRecords({ customerId: selectedCustomer });

    // Group records by date to show badge count
    const recordsByDate = {};
    records.forEach(record => {
        if (!recordsByDate[record.date]) {
            recordsByDate[record.date] = [];
        }
        recordsByDate[record.date].push(record);
    });

    // Create events for calendar
    const events = [];
    Object.keys(recordsByDate).forEach(date => {
        const dayRecords = recordsByDate[date];
        const hasBiolite = dayRecords.some(r => r.therapy_type === 'Biolite');
        const hasTerahertz = dayRecords.some(r => r.therapy_type === 'Terahertz');

        let title = '';
        let className = '';

        if (hasBiolite && hasTerahertz) {
            title = `Both (${dayRecords.length})`;
            className = 'both-event';
        } else if (hasBiolite) {
            title = `Biolite (${dayRecords.length})`;
            className = 'biolite-event';
        } else {
            title = `Terahertz (${dayRecords.length})`;
            className = 'terahertz-event';
        }

        events.push({
            title: title,
            start: date,
            className: className,
            allDay: true
        });
    });

    calendar.removeAllEvents();
    calendar.addEventSource(events);
}

// ===== ATTENDANCE MODAL =====
async function openAttendanceModal(customerId, date) {
    const customer = await getUserById(customerId);

    document.getElementById('attendanceCustomerId').value = customerId;
    document.getElementById('attendanceClientName').value = customer.name;
    document.getElementById('attendanceDate').value = date;
    document.getElementById('attendanceRecordId').value = '';

    // Check existing records for this date
    const existingRecords = await getAttendanceByDate(customerId, date);
    const hasBiolite = existingRecords.some(r => r.therapyType === 'Biolite');
    const hasTerahertz = existingRecords.some(r => r.therapyType === 'Terahertz');
    
    // Uncheck all by default
    document.getElementById('therapyBiolite').checked = false;
    document.getElementById('therapyTerahertz').checked = false;
    
    // Show info if records exist
    const errorDiv = document.getElementById('attendanceError');
    if (existingRecords.length > 0) {
        errorDiv.textContent = `Note: ${existingRecords.length} session(s) already recorded for this date`;
        errorDiv.style.backgroundColor = '#FFF3E0';
        errorDiv.style.color = '#E65100';
        errorDiv.classList.add('show');
    } else {
        errorDiv.textContent = '';
        errorDiv.classList.remove('show');
    }
    
    document.getElementById('attendanceModal').classList.add('show');
}

function closeAttendanceModal() {
    document.getElementById('attendanceModal').classList.remove('show');
    document.getElementById('attendanceForm').reset();
    document.getElementById('attendanceError').classList.remove('show');
}

async function handleAttendanceSave(e) {
    e.preventDefault();

    const customerId = document.getElementById('attendanceCustomerId').value;
    const date = document.getElementById('attendanceDate').value;
    const bioliteChecked = document.getElementById('therapyBiolite').checked;
    const terahertzChecked = document.getElementById('therapyTerahertz').checked;
    const errorDiv = document.getElementById('attendanceError');

    // Validate at least one therapy is selected
    if (!bioliteChecked && !terahertzChecked) {
        errorDiv.textContent = 'Please select at least one therapy type';
        errorDiv.classList.add('show');
        return;
    }

    // Prepare therapy types array
    const therapyTypes = [];
    if (bioliteChecked) therapyTypes.push('Biolite');
    if (terahertzChecked) therapyTypes.push('Terahertz');

    // Add attendance records
    const result = await addMultipleAttendanceRecords(
        customerId,
        date,
        therapyTypes,
        currentUser.id
    );

    if (result.success) {
        closeAttendanceModal();
        await updateStats();
        await loadCalendarEvents();
        await loadClientsView();

        alert(`Successfully recorded ${therapyTypes.length} session(s) for ${formatDate(date)}`);
    }
}

// ===== REVENUE VIEW =====
async function loadRevenueData() {
    const monthInput = document.getElementById('revenueMonth').value;
    const [year, month] = monthInput.split('-');
    const monthIndex = parseInt(month) - 1;

    const revenue = await getRevenueBreakdown(monthIndex, parseInt(year));

    // Update summary cards
    document.getElementById('bioliteCount').textContent = `${revenue.biolite.count} sessions`;
    document.getElementById('bioliteAmount').textContent = formatCurrency(revenue.biolite.amount);

    document.getElementById('terahertzCount').textContent = `${revenue.terahertz.count} sessions`;
    document.getElementById('terahertzAmount').textContent = formatCurrency(revenue.terahertz.amount);

    document.getElementById('totalSessionsRevenue').textContent = `${revenue.total.count} sessions`;
    document.getElementById('totalAmountRevenue').textContent = formatCurrency(revenue.total.amount);

    // Update breakdown table
    const tbody = document.getElementById('revenueBreakdownBody');
    tbody.innerHTML = '';

    if (revenue.breakdown.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-chart-line"></i><br>No revenue data for this month</td></tr>';
        return;
    }

    revenue.breakdown.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.customerName}</strong></td>
            <td>${item.bioliteCount}</td>
            <td>${item.terahertzCount}</td>
            <td><strong>${item.totalSessions}</strong></td>
            <td><strong>${formatCurrency(item.totalAmount)}</strong></td>
        `;
        tbody.appendChild(row);
    });
}
