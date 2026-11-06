require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((key) => !process.env[key]);

let supabase = null;
if (!missing.length) {
  // Keep the service-role key on the server only. Never expose it to browser JavaScript.
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

function databaseReady(req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      error: "Supabase is not configured yet. Copy .env.example to .env and add your Supabase project URL and service-role key."
    });
  }
  next();
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    databaseConfigured: Boolean(supabase),
    message: supabase ? "Server is ready." : "Add Supabase credentials to .env to connect the database."
  });
});

app.get("/api/movies", databaseReady, async (req, res) => {
  const { data, error } = await supabase
    .from("movies")
    .select("id,title,description,genre,language,duration_minutes,release_year,rating,poster_url,is_featured")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("title", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ movies: data || [] });
});

app.get("/api/movies/:id", databaseReady, async (req, res) => {
  const { data, error } = await supabase.from("movies")
    .select("id,title,description,genre,language,duration_minutes,release_year,rating,poster_url,is_featured")
    .eq("id", req.params.id).eq("is_active", true).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Movie not found." });
  res.json({ movie: data });
});

app.get("/api/movies/:id/shows", databaseReady, async (req, res) => {
  const { data, error } = await supabase
    .from("shows")
    .select("id,show_date,show_time,ticket_price,screen_name,theatres(id,name,location)")
    .eq("movie_id", req.params.id)
    .eq("is_active", true)
    .gte("show_date", new Date().toISOString().slice(0, 10))
    .order("show_date")
    .order("show_time");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ shows: data || [] });
});

app.get("/api/shows/:id/seats", databaseReady, async (req, res) => {
  const { data, error } = await supabase.rpc("get_show_seats", { p_show_id: req.params.id });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ seats: data || [] });
});

// Demo booking endpoint. It requires an email and relies on a database transaction/RPC
// so concurrent requests cannot book the same seat twice.
app.post("/api/bookings", databaseReady, async (req, res) => {
  const { showId, seatIds, customerName, customerEmail } = req.body || {};
  if (!showId || !Array.isArray(seatIds) || seatIds.length < 1 || seatIds.length > 10 ||
      !customerName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail || "")) {
    return res.status(400).json({ error: "Enter your name, a valid email, a show, and choose 1–10 seats." });
  }
  const uniqueSeats = [...new Set(seatIds)];
  if (uniqueSeats.length !== seatIds.length) {
    return res.status(400).json({ error: "Duplicate seats were selected." });
  }

  const { data, error } = await supabase.rpc("create_booking", {
    p_show_id: showId,
    p_seat_ids: uniqueSeats,
    p_customer_name: customerName.trim(),
    p_customer_email: customerEmail.trim().toLowerCase()
  });
  if (error) {
    const conflict = /already booked|not available|seat/i.test(error.message);
    return res.status(conflict ? 409 : 500).json({ error: error.message });
  }
  res.status(201).json({ booking: data });
});

app.get("/api/bookings/:reference", databaseReady, async (req, res) => {
  const ref = String(req.params.reference || "").trim();
  if (!/^[A-Z0-9-]{6,40}$/i.test(ref)) return res.status(400).json({ error: "Invalid booking reference." });
  const { data, error } = await supabase
    .from("bookings")
    .select("id,reference,customer_name,customer_email,total_amount,status,created_at,shows(show_date,show_time,screen_name,movies(title),theatres(name,location)),booking_seats(seats(seat_number))")
    .eq("reference", ref)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Booking not found." });
  // This demo endpoint returns the record by reference. For production, add authentication
  // and ensure only the booking owner can retrieve personal information.
  res.json({ booking: data });
});

app.get("*", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

app.listen(PORT, () => {
  console.log(`Movie Ticket Flix running at http://localhost:${PORT}`);
  if (missing.length) console.warn(`Supabase setup required. Missing: ${missing.join(", ")}`);
});
