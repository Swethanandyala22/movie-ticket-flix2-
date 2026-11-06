# Movie Ticket Flix

Movie Ticket Flix is a beginner-friendly full-stack movie-ticket booking demo inspired by common cinema-booking experiences. It uses **HTML, CSS, and vanilla JavaScript** in the frontend, **Node.js + Express** in the backend, and **Supabase PostgreSQL** for persistent data.

## Features
- Responsive dark UI with pink accents, featured banner, movie posters, search and genre filters.
- Movie cards loaded from the real Supabase database through the Node API.
- Cinema/showtime selection and live seat availability.
- Seat selection, price calculation, server-side validation, and booking confirmation.
- Unique booking reference and booking lookup.
- Database function and transaction-safe checks to prevent double booking of a seat for the same show.
- Demo only: no payment is taken and no real payment processing is implemented.

## Project folders
- `frontend/` — HTML, CSS, browser JavaScript, and assets.
- `backend/` — Express API and environment configuration.
- `database/` — Supabase schema, seed data, and database instructions.

The main working experience is in `frontend/index.html`. The extra requested HTML entry points are included for navigation/organization; the booking flow itself is currently handled in the main page's dialogs.

## Before you start
Install **Node.js LTS** from https://nodejs.org if `node` or `npm` is not recognized. After installation, close and reopen VS Code.

## Step 1 — Extract and open the project
1. Extract `Movie-Ticket-Flix.zip`.
2. Open VS Code.
3. Select **File → Open Folder**.
4. Select the extracted `Movie-Ticket-Flix` folder (the outer folder containing `frontend`, `backend`, and `database`).

## Step 2 — Set up Supabase
1. Create/open your Supabase project at https://supabase.com.
2. In the project dashboard, open **SQL Editor → New query**.
3. Open `database/schema.sql` in VS Code, copy all its contents, paste into the Supabase SQL Editor, and click **Run**.
4. Create another SQL query.
5. Open `database/seed.sql`, copy all its contents, paste into the new query, and click **Run**.
6. Open **Table Editor** and confirm that `movies`, `cities`, `theatres`, `screens`, `shows`, `seats`, `bookings`, and `booking_seats` exist.

Run `schema.sql` first, then `seed.sql`. The seed file adds demo movies, a sample Hyderabad cinema, seats, and upcoming shows. It is safe to rerun for the supplied sample data.

## Step 3 — Create the local `.env` file
1. In VS Code Explorer, expand the `backend` folder.
2. Copy `.env.example` and paste the copy in the same `backend` folder.
3. Rename the copied file to exactly `.env` (not `.env.example` and not `.env.txt`).
4. Open `backend/.env` and fill in your own Supabase Project URL and server-side key:

```env
PORT=3000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_side_secret_key
```

Use the **Project URL**, not a URL ending in `/rest/v1/`. Find it in Supabase project settings/API details. Use the server-side secret/service-role key supported by your project. Never put this key in `frontend/` files, never send it in chat, and do not upload `.env` publicly. The `.gitignore` already excludes `.env`.

## Step 4 — Install backend packages
1. In VS Code choose **Terminal → New Terminal**. PowerShell is fine.
2. If the prompt is at the outer project folder, type:

```powershell
cd backend
```

3. Press Enter, then type:

```powershell
npm install
```

4. Press Enter and wait until installation finishes. The first install needs an internet connection.

## Step 5 — Start the website
In the same terminal, type:

```powershell
npm start
```

Keep the terminal open. You should see a message that Movie Ticket Flix is running. Open this address in your browser:

**http://localhost:3000**

You can also test the backend status at http://localhost:3000/api/health.

## Troubleshooting
- **`npm` is not recognized:** Install Node.js LTS, close VS Code, reopen it, and try again.
- **`cd backend` says the path does not exist:** In the terminal type `dir`. If you cannot see `backend`, VS Code may have opened the wrong folder. Open the outer `Movie-Ticket-Flix` folder.
- **`Cannot find module`:** Run `npm install` inside `backend`, then run `npm start` again.
- **Supabase is not configured / missing environment variables:** Check that the file is exactly `backend/.env`, contains both required variables, and is saved.
- **Database error / relation does not exist:** Run `database/schema.sql` first, then `database/seed.sql`. Check the backend terminal for the exact database error.
- **Movies do not load:** Visit `/api/health`; check `databaseConfigured` and inspect the terminal. Make sure the Supabase URL has no `/rest/v1/` suffix and the server-side key is correct.
- **No upcoming shows:** The starter seed creates sample shows for Hyderabad. Re-run `seed.sql` and choose the sample Hyderabad cinema/show.
- **Port 3000 is busy:** Change `PORT=3001` in `.env`, restart the server, and open http://localhost:3001.

## Security and limitations
This is an educational demo, not a production ticketing system. It does not include login/authentication or real payments. Booking lookup by reference is convenient for a demo; before public deployment, add authentication/booking ownership checks, rate limiting, logging, and a security review. The Supabase server-side key must remain on the Node server only.
