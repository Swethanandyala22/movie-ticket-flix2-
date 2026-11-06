# Database setup

1. Open your Supabase project and select **SQL Editor → New query**.
2. Copy all of `schema.sql` into the editor and run it.
3. Create another query, paste all of `seed.sql`, and run it.
4. In **Table Editor**, check `movies`, `cities`, `theatres`, `screens`, `shows`, `seats`, `bookings`, and `booking_seats`.

The Node.js server uses a server-side Supabase key. Never place that key in frontend files. The booking function calculates totals in PostgreSQL and prevents duplicate bookings for the same show and seat.
