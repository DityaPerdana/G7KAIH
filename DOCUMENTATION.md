# G7 KAIH - Documentation Index

Welcome to the G7 KAIH project documentation! This index will help you navigate through all available documentation.

## 📚 Documentation Overview

This project is an educational activity management system built with Next.js 15, Supabase, and Cloudinary. The documentation is organized into several files to help you understand different aspects of the system.

## 📖 Available Documentation

### 1. **[API Documentation (API.md)](./API.md)**
Complete reference for all API endpoints, including:
- Authentication and authorization
- Activity management endpoints
- Category and kegiatan (task) management
- User profile management
- Teacher, parent, and admin APIs
- File upload handling
- Error handling and best practices

**When to use:** When you need to integrate with the API, understand endpoint behavior, or troubleshoot API issues.

### 2. **[Backend Architecture (BACKEND.md)](./BACKEND.md)**
In-depth backend architecture documentation covering:
- Tech stack and architecture patterns
- Complete database schema with SQL definitions
- Authentication & authorization flows
- File storage with Cloudinary
- Middleware and routing
- Data flow diagrams
- Key features implementation
- Development and deployment guides

**When to use:** When setting up the project, understanding system architecture, or contributing to backend development.

### 3. **[Teacher Dashboard Refactor (TEACHER_DASHBOARD_REFACTOR.md)](./TEACHER_DASHBOARD_REFACTOR.md)**
Details about the teacher dashboard refactoring:
- Route structure and organization
- Component breakdown
- Migration from monolithic to modular design
- URL patterns and navigation

**When to use:** When working on teacher-related features or understanding the dashboard structure.

### 4. **[Parent Features (PARENT_FEATURES_README.md)](./PARENT_FEATURES_README.md)**
Parent dashboard implementation guide:
- Database changes required
- API endpoints for parents
- Parent-student linking
- Calendar and comment features

**When to use:** When implementing or modifying parent-related functionality.

## 🚀 Quick Start Guide

### For Developers New to the Project

1. **Start here:** [BACKEND.md - Overview](./BACKEND.md#overview) to understand what the system does
2. **Then read:** [BACKEND.md - Tech Stack](./BACKEND.md#tech-stack) to understand the technologies
3. **Set up environment:** Follow [BACKEND.md - Development Guide](./BACKEND.md#development-guide)
4. **Understand APIs:** Read [API.md](./API.md) to understand available endpoints

### For Frontend Developers

1. **API Reference:** [API.md](./API.md) - All endpoints and request/response formats
2. **Authentication:** [BACKEND.md - Authentication & Authorization](./BACKEND.md#authentication--authorization)
3. **User Roles:** [API.md - Role-Based Access Control](./API.md#role-based-access-control)

### For Backend Developers

1. **Architecture:** [BACKEND.md - Architecture](./BACKEND.md#architecture)
2. **Database Schema:** [BACKEND.md - Database Schema](./BACKEND.md#database-schema)
3. **Key Features:** [BACKEND.md - Key Features](./BACKEND.md#key-features)
4. **API Layer:** [BACKEND.md - API Layer](./BACKEND.md#api-layer)

### For DevOps/Deployment

1. **Environment Setup:** [BACKEND.md - Environment Variables](./BACKEND.md#environment-variables)
2. **Deployment Guide:** [BACKEND.md - Deployment](./BACKEND.md#deployment)
3. **Security:** [BACKEND.md - Security Considerations](./BACKEND.md#security-considerations)

## 🔑 Key Concepts

### User Roles
The system supports multiple user roles:
- **Admin**: Full system access, user management
- **Teacher**: View and monitor students in their class
- **Guru Wali**: Homeroom teacher with extended permissions
- **Student**: Submit daily activities
- **Parent**: View their child's activities

### Core Features
1. **Daily Activity Submission**: Students submit activities with a one-per-day limit
2. **Submission Window**: Admin-controlled global submission toggle
3. **Class-Based Filtering**: Teachers see only their class students
4. **File Uploads**: Image and document support via Cloudinary
5. **Comments**: Teachers and parents can comment on student activities
6. **Dynamic Fields**: Admin-configurable activity fields

### Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Cloudinary
- **Testing**: Vitest, React Testing Library

## 📋 Common Tasks

### Adding a New API Endpoint
1. Read [BACKEND.md - Route Handlers](./BACKEND.md#route-handlers-api-routes)
2. Follow the pattern in [BACKEND.md - API Layer](./BACKEND.md#api-layer)
3. Add authentication/authorization checks
4. Update [API.md](./API.md) with the new endpoint

### Modifying Database Schema
1. Review current schema in [BACKEND.md - Database Schema](./BACKEND.md#database-schema)
2. Plan migrations carefully (no automated migration system currently)
3. Update documentation in BACKEND.md
4. Test thoroughly before deployment

### Understanding Data Flow
1. Check [BACKEND.md - Data Flow](./BACKEND.md#data-flow) for specific flows
2. Review [BACKEND.md - Key Features](./BACKEND.md#key-features) for feature implementations
3. See [API.md](./API.md) for endpoint details

## 🐛 Troubleshooting

Having issues? Check these resources:

1. **API Errors**: [API.md - Error Handling](./API.md#error-handling)
2. **Common Issues**: [BACKEND.md - Troubleshooting](./BACKEND.md#troubleshooting)
3. **Development Setup**: [BACKEND.md - Development Guide](./BACKEND.md#development-guide)

## 🤝 Contributing

Before contributing:
1. Read [BACKEND.md - Contributing](./BACKEND.md#contributing)
2. Understand the architecture from [BACKEND.md](./BACKEND.md)
3. Follow code style guidelines
4. Update relevant documentation with your changes

## 📞 Getting Help

- **Issues**: Create a GitHub issue
- **Questions**: Check existing documentation first
- **Examples**: Review test files for code examples

## 📝 Documentation Maintenance

When making changes to the codebase:
- [ ] Update API.md if API endpoints change
- [ ] Update BACKEND.md if architecture or database changes
- [ ] Update role-specific docs (TEACHER_DASHBOARD_REFACTOR.md, PARENT_FEATURES_README.md) if UI changes
- [ ] Update README.md if setup process changes

---

**Last Updated**: October 2024
**Project Version**: 0.1.0
