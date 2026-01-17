# GTO Trading Corporation Employee Leave Tracker Tool

## Overview
A comprehensive Employee Leave Tracker Tool for GTO Trading Corporation serving 200+ employees across 11 departments. The system features role-based access control, PTO credit tracking with LWOP handling, leave filing with 7 leave types, approval workflows with designated department approvers, file attachments via object storage, and audit logging.

## Departments (11 total)
1. Human Resources (HR)
2. IT & Digital Transformation
3. Accounting
4. Credit & Collection
5. Sales
6. Business Unit
7. Business Support Group
8. Operations (Logistics)
9. Operations (Frontline)
10. Operations (Warehouse)
11. Top Management

## Project Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Custom email/password auth with bcrypt hashing and PostgreSQL session store
- **File Storage**: Replit Object Storage
- **Styling**: TailwindCSS with GTO brand colors (black/gold)

### Directory Structure
```
├── client/src/
│   ├── pages/           # React page components
│   │   ├── login.tsx    # Login page (Replit Auth)
│   │   ├── complete-profile.tsx # Profile completion for new users
│   │   ├── dashboard.tsx # Employee dashboard
│   │   ├── file-leave.tsx # Leave filing form
│   │   ├── my-leaves.tsx # Leave history
│   │   ├── approvals.tsx # Manager approvals
│   │   ├── employees.tsx # HR employee directory
│   │   ├── reports.tsx   # HR reports & analytics
│   │   ├── admin.tsx     # IT admin panel
│   │   └── executive.tsx # Executive dashboard
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   ├── app-sidebar.tsx # Navigation sidebar
│   │   ├── status-badge.tsx # Status indicators
│   │   └── leave-type-icon.tsx # Leave type icons
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and auth
├── server/
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Database operations
│   └── db.ts            # Database connection
└── shared/
    └── schema.ts        # Database schema & types
```

### User Roles
1. **Employee** - File leaves, view own history
2. **Manager** - Approve leaves for department
3. **HR** - View all employees, generate reports
4. **Admin (IT)** - User management, audit logs
5. **Top Management** - Executive dashboard

### Key Features
- Replit Auth with profile completion for new users
- 5 PTO credits per employee per year
- LWOP handling when PTO exhausted
- 7 leave types: Vacation, Sick, Emergency, Bereavement, Maternity, Paternity, Indefinite
- File attachments for leave requests
- Approval workflow with audit logging
- PDF/Excel report generation
- Dark mode support

### API Endpoints
- `POST /api/auth/register` - Register new user with employee details
- `POST /api/auth/login` - Login with email/password
- `POST /api/logout` - User logout
- `GET /api/auth/me` - Current authenticated user
- `GET /api/dashboard` - Dashboard stats
- `POST /api/leave-requests` - File leave
- `GET /api/leave-requests` - User's leaves
- `GET /api/leave-requests/pending` - Pending approvals
- `PATCH /api/leave-requests/:id/approve` - Approve leave
- `PATCH /api/leave-requests/:id/reject` - Reject leave
- `GET /api/employees` - Employee list (HR/Admin)
- `GET /api/reports` - Analytics (HR/Admin)
- `GET /api/executive/dashboard` - Executive view

## Recent Changes
- 2026-01-15: Initial system implementation with all core features
- 2026-01-15: Fixed frontend-backend API alignment
- 2026-01-15: Added department scoping for manager approvals
- 2026-01-15: Improved PTO/LWOP audit logging accuracy
- 2026-01-15: Enhanced session security with environment-aware configuration
- 2026-01-17: Added designated leave approvers per department
- 2026-01-17: Department is now unchangeable after registration (read-only in admin panel)
- 2026-01-17: Approval workflow updated to route only to designated approvers or HR/Admin
- 2026-01-17: Custom email/password authentication with bcrypt hashing
- 2026-01-17: Sessions stored in PostgreSQL via connect-pg-simple
- 2026-01-17: Email validation accepts both @gtotradingcorp.com and @gmail.com domains
- 2026-01-17: Registration captures all employee data (employeeId, department, position, level) upfront
- 2026-01-17: Added Settings page (/settings) for IT department and admins to configure department approvers
- 2026-01-17: Fixed LSP errors related to nullable User fields (fullName, email, employeeId, department)

## Development Notes
- Run `npm run dev` to start the application
- Run `npm run db:push` to sync database schema
- SESSION_SECRET environment variable is required
- Design follows design_guidelines.md for GTO branding
