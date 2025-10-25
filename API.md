# G7 KAIH - API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Activity Management](#activity-management)
  - [Category Management](#category-management)
  - [Kegiatan (Tasks) Management](#kegiatan-tasks-management)
  - [User Management](#user-management)
  - [Comments](#comments)
  - [Teacher & Guru Wali](#teacher--guru-wali)
  - [Parent (Orang Tua)](#parent-orang-tua)
  - [Admin](#admin)
  - [Files & Media](#files--media)
  - [Submission Window](#submission-window)
  - [Reports](#reports)
- [Error Handling](#error-handling)

## Overview

The G7 KAIH API is built using Next.js 15 App Router with API routes. It uses Supabase for authentication and database operations, and Cloudinary for file storage.

**Base URL**: Your Next.js application URL (e.g., `http://localhost:3000` in development)

**API Prefix**: `/api`

## Authentication

All API endpoints (except public routes) require authentication via Supabase Auth. Authentication is handled through:

1. **Session Cookies**: Managed by Supabase SSR
2. **Authorization Header**: For programmatic access

### Authentication Flow
- Login redirects to `/login`
- Authenticated users are redirected based on their role:
  - `admin` → `/dashboard`
  - `student` → `/siswa`
  - `teacher` → `/guru`
  - `guruwali` → `/guruwali`
  - `parent` → `/orangtua`
  - `unknown` → `/unknown`

### Role-Based Access Control
The system supports the following roles:
- **Admin** (`roleid: 1` or by name): Full system access
- **Teacher** (`roleid: 2`): Access to student data for their class
- **Parent** (`roleid: 3`): Access to their child's data
- **Student** (`roleid: 4` or `5`, name: "siswa"/"student"): Submit activities
- **Guru Wali** (`roleid: 6`): Class homeroom teacher with extended permissions

---

## API Endpoints

### Activity Management

#### GET `/api/aktivitas`
Get all activities with related kegiatan and user profiles.

**Response:**
```json
{
  "data": [
    {
      "activityid": "uuid",
      "activityname": "Activity name",
      "activitycontent": "Content description",
      "kegiatanid": "uuid",
      "userid": "uuid",
      "status": "completed|pending",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "kegiatan": {
        "kegiatanid": "uuid",
        "kegiatanname": "Task name"
      },
      "profile": {
        "username": "student name"
      }
    }
  ]
}
```

#### POST `/api/aktivitas`
Create a new activity submission.

**Submission Rules:**
- Only **one submission per kegiatan per user per day** (based on Asia/Jakarta timezone)
- Duplicate submissions return HTTP 409 Conflict

**Request (JSON):**
```json
{
  "kegiatanid": "uuid",
  "activityname": "My Activity (optional)",
  "activitycontent": "Description (optional)",
  "status": "completed|pending (optional)",
  "values": [
    {
      "categoryid": "uuid",
      "fields": [
        {
          "key": "field_key",
          "type": "text|time|multiselect|text_image|image",
          "value": "field value"
        }
      ]
    }
  ]
}
```

**Request (Multipart Form-Data for File Uploads):**
```
kegiatanid: uuid
activityname: string (optional)
activitycontent: string (optional)
status: string (optional)
values: JSON string (same structure as above)
file:categoryid:field_key: File (repeat for each file)
```

**File Upload Notes:**
- Maximum file size: **5MB**
- Files are uploaded to Cloudinary
- Images stored in `aktivitas_field_images` table
- Each file is prefixed with `file:categoryid:field_key` in form data

**Response (201 Created):**
```json
{
  "data": {
    "activityid": "uuid",
    "inserted": 5,
    "warnings": ["Optional warnings array"]
  }
}
```

**Error Responses:**
- `400`: Missing kegiatanid
- `401`: Unauthorized
- `404`: Kegiatan not found
- `409`: Duplicate submission (already submitted today)

#### GET `/api/aktivitas/validate`
Validate if user can submit for a kegiatan today.

**Query Parameters:**
- `kegiatanid`: Required UUID

**Response:**
```json
{
  "data": {
    "canSubmit": true,
    "reason": "No submission today|Already submitted today",
    "lastSubmission": "2024-01-01T00:00:00Z"
  }
}
```

---

### Category Management

#### GET `/api/category`
Get all categories with their fields.

**Response:**
```json
{
  "data": [
    {
      "categoryid": "uuid",
      "categoryname": "Category Name",
      "inputs": [
        {
          "key": "field_key",
          "label": "Field Label",
          "type": "text|time|multiselect|image|text_image",
          "required": true,
          "order": 0,
          "config": {}
        }
      ]
    }
  ]
}
```

#### POST `/api/category`
Create a new category.

**Request:**
```json
{
  "categoryname": "Category Name",
  "inputs": [
    {
      "key": "field_key",
      "label": "Field Label",
      "type": "text",
      "required": true,
      "order": 0,
      "config": {}
    }
  ],
  "kegiatanIds": ["uuid1", "uuid2"],
  "autoAttachAllKegiatan": true
}
```

**Response (201):**
```json
{
  "data": {
    "categoryid": "uuid",
    "categoryname": "Category Name",
    "inputs": [...]
  }
}
```

**Error Responses:**
- `400`: Invalid categoryname or inputs
- `409`: Category already exists

#### GET `/api/category/[categoryid]`
Get a specific category by ID.

#### PUT `/api/category/[categoryid]`
Update a category.

#### DELETE `/api/category/[categoryid]`
Delete a category.

---

### Kegiatan (Tasks) Management

#### GET `/api/kegiatan`
Get all kegiatan with their categories.

**Access Control:**
- Students: Only when submission window is open
- Teachers/Admin: Always accessible

**Response:**
```json
{
  "data": [
    {
      "kegiatanid": "uuid",
      "kegiatanname": "Task Name",
      "created_at": "2024-01-01T00:00:00Z",
      "categories": [
        {
          "categoryid": "uuid",
          "categoryname": "Category Name"
        }
      ]
    }
  ]
}
```

**Error (403 for students when window closed):**
```json
{
  "error": "Pengumpulan belum dibuka. Silakan hubungi admin."
}
```

#### POST `/api/kegiatan`
Create a new kegiatan.

**Request:**
```json
{
  "kegiatanname": "Task Name",
  "categories": ["categoryid1", "categoryid2"],
  "autoAttachAllCategories": true
}
```

**Response (201):**
```json
{
  "data": {
    "kegiatanid": "uuid",
    "kegiatanname": "Task Name",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error (409):**
```json
{
  "error": "Kegiatan dengan nama sama sudah ada"
}
```

#### GET `/api/kegiatan/[kegiatanid]`
Get a specific kegiatan.

#### PUT `/api/kegiatan/[kegiatanid]`
Update a kegiatan.

#### DELETE `/api/kegiatan/[kegiatanid]`
Delete a kegiatan.

---

### User Management

#### GET `/api/user-profiles`
Get user profiles with pagination and filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (1-100, default: 10)
- `roleid`: Filter by role ID
- `excludeRole`: Exclude specific role ID
- `q`: Search query (username, email, kelas, userid, role name)

**Response:**
```json
{
  "data": [...],
  "page": 1,
  "pageSize": 10,
  "total": 100
}
```

#### POST `/api/user-profiles`
Create or update a user profile.

**Request:**
```json
{
  "userid": "uuid (optional, defaults to current user)",
  "username": "Username",
  "email": "email@example.com",
  "roleid": 5,
  "kelas": "7A"
}
```

#### GET `/api/user-profiles/[userid]`
Get a specific user profile.

#### PUT `/api/user-profiles/[userid]`
Update a user profile.

#### PUT `/api/user-profiles/[userid]/password`
Change user password.

**Request:**
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

#### GET `/api/roles`
Get all available roles.

**Response:**
```json
{
  "data": [
    {
      "roleid": 1,
      "rolename": "admin"
    }
  ]
}
```

---

### Comments

#### GET `/api/komentar`
Get comments for a student.

**Query Parameters:**
- `siswa_id`: Required student UUID

**Response:**
```json
{
  "data": [
    {
      "komentarid": "uuid",
      "content": "Comment text",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "userid": "uuid",
      "user_profiles": {
        "userid": "uuid",
        "username": "Teacher Name",
        "roleid": 2
      }
    }
  ]
}
```

#### POST `/api/komentar`
Create a new comment.

**Request:**
```json
{
  "content": "Comment text",
  "siswaid": "uuid"
}
```

**Response (201):**
```json
{
  "data": {
    "komentarid": "uuid",
    "content": "Comment text",
    ...
  },
  "message": "Comment created successfully"
}
```

#### DELETE `/api/komentar`
Delete a comment (soft delete).

**Query Parameters:**
- `comment_id`: Required comment UUID

**Authorization:**
- Only the comment author can delete their own comments

**Response:**
```json
{
  "message": "Comment deleted successfully"
}
```

---

### Teacher & Guru Wali

#### GET `/api/teacher/students`
Get students for the logged-in teacher's class.

**Authorization:** Teachers (roleid 2) and Guru Wali (roleid 6)

**Features:**
- Filters students by teacher's class (`kelas`)
- Handles duplicate user accounts (verified aliases)
- Aggregates activity statistics
- Enriches missing data from Auth API

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Student Name",
      "class": "7A",
      "email": "student@example.com",
      "activitiesCount": 10,
      "lastActivity": "2024-01-01T00:00:00Z",
      "status": "active|inactive|completed",
      "roleid": 5
    }
  ]
}
```

**Status Logic:**
- `active`: Last activity within 3 days
- `inactive`: Last activity more than 3 days ago
- `completed`: No recent activity

#### GET `/api/teacher/students/[id]`
Get detailed student information.

#### GET `/api/teacher/students/[id]/activities`
Get activities for a specific student.

#### GET `/api/teacher/students/[id]/details`
Get detailed activity data for a student.

#### GET `/api/teacher/supervised-students`
Get students supervised by the teacher.

#### GET `/api/teacher/reports/daily-inactive`
Get daily inactive students report.

**Similar endpoints exist for Guru Wali:**
- `/api/guruwali/students`
- `/api/guruwali/students/[id]`
- `/api/guruwali/students/[id]/details`
- `/api/guruwali/siswa` (legacy)
- `/api/guruwali/siswa/[id]` (legacy)
- `/api/guruwali/reports/daily-inactive`

---

### Parent (Orang Tua)

#### GET `/api/orangtua/siswa`
Get the student(s) linked to the parent.

**Authorization:** Parents (roleid 3)

**Response:**
```json
{
  "data": {
    "userid": "uuid",
    "username": "Student Name",
    "email": "student@example.com",
    "kelas": "7A"
  }
}
```

**Note:** Uses `parent_of_userid` field in `user_profiles` table.

#### GET `/api/orangtua/siswa/activities`
Get activities for the parent's child.

**Query Parameters:**
- `siswa_id`: Required student UUID

---

### Admin

#### POST `/api/admin/create-user`
Create a new user account.

**Authorization:** Admin only

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "username": "Username",
  "roleid": 5,
  "kelas": "7A"
}
```

**Response (201):**
```json
{
  "data": {
    "userid": "uuid",
    "username": "Username",
    "email": "user@example.com",
    "roleid": 5,
    "kelas": "7A",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### POST `/api/admin/link-parent-student`
Link a parent to a student.

**Request:**
```json
{
  "parentId": "parent_uuid",
  "studentId": "student_uuid"
}
```

#### GET `/api/admin/guruwali-assignments`
Get guru wali assignments.

#### POST `/api/admin/assign-guruwali`
Assign a guru wali to a class.

#### GET `/api/admin/merge-candidates`
Get potential duplicate user accounts.

#### POST `/api/admin/merge-users`
Merge duplicate user accounts.

#### POST `/api/admin/auto-merge`
Automatically merge obvious duplicates.

#### POST `/api/admin/migrate`
Run database migrations.

#### GET `/api/admin/teacher-roles`
Get teacher role information.

#### GET `/api/admin/teachers-roles`
Get all teachers with their roles.

#### POST `/api/users/bulk-import`
Bulk import users from CSV/JSON.

---

### Files & Media

#### GET `/api/files/[activityid]/[fieldid]`
Get file/image for a specific activity field.

**Response:** Redirects to Cloudinary URL or returns file metadata

**File Storage:**
- Provider: Cloudinary
- Folder structure: `g7-aktivitas/[activityid]/`
- Max file size: 5MB
- Automatic optimization and transformation

**Database Tables:**
- `aktivitas_field_images`: Stores Cloudinary URLs and metadata
  - `cloudinary_url`: Public file URL
  - `cloudinary_public_id`: Cloudinary identifier for deletion
  - `filename`: Original filename
  - `content_type`: MIME type

---

### Submission Window

#### GET `/api/submission-window`
Get current submission window status.

**Response:**
```json
{
  "data": {
    "open": true,
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": {
      "userid": "uuid",
      "username": "Admin Name",
      "role": {
        "rolename": "admin"
      }
    }
  }
}
```

#### POST `/api/submission-window`
Update submission window status.

**Authorization:** Admin only

**Request:**
```json
{
  "open": true
}
```

**Response:**
```json
{
  "data": {
    "open": true,
    ...
  }
}
```

---

### Reports

#### GET `/api/teacher/reports/daily-inactive`
Get report of students who haven't submitted activities today.

**Authorization:** Teachers

**Response:**
```json
{
  "data": [
    {
      "userid": "uuid",
      "username": "Student Name",
      "kelas": "7A",
      "lastActivity": "2024-01-01T00:00:00Z",
      "daysInactive": 5
    }
  ]
}
```

---

### Debug Endpoints

#### GET `/api/debug/current-user`
Get current authenticated user info (development only).

#### GET `/api/debug/user-check`
Check user authentication status (development only).

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST/PUT request |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource (e.g., same-day submission) |
| 500 | Internal Server Error | Server-side error |

### Common Error Scenarios

1. **Duplicate Submission (409)**
   ```json
   {
     "error": "Kamu sudah mengirim aktivitas untuk kegiatan ini hari ini. Silakan coba lagi besok.",
     "last_submission": "2024-01-01T10:30:00Z"
   }
   ```

2. **Unauthorized (401)**
   ```json
   {
     "error": "Unauthorized"
   }
   ```

3. **Validation Error (400)**
   ```json
   {
     "error": "kegiatanid wajib diisi"
   }
   ```

4. **Permission Error (403)**
   ```json
   {
     "error": "Only teachers can access this endpoint"
   }
   ```

---

## Best Practices

### 1. Request Headers
Always include appropriate headers:
```
Content-Type: application/json
```

For file uploads:
```
Content-Type: multipart/form-data
```

### 2. Pagination
When available, use pagination parameters:
- `page`: Start from 1
- `pageSize`: Reasonable limits (10-50 recommended)

### 3. Error Handling
Always handle both HTTP errors and error response bodies:
```typescript
try {
  const response = await fetch('/api/aktivitas', { method: 'POST', ... })
  if (!response.ok) {
    const error = await response.json()
    console.error('API Error:', error.error)
  }
  const data = await response.json()
} catch (err) {
  console.error('Network Error:', err)
}
```

### 4. File Uploads
- Always validate file size client-side (max 5MB)
- Use multipart/form-data for file uploads
- Include metadata in JSON string in `values` field

### 5. Timezone Handling
- Server uses **Asia/Jakarta** timezone for daily submission checks
- All timestamps in responses are UTC ISO 8601 format
- Convert to local timezone client-side as needed

---

## Rate Limiting

Currently, there is no explicit rate limiting implemented. However, consider implementing:
- API request throttling at middleware level
- Per-user request limits
- Exponential backoff for failed requests

---

## Versioning

The API currently does not use versioning. Breaking changes should be carefully managed with:
- Deprecation notices
- Backward compatibility periods
- Clear migration guides

Future consideration: Implement API versioning (e.g., `/api/v1/...`)
