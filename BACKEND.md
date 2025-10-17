# G7 KAIH - Backend Architecture Documentation

## Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [API Layer](#api-layer)
- [File Storage](#file-storage)
- [Middleware](#middleware)
- [Data Flow](#data-flow)
- [Key Features](#key-features)
- [Development Guide](#development-guide)
- [Deployment](#deployment)

## Overview

G7 KAIH is an educational activity management system built with Next.js 15 using the App Router architecture. The backend handles:
- Student activity submissions with daily limits
- Teacher and parent monitoring
- Admin user management
- File uploads and media storage
- Comments and feedback system
- Submission window controls

### System Purpose
The system allows students to submit daily activities, which can be monitored by teachers (filtered by class) and parents. Administrators control the submission window and manage users.

---

## Tech Stack

### Core Framework
- **Next.js 15.6.0** (App Router)
  - Server Components for optimal performance
  - API Routes for backend endpoints
  - Middleware for authentication and routing

### Database & Authentication
- **Supabase**
  - PostgreSQL database
  - Authentication (email/password, OAuth)
  - Row Level Security (RLS) policies
  - Real-time subscriptions (future enhancement)

### File Storage
- **Cloudinary**
  - Image and file uploads
  - Automatic optimization
  - Transformation API for responsive images

### Development Tools
- **TypeScript 5** - Type safety
- **Vitest** - Unit and integration testing
- **React Testing Library** - Component testing
- **Tailwind CSS 4** - Styling (with shadcn/ui components)

---

## Architecture

### Folder Structure

```
src/
├── app/
│   ├── (user)/              # Authenticated user routes
│   │   ├── dashboard/       # Admin dashboard
│   │   ├── guru/            # Teacher pages
│   │   ├── guruwali/        # Homeroom teacher pages
│   │   ├── siswa/           # Student pages
│   │   └── orangtua/        # Parent pages
│   ├── api/                 # API routes
│   │   ├── aktivitas/       # Activity endpoints
│   │   ├── category/        # Category management
│   │   ├── kegiatan/        # Task management
│   │   ├── komentar/        # Comments
│   │   ├── admin/           # Admin operations
│   │   ├── teacher/         # Teacher-specific APIs
│   │   ├── guruwali/        # Guru wali APIs
│   │   ├── orangtua/        # Parent APIs
│   │   ├── user-profiles/   # User management
│   │   ├── files/           # File access
│   │   └── submission-window/ # Submission control
│   ├── login/               # Authentication pages
│   └── auth/                # Auth callbacks
├── components/              # React components
├── utils/                   # Utility functions
│   ├── supabase/           # Supabase clients
│   ├── cloudinary.ts       # File upload helpers
│   └── lib/                # Shared utilities
├── hooks/                   # Custom React hooks
└── middleware.ts            # Request middleware
```

### Architectural Patterns

#### 1. **Server-First Architecture**
- API routes run on the server (Node.js runtime)
- Database queries execute server-side
- Server Components for data fetching
- Client Components only for interactivity

#### 2. **Route Handlers (API Routes)**
```typescript
// src/app/api/aktivitas/route.ts
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('aktivitas').select('*')
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const body = await request.json()
  // Process request...
  return NextResponse.json({ data }, { status: 201 })
}
```

#### 3. **Dependency Injection**
- Supabase client created per request
- Environment-based configuration
- Service role client for admin operations

---

## Database Schema

### Core Tables

#### `user_profiles`
User metadata and profile information.

```sql
CREATE TABLE user_profiles (
  userid UUID PRIMARY KEY REFERENCES auth.users(id),
  username VARCHAR,
  email VARCHAR,
  roleid INTEGER REFERENCES role(roleid),
  kelas VARCHAR,                    -- Class name (e.g., "7A")
  parent_of_userid UUID,            -- For parent-student linking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_roleid ON user_profiles(roleid);
CREATE INDEX idx_user_profiles_kelas ON user_profiles(kelas);
CREATE INDEX idx_user_profiles_parent_of_userid ON user_profiles(parent_of_userid);
```

#### `role`
User role definitions.

```sql
CREATE TABLE role (
  roleid INTEGER PRIMARY KEY,
  rolename VARCHAR UNIQUE NOT NULL
);

-- Standard roles:
-- 1: admin
-- 2: teacher
-- 3: parent
-- 4 or 5: student (siswa)
-- 6: guruwali (homeroom teacher)
```

#### `kegiatan`
Tasks/activities that students complete.

```sql
CREATE TABLE kegiatan (
  kegiatanid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatanname VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `category`
Field categories for structured data collection.

```sql
CREATE TABLE category (
  categoryid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoryname VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `category_fields`
Defines fields within each category.

```sql
CREATE TABLE category_fields (
  fieldid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoryid UUID REFERENCES category(categoryid) ON DELETE CASCADE,
  field_key VARCHAR NOT NULL,
  label VARCHAR NOT NULL,
  type VARCHAR NOT NULL,              -- text, time, multiselect, image, text_image
  required BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::JSONB,   -- Additional field configuration
  UNIQUE(categoryid, field_key)
);
```

#### `kegiatan_categories`
Many-to-many relationship between kegiatan and categories.

```sql
CREATE TABLE kegiatan_categories (
  kegiatanid UUID REFERENCES kegiatan(kegiatanid) ON DELETE CASCADE,
  categoryid UUID REFERENCES category(categoryid) ON DELETE CASCADE,
  PRIMARY KEY (kegiatanid, categoryid)
);
```

#### `aktivitas`
Student activity submissions.

```sql
CREATE TABLE aktivitas (
  activityid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatanid UUID REFERENCES kegiatan(kegiatanid),
  userid UUID REFERENCES auth.users(id),
  activityname VARCHAR,
  activitycontent TEXT,
  status VARCHAR DEFAULT 'pending',
  submitted_date DATE DEFAULT CURRENT_DATE, -- For daily limit enforcement
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(kegiatanid, userid, submitted_date)  -- One submission per day
);

CREATE INDEX idx_aktivitas_userid ON aktivitas(userid);
CREATE INDEX idx_aktivitas_kegiatanid ON aktivitas(kegiatanid);
CREATE INDEX idx_aktivitas_submitted_date ON aktivitas(submitted_date);
```

#### `aktivitas_field_values`
Stores field values for each activity.

```sql
CREATE TABLE aktivitas_field_values (
  activityid UUID REFERENCES aktivitas(activityid) ON DELETE CASCADE,
  fieldid UUID REFERENCES category_fields(fieldid) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (activityid, fieldid)
);
```

#### `aktivitas_field_images`
Stores image/file references from Cloudinary.

```sql
CREATE TABLE aktivitas_field_images (
  imageid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activityid UUID REFERENCES aktivitas(activityid) ON DELETE CASCADE,
  fieldid UUID REFERENCES category_fields(fieldid) ON DELETE CASCADE,
  filename VARCHAR,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id VARCHAR NOT NULL,
  content_type VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `komentar`
Comments/feedback on student activities.

```sql
CREATE TABLE komentar (
  komentarid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswaid UUID REFERENCES auth.users(id),  -- Student being commented on
  userid UUID REFERENCES auth.users(id),   -- Comment author
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleteat TIMESTAMP                       -- Soft delete
);

CREATE INDEX idx_komentar_siswaid ON komentar(siswaid);
CREATE INDEX idx_komentar_userid ON komentar(userid);
```

#### `submission_window`
Controls when students can submit activities.

```sql
CREATE TABLE submission_window (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_open BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  CHECK (id = 1)  -- Ensure only one row
);
```

### Database Constraints & Business Logic

#### 1. **Daily Submission Limit**
Enforced by unique constraint:
```sql
UNIQUE(kegiatanid, userid, submitted_date)
```

The `submitted_date` is set based on Asia/Jakarta timezone:
```typescript
function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}
```

#### 2. **Cascading Deletes**
- Deleting a kegiatan removes all related aktivitas
- Deleting a category removes all field definitions
- Deleting an aktivitas removes all field values and images

#### 3. **Soft Deletes**
Comments use soft delete pattern:
```sql
deleteat TIMESTAMP NULL
```

Queries filter with:
```sql
WHERE deleteat IS NULL
```

---

## Authentication & Authorization

### Authentication Flow

#### 1. **Supabase Auth Integration**
```typescript
// Server-side client
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Process authenticated request...
}
```

#### 2. **Client Creation Methods**

**Standard Client (uses session cookies):**
```typescript
// src/utils/supabase/server.ts
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { /* set cookies */ }
      }
    }
  )
}
```

**Admin Client (service role):**
```typescript
// src/utils/supabase/admin.ts
export async function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-only
    { cookies: { /* ... */ } }
  )
}
```

### Role-Based Access Control (RBAC)

#### Authorization Helper
```typescript
async function getCurrentRoleName(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, roleName: null }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('userid, role:roleid(rolename)')
    .eq('userid', user.id)
    .maybeSingle()

  const roleName = profile?.role?.rolename ?? null
  return { userId: user.id, roleName }
}
```

#### Middleware-Level Protection
```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based routing
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('roleid')
    .eq('userid', user.id)
    .single()

  const roleName = getRoleName(profile.roleid)
  
  // Protect routes by role
  if (pathname.startsWith('/dashboard') && roleName !== 'admin') {
    return NextResponse.redirect(new URL('/unknown', request.url))
  }
}
```

#### API-Level Authorization
```typescript
// Example: Teacher-only endpoint
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('roleid')
    .eq('userid', user.id)
    .single()

  if (profile.roleid !== 2 && profile.roleid !== 6) {
    return NextResponse.json({ 
      error: 'Only teachers can access this endpoint' 
    }, { status: 403 })
  }

  // Process teacher request...
}
```

### Admin Operations

Admin endpoints use service role client for elevated permissions:
```typescript
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Verify admin role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('roleid')
    .eq('userid', user.id)
    .single()

  if (profile.roleid !== 1) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Use admin client for privileged operations
  const admin = await createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { username, roleid, kelas }
  })
}
```

---

## API Layer

### Request/Response Pattern

#### Standard Response Format
```typescript
// Success response
return NextResponse.json({ 
  data: result 
}, { status: 200 })

