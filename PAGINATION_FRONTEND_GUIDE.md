# 🚀 Pagination Frontend Implementation Guide

## 📋 Overview
All major APIs now support pagination. This guide provides complete implementation details for frontend developers.

## 🔧 API Endpoints with Pagination

### 1. Attendance API
- **Endpoint**: `GET /api/attendance/all`
- **Query Parameters**: `page`, `limit`, `date`, `employeeId`, `status`
- **Response Structure**:
```json
{
  "success": true,
  "message": "Attendance records retrieved successfully",
  "data": {
    "records": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalRecords": 50,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 2. Advance Salary API
- **Endpoint**: `GET /api/advance-salary/all`
- **Query Parameters**: `page`, `limit`, `status`
- **Response Structure**:
```json
{
  "success": true,
  "message": "Advance salary requests retrieved successfully",
  "data": {
    "requests": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalRequests": 25,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 3. Advance Booking API
- **Endpoint**: `GET /api/advance-booking/all`
- **Query Parameters**: `page`, `limit`
- **Response Structure**:
```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": {
    "bookings": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 4,
      "totalBookings": 35,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 4. Expense API
- **Endpoint**: `GET /api/expenses/all`
- **Query Parameters**: `page`, `limit`
- **Response Structure**:
```json
{
  "success": true,
  "data": {
    "expenses": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalExpenses": 15,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 5. Employee API
- **Endpoint**: `GET /api/employees/all`
- **Query Parameters**: `page`, `limit`, `role`
- **Response Structure**:
```json
{
  "message": "Employees retrieved successfully",
  "data": {
    "employees": [...],
    "grouped": {
      "admins": [...],
      "managers": [...],
      "employees": [...]
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalEmployees": 25,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "total": 10
}
```

### 6. Client API
- **Endpoint**: `GET /api/clients/all`
- **Query Parameters**: `page`, `limit`
- **Response Structure**:
```json
{
  "success": true,
  "data": {
    "clients": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 4,
      "totalClients": 40,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## 🎯 Frontend Implementation

### 1. React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PaginatedList = ({ endpoint, title }) => {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const response = await axios.get(`${endpoint}`, {
        params: { page, limit }
      });
      
      // Handle different response structures
      const responseData = response.data.data || response.data;
      const records = responseData.records || 
                     responseData.requests || 
                     responseData.bookings || 
                     responseData.expenses || 
                     responseData.employees || 
                     responseData.clients || 
                     [];
      
      setData(records);
      setPagination(responseData.pagination || {});
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [currentPage, pageSize]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="paginated-list">
      <h2>{title}</h2>
      
      {/* Page Size Selector */}
      <div className="page-size-selector">
        <label>Items per page:</label>
        <select 
          value={pageSize} 
          onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Data Display */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="data-list">
          {data.map((item, index) => (
            <div key={item._id || index} className="data-item">
              {/* Render your data here */}
              <pre>{JSON.stringify(item, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="pagination-controls">
        <button 
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!pagination.hasPrev || loading}
        >
          Previous
        </button>
        
        <span className="page-info">
          Page {pagination.currentPage} of {pagination.totalPages}
          ({pagination.totalRecords || pagination.totalEmployees || pagination.totalClients} total)
        </span>
        
        <button 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!pagination.hasNext || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PaginatedList;
```

### 2. Usage Examples

```jsx
// Attendance Screen
<PaginatedList 
  endpoint="/api/attendance/all" 
  title="Attendance Records" 
/>

// Advance Salary Screen
<PaginatedList 
  endpoint="/api/advance-salary/all" 
  title="Advance Salary Requests" 
/>

// Employee Screen
<PaginatedList 
  endpoint="/api/employees/all" 
  title="Employees" 
/>

// Client Screen
<PaginatedList 
  endpoint="/api/clients/all" 
  title="Clients" 
/>
```

### 3. Advanced Pagination Component

```jsx
const AdvancedPagination = ({ pagination, onPageChange, loading }) => {
  const { currentPage, totalPages, hasNext, hasPrev } = pagination;
  
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="advanced-pagination">
      <button 
        onClick={() => onPageChange(1)}
        disabled={!hasPrev || loading}
        className="first-page"
      >
        First
      </button>
      
      <button 
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrev || loading}
        className="prev-page"
      >
        Previous
      </button>
      
      {getPageNumbers().map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          disabled={loading}
          className={page === currentPage ? 'active' : ''}
        >
          {page}
        </button>
      ))}
      
      <button 
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext || loading}
        className="next-page"
      >
        Next
      </button>
      
      <button 
        onClick={() => onPageChange(totalPages)}
        disabled={!hasNext || loading}
        className="last-page"
      >
        Last
      </button>
    </div>
  );
};
```

### 4. CSS Styles

```css
.paginated-list {
  padding: 20px;
}

.page-size-selector {
  margin-bottom: 20px;
}

.page-size-selector select {
  margin-left: 10px;
  padding: 5px;
}

.data-list {
  margin-bottom: 20px;
}

.data-item {
  border: 1px solid #ddd;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 4px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.pagination-controls button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
}

.pagination-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-controls button.active {
  background: #007bff;
  color: white;
}

.page-info {
  margin: 0 20px;
  font-weight: bold;
}

.advanced-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 20px;
}

.advanced-pagination button {
  padding: 8px 12px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  min-width: 40px;
}

.advanced-pagination button.active {
  background: #007bff;
  color: white;
}

.advanced-pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## 🚀 Implementation Steps

### Step 1: Update API Calls
Replace existing API calls with pagination parameters:

```javascript
// Before
const response = await axios.get('/api/employees/all');

// After
const response = await axios.get('/api/employees/all', {
  params: { page: 1, limit: 10 }
});
```

### Step 2: Handle Response Structure
Update response handling to work with new structure:

```javascript
// Before
const employees = response.data;

// After
const employees = response.data.employees || response.data.data.employees;
const pagination = response.data.pagination || response.data.data.pagination;
```

### Step 3: Add Pagination State
Add pagination state to your components:

```javascript
const [pagination, setPagination] = useState({
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  hasNext: false,
  hasPrev: false
});
```

### Step 4: Implement Pagination Controls
Add pagination controls to your UI:

```jsx
<div className="pagination">
  <button 
    onClick={() => handlePageChange(currentPage - 1)}
    disabled={!pagination.hasPrev}
  >
    Previous
  </button>
  
  <span>
    Page {pagination.currentPage} of {pagination.totalPages}
  </span>
  
  <button 
    onClick={() => handlePageChange(currentPage + 1)}
    disabled={!pagination.hasNext}
  >
    Next
  </button>
</div>
```

## 🧪 Testing

### Test Different Page Sizes
```javascript
const pageSizes = [5, 10, 20, 50];
pageSizes.forEach(size => {
  // Test with different page sizes
  fetchData(1, size);
});
```

### Test Edge Cases
```javascript
// Test with page 0
fetchData(0, 10);

// Test with very large page
fetchData(999, 10);

// Test with limit 0
fetchData(1, 0);
```

## 📱 Mobile Responsive Design

```css
@media (max-width: 768px) {
  .pagination-controls {
    flex-direction: column;
    gap: 10px;
  }
  
  .page-info {
    margin: 10px 0;
  }
  
  .advanced-pagination {
    flex-wrap: wrap;
  }
}
```

## 🔧 Error Handling

```javascript
const fetchData = async (page, limit) => {
  try {
    setLoading(true);
    const response = await axios.get(endpoint, {
      params: { page, limit }
    });
    
    if (response.data.success) {
      setData(response.data.data.records || []);
      setPagination(response.data.data.pagination || {});
    } else {
      throw new Error(response.data.message || 'Failed to fetch data');
    }
  } catch (error) {
    console.error('Error:', error);
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

## 🎯 Performance Tips

1. **Debounce API calls** when changing page size
2. **Cache data** for previously visited pages
3. **Use loading states** to improve UX
4. **Implement virtual scrolling** for large datasets
5. **Add search and filtering** to reduce data load

## 📋 Checklist

- [ ] Update all API calls to include pagination parameters
- [ ] Handle new response structure in all components
- [ ] Add pagination state management
- [ ] Implement pagination controls
- [ ] Add loading states
- [ ] Test with different page sizes
- [ ] Test edge cases (page 0, large page numbers)
- [ ] Add error handling
- [ ] Make responsive for mobile
- [ ] Add performance optimizations

## 🚀 Ready to Implement!

All backend APIs are now ready with pagination support. Follow this guide to implement pagination in your frontend application.
