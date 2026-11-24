# INDOOR ACADEMY

Management app for a cricket academy: students, coaches, batches, attendance, fees, performance assessments, tournaments, branches and reports. Built with Next.js 16 (App Router), Prisma and SQLite.

## First-time setup (new computer)

1. Install **Node.js** (LTS, version 20.9 or newer) from https://nodejs.org and **Git** from https://git-scm.com.
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

The seed creates the admin user, the academy's two branches (**Sultanpur City** — Pausahal Road, and **Aliganj Bazar** — Nirman Public School), coach **Aftab Khan**, and the academy phone/address used on receipts. Add the upcoming third branch from **Branches** when it opens. No sample students or payments are created, so every number on the dashboard comes from data you enter.

> **Keeping it secure:** the project uses Next.js 16, which receives security fixes. Every few weeks, stop the app and run `npm update` then `npm run build` to pick them up, especially once the app is on the internet.

## Getting started in the app

1. **Branches**: check your locations.
2. **Coaches**: add your coaching staff.
3. **Batches & Sessions**: create batches with training days, timings and monthly fee.
4. **Students**: add students and assign each to a batch.
5. **Attendance**: pick a batch and date, mark Present/Late/Absent, save.
6. **Fees & Finance**: see who owes fees this month and record payments.
7. **Performance**: coaches rate batting, bowling, fielding and fitness (1–10).

## Public home page

Anyone who opens the app's address without logging in sees the academy's home page: what the academy trains, how progress is tracked, the branches, the coaches and how to get in touch. Staff who are logged in still get the dashboard at the same address, and can preview the home page at **`/home`**.

- Everything on it comes from data you already manage: academy name, phone and address (**Settings**), branches with their address, facilities and Google Maps link (**Branches**), active batches with days and timings (**Batches & Sessions**) and active coaches (**Coaches**). Sections with no data are hidden.
- **Settings → Home page** (admin) holds the rest: the short "about" line, the academy's timings, and the Instagram, Facebook and YouTube links. Timings show in the top bar and footer, the links as icons in both. Anything left empty is hidden. Only real Instagram, Facebook and YouTube addresses are accepted (for Instagram, `@yourpage` also works).
- **Enquire on WhatsApp** and **Call** use the academy phone from Settings. On phones a Call / WhatsApp bar stays at the bottom of the screen, and the menu button opens the section links and both logins.
- It is public, so it never shows students, fees, branch photos, notices or coaches' phone numbers. The rating, match and attendance cards beside the headline are a fixed sample, not a real student.
- **Parent login** and **Staff login** are in the top bar and the footer.

### Coach profile pages

Each active coach's card on the home page opens that coach's own public page (`/home/coach/...`) with their photo, experience, trophies and awards, social media links and the batches they coach.

- **Coaches → Edit profile** (admin) fills it in: photo, a few lines about the coach, the year they started coaching (the page works out "14+ years" itself), experience and qualifications (one per line), trophies and awards (one per line; start a line with the year, e.g. `2019 - District champions`, to show the year as a tag), and Instagram, Facebook and YouTube links. Anything left empty is hidden; a coach with nothing filled in shows a short "profile is being updated" note.
- The ↗ icon next to **Edit profile** opens the public page. Inactive coaches have no public page.
- The coach's phone and email are never shown. **Enquire on WhatsApp** and **Call** on the page go to the academy's number.
- Coach photos are public (unlike student and branch photos), because they are on the home page.

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

## Student photos

Each student can have a profile photo, shown on their profile, in the student list, dashboard, fees and performance pages, and in the parent app.

