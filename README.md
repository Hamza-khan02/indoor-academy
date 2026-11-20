# INDOOR ACADEMY

Management app for a cricket academy: students, coaches, batches, attendance, fees, performance assessments, tournaments, branches and reports. Built with Next.js 14 (App Router), Prisma and SQLite.

## First-time setup

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and fill it in:
   - `AUTH_SECRET`: a long random string. You can generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the first administrator login.
3. Install packages: `npm install`. If npm asks you to approve install scripts, run
   `npm approve-scripts prisma @prisma/client @prisma/engines`.
4. Create the database and the first admin: `npm run setup`
5. Start the app: `npm run dev`, then open http://localhost:3000 and log in with the admin email and password from `.env`.
6. Change the admin password from **Settings** after the first login.

The seed creates the admin user and three branches (Sultanpur Main, North and South). Rename or delete them from **Branches**. No sample students or payments are created, so every number on the dashboard comes from data you enter.

## Getting started in the app

1. **Branches**: check your locations.
2. **Coaches**: add your coaching staff.
3. **Batches & Sessions**: create batches with training days, timings and monthly fee.
4. **Students**: add students and assign each to a batch.
5. **Attendance**: pick a batch and date, mark Present/Late/Absent, save.
6. **Fees & Finance**: see who owes fees this month and record payments.
7. **Performance**: coaches rate batting, bowling, fielding and fitness (1–10).

## WhatsApp reminders

Green **WhatsApp** buttons open WhatsApp (phone app or WhatsApp Web) with a message already typed for the parent; you press Send. This uses free `wa.me` links, so no WhatsApp Business account or API is needed, and messages go from your own WhatsApp number.

- **Fees & Finance → Pending dues**: *Remind* sends a fee reminder with the due amount and month. The table shows when the last reminder was sent and how many times.
- **Attendance**: when a student is marked Absent, *Notify parent* sends an absence notice for that date.
- **Student profile**: fee reminder, latest absence notice (last 14 days), a plain *Chat* link, and a log of reminders sent.
- **Settings → WhatsApp messages** (admin): edit the academy name and both messages, switch between the English and Hindi presets, and see a live preview.

Clicking a button is logged as "sent"; WhatsApp does not report whether you actually pressed Send. Phone numbers without a country code are treated as Indian (+91). Fee reminders are admin-only; coaches can send absence notices.

## Roles

| | Administrator | Coach |
|---|---|---|
| Dashboard, students, attendance, assessments, tournaments | ✅ | ✅ |
| View coaches and batches | ✅ | ✅ |
| Add/edit coaches, batches, branches | ✅ | ❌ |
| Fees & Finance, Reports, CSV export | ✅ | ❌ |
| Delete students, payments, assessments | ✅ | ❌ |
| Create logins for other users | ✅ | ❌ |

Administrators create logins from **Settings → Users**.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for local use / development |
| `npm run build` then `npm start` | Run an optimised production build |
| `npm run setup` | Apply database migrations and create the first admin |
| `npm run db:migrate` | After changing `prisma/schema.prisma`, create and apply a migration |
| `npm run db:studio` | Open Prisma Studio to browse the database |

## Data and backups

- The database is the single file `prisma/dev.db`. **Back it up regularly** (copy the file while the app is stopped).
- Dates are stored as India-time calendar dates (`YYYY-MM-DD`), so they do not shift with server timezone.
- Reports → download Students, Fee payments and Attendance as CSV files for Excel.

## Running on a local network

`npm run dev` works on other devices at `http://<your-computer-ip>:3000`. When using a production build (`npm start`) over plain `http` on a local network, set `COOKIE_SECURE="false"` in `.env`, otherwise browsers will refuse the login cookie. Leave it unset when the site is served over HTTPS.

## Moving to a hosted database

SQLite suits a single computer. To deploy online with several users, switch to PostgreSQL: change `provider` in `prisma/schema.prisma` to `postgresql`, set `DATABASE_URL` to your Postgres connection string, delete `prisma/migrations`, and run `npx prisma migrate dev --name init`.

## Project layout

```
app/(app)/            Logged-in pages (one folder per section, each with page.tsx + actions.ts)
app/login/            Login page and login/logout actions
app/api/export/       CSV downloads
components/           Shared UI (sidebar shell, modal form, toast, chart)
lib/                  Database client, auth/session, dates (IST), validation, queries
prisma/               Schema, migrations and seed script
middleware.ts         Sends logged-out visitors to /login
```