// Error response
return NextResponse.json({ 
  error: 'Error message' 
}, { status: 400 })

// With metadata
return NextResponse.json({ 
  data: results,
  page: 1,
  pageSize: 10,
  total: 100
})
```

### Request Handling

#### JSON Requests
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { field1, field2 } = body
    
    // Validate
    if (!field1) {
      return NextResponse.json(
        { error: 'field1 is required' }, 
        { status: 400 }
      )
    }

    // Process...
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err.message ?? 'Unexpected error' },
      { status: 500 }
    )
  }
}
```

#### Multipart Form Data (File Uploads)
```typescript
export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    
    // Extract JSON fields
    const kegiatanid = formData.get('kegiatanid') as string
    const values = JSON.parse(formData.get('values') as string)
    
    // Extract files
    const files: File[] = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file:') && value instanceof File) {
        files.push(value)
      }
    }
    
    // Process files...
  }
}
```

### Pagination

Implemented in user-profiles and other list endpoints:
```typescript
export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || 10)))
  
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  const { data, error, count } = await supabase
    .from('table')
    .select('*', { count: 'exact' })
    .range(from, to)
  
  return NextResponse.json({ 
    data, 
    page, 
    pageSize, 
    total: count ?? 0 
  })
}
```

### Query Filtering

