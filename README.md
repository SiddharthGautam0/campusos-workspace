# CampusOS Workspace

Create a modern, minimal, premium, and fully responsive web application called CampusOs.

Supabase Integration:
Use Supabase as the backend from the start.
Configure:
● Supabase Authentication
● PostgreSQL Database
● Storage
● Row Level Security (RLS)
● SQL Migrations

Create all required database tables, relationships, indexes, and RLS policies. Store all application data in Supabase.

We are building a production-style college academic platform called:
CAMPUSOS
Tagline: "One campus. Every class. One connected space."

The goal is NOT to build a static college website. CampusOS is a permission-aware digital academic workspace where students, teachers and administrators interact inside controlled academic spaces. The application must be fully functional. Do not create fake buttons, fake API responses, fake database behavior, or UI-only permissions. Every important action must be connected to a real backend and database.

1. PRODUCT VISION
CampusOS connects:
College → Course → Year → Section → Subject/Class → Academic Content
Example:
College └── BCA └── 1st Year └── Section A ├── Computer Fundamentals ├── Mathematics ├── Business Communication └── Soft Skills

The system supports:
- Students, Teachers, Administrators
- Courses, Years, Sections, Classes/subjects
- Join requests, Memberships
- Announcements, Assignments, Study material, Files, People, Permissions, Notifications
- AI Study Assistant

2. TECHNOLOGY STACK
React, Tailwind CSS, shadcn/ui, Supabase (Auth, Postgres, Storage, RLS).

3. FRONTEND DESIGN SYSTEM
Modern education SaaS + clean productivity application + academic workspace.
- Light interface, deep indigo / blue-violet primary color, white cards, soft neutral background, subtle borders, 12–18px border radius, clean typography (Inter / Plus Jakarta Sans).
- Responsive design: Desktop left sidebar navigation; Mobile bottom navigation. Navigation changes based on role.

4. AUTHENTICATION & ROLES
- Roles: student, teacher, admin. Role stored in database and enforced via Supabase RLS.
- Professional login and registration.

5. ACADEMIC HIERARCHY & WORKSPACES
- Course → Year → Section → Class hierarchy.
- Student Dashboard: Greeting, My Classes, Pending Requests, Notifications, Recent announcements, quick access.
- Discover Classes: search, filter by course/year/section, request to join.
- Join Request System: Student requests -> Teacher approves/rejects -> Membership created.
- Class Workspace: Feed (announcements, assignments, resources, links), Subjects (units/modules, notes, links), People (authorized members), Files.

6. PERMISSION & FILE RULES
- Students cannot directly join classes; they must request access.
- Teachers approve/reject requests for their classes.
- Students cannot upload files or delete files.
- Teachers cannot upload/delete files.
- Only Admins can upload official files and delete authorized files.
- Students and teachers can only access data they are authorized to access. Enforce with Supabase RLS.
- File metadata in database, files stored in Supabase Storage.

7. AI STUDY ASSISTANT & NOTIFICATIONS
- AI assistant grounded in authorized class material.
- Notifications for join requests, approvals, new posts.
- Audit log for administrative actions.

Build the database and security foundation first, then the application UI and functionality on top of it.
Show:
- Database tables created
- RLS policies created
- Authentication setup
- Storage setup
- Application routes/pages
- What is fully functional
- What still requires external configuration

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/41c9bc07-e316-44e0-a665-43921fb896c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