- **Staff** (admin or coach): click the photo (or *Add photo* / *Change photo*) on the student's profile. *Remove* deletes it.
- **Parents / students**: the same buttons on the child's card in the parent app. They can only change their own children's photos.
- The profile shows when the photo was last changed and by whom ("Parent / student" or the staff member's name), so staff can remove an unsuitable photo.
- Photos are cropped to a square and shrunk to about 20–40 KB in the browser before upload; the server accepts only real JPG, PNG or WebP files up to 300 KB. They are stored inside the database, so they move with `prisma/dev.db` and backups.
- A photo is only visible to staff and to that student's own family.

## Monthly progress reports

**Progress reports** (left menu) gives every student a one-page report per month.

- Pick the **month** (early in a month it defaults to the month that just ended) and optionally a **batch**. The list shows attendance, whether the student was rated, matches, the coach's comment and whether the report was sent.
- **Write** adds the coach's comment for that month (shown on the report and in the WhatsApp summary; empty removes it).
- **Open report**: attendance (present/late/absent, % and change from last month, day-by-day), coach rating (each skill and change since the previous assessment, notes), matches that month, practice drills done, tournament selections, the month's fee status, and the coach's comment. **Print / Save as PDF**, **Send on WhatsApp** (a short summary to the guardian, logged as sent) and **Add/Edit comment** are at the top.
- Parents open **📄 Monthly report** in the parent app to see and print the last 6 months for their own child.
- Admins and coaches can open reports and write comments.

## Drills & homework

**Drills & homework** (left menu) lets coaches set practice for students to do at home.

- **New drill**: title, how to do it, category (batting, bowling, fielding, fitness, other), optional video link (https, e.g. YouTube) and optional *Complete by* date.
- **Who**: a whole batch (current students), or only the students ticked in the list.
- Each drill shows **done / total**; open it to see who has done it (with their note) and who hasn't. **Share on WhatsApp** and **Copy** send it to a group.
- In the parent app, **Practice at home** lists the child's drills (to-do first) with the video button and **Mark as done** (optional note for the coach), which can be undone.
- Admins and coaches set and edit drills; admins can delete any, coaches only their own. Parents can only mark drills set for their own child.

## Branch facilities & photos

Open a branch (click its name on **Branches**) to manage what parents see about it:

- **Facilities → Edit**: tick what the branch offers (indoor nets, turf/cement pitch, bowling machine, special mentoring, video analysis, floodlights, gym, match practice, kit, changing room, drinking water, parking, first aid, seating for parents, CCTV), add a short detail (e.g. "3 nets"), and add other facilities one per line (e.g. "AC hall").
- **Photos → Add photos**: pick one or many pictures; each is resized in the browser (longest side 1280 px) before upload. Up to 12 photos per branch; delete with the bin icon.
- The parent app shows an "At <branch>" panel with the facilities and photos for the child's branch (hidden until something is added). Photos are visible only to logged-in staff and families.
- Only administrators can change facilities and photos.

## Notice board

**Notices** (left menu) holds announcements for families: holidays, timing changes, tournament news, fee dates.

- Choose who sees it: **all families**, **one branch** or **one batch**. Optional **Show until** date hides it from parents after that day; **Pin to the top** keeps it first.
- Notices appear at the top of the parent app for the families they are aimed at, newest first, with a *New* tag for 3 days.
- **Share on WhatsApp** opens WhatsApp with the notice typed in (bold title) so you can pick a group or contact; **Copy** copies the same text. If the app's public address is set (Settings → Parent app), the parent app link is added.
- Admins and coaches can post and edit notices; admins can delete any notice, others only their own. Ended notices stay listed under *Ended notices*.

## Matches & career stats

**Matches** (left menu) records every match the academy plays: opponent, date, type (practice, friendly, tournament, league), overs, scores and result.

- Open a match to fill in the **scorecard** for our players: how they batted (did not bat / out / not out), runs, balls, 4s, 6s; bowling overs (e.g. `3.4` = 3 overs 4 balls), maidens, runs, wickets; catches, stumpings and run outs. Wrong combinations (e.g. 4s and 6s adding to more than the runs) are rejected with a clear message.
- Each student's **career record** is worked out automatically: matches, runs, highest score, average, strike rate, 50s/100s, overs, wickets, best bowling, economy and fielding. It shows on the student's profile and in the parent app.
- **Performance** lists the top run scorers and wicket takers.
- Admins and coaches can add matches and scorecards; only admins can delete a match.

## Career stats

Every student has a full career page (**Full career stats →** on the profile's *Match record*, and the same link in the parent app):

- **Totals**: matches, runs, highest score, average, strike rate, wickets, best bowling, economy, catches.
- **Season by season** (season = April–March, e.g. 2026-27) and **by match type** (practice, friendly, tournament, league).
- **Graphs**: runs and wickets in each match, and the coach rating (average and each skill) over time.
- **Milestones**: first match, first fifty / hundred, first 3- and 5-wicket hauls, 100/250/500/1000 career runs, 10/25/50/100 wickets, highest score, best bowling, best fielding match.
- **Rank in batch** (or age group if no batch): runs, wickets, batting average (needs 3 innings) and catches + stumpings, among players with match records.
- **Overall performance score (0–100)**: coach rating (latest assessment average × 10) 40%, attendance in the last 90 days 30%, match performance 30% — (runs + 20 per wicket + 10 per catch/stumping/run out) per match × 2, capped at 100. Parts without data are left out and the others count for more. The page shows each part, so the number is explainable. It is a guide, not a selection decision.
- **Career card**: a one-page printable card (photo, stats, seasons, milestones, rating, ranks) — *Career card* button → *Print / Save as PDF*. Parents can print their own child's card.

## Tournament squads

Open a tournament (title or *Squad* link) to tick the selected players and give each a role (Captain, Vice-captain, Wicket-keeper, Player, Reserve; one captain and one vice-captain). The list starts with the tournament's age group; tick "Show all age groups" to pick others. In the parent app, a selected child sees a "has been selected" banner and a *Selected* tag on the tournament. A match linked to a tournament can add the whole squad to its scorecard in one click.

## Health & emergency details

Each student can have a blood group, an emergency contact (name and phone) and medical notes (allergies, asthma, injuries). They are in the student form, on the profile, in the students CSV export, and shown read-only to the family in the parent app. Students with medical notes get a ⚕ mark on the attendance sheet so coaches can see them during training. The separate *Internal notes* field stays staff-only.

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
| `npm run start:live` | For hosting: apply database migrations, create the first admin if there is none, then start the production build |
| `npm run setup` | Create `.env` if missing, apply database migrations, create the first admin (safe to re-run) |
| `npm run db:migrate` | After changing `prisma/schema.prisma`, create and apply a migration |
| `npm run db:studio` | Open Prisma Studio to browse the database |

## Data and backups

- The database is the single file `prisma/dev.db`. **Back it up regularly** (copy the file while the app is stopped).
- Dates are stored as India-time calendar dates (`YYYY-MM-DD`), so they do not shift with server timezone.
- Reports → download Students, Fee payments and Attendance as CSV files for Excel.

## Running on a local network

`npm run dev` works on other devices at `http://<your-computer-ip>:3000`. When using a production build (`npm start`) over plain `http` on a local network, set `COOKIE_SECURE="false"` in `.env`, otherwise browsers will refuse the login cookie. Leave it unset when the site is served over HTTPS.

## Going live (putting the app on the internet)

The app needs a host that runs **Node.js 20.9 or newer** all the time and serves it over **https**. Hosts differ in one thing that matters here: whether files survive a restart.

- **Host with a persistent disk / volume** (the simple route): the database stays a single SQLite file, exactly as on your computer. Put it on the disk, e.g. `DATABASE_URL="file:/data/academy.db"`.
- **Host without a disk** (most free "serverless" plans): files are wiped on every restart, so the database must move to PostgreSQL first (next section).

Whichever host you choose:

1. **Settings on the host** (environment variables): `DATABASE_URL`; `AUTH_SECRET` (a new long random value, at least 32 characters, never the one from your computer); `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first admin. Do **not** set `COOKIE_SECURE`.
2. **Build command:** `npm install && npm run build`. **Start command:** `npm run start:live`. It applies database changes, creates the first admin, branches and coach if the database is empty, then starts the app on the port the host gives it.
3. **After the first start:** log in and change the admin password; fill in **Settings → Parent app** with the public address (so PIN messages carry the right link) and **Settings → Home page**; check the branches and the coach profile; then add students and send parents their PINs.
4. **Backups:** download a copy of the database file (or use the host's volume backups) regularly. It holds everything, including photos.

The live app starts with an empty database. To carry over what is on your computer, copy `prisma/dev.db` to the host's disk under the name used in `DATABASE_URL` before the first start.

Search engines are told (in `/robots.txt`) to list only the home page and coach pages; everything behind a login stays out of search results.

## Moving to a hosted database

SQLite suits a single computer. To deploy online with several users, switch to PostgreSQL: change `provider` in `prisma/schema.prisma` to `postgresql`, set `DATABASE_URL` to your Postgres connection string, delete `prisma/migrations`, and run `npx prisma migrate dev --name init`.

## Project layout

```
app/(app)/            Logged-in pages (one folder per section, each with page.tsx + actions.ts)
app/home/             Public home page and coach pages (shared header/footer in site.tsx, styles in home.css)
app/login/            Staff login page and login/logout actions
app/parent/           Parent & student app (own login, own session cookie)
app/receipt/          Printable receipt page for staff
app/api/export/       CSV downloads
components/           Shared UI (sidebar shell, modal form, toast, chart)
lib/                  Database client, auth/session, dates (IST), validation, queries
prisma/               Schema, migrations and seed script
proxy.ts              Runs before every request: shows logged-out visitors the home page at "/", keeps /home/... public, and sends them to /login (staff) or /parent/login (parents) elsewhere
```