Advanced filtering in user-profiles endpoint:
```typescript
const roleid = url.searchParams.get('roleid')
const excludeRole = url.searchParams.get('excludeRole')
const q = url.searchParams.get('q')?.trim()

let query = supabase.from('user_profiles').select('*')

if (roleid) {
  query = query.eq('roleid', Number(roleid))
}

if (excludeRole) {
  query = query.neq('roleid', Number(excludeRole))
}

if (q) {
  // Search across multiple fields
  query = query.or(`
    username.ilike.%${q}%,
    email.ilike.%${q}%,
    kelas.ilike.%${q}%
  `)
}
```

---

## File Storage

### Cloudinary Integration

#### Configuration
```typescript
// src/utils/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})
```

#### Upload Function
```typescript
export async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  folder: string = 'g7-aktivitas'
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${Date.now()}-${filename.replace(/\.[^/.]+$/, '')}`,
        resource_type: 'auto',
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error)
        else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          })
        }
      }
    ).end(buffer)
  })
}
```

#### Upload in API Route
```typescript
// Process file from FormData
const file = formData.get('file:categoryid:field_key') as File
const buffer = Buffer.from(await file.arrayBuffer())

// Upload to Cloudinary
const { url, publicId } = await uploadToCloudinary(
  buffer,
  file.name,
  `g7-aktivitas/${activityid}`
)

// Save to database
await supabase.from('aktivitas_field_images').insert({
  activityid,
  fieldid,
  filename: file.name,
  cloudinary_url: url,
  cloudinary_public_id: publicId,
  content_type: file.type,
})
```

#### File Validation
```typescript
const maxSize = 5 * 1024 * 1024 // 5MB
if (file.size > maxSize) {
  return NextResponse.json(
    { error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max 5MB.` },
    { status: 400 }
  )
}
```

### File Organization

**Folder Structure in Cloudinary:**
```
g7-aktivitas/
  └── [activityid]/
      ├── [timestamp]-filename1.jpg
      ├── [timestamp]-filename2.png
      └── ...
```

**Database Storage:**
- `cloudinary_url`: Direct HTTPS URL to file
- `cloudinary_public_id`: For programmatic access and deletion
- `filename`: Original filename for display
- `content_type`: MIME type for proper rendering

---

## Middleware

### Request Flow

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // 1. Create Supabase client with request cookies
  const supabase = createServerClient(...)
  
  // 2. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  
  // 3. Public route bypass
  const publicRoutes = ['/login', '/auth/callback', '/error', '/tos']
  if (publicRoutes.includes(pathname)) {
    return supabaseResponse
  }
  
  // 4. Require authentication
  if (!user && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // 5. Role-based routing
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('roleid, role:roleid(rolename)')
      .eq('userid', user.id)
      .single()
    
    const roleName = profile?.role?.rolename
    
    // Protect /dashboard for admin only
    if (pathname.startsWith('/dashboard') && roleName !== 'admin') {
      return NextResponse.redirect(roleBasedRedirect(roleName))
    }
    
    // Protect /siswa for students only
    if (pathname.startsWith('/siswa') && roleName !== 'student') {
      return NextResponse.redirect(roleBasedRedirect(roleName))
    }
    
    // ... other role protections
  }
  
  return supabaseResponse
}
```

### Route Protection Matrix

| Route | Allowed Roles | Redirect |
|-------|---------------|----------|
| `/dashboard` | admin | Role-specific home |
| `/siswa` | student | Role-specific home |
| `/guru` | teacher, guruwali | Role-specific home |
| `/guruwali` | guruwali | Role-specific home |
| `/orangtua` | parent | Role-specific home |
| `/unknown` | unknown | No redirect |
| `/login` | All | - |

### Cookie Management

Middleware refreshes Supabase session cookies:
```typescript
const supabase = createServerClient(url, key, {
  cookies: {
    getAll() {
      return request.cookies.getAll()
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        request.cookies.set(name, value)
        supabaseResponse.cookies.set(name, value, options)
      })
    },
  },
})
```

---

## Data Flow

### Activity Submission Flow

```
Student Client
    ↓ POST /api/aktivitas (multipart/form-data)
API Route Handler
    ↓ Authenticate user
    ↓ Validate kegiatan exists
    ↓ Check daily submission limit (Jakarta timezone)
    ↓ Insert aktivitas row
    ↓ Process field values
    ↓ Upload files to Cloudinary
    ↓ Insert field values to database
    ↓ Insert image URLs to database
    ↓ Return success with activityid
Student Dashboard
    ↓ Display confirmation
```

**Daily Limit Logic:**
```typescript
const today = todayInJakarta() // "2024-01-15"

const { data: existing } = await supabase
  .from('aktivitas')
  .select('activityid')
  .eq('kegiatanid', kegiatanid)
  .eq('userid', userid)
  .eq('submitted_date', today)
  .maybeSingle()

if (existing) {
  return NextResponse.json(
    { error: 'Already submitted today' },
    { status: 409 }
  )
}
```

### Teacher Dashboard Data Flow

```
Teacher Client
    ↓ GET /api/teacher/students
API Route Handler
    ↓ Authenticate teacher
    ↓ Get teacher's class from profile
    ↓ Fetch students in same class
    ↓ Fetch activities for those students
    ↓ Aggregate statistics (total, completed, last activity)
    ↓ Handle duplicate accounts (verified aliases)
    ↓ Enrich missing data from Auth API
    ↓ Calculate activity status (active/inactive)
    ↓ Return filtered student list
Teacher Dashboard
    ↓ Display student cards with stats
```

**Duplicate Handling:**
```typescript
const VERIFIED_ALIASES = new Map([
  ['user-id-1', ['user-id-1', 'user-id-2']],
  ['user-id-2', ['user-id-1', 'user-id-2']],
])

function expandWithVerifiedAliases(ids: string[]): string[] {
  const set = new Set(ids)
  for (const [primary, list] of VERIFIED_ALIASES.entries()) {
    if (list.some(id => set.has(id))) {
      list.forEach(id => set.add(id))
    }
  }
  return Array.from(set)
}
```

### Parent Dashboard Data Flow

```
Parent Client
    ↓ GET /api/orangtua/siswa
API Route Handler
    ↓ Authenticate parent
    ↓ Get parent_of_userid from profile
    ↓ Fetch student profile
    ↓ Return student data
Parent Dashboard
    ↓ GET /api/orangtua/siswa/activities?siswa_id=...
API Route Handler
    ↓ Fetch student's activities
    ↓ Return activity calendar data
Parent Dashboard
    ↓ Display calendar and comment section
```

---

## Key Features

### 1. Daily Submission Limit

**Implementation:**
- Uses unique constraint on `(kegiatanid, userid, submitted_date)`
- `submitted_date` computed in Asia/Jakarta timezone
- Prevents multiple submissions per day per task

**Code:**
```typescript
function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

// In POST /api/aktivitas
const today = todayInJakarta()
const { data: existingToday } = await supabase
  .from('aktivitas')
  .select('activityid')
  .eq('kegiatanid', kegiatanid)
  .eq('userid', userid)
  .eq('submitted_date', today)
  .maybeSingle()

if (existingToday) {
  return NextResponse.json({ 
    error: 'Already submitted today' 
  }, { status: 409 })
}
```

### 2. Submission Window Control

**Purpose:** Admin can open/close student submissions globally.

**Implementation:**
```typescript
// Check window status
async function isSubmissionWindowOpen(supabase) {
  const { data } = await supabase
    .from('submission_window')
    .select('is_open')
    .eq('id', 1)
    .maybeSingle()
  
  return data?.is_open ?? false
}

// In GET /api/kegiatan
const { roleName } = await getCurrentRoleName(supabase)

if (roleName === 'student') {
  const open = await isSubmissionWindowOpen(supabase)
  if (!open) {
    return NextResponse.json({
      error: 'Pengumpulan belum dibuka. Silakan hubungi admin.'
    }, { status: 403 })
  }
}
```

### 3. Class-Based Filtering (Teacher View)

**Purpose:** Teachers only see students in their assigned class.

**Implementation:**
```typescript
// Get teacher's class
const { data: teacherProfile } = await supabase
  .from('user_profiles')
  .select('kelas')
  .eq('userid', user.id)
  .single()

const teacherClass = teacherProfile.kelas

// Filter students by class
const students = allStudents.filter(s => s.class === teacherClass)
```

### 4. Parent-Student Linking

**Purpose:** Parents view only their child's activities.

**Database Field:**
```sql
ALTER TABLE user_profiles ADD COLUMN parent_of_userid UUID;
```

**Usage:**
```typescript
// In GET /api/orangtua/siswa
const { data: parentProfile } = await supabase
  .from('user_profiles')
  .select('parent_of_userid')
  .eq('userid', parentUserId)
  .single()

const studentId = parentProfile.parent_of_userid

// Fetch student data
const { data: student } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('userid', studentId)
  .single()
