// AuraTheracare - Data Management
// This file handles all data storage and retrieval using localStorage

// Pricing Configuration
const THERAPY_PRICES = {
    'Biolite': 300,
    'Terahertz': 400
};

// Initialize Data Structure
function initializeData() {
    // Initialize users if not exists
    if (!localStorage.getItem('users')) {
        const users = [
            // Hardcoded Admin Account
            {
                id: 'admin-001',
                name: 'Jay Thakkar',
                email: 'coderjt25@gmail.com',
                password: 'jayadmin2024',
                role: 'therapist',
                phone: '+91 98765 43210',
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem('users', JSON.stringify(users));
    }

    // Initialize attendance records if not exists
    if (!localStorage.getItem('attendanceRecords')) {
        const attendanceRecords = [];
        localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
    }
}



// Generate unique record ID
function generateRecordId() {
    return 'record-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// User Management Functions
function registerUser(userData) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Check if email already exists
    if (users.some(user => user.email === userData.email)) {
        return { success: false, message: 'Email already registered' };
    }
    
    const newUser = {
        id: 'customer-' + Date.now(),
        name: userData.name,
        email: userData.email,
        password: userData.password,
        phone: userData.phone,
        role: 'customer', // Always customer for new registrations
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    return { success: true, message: 'Registration successful', user: newUser };
}

function loginUser(email, password) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        // Store current user session
        const sessionUser = { ...user };
        delete sessionUser.password; // Don't store password in session
        localStorage.setItem('currentUser', JSON.stringify(sessionUser));
        return { success: true, user: sessionUser };
    }
    
    return { success: false, message: 'Invalid email or password' };
}

function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

function logoutUser() {
    localStorage.removeItem('currentUser');
}

function getAllCustomers() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    return users.filter(user => user.role === 'customer');
}

function getUserById(userId) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    return users.find(user => user.id === userId);
}

// Attendance Record Functions
function addAttendanceRecord(record) {
    const records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    
    const newRecord = {
        id: generateRecordId(),
        customerId: record.customerId,
        date: record.date,
        therapyType: record.therapyType,
        price: THERAPY_PRICES[record.therapyType],
        recordedBy: record.recordedBy,
        recordedAt: new Date().toISOString()
    };
    
    records.push(newRecord);
    localStorage.setItem('attendanceRecords', JSON.stringify(records));
    
    return { success: true, record: newRecord };
}

function addMultipleAttendanceRecords(customerId, date, therapyTypes, recordedBy) {
    const records = [];
    
    therapyTypes.forEach(therapyType => {
        const result = addAttendanceRecord({
            customerId,
            date,
            therapyType,
            recordedBy
        });
        
        if (result.success) {
            records.push(result.record);
        }
    });
    
    return { success: true, records };
}

function getAttendanceRecords(filters = {}) {
    let records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    
    // Apply filters
    if (filters.customerId) {
        records = records.filter(r => r.customerId === filters.customerId);
    }
    
    if (filters.date) {
        records = records.filter(r => r.date === filters.date);
    }
    
    if (filters.month && filters.year) {
        records = records.filter(r => {
            const recordDate = new Date(r.date);
            return recordDate.getMonth() === filters.month && 
                   recordDate.getFullYear() === filters.year;
        });
    }
    
    if (filters.startDate && filters.endDate) {
        records = records.filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= new Date(filters.startDate) && 
                   recordDate <= new Date(filters.endDate);
        });
    }
    
    // Sort by date (most recent first)
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return records;
}

function deleteAttendanceRecord(recordId) {
    let records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    records = records.filter(r => r.id !== recordId);
    localStorage.setItem('attendanceRecords', JSON.stringify(records));
    return { success: true };
}

function getAttendanceByDate(customerId, date) {
    const records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    return records.filter(r => r.customerId === customerId && r.date === date);
}

// Statistics Functions
function getCustomerStats(customerId) {
    const records = getAttendanceRecords({ customerId });
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Current month records
    const currentMonthRecords = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getFullYear() === currentYear;
    });
    
    // Calculate totals
    const totalSessions = currentMonthRecords.length;
    const totalCost = currentMonthRecords.reduce((sum, r) => sum + r.price, 0);
    
    // Last visit
    const lastVisit = records.length > 0 ? records[0].date : null;
    
    return {
        totalSessions,
        totalCost,
        lastVisit,
        currentMonthRecords
    };
}

function getTherapistStats() {
    const customers = getAllCustomers();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    let totalSessions = 0;
    let totalRevenue = 0;
    
    customers.forEach(customer => {
        const records = getAttendanceRecords({
            customerId: customer.id,
            month: currentMonth,
            year: currentYear
        });
        
        totalSessions += records.length;
        totalRevenue += records.reduce((sum, r) => sum + r.price, 0);
    });
    
    return {
        totalClients: customers.length,
        totalSessions,
        totalRevenue
    };
}

function getRevenueBreakdown(month, year) {
    const customers = getAllCustomers();
    const breakdown = [];
    
    let totalBiolite = 0;
    let totalTerahertz = 0;
    let bioliteCount = 0;
    let terahertzCount = 0;
    
    customers.forEach(customer => {
        const records = getAttendanceRecords({
            customerId: customer.id,
            month,
            year
        });
        
        const bioliteRecords = records.filter(r => r.therapyType === 'Biolite');
        const terahertzRecords = records.filter(r => r.therapyType === 'Terahertz');
        
        const bioliteTotal = bioliteRecords.length * THERAPY_PRICES.Biolite;
        const terahertzTotal = terahertzRecords.length * THERAPY_PRICES.Terahertz;
        
        totalBiolite += bioliteTotal;
        totalTerahertz += terahertzTotal;
        bioliteCount += bioliteRecords.length;
        terahertzCount += terahertzRecords.length;
        
        if (records.length > 0) {
            breakdown.push({
                customerId: customer.id,
                customerName: customer.name,
                bioliteCount: bioliteRecords.length,
                terahertzCount: terahertzRecords.length,
                totalSessions: records.length,
                totalAmount: bioliteTotal + terahertzTotal
            });
        }
    });
    
    return {
        biolite: { count: bioliteCount, amount: totalBiolite },
        terahertz: { count: terahertzCount, amount: totalTerahertz },
        total: {
            count: bioliteCount + terahertzCount,
            amount: totalBiolite + totalTerahertz
        },
        breakdown
    };
}

// Export Functions
function getMonthlyInvoiceData(customerId, month, year) {
    const customer = getUserById(customerId);
    const records = getAttendanceRecords({
        customerId,
        month,
        year
    });
    
    // Group records by date
    const recordsByDate = {};
    records.forEach(record => {
        if (!recordsByDate[record.date]) {
            recordsByDate[record.date] = [];
        }
        recordsByDate[record.date].push(record);
    });
    
    const invoiceData = {
        customer,
        month,
        year,
        records,
        recordsByDate,
        totalSessions: records.length,
        totalAmount: records.reduce((sum, r) => sum + r.price, 0),
        generatedAt: new Date().toISOString()
    };
    
    return invoiceData;
}

// Utility Functions
function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function getMonthName(monthIndex) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
}

function isExportAvailable() {
    const today = new Date();
    return today.getDate() >= 4;
}

function getPreviousMonth() {
    const today = new Date();
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
        month: previousMonth.getMonth(),
        year: previousMonth.getFullYear(),
        name: getMonthName(previousMonth.getMonth()) + ' ' + previousMonth.getFullYear()
    };
}

// Initialize data on load
initializeData();
