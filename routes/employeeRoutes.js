const express = require('express');
const router = express.Router();
const { 
  addEmployee, 
  getAllEmployees, 
  getEmployeeById, 
  updateEmployee, 
  deleteEmployee,
  getEmployeesByRole,
  getEmployeeStats,
  handleFileUpload 
} = require('../controller/employeeController');

// Add employee or manager
router.post('/add', handleFileUpload, addEmployee);

// Get all employees (with role filter)
router.get('/all', getAllEmployees);

// Get employees by role (managers or employees)
router.get('/role/:role', getEmployeesByRole);

// Get employee statistics
router.get('/stats', getEmployeeStats);

// Get employee by ID
router.get('/:id', getEmployeeById);

// Update employee
router.put('/:id', handleFileUpload, updateEmployee);

// Delete employee
router.delete('/:id', deleteEmployee);

module.exports = router; 