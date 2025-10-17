# G7 KAIH - Database Guide

## Table of Contents
- [Overview](#overview)
- [Database Design Philosophy](#database-design-philosophy)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Core Entities](#core-entities)
- [Table Details](#table-details)
- [Relationships Explained](#relationships-explained)
- [Data Flow Examples](#data-flow-examples)
- [Common Queries](#common-queries)
- [Database Maintenance](#database-maintenance)

---

## Overview

The G7 KAIH system uses **PostgreSQL** (via Supabase) as its database. The database is designed to support an educational activity tracking system where students submit daily activities, teachers monitor their class, and parents can view their children's progress.

> 📁 **Ready-to-use SQL Schema**: The complete database schema is available in [`database/schema.sql`](./database/schema.sql). See [`database/README.md`](./database/README.md) for setup instructions.

### Key Database Features

1. **Role-Based Access**: Different user types (admin, teacher, student, parent) with varying permissions
2. **Daily Submission Limits**: Students can only submit one activity per task per day
3. **Flexible Activity Fields**: Admin-configurable fields for different types of activities
4. **File Storage Integration**: Links to Cloudinary for image/file uploads
5. **Soft Deletes**: Comments can be deleted without losing data permanently
6. **Class-Based Organization**: Students grouped by class (kelas) for teacher monitoring

---

## Database Design Philosophy

### Design Principles

1. **Separation of Concerns**: User data, activity data, and metadata are stored in separate tables
2. **Flexibility**: Dynamic field system allows admins to create custom activity forms
3. **Data Integrity**: Foreign key constraints ensure referential integrity
4. **Performance**: Strategic indexes on frequently queried columns
5. **Auditability**: Timestamps on most tables for tracking changes

### Why PostgreSQL?

- **ACID Compliance**: Ensures data consistency
- **JSON Support**: Flexible configuration storage (e.g., field config)
- **Robust Constraints**: Enforce business rules at database level
- **Supabase Integration**: Built-in authentication and real-time capabilities

---

## Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │ (Managed by Supabase Auth)
│  (Authentication)│
└────────┬────────┘
         │
         │ 1:1
         │
┌────────▼────────────┐         ┌──────────────┐
│  user_profiles      │ N:1     │     role     │
│  - userid (PK)      ├────────►│  - roleid    │
│  - username         │         │  - rolename  │
│  - email            │         └──────────────┘
│  - roleid (FK)      │
│  - kelas            │
│  - parent_of_userid │◄───┐ (parent links to student)
└─────────────────────┘    │
         │                 │
         │ 1:N            │
         │                │
┌────────▼────────────┐   │
│    aktivitas        │   │
│  - activityid (PK)  │   │
│  - kegiatanid (FK)  │───┐
│  - userid (FK)      │   │
│  - submitted_date   │   │
└─────────┬───────────┘   │
          │               │
          │ 1:N           │ N:1
          │               │
┌─────────▼─────────────┐ │    ┌──────────────────┐
│aktivitas_field_values │ │    │    kegiatan      │
│  - activityid (FK)    │ │    │  - kegiatanid    │
│  - fieldid (FK)       │ │    │  - kegiatanname  │
│  - value              │ │    └────────┬─────────┘
└───────────────────────┘ │             │
                          │             │ N:M
┌─────────────────────────┐│             │
│aktivitas_field_images   ││    ┌────────▼──────────────┐
│  - activityid (FK)      ││    │ kegiatan_categories   │
│  - fieldid (FK)         ││    │  - kegiatanid (FK)    │
│  - cloudinary_url       ││    │  - categoryid (FK)    │
└─────────────────────────┘│    └────────┬──────────────┘
                           │             │
                           │             │ N:1
                           │             │
                           │    ┌────────▼─────────┐
                           │    │    category      │
                           └───►│  - categoryid    │
                                │  - categoryname  │
                                └────────┬─────────┘
                                         │
                                         │ 1:N
                                         │
                                ┌────────▼──────────────┐
                                │  category_fields      │
                                │  - fieldid (PK)       │
                                │  - categoryid (FK)    │
                                │  - field_key          │
                                │  - label              │
                                │  - type               │
                                └───────────────────────┘

┌─────────────────┐
│    komentar     │
│  - komentarid   │
│  - siswaid (FK) │───► Points to student userid
│  - userid (FK)  │───► Points to comment author
│  - content      │
│  - deleteat     │
└─────────────────┘

┌──────────────────────┐
│  submission_window   │ (Single row table)
│  - id (always 1)     │
│  - is_open           │
│  - updated_by (FK)   │
└──────────────────────┘
```

---

## Core Entities

### 1. Users and Authentication

The system uses **two-layer user management**:

1. **`auth.users`** (Supabase managed)
   - Handles authentication (passwords, sessions)
   - Managed by Supabase Auth
   - Not directly accessible in application code

2. **`user_profiles`** (Application managed)
   - Stores user metadata (username, class, role)
   - Links to `auth.users` via `userid`
   - Queryable and updatable by application

**Why two tables?**
- Separation of authentication (security) from profile data (business logic)
- Allows custom fields without modifying auth system
- Better security: sensitive auth data isolated

### 2. Activities (Aktivitas)

The core entity representing student submissions:

- **One activity = one task submission for one day**
- Links to a `kegiatan` (task definition)
- Contains submitted field values
- Can include file uploads

### 3. Tasks (Kegiatan)

Template for activities that students complete:

- Defines what students need to submit
- Can have multiple categories (forms)
- Examples: "Morning Prayer", "Reading Log", "Exercise Log"

### 4. Categories and Fields

Dynamic form system:

- **Category**: A group of related fields (e.g., "Prayer Details", "Reading Details")
- **Field**: Individual input (e.g., "Prayer Time", "Book Title")
- Admin can create new categories/fields without code changes

---

## Table Details

### `user_profiles`

**Purpose**: Store user information and metadata

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `userid` | UUID | Primary key, links to auth.users | `a1b2c3d4-...` |
| `username` | VARCHAR | Display name | `"Ahmad Sidiq"` |
| `email` | VARCHAR | User's email | `"ahmad@school.com"` |
| `roleid` | INTEGER | Role (1=admin, 2=teacher, etc.) | `5` (student) |
| `kelas` | VARCHAR | Class name | `"7A"`, `"8B"` |
| `parent_of_userid` | UUID | For parents, links to their child | `b2c3d4e5-...` |

**Real-World Example**:
```sql
-- Student record
userid: 'a1b2c3d4-e5f6-...'
username: 'Ahmad Sidiq'
email: 'ahmad@school.com'
roleid: 5
kelas: '7A'
parent_of_userid: NULL

-- Parent record
userid: 'b2c3d4e5-f6a7-...'
username: 'Ibu Ahmad'
email: 'ibu.ahmad@email.com'
roleid: 3
kelas: NULL
parent_of_userid: 'a1b2c3d4-e5f6-...'  -- Links to Ahmad
```

**Indexes**:
- `idx_user_profiles_roleid`: Fast role-based queries
- `idx_user_profiles_kelas`: Fast class-based filtering
- `idx_user_profiles_parent_of_userid`: Fast parent-child lookups

---

### `role`

**Purpose**: Define user roles and permissions

| Role ID | Role Name | Access Level |
|---------|-----------|--------------|
| 1 | admin | Full system access |
| 2 | teacher | View students in their class |
| 3 | parent | View their child's data |
| 4 or 5 | student / siswa | Submit activities |
| 6 | guruwali | Homeroom teacher (extended access) |

**Why separate table?**
- Centralized role management
- Easy to add new roles
- Role names are human-readable

---

### `kegiatan` (Tasks)

**Purpose**: Define tasks that students need to complete

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `kegiatanid` | UUID | Primary key | `c3d4e5f6-...` |
| `kegiatanname` | VARCHAR | Task name | `"Morning Prayer"` |
| `created_at` | TIMESTAMP | When task was created | `2024-01-15 08:00:00` |

**Real-World Example**:
```sql
-- Task: Students must log their morning prayer
kegiatanid: 'c3d4e5f6-a7b8-...'
kegiatanname: 'Morning Prayer (Sholat Subuh)'
created_at: '2024-01-01 00:00:00'

-- Task: Students must log their reading activity
kegiatanid: 'd4e5f6a7-b8c9-...'
kegiatanname: 'Daily Reading Log'
created_at: '2024-01-01 00:00:00'
```

---

### `category`

**Purpose**: Group related fields together

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `categoryid` | UUID | Primary key | `e5f6a7b8-...` |
| `categoryname` | VARCHAR | Category name | `"Prayer Details"` |

**Real-World Example**:
```sql
-- Category for prayer activities
categoryid: 'e5f6a7b8-c9d0-...'
categoryname: 'Prayer Details'

-- Category for reading activities
categoryid: 'f6a7b8c9-d0e1-...'
categoryname: 'Reading Details'
```

---

### `category_fields`

**Purpose**: Define individual fields within a category

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `fieldid` | UUID | Primary key | `a7b8c9d0-...` |
| `categoryid` | UUID | Parent category | `e5f6a7b8-...` |
| `field_key` | VARCHAR | Unique field identifier | `"prayer_time"` |
| `label` | VARCHAR | Display label | `"Prayer Time"` |
| `type` | VARCHAR | Input type | `"time"`, `"text"`, `"image"` |
| `required` | BOOLEAN | Is field mandatory? | `true` |
| `order_index` | INTEGER | Display order | `0`, `1`, `2` |
| `config` | JSONB | Additional configuration | `{"placeholder": "HH:MM"}` |

**Field Types**:
- `text`: Single-line text input
- `time`: Time picker
- `multiselect`: Multiple choice (stored as comma-separated)
- `image`: Image upload
- `text_image`: Text with optional image

**Real-World Example**:
```sql
-- Field: Prayer Time
fieldid: 'a7b8c9d0-e1f2-...'
categoryid: 'e5f6a7b8-c9d0-...'  -- Prayer Details
field_key: 'prayer_time'
label: 'Prayer Time'
type: 'time'
required: true
order_index: 0

-- Field: Prayer Location
fieldid: 'b8c9d0e1-f2a3-...'
categoryid: 'e5f6a7b8-c9d0-...'  -- Prayer Details
field_key: 'prayer_location'
label: 'Where did you pray?'
type: 'text'
required: false
order_index: 1
```

---

### `kegiatan_categories`

**Purpose**: Link tasks to their categories (many-to-many)

| Column | Type | Description |
|--------|------|-------------|
| `kegiatanid` | UUID | Task reference |
| `categoryid` | UUID | Category reference |

**Why many-to-many?**
- One task can have multiple categories (e.g., Prayer task needs both "Prayer Details" and "Reflection" categories)
- One category can be used in multiple tasks (e.g., "Location" category used in Prayer, Exercise, Reading tasks)

**Real-World Example**:
```sql
-- Morning Prayer task uses these categories:
kegiatanid: 'c3d4e5f6-...' (Morning Prayer)
categoryid: 'e5f6a7b8-...' (Prayer Details)

kegiatanid: 'c3d4e5f6-...' (Morning Prayer)
categoryid: 'f6a7b8c9-...' (Reflection)

kegiatanid: 'c3d4e5f6-...' (Morning Prayer)
categoryid: 'a7b8c9d0-...' (Location)
```

---

### `aktivitas` (Activity Submissions)

**Purpose**: Store student activity submissions

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `activityid` | UUID | Primary key | `d0e1f2a3-...` |
| `kegiatanid` | UUID | Which task | `c3d4e5f6-...` |
| `userid` | UUID | Which student | `a1b2c3d4-...` |
| `activityname` | VARCHAR | Auto-generated title | `"Morning Prayer - 2024-01-15"` |
| `activitycontent` | TEXT | Optional description | `"Prayed at home"` |
| `status` | VARCHAR | Status | `"completed"`, `"pending"` |
| `submitted_date` | DATE | Submission date (Jakarta TZ) | `2024-01-15` |

**Key Constraint**:
```sql
UNIQUE(kegiatanid, userid, submitted_date)
```
This ensures **one submission per task per day per student**.

**Real-World Example**:
```sql
-- Ahmad's Morning Prayer submission for Jan 15, 2024
activityid: 'd0e1f2a3-b4c5-...'
kegiatanid: 'c3d4e5f6-...'  -- Morning Prayer task
userid: 'a1b2c3d4-...'      -- Ahmad
activityname: 'Morning Prayer - 2024-01-15 05:30'
activitycontent: 'Prayed at mosque with congregation'
status: 'completed'
submitted_date: '2024-01-15'  -- Can't submit again for same date!
created_at: '2024-01-15 05:32:00'
```

**Indexes**:
- `idx_aktivitas_userid`: Fast user activity queries
- `idx_aktivitas_kegiatanid`: Fast task-based queries
- `idx_aktivitas_submitted_date`: Fast date-based queries

---

### `aktivitas_field_values`

**Purpose**: Store the actual field values for each activity

| Column | Type | Description |
|--------|------|-------------|
| `activityid` | UUID | Which activity |
| `fieldid` | UUID | Which field |
| `value` | TEXT | The submitted value |

**Real-World Example**:
```sql
-- For Ahmad's Morning Prayer submission:

-- Prayer Time field
activityid: 'd0e1f2a3-...'
fieldid: 'a7b8c9d0-...'  -- prayer_time field
value: '05:30'

-- Prayer Location field
activityid: 'd0e1f2a3-...'
fieldid: 'b8c9d0e1-...'  -- prayer_location field
value: 'Mosque near home'

-- Reflection field
activityid: 'd0e1f2a3-...'
fieldid: 'c9d0e1f2-...'  -- reflection field
value: 'Felt peaceful praying in congregation'
```

**Why separate table?**
- Flexible: Can add/remove fields without schema changes
- Normalized: Avoid NULL columns for unused fields
- Scalable: Easy to query specific field values

---

### `aktivitas_field_images`

**Purpose**: Store file/image references for activities

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `imageid` | UUID | Primary key | `e1f2a3b4-...` |
| `activityid` | UUID | Which activity | `d0e1f2a3-...` |
| `fieldid` | UUID | Which field | `d0e1f2a3-...` |
| `filename` | VARCHAR | Original filename | `"prayer_photo.jpg"` |
| `cloudinary_url` | TEXT | Public URL | `"https://res.cloudinary.com/..."` |
| `cloudinary_public_id` | VARCHAR | Cloudinary ID for deletion | `"g7-aktivitas/d0e1f2/12345-prayer"` |
| `content_type` | VARCHAR | MIME type | `"image/jpeg"` |

**Real-World Example**:
```sql
-- Ahmad uploaded a photo of his prayer location
imageid: 'e1f2a3b4-c5d6-...'
activityid: 'd0e1f2a3-...'
fieldid: 'd0e1f2a3-...'  -- photo field
filename: 'my_prayer_place.jpg'
cloudinary_url: 'https://res.cloudinary.com/xyz/image/upload/v123/g7-aktivitas/...'
cloudinary_public_id: 'g7-aktivitas/d0e1f2a3/1705294800000-my_prayer_place'
content_type: 'image/jpeg'
created_at: '2024-01-15 05:33:00'
```

**Why Cloudinary?**
- Professional image hosting
- Automatic optimization
- Transformation API (resize, crop, etc.)
- Reliable CDN delivery

---

### `komentar` (Comments)

**Purpose**: Store teacher/parent feedback on student activities

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `komentarid` | UUID | Primary key | `f2a3b4c5-...` |
| `siswaid` | UUID | Student being commented on | `a1b2c3d4-...` |
| `userid` | UUID | Comment author | `b2c3d4e5-...` |
| `content` | TEXT | Comment text | `"Great improvement!"` |
| `deleteat` | TIMESTAMP | Soft delete timestamp | `NULL` (not deleted) |

**Soft Delete Pattern**:
- Comments are never truly deleted
- `deleteat = NULL` means active
- `deleteat = timestamp` means deleted
- Queries use `WHERE deleteat IS NULL`

**Real-World Example**:
```sql
-- Teacher comments on Ahmad's prayer submission
komentarid: 'f2a3b4c5-d6e7-...'
siswaid: 'a1b2c3d4-...'    -- Ahmad
userid: 'z9y8x7w6-...'      -- Teacher Budi
content: 'Excellent consistency! Keep it up, Ahmad.'
created_at: '2024-01-15 10:00:00'
deleteat: NULL  -- Active comment

-- Parent's comment
komentarid: 'a3b4c5d6-e7f8-...'
siswaid: 'a1b2c3d4-...'    -- Ahmad
userid: 'b2c3d4e5-...'      -- Ibu Ahmad
content: 'Alhamdulillah, proud of you!'
created_at: '2024-01-15 18:00:00'
deleteat: NULL
```

---

### `submission_window`

**Purpose**: Global toggle to control when students can submit

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Always 1 (single row) |
| `is_open` | BOOLEAN | Is submission allowed? |
| `updated_at` | TIMESTAMP | Last change time |
| `updated_by` | UUID | Admin who changed it |

**Why single row?**
- Global setting affects all students
- `CHECK (id = 1)` ensures only one row
- Simple to query and update

**Real-World Example**:
```sql
-- Admin opens submission window
id: 1
is_open: true
updated_at: '2024-01-15 06:00:00'
updated_by: 'admin-uuid-...'

-- Later, admin closes it
id: 1
is_open: false
updated_at: '2024-01-15 22:00:00'
updated_by: 'admin-uuid-...'
```

**Usage**:
- Students can only submit when `is_open = true`
- Admin dashboard shows current state
- Automatically logs who made the change

---

## Relationships Explained

### 1. User to Activity (1:N)

**One user can have many activities**

```
user_profiles (Ahmad)
    └── aktivitas (Morning Prayer - Jan 15)
    └── aktivitas (Morning Prayer - Jan 16)
    └── aktivitas (Reading Log - Jan 15)
    └── ...
```

**Why?**
- Students submit activities every day
- Each submission creates a new `aktivitas` row
- All activities link back to the student via `userid`

---

### 2. Kegiatan to Aktivitas (1:N)

**One task template can have many submissions**

```
kegiatan (Morning Prayer)
    └── aktivitas (Ahmad's submission - Jan 15)
    └── aktivitas (Budi's submission - Jan 15)
    └── aktivitas (Ahmad's submission - Jan 16)
    └── ...
```

**Why?**
- Multiple students submit the same task
- Same student submits the same task on different days
- Task definition is reused

---

### 3. Aktivitas to Field Values (1:N)

**One activity has many field values**

```
aktivitas (Ahmad's Morning Prayer - Jan 15)
    ├── aktivitas_field_values (prayer_time = "05:30")
    ├── aktivitas_field_values (location = "Mosque")
    ├── aktivitas_field_values (reflection = "Felt peaceful")
    └── aktivitas_field_images (prayer_photo.jpg)
```

**Why?**
- Dynamic fields system
- Each field value stored separately
- Images stored in separate table

---

### 4. Kegiatan to Category (N:M)

**Tasks can have multiple categories, categories can be used in multiple tasks**

```
kegiatan (Morning Prayer)
    ├── category (Prayer Details)
    ├── category (Reflection)
    └── category (Location)

kegiatan (Evening Prayer)
    ├── category (Prayer Details)  -- REUSED!
    ├── category (Reflection)      -- REUSED!
    └── category (Location)        -- REUSED!
```

**Why?**
- Reusable categories across tasks
- Flexible task configuration
- Easy to add/remove categories from tasks

---

### 5. Category to Fields (1:N)

**One category contains multiple fields**

```
category (Prayer Details)
    ├── category_fields (prayer_time)
    ├── category_fields (prayer_location)
    └── category_fields (in_congregation)

category (Reflection)
    └── category_fields (reflection_text)
```

**Why?**
- Related fields grouped together
- Forms are composable
- Admin can manage fields per category

---

### 6. Parent to Student (1:1)

**One parent links to one student** (simplified, can be extended to 1:N)

```
user_profiles (Ibu Ahmad)
    parent_of_userid ──► user_profiles (Ahmad)
```

**Why?**
- Parents view their child's activities
- Simple foreign key relationship
- Can be extended for multiple children

---

## Data Flow Examples

### Example 1: Student Submits Morning Prayer

**Step-by-step database operations:**

1. **Student opens form**
   ```sql
   -- Get task details
   SELECT * FROM kegiatan WHERE kegiatanid = 'morning-prayer-uuid';
   
   -- Get categories for this task
   SELECT c.* FROM category c
   JOIN kegiatan_categories kc ON c.categoryid = kc.categoryid
   WHERE kc.kegiatanid = 'morning-prayer-uuid';
   
   -- Get fields for each category
   SELECT * FROM category_fields 
   WHERE categoryid IN (...category-uuids...)
   ORDER BY order_index;
   ```

2. **Student fills form and submits**
   ```sql
   -- Check if already submitted today
   SELECT * FROM aktivitas 
   WHERE kegiatanid = 'morning-prayer-uuid'
     AND userid = 'ahmad-uuid'
     AND submitted_date = '2024-01-15';
   -- If exists → ERROR 409 (already submitted)
   
   -- Insert activity
   INSERT INTO aktivitas (kegiatanid, userid, activityname, submitted_date)
   VALUES ('morning-prayer-uuid', 'ahmad-uuid', 'Morning Prayer - 2024-01-15', '2024-01-15')
   RETURNING activityid;
   
   -- Insert field values
   INSERT INTO aktivitas_field_values (activityid, fieldid, value) VALUES
   ('new-activity-uuid', 'prayer-time-field-uuid', '05:30'),
   ('new-activity-uuid', 'location-field-uuid', 'Mosque'),
   ('new-activity-uuid', 'reflection-field-uuid', 'Felt peaceful');
   
   -- Insert image (if uploaded)
   INSERT INTO aktivitas_field_images (
     activityid, fieldid, filename, cloudinary_url, cloudinary_public_id
   ) VALUES (
     'new-activity-uuid', 
     'photo-field-uuid', 
     'prayer.jpg',
     'https://res.cloudinary.com/...',
     'g7-aktivitas/abc123/...'
   );
   ```

3. **Result**: Activity created with all field values and images

---

### Example 2: Teacher Views Class Activities

**Step-by-step database operations:**

1. **Get teacher's class**
   ```sql
   SELECT kelas FROM user_profiles 
   WHERE userid = 'teacher-uuid';
   -- Result: '7A'
   ```

2. **Get students in that class**
   ```sql
   SELECT userid, username, email 
   FROM user_profiles 
   WHERE kelas = '7A' AND roleid = 5;
   ```

3. **Get activities for those students**
   ```sql
   SELECT 
     a.activityid,
     a.activityname,
     a.status,
     a.created_at,
     k.kegiatanname,
     u.username
   FROM aktivitas a
   JOIN kegiatan k ON a.kegiatanid = k.kegiatanid
   JOIN user_profiles u ON a.userid = u.userid
   WHERE a.userid IN (...student-uuids...)
   ORDER BY a.created_at DESC;
   ```

4. **Result**: Teacher sees all activities from their class students

---

### Example 3: Parent Views Child's Activity Calendar

**Step-by-step database operations:**

1. **Get parent's child**
   ```sql
   SELECT parent_of_userid 
   FROM user_profiles 
   WHERE userid = 'parent-uuid';
   -- Result: 'ahmad-uuid'
   ```

2. **Get child's profile**
   ```sql
   SELECT username, kelas 
   FROM user_profiles 
   WHERE userid = 'ahmad-uuid';
   ```

3. **Get child's activities**
   ```sql
   SELECT 
     a.activityid,
     a.activityname,
     a.activitycontent,
     a.created_at,
     a.submitted_date,
     k.kegiatanname
   FROM aktivitas a
   JOIN kegiatan k ON a.kegiatanid = k.kegiatanid
   WHERE a.userid = 'ahmad-uuid'
   ORDER BY a.submitted_date DESC;
   ```

4. **Get comments on child**
   ```sql
   SELECT 
     kom.content,
     kom.created_at,
     u.username as commenter
   FROM komentar kom
   JOIN user_profiles u ON kom.userid = u.userid
   WHERE kom.siswaid = 'ahmad-uuid'
     AND kom.deleteat IS NULL
   ORDER BY kom.created_at DESC;
   ```

5. **Result**: Parent sees child's calendar and feedback

---

### Example 4: Admin Creates New Task with Custom Fields

**Step-by-step database operations:**

1. **Create categories**
   ```sql
   -- Create "Exercise Details" category
   INSERT INTO category (categoryname)
   VALUES ('Exercise Details')
   RETURNING categoryid;
   -- Result: 'exercise-category-uuid'
   
   -- Create "Health Metrics" category
   INSERT INTO category (categoryname)
   VALUES ('Health Metrics')
   RETURNING categoryid;
   -- Result: 'health-category-uuid'
   ```

2. **Create fields**
   ```sql
   -- Fields for Exercise Details
   INSERT INTO category_fields (categoryid, field_key, label, type, required, order_index) VALUES
   ('exercise-category-uuid', 'exercise_type', 'Exercise Type', 'text', true, 0),
   ('exercise-category-uuid', 'duration', 'Duration (minutes)', 'text', true, 1),
   ('exercise-category-uuid', 'location', 'Location', 'text', false, 2);
   
   -- Fields for Health Metrics
   INSERT INTO category_fields (categoryid, field_key, label, type, required, order_index) VALUES
   ('health-category-uuid', 'heart_rate', 'Heart Rate', 'text', false, 0),
   ('health-category-uuid', 'feeling', 'How do you feel?', 'text', true, 1);
   ```

3. **Create task**
   ```sql
   INSERT INTO kegiatan (kegiatanname)
   VALUES ('Daily Exercise Log')
   RETURNING kegiatanid;
   -- Result: 'exercise-task-uuid'
   ```

4. **Link categories to task**
   ```sql
   INSERT INTO kegiatan_categories (kegiatanid, categoryid) VALUES
   ('exercise-task-uuid', 'exercise-category-uuid'),
   ('exercise-task-uuid', 'health-category-uuid');
   ```

5. **Result**: New task ready for students with custom fields

---

## Common Queries

### Get All Activities for a Student

```sql
SELECT 
  a.activityid,
  a.activityname,
  a.activitycontent,
  a.status,
  a.submitted_date,
  a.created_at,
  k.kegiatanname
FROM aktivitas a
JOIN kegiatan k ON a.kegiatanid = k.kegiatanid
WHERE a.userid = 'student-uuid'
ORDER BY a.submitted_date DESC, a.created_at DESC;
```

---

### Get Activity with All Field Values

```sql
-- Get activity
SELECT * FROM aktivitas WHERE activityid = 'activity-uuid';

-- Get field values
SELECT 
  cf.label,
  cf.type,
  afv.value
FROM aktivitas_field_values afv
JOIN category_fields cf ON afv.fieldid = cf.fieldid
WHERE afv.activityid = 'activity-uuid';

-- Get images
SELECT 
  cf.label,
  afi.filename,
  afi.cloudinary_url
FROM aktivitas_field_images afi
JOIN category_fields cf ON afi.fieldid = cf.fieldid
WHERE afi.activityid = 'activity-uuid';
```

---

### Check if Student Can Submit Today

```sql
SELECT COUNT(*) as submission_count
FROM aktivitas
WHERE kegiatanid = 'task-uuid'
  AND userid = 'student-uuid'
  AND submitted_date = CURRENT_DATE;

-- If submission_count > 0, cannot submit
```

---

### Get Students Who Haven't Submitted Today

```sql
SELECT 
  u.userid,
  u.username,
  u.kelas
FROM user_profiles u
WHERE u.roleid = 5  -- students
  AND u.kelas = '7A'
  AND NOT EXISTS (
    SELECT 1 FROM aktivitas a
    WHERE a.userid = u.userid
      AND a.submitted_date = CURRENT_DATE
  );
```

---

### Get All Comments for a Student

```sql
SELECT 
  kom.content,
  kom.created_at,
  author.username as commenter,
  author_role.rolename as commenter_role
FROM komentar kom
JOIN user_profiles author ON kom.userid = author.userid
JOIN role author_role ON author.roleid = author_role.roleid
WHERE kom.siswaid = 'student-uuid'
  AND kom.deleteat IS NULL
ORDER BY kom.created_at DESC;
```

---

### Get Task with All Categories and Fields

```sql
-- Get task
SELECT * FROM kegiatan WHERE kegiatanid = 'task-uuid';

-- Get categories
SELECT 
  c.categoryid,
  c.categoryname
FROM category c
JOIN kegiatan_categories kc ON c.categoryid = kc.categoryid
WHERE kc.kegiatanid = 'task-uuid';

-- Get fields for each category
SELECT 
  cf.fieldid,
  cf.categoryid,
  cf.field_key,
  cf.label,
  cf.type,
  cf.required,
  cf.order_index,
  cf.config
FROM category_fields cf
WHERE cf.categoryid IN (
  SELECT categoryid FROM kegiatan_categories 
  WHERE kegiatanid = 'task-uuid'
)
ORDER BY cf.categoryid, cf.order_index;
```

---

### Get Activity Statistics for a Student

```sql
SELECT 
  COUNT(*) as total_activities,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  MAX(created_at) as last_activity
FROM aktivitas
WHERE userid = 'student-uuid';
```

---

## Database Maintenance

### Regular Tasks

#### 1. Backup Database
```bash
# Via Supabase CLI or dashboard
# Automatic daily backups included in Supabase
```

#### 2. Monitor Table Sizes
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### 3. Check for Orphaned Records
```sql
-- Field values without activities (shouldn't happen due to CASCADE)
SELECT COUNT(*) FROM aktivitas_field_values afv
WHERE NOT EXISTS (
  SELECT 1 FROM aktivitas a WHERE a.activityid = afv.activityid
);

-- Images without activities
SELECT COUNT(*) FROM aktivitas_field_images afi
WHERE NOT EXISTS (
  SELECT 1 FROM aktivitas a WHERE a.activityid = afi.activityid
);
```

#### 4. Analyze Query Performance
```sql
-- Enable query timing
EXPLAIN ANALYZE
SELECT * FROM aktivitas WHERE userid = 'some-uuid';

-- Check slow queries in Supabase dashboard
```

---

### Data Cleanup

#### Delete Old Soft-Deleted Comments (>90 days)
```sql
DELETE FROM komentar
WHERE deleteat IS NOT NULL
  AND deleteat < NOW() - INTERVAL '90 days';
```

#### Archive Old Activities (>1 year)
```sql
-- Create archive table
CREATE TABLE aktivitas_archive AS
SELECT * FROM aktivitas WHERE created_at < NOW() - INTERVAL '1 year';

-- Delete from main table
DELETE FROM aktivitas WHERE created_at < NOW() - INTERVAL '1 year';
```

---

### Index Maintenance

#### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

#### Rebuild Indexes (if needed)
```sql
REINDEX TABLE aktivitas;
REINDEX TABLE user_profiles;
```

---

### Security Best Practices

1. **Use Row Level Security (RLS)**
   ```sql
   -- Enable RLS on aktivitas table
   ALTER TABLE aktivitas ENABLE ROW LEVEL SECURITY;
   
   -- Students can only see their own activities
   CREATE POLICY student_see_own ON aktivitas
   FOR SELECT
   USING (auth.uid() = userid);
   ```

2. **Never expose service role key** to client
3. **Use prepared statements** (Supabase client does this automatically)
4. **Regular security audits** via Supabase dashboard

---

## Summary

The G7 KAIH database is designed to be:

- **Flexible**: Dynamic fields allow customization without code changes
- **Scalable**: Proper indexes and relationships for performance
- **Secure**: Role-based access and foreign key constraints
- **Auditable**: Timestamps and soft deletes preserve history
- **Maintainable**: Clear structure and documentation

### Key Takeaways

1. **Two-layer user system**: Auth (Supabase) + Profiles (custom)
2. **Dynamic forms**: Admin creates categories/fields for tasks
3. **Daily limits**: Enforced by unique constraint + timezone handling
4. **File storage**: Cloudinary integration for images
5. **Soft deletes**: Comments never truly deleted
6. **Class-based access**: Teachers see only their class

### Next Steps

- Review [BACKEND.md](./BACKEND.md) for implementation details
- Check [API.md](./API.md) for endpoint documentation
- See [DOCUMENTATION.md](./DOCUMENTATION.md) for quick start guides

---

**Last Updated**: October 2024