```

### 5. Dynamic Category Fields

**Purpose:** Admin-defined fields for flexible activity data collection.

**Field Types:**
- `text`: Single-line text
- `time`: Time input
- `multiselect`: Multiple choice (stored as comma-separated)
- `image`: Image upload
- `text_image`: Text with optional image

**Processing:**
```typescript
// Extract field values
for (const group of values) {
  for (const field of group.fields) {
    const meta = fieldMap.get(`${group.categoryid}|${field.key}`)
    
    let value: string | null = null
    
    if (meta.type === 'multiselect') {
      const arr = Array.isArray(field.value) ? field.value : [String(field.value)]
      value = arr.join(',')
    } else if (meta.type === 'text_image') {
      value = field.value?.text ?? field.value
    } else {
      value = String(field.value)
    }
    
    rows.push({ activityid, fieldid: meta.fieldid, value })
  }
}
```

### 6. Duplicate Account Handling

**Purpose:** Merge data from duplicate user accounts.

**Implementation:**
```typescript
const VERIFIED_ALIASES = new Map([
  ['primary-id', ['primary-id', 'duplicate-id']],
])

// Aggregate stats across aliases
for (const [userid, stats] of Object.entries(byUser)) {
  const aliases = VERIFIED_ALIASES.get(userid)
  if (aliases) {
    const primaryId = aliases[0]
    aggregatedByUser[primaryId].total += stats.total
    aggregatedByUser[primaryId].completed += stats.completed
  }
}
```

---

## Development Guide

### Environment Variables

Create `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only, for admin operations

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional
ADMIN_ROLE_ID=1  # Override admin role detection
```

### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

2. **Configure Supabase**
   - Create a Supabase project
   - Run database migrations (see schema above)
   - Enable authentication providers
   - Set RLS policies (if needed)

3. **Configure Cloudinary**
   - Create Cloudinary account
   - Get API credentials from dashboard
   - Add to `.env.local`

4. **Run Development Server**
   ```bash
   npm run dev
   # Runs on http://localhost:3000
   ```

5. **Run Tests**
   ```bash
   npm test          # Run once
   npm run test:watch # Watch mode
   ```

### Database Migrations

**Manual SQL Execution:**
1. Go to Supabase SQL Editor
2. Paste schema definitions
3. Execute

**Future Enhancement:**
Consider migration tools like:
- Supabase CLI migrations
- Prisma
- TypeORM

### Testing Strategy

#### API Route Tests
```typescript
// src/app/api/__tests__/route-exports.test.ts
describe('API Routes', () => {
  it('exports HTTP method handlers', () => {
    const route = require('../aktivitas/route')
    expect(route.GET).toBeDefined()
    expect(route.POST).toBeDefined()
  })
})
```

#### Integration Tests
```typescript
// src/app/api/submission-window/__tests__/submission-window.test.ts
import { GET, POST } from '../route'

describe('/api/submission-window', () => {
  it('returns window status', async () => {
    const response = await GET()
    const data = await response.json()
    expect(data).toHaveProperty('data.open')
  })
})
```

### Code Style

**TypeScript:**
- Strict mode enabled
- Explicit return types for public APIs
- Prefer interfaces for object shapes

**Error Handling:**
```typescript
try {
  // API logic
  return NextResponse.json({ data })
} catch (err: any) {
  return NextResponse.json(
    { error: err?.message ?? 'Unexpected error' },
    { status: 500 }
  )
}
```

**Naming Conventions:**
- API routes: lowercase with hyphens (`/api/user-profiles`)
- Functions: camelCase (`getCurrentRoleName`)
- Types/Interfaces: PascalCase (`SubmissionWindowRow`)
- Database tables: snake_case (`user_profiles`)

---

## Deployment

### Production Checklist

1. **Environment Variables**
   - Set all required env vars in hosting platform
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is server-only
   - Verify Cloudinary credentials

2. **Database**
   - Run all migrations
   - Set up Row Level Security (RLS) policies
   - Enable connection pooling (if using serverless)

3. **Build Configuration**
   ```bash
   npm run build
   # Generates optimized production build
   ```

4. **Deployment Platforms**
   - **Vercel** (recommended for Next.js)
     - Automatic deployments from Git
     - Serverless function support
     - Edge runtime for middleware
   
   - **Self-hosted**
     - Use `next start` after `next build`
     - Requires Node.js 18+ runtime
     - Configure reverse proxy (nginx/Apache)

5. **Performance Optimization**
   - Enable Cloudinary auto-optimization
   - Configure Next.js Image Optimization
   - Set up CDN for static assets
   - Enable compression (gzip/brotli)

### Monitoring

**Error Tracking:**
- Implement error logging (e.g., Sentry)
- Monitor API response times
- Track failed upload attempts

**Database:**
- Monitor query performance
- Set up alerts for slow queries
- Track connection pool usage

**Application:**
- Monitor memory usage
- Track API endpoint hit rates
- Set up uptime monitoring

---

## Security Considerations

### 1. **Service Role Key Protection**
```typescript
// ❌ NEVER expose service role key to client
// ✅ Only use in API routes (server-side)
const admin = await createAdminClient()
```

### 2. **SQL Injection Prevention**
Supabase client uses parameterized queries:
```typescript
// ✅ Safe - parameterized
await supabase
  .from('table')
  .select()
  .eq('userid', userInput)

