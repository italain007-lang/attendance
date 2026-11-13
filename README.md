# GS Nyagatoma Attendance Management System

Attendance for GS Nyagatoma Ordinary Level (S1 to S3, streams A and B): daily registers and lesson-by-lesson attendance,
dashboard, nine report types with Excel/PDF export, installable app with offline recording.
React + Vite + Tailwind on Render; Supabase (PostgreSQL, Auth, Row Level Security) for data and login.

## Start here
| I want to... | Read |
|---|---|
| Deploy it (Supabase, GitHub, Render) | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Check that it works | [docs/TESTING.md](docs/TESTING.md) and `npm test` |
| Understand and review security | [docs/SECURITY.md](docs/SECURITY.md) and `npm run check:security` |
| Back up and restore | [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md) |

Commands: `npm install`, `npm run dev`, `npm run build`, `npm test`, `npm run check:security`.
Database: run `supabase/all_migrations.sql` once (or the numbered files in `supabase/migrations/`), then the tests in `supabase/tests/`.

The sections below are the per-phase notes written during development.

React + Vite + Tailwind frontend, Supabase (PostgreSQL, Auth, RLS) backend, hosted on Render.

## Run locally
```bash
npm install
cp .env.example .env   # fill in the two Supabase values
npm run dev
```

## Build
```bash
npm run build   # output in dist/
```

## Deploy on Render
Static Site, build command `npm install && npm run build`, publish directory `dist`,
rewrite `/*` to `/index.html` (already in `render.yaml`). Set `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` in Render's environment settings.

## Security
Only the anon key is used in the browser. Never commit `.env` or the service-role key.
Authorization is enforced by Row Level Security in `supabase/migrations/` (Phase 2).

## Database setup (Phase 2)
1. Create a Supabase project. In Authentication > Providers > Email, **turn off "Allow new users to sign up"** (accounts are created by the administrator).
2. In the SQL Editor run, in order: `supabase/migrations/001_schema.sql`, `002_functions_triggers.sql`, `003_rls.sql`.
3. Create your first user in Authentication > Users, then make that user an administrator:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
4. In the app (Phase 5) create the academic year and its three terms before taking attendance.
5. Run `supabase/tests/rls_tests.sql` in the SQL Editor. It must end with `ALL RLS TESTS PASSED` (it rolls back, so no data is kept).

## Authentication and users (Phase 3)
**Deploy the Edge Function** (needed to create users and reset passwords). With the Supabase CLI:
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy admin-users
```
(or create a function named `admin-users` in the Supabase dashboard and paste `supabase/functions/admin-users/index.ts`).
Supabase supplies the service-role key to the function automatically; it never reaches the browser.

**Password reset links**: Authentication > URL Configuration. Set Site URL to your Render URL and add
`https://<your-app>.onrender.com/reset-password` and `http://localhost:5173/reset-password` to Redirect URLs.
Supabase's built-in email sender is heavily rate-limited; for a real school set up custom SMTP.
If a teacher cannot receive email, the administrator can set a new password in Users > Password.

**Test checklist**
1. Sign in as the admin; Users page opens. Sign in as a teacher; /users redirects to Home.
2. Admin adds a teacher; sign in with the shown credentials.
3. Admin deactivates that teacher; their next sign-in is refused.
4. "Forgot password" email arrives and the link opens "Choose a new password".
5. Teacher tries to call the function directly: it answers "Administrator access is required."

## Dashboard (Phase 4)
Run `supabase/migrations/004_dashboard.sql` in the SQL Editor, then `npm install` (adds `recharts`).
All figures come from the database through RPC functions. They run as the signed-in user, so
teachers only ever see numbers for their own classes. Dashboard statistics use **daily registers**;
lesson attendance is kept separate. The percentage follows `app_settings.attendance_rules`
(default: (Present + Late) / all marked records).

Check: with no data the dashboard shows empty states; after daily attendance exists (Phase 6) the cards and charts fill in.

## Management modules (Phase 5)
Run `supabase/migrations/005_management.sql`, then `npm install` (adds `xlsx`).

First-time setup order (as administrator):
1. **Settings**: add the academic year, set it as current, enter the three terms and set the current term.
2. **Subjects**: add the subjects taught.
3. **Users**: add teachers.
4. **Classes > Teachers**: assign teachers to each class and subject.
5. **Students**: add students or import them from Excel (download the template in the import window).

Notes: student class changes go through "Transfer" so history is preserved. Excel import checks every row,
skips bad rows with a reason, and never stops the good ones. Teachers see only their own students and classes.

