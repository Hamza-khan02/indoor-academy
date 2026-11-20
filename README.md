# INDOOR ACADEMY

Management app for a cricket academy: students, coaches, batches, attendance, fees, performance assessments, tournaments, branches and reports. Built with Next.js 14.2 (App Router), Prisma and SQLite.

## First-time setup (new computer)

1. Install **Node.js** (LTS) from https://nodejs.org and **Git** from https://git-scm.com.
2. Download the project and open its folder:
   ```
   git clone https://github.com/Hamza-khan02/indoor-academy.git
   cd indoor-academy
   ```
3. Install and set up:
   ```
   npm install
   npm run setup
   ```
   `npm run setup` creates the `.env` file (with a random secret key and admin password), the database, and the first admin. **At the end it prints the admin email and password** — note them down (they are also saved in `.env`).
   If `npm install` asks you to approve install scripts, run `npm approve-scripts prisma @prisma/client @prisma/engines`, then `npm install` again.
4. Start the app: `npm run dev`, then open http://localhost:3000 and log in.
5. Change the admin password from **Settings** after the first login.

Running `npm run setup` again is safe: it never overwrites real values in `.env` or data in the database. If you prefer to choose the admin email/password yourself, copy `.env.example` to `.env`, fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running setup (any placeholder values left in it are replaced with random ones).

**Moving data from another computer:** copy both `.env` and `prisma/dev.db` from the old computer into the same places, then run `npm install` and `npm run setup`. Log in with the old admin account.

The seed creates the admin user and three branches (Sultanpur Main, North and South). Rename or delete them from **Branches**. No sample students or payments are created, so every number on the dashboard comes from data you enter.

> **Security note:** the project uses Next.js 14.2.35, the last 14.x release. Some advisories are only fixed in Next.js 15/16; plan that upgrade before putting the app on the internet.

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

## Fee receipts

Every payment recorded in **Fees & Finance** (or on a student's profile) gets a receipt number like `IA/2026-27/0001`.

- Numbers run per Indian financial year (1 April – 31 March) and restart at 0001 each April. The year comes from the payment date.
- Numbers are never reused. Deleting a payment cancels its receipt number; the next payment gets the next number.
- Open a receipt from the 📄 icon in *Payments received* or the receipt number on the student's profile. **Print / Save as PDF** uses the browser's print dialog (choose "Save as PDF" as the printer).
- **Send on WhatsApp** sends the receipt details as a text message (WhatsApp links cannot attach files; send the saved PDF yourself if the parent wants a copy).
- **Settings → Receipt details**: receipt prefix, academy address and phone, and a note printed at the bottom. **Settings → WhatsApp messages**: the receipt message text (English/Hindi presets).
- Payments recorded before receipts existed get a number the first time their receipt is opened.

## Parent & student app

Parents (and students, using the parent's login) open **`/parent/login`** and log in with the **guardian phone number** saved on the student's record and a **6-digit PIN**. They see, for each child on that phone number:

- Training schedule and next session (batch, days, time, venue, coach)
- Attendance for the last 30 days
- Fees: this month's status, payment history and printable receipts
- Coach ratings (batting, bowling, fielding, fitness) with the coach's notes
- Upcoming tournaments for the child's age group

They cannot see internal student notes, the "Review" status, other families, or any staff page.

**Giving access (admin):** open the student's profile → *Parent app* → **Give parent access**. A PIN is shown once, with a ready WhatsApp message (link + phone + PIN). Siblings with the same guardian phone share one login. **New PIN** replaces the old one and logs the family out everywhere. **Settings → Parent app** lists every parent login, lets you switch one off or remove it, and holds the app's public address used in the login link.

Until the app is online, the login link only works on the computer running it (the PIN window warns about this). After hosting, set the address in **Settings → Parent app** and send new PINs. Five wrong PINs lock that phone number for 15 minutes.

## Roles

| | Administrator | Coach |
|---|---|---|
| Dashboard, students, attendance, assessments, tournaments | ✅ | ✅ |
| View coaches and batches | ✅ | ✅ |
| Add/edit coaches, batches, branches | ✅ | ❌ |
| Fees & Finance, receipts, Reports, CSV export | ✅ | ❌ |
| Delete students, payments, assessments | ✅ | ❌ |
| Create logins for other users | ✅ | ❌ |
| Give / reset / switch off parent app PINs | ✅ | ❌ |

Administrators create logins from **Settings → Users**.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for local use / development |
| `npm run build` then `npm start` | Run an optimised production build |
| `npm run setup` | Create `.env` if missing, apply database migrations, create the first admin (safe to re-run) |
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
app/login/            Staff login page and login/logout actions
app/parent/           Parent & student app (own login, own session cookie)
app/receipt/          Printable receipt page for staff
app/api/export/       CSV downloads
components/           Shared UI (sidebar shell, modal form, toast, chart)
lib/                  Database client, auth/session, dates (IST), validation, queries
prisma/               Schema, migrations and seed script
middleware.ts         Sends logged-out visitors to /login (staff) or /parent/login (parents)
```