// ❌ NEVER build raw SQL with user input
```

### 3. **File Upload Validation**
```typescript
// Validate file size
if (file.size > 5 * 1024 * 1024) {
  return NextResponse.json({ error: 'File too large' }, { status: 400 })
}

// Validate file type
const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
if (!allowedTypes.includes(file.type)) {
  return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
}
```

### 4. **Authorization Checks**
Always verify user permissions before operations:
```typescript
// Check ownership
if (comment.userid !== currentUser.id) {
  return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
}
```

### 5. **Data Sanitization**
```typescript
// Trim and validate input
const categoryname = (body.categoryname || '').trim()
if (!categoryname) {
  return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
}
```

---

## Future Enhancements

### Planned Features
1. **Real-time Updates** - WebSocket support via Supabase Realtime
2. **Analytics Dashboard** - Activity trends and student performance metrics
3. **Notification System** - Email/SMS for submission reminders
4. **Bulk Operations** - CSV import/export for users and activities
5. **Advanced Reports** - PDF generation for teacher reports
6. **Mobile App** - React Native or Progressive Web App
7. **Multi-language Support** - i18n for Bahasa Indonesia and English

### Technical Improvements
1. **API Versioning** - `/api/v1/...` for backward compatibility
2. **Rate Limiting** - Prevent abuse and DoS
3. **Caching** - Redis for session and frequently accessed data
4. **Queue System** - Background jobs for heavy operations (e.g., bulk uploads)
5. **GraphQL** - Alternative API layer for flexible queries
6. **Microservices** - Split into smaller, independent services

---

## Troubleshooting

### Common Issues

#### 1. **401 Unauthorized Errors**
- Check if user session is valid
- Verify Supabase URL and keys in `.env.local`
- Clear browser cookies and re-login

#### 2. **409 Duplicate Submission**
- User already submitted today (Jakarta timezone)
- Check `submitted_date` in database
- Verify timezone calculation

#### 3. **File Upload Failures**
- Check Cloudinary credentials
- Verify file size (max 5MB)
- Check network connectivity to Cloudinary

#### 4. **Permission Denied Errors**
- Verify user role in `user_profiles`
- Check middleware route protection
- Ensure role-based logic in API routes

#### 5. **Database Connection Issues**
- Verify Supabase project is running
- Check connection string
- Monitor connection pool limits

### Debug Tools

**Enable Debug Logs:**
```typescript
// In API routes
console.log('Debug:', { user, profile, data })

// In client
console.log('Request:', { method, url, body })
```

**Database Debugging:**
```sql
-- Check user role
SELECT * FROM user_profiles WHERE userid = 'user-id';

-- Check submissions
SELECT * FROM aktivitas WHERE userid = 'user-id' AND submitted_date = '2024-01-15';

-- Check submission window
SELECT * FROM submission_window WHERE id = 1;
```

---

## Contributing

### Pull Request Process
1. Create feature branch from `main`
2. Write tests for new features
3. Update documentation (API.md, BACKEND.md)
4. Ensure all tests pass
5. Submit PR with clear description

### Code Review Checklist
- [ ] TypeScript types are correct
- [ ] Error handling is comprehensive
- [ ] Database queries are optimized
- [ ] Security checks are in place
- [ ] Tests cover new code
- [ ] Documentation is updated

---

## Contact & Support

For questions or issues:
- Create GitHub issue
- Check existing documentation
- Review test files for examples

---

**Last Updated:** 2024-01-15
**Version:** 1.0.0