## Daily attendance (Phase 6)
Run `supabase/migrations/006_daily_attendance.sql`. Optional: run `supabase/tests/daily_register_tests.sql`
(must end with `ALL DAILY REGISTER TESTS PASSED`).

How it works: choose class and date, mark each student (Present / Absent / Late / Excused), optional remark,
then Save. Everyone must be marked before saving. "Mark all present/absent" speeds this up.
- One daily register per class and date; opening the same day again edits it (no duplicates).
- A teacher edits only registers they took; an administrator can correct any register (changes are audited).
- If two people change the same register, the second save is refused with a "reload" message (no silent overwrite).
- Students are listed for the date chosen, so transferred students stay in the right class's history.
- Future dates are refused. Past dates are allowed (for catching up).

## Lesson attendance (Phase 7)
Run `supabase/migrations/007_lesson_attendance.sql`. Optional: `supabase/tests/lesson_register_tests.sql`
(must end with `ALL LESSON REGISTER TESTS PASSED`).

Choose class, subject, date and lesson number, type the lesson topic, mark students, save.
- A teacher can only pick subjects assigned to them in that class (enforced in the database too).
- One record per class + date + subject + lesson number; reopening it edits it. Lessons already recorded that day are marked "(recorded)".
- Topic is required. Lesson attendance never changes the daily register, and the dashboard counts daily registers only.
- Same edit rules as daily attendance: the teacher who took it or an administrator can change it; simultaneous edits are refused with a reload message.

## Reports and analytics (Phase 8)
Run `supabase/migrations/008_reports.sql`, then `npm install` (adds `jspdf`, `jspdf-autotable`).
Optional test: `supabase/tests/report_tests.sql` (must end with `ALL REPORT TESTS PASSED`).

Report types: Daily, Weekly, Monthly, Termly, Annual, Individual student, Class, Subject (lessons), Teacher activity (admin only).
Filters: academic year, term, date range, class, stream, subject, student, and "Based on" (daily registers or lesson attendance; never mixed).
Each result shows totals, charts, a table with the exact `Attended / Eligible` numbers behind every percentage, and the active rule text.
Export: Excel (.xlsx), PDF (landscape A4) and Print (the page hides menus when printing; choose "Save as PDF" in the print dialog if you prefer).

The percentage rule lives in Settings > Attendance percentage rules and applies to the dashboard and every report.
Teachers get the same reports but only ever see their own classes (enforced by Row Level Security).

## PWA and offline attendance (Phase 9)
Run `npm install` (adds `vite-plugin-pwa`). No new SQL. Deploy as before (`render.yaml` now sets no-cache headers on `sw.js` and the entry page so updates reach users).

**Install**: Android/Chrome/Edge use the browser menu "Install app" (an "Install app" button also appears in the menu when the browser offers it); iPhone/iPad use Safari Share > Add to Home Screen.
**What works offline**: opening the app, Daily and Lesson attendance for classes prepared on the device. Everything else needs internet.

How it behaves
- While online the app downloads the class list and a minimal roster (admission no. + names) for the user's classes, refreshed every 12 hours (or "Prepare now" on the Sync page). Offline registers are built from this copy; rosters expire after 14 days and are removed on sign-out.
- Saving offline stores the register on the device only. The screen says so ("NOT yet on the server") and a success message is shown only after the server confirms.
- Unsent registers are sent automatically when internet returns, when the app is reopened, and every minute while any wait. One entry per register, so repeated saving never creates duplicates; if a reply was lost the sync recognises that the server already has identical data.
- If someone else saved the same register meanwhile, nothing is overwritten silently: the Sync page shows both versions and the user chooses "Replace the server version with mine" or "Discard mine".
- The service worker caches only the app files. Student data from the database is never cached by it.
- Updates never reload the page by themselves; a banner offers "Update now".

Security notes: the browser cannot hide data from someone who controls the unlocked device, so keep devices locked and sign out on shared devices (this removes student lists). The saved profile (name, role) lets the app open offline; it is removed on sign-out. Sign-out uses "this device only", so other devices stay signed in.

Manual test (Chrome DevTools > Network > Offline):
1. Sign in online, wait for "Up to date", open Sync and check "Ready: N class(es)".
2. Go offline, reload: the app still opens. Take a daily register and Save: it says stored on this device; the Sync page lists it as "Waiting to send".
3. Go online: it sends by itself, the list empties, the dashboard shows it. Reopen the register: it is the server copy.
4. Conflict: take the same register offline as teacher A, save the same class/date as an admin online, then go online as teacher A: the Sync page shows a conflict.
5. Sign out with a waiting register: the warning appears; student lists are removed.
6. Lighthouse > PWA / installability check passes; install the app on a phone.
