// =============================================
// BANDAPTAI APARTMENTS - MAIN SERVER
// =============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth.routes');
const apartmentRoutes = require('./routes/apartment.routes');
const unitRoutes = require('./routes/unit.routes');
const tenantRoutes = require('./routes/tenant.routes');
const rentRoutes = require('./routes/rent.routes');
const expenseRoutes = require('./routes/expense.routes');
const staffRoutes = require('./routes/staff.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificationRoutes = require('./routes/notification.routes');
const announcementRoutes = require('./routes/announcement.routes'); // NEW

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================
// HEALTH CHECK
// =============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Bandaptai Apartments API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// API ROUTES
// =============================================
app.use('/api/auth', authRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/rent', rentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes); // NEW

// =============================================
// 404 HANDLER
// =============================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// =============================================
// ERROR HANDLER
// =============================================
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
    console.log(`🏢 Bandaptai Apartments API running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
