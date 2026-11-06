const $ = (selector) => document.querySelector(selector);
const state = { movies: [], selectedMovie: null, shows: [], selectedShow: null, seats: [], selectedSeats: new Set() };

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount || 0));
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const timeLabel = (value) => {
  const [h, m] = String(value).split(":");
  const d = new Date(); d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};
async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload;
}
function setStatus(message, isError = false) {
  const banner = $("#statusBanner");
  banner.classList.toggle("error", isError);
  banner.innerHTML = isError ? `<span>⚠</span> ${escapeHtml(message)}` : `<span class="spinner"></span> ${escapeHtml(message)}`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function poster(movie, extraClass = "") {
  if (movie.poster_url) return `<img class="${extraClass}" src="${escapeHtml(movie.poster_url)}" alt="${escapeHtml(movie.title)} poster" loading="lazy" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('hidden')"><div class="poster-placeholder ${movie.poster_url ? "hidden" : ""}">${escapeHtml(movie.title)}</div>`;
  return `<div class="poster-placeholder">${escapeHtml(movie.title)}</div>`;
}
function renderMovies() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const genre = $("#genreFilter").value;
  const filtered = state.movies.filter((movie) =>
    `${movie.title} ${movie.genre || ""} ${movie.language || ""}`.toLowerCase().includes(query) &&
    (!genre || movie.genre === genre)
  );
  $("#movieGrid").innerHTML = filtered.map((movie) => `
    <article class="movie-card">
      <div class="poster-wrap">${poster(movie)}${movie.rating ? `<span class="movie-rating">★ ${escapeHtml(movie.rating)}</span>` : ""}</div>
      <div class="movie-card-body">
        <h3 title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</h3>
        <div class="movie-meta"><span>${escapeHtml(movie.genre || "Movie")}</span><span>•</span><span>${escapeHtml(movie.language || "Various")}</span>${movie.duration_minutes ? `<span>•</span><span>${movie.duration_minutes} min</span>` : ""}</div>
        <div class="movie-card-bottom"><span>${movie.release_year ? `Released ${movie.release_year}` : "Now showing"}</span><button class="book-button" data-book="${escapeHtml(movie.id)}">Book tickets ↗</button></div>
      </div>
    </article>`).join("");
  $("#emptyState").classList.toggle("hidden", filtered.length > 0);
  $("#movieCount").textContent = state.movies.length;
}
async function loadMovies() {
  setStatus("Connecting to Supabase…");
  try {
    const result = await api("/api/movies");
    state.movies = result.movies || [];
    const genres = [...new Set(state.movies.map((m) => m.genre).filter(Boolean))].sort();
    $("#genreFilter").innerHTML = `<option value="">All genres</option>` + genres.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
    $("#statusBanner").classList.add("hidden");
    renderMovies();
  } catch (error) {
    setStatus(error.message, true);
    $("#movieGrid").innerHTML = "";
  }
}
function openModal(id) { $(id).classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(modal) { modal.classList.add("hidden"); if ($$(".modal-backdrop:not(.hidden)").length === 0) document.body.style.overflow = ""; }
function $$(selector) { return [...document.querySelectorAll(selector)]; }
function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3000);
}
async function openBooking(movieId) {
  const movie = state.movies.find((item) => String(item.id) === String(movieId));
  if (!movie) return;
  state.selectedMovie = movie; state.selectedShow = null; state.seats = []; state.selectedSeats.clear();
  $("#bookingError").textContent = "";
  $("#selectedMovie").innerHTML = `${movie.poster_url ? `<img src="${escapeHtml(movie.poster_url)}" alt="">` : `<div class="poster-placeholder" style="width:48px;height:64px;font-size:9px;border-radius:6px">${escapeHtml(movie.title)}</div>`}<div><strong>${escapeHtml(movie.title)}</strong><span>${escapeHtml(movie.genre || "Movie")} · ${escapeHtml(movie.language || "Various")}</span></div>`;
  $("#showSelect").innerHTML = `<option value="">Loading showtimes…</option>`;
  $("#seatGrid").innerHTML = `<p class="muted">Choose a showtime to load seats.</p>`;
  updateSeatSummary();
  openModal("#bookingModal");
  try {
    const result = await api(`/api/movies/${encodeURIComponent(movie.id)}/shows`);
    state.shows = result.shows || [];
    $("#showSelect").innerHTML = `<option value="">Select a showtime</option>` + state.shows.map((show) => {
      const theatre = show.theatres?.name || "Theatre";
      const location = show.theatres?.location ? ` · ${show.theatres.location}` : "";
      return `<option value="${escapeHtml(show.id)}">${escapeHtml(theatre + location)} — ${dateLabel(show.show_date)}, ${timeLabel(show.show_time)} · ${money(show.ticket_price)}</option>`;
    }).join("");
    if (!state.shows.length) $("#seatGrid").innerHTML = `<p class="muted">No upcoming shows are listed for this movie yet.</p>`;
  } catch (error) {
    $("#showSelect").innerHTML = `<option value="">Unable to load showtimes</option>`;
    $("#bookingError").textContent = error.message;
  }
}
async function loadSeats(showId) {
  state.selectedShow = state.shows.find((show) => String(show.id) === String(showId)) || null;
  state.selectedSeats.clear();
  updateSeatSummary();
  if (!state.selectedShow) {
    $("#seatGrid").innerHTML = `<p class="muted">Choose a showtime to load seats.</p>`;
    return;
  }
  $("#seatGrid").innerHTML = `<p class="muted">Loading seats…</p>`;
  try {
    const result = await api(`/api/shows/${encodeURIComponent(showId)}/seats`);
    state.seats = result.seats || [];
    renderSeats();
  } catch (error) {
    $("#seatGrid").innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}
function renderSeats() {
  if (!state.seats.length) {
    $("#seatGrid").innerHTML = `<p class="muted">No seats configured for this show. Add seats in Supabase using the setup guide.</p>`;
    return;
  }
  $("#seatGrid").innerHTML = state.seats.map((seat) => {
    const booked = Boolean(seat.is_booked);
    const selected = state.selectedSeats.has(seat.id);
    return `<button class="seat ${booked ? "booked" : selected ? "selected" : ""}" data-seat="${escapeHtml(seat.id)}" ${booked ? "disabled" : ""} aria-label="Seat ${escapeHtml(seat.seat_number)}${booked ? ", booked" : ""}" aria-pressed="${selected}">${escapeHtml(seat.seat_number)}</button>`;
  }).join("");
}
function updateSeatSummary() {
  const selected = state.seats.filter((seat) => state.selectedSeats.has(seat.id));
  $("#selectedSeatLabel").textContent = selected.length ? selected.map((s) => s.seat_number).join(", ") : "None";
  $("#totalPrice").textContent = money((state.selectedShow?.ticket_price || 0) * selected.length);
}
async function confirmBooking() {
  $("#bookingError").textContent = "";
  if (!state.selectedShow) return $("#bookingError").textContent = "Please choose a showtime.";
  if (!state.selectedSeats.size) return $("#bookingError").textContent = "Please select at least one available seat.";
  const customerName = $("#customerName").value.trim();
  const customerEmail = $("#customerEmail").value.trim();
  if (!customerName || !customerEmail) return $("#bookingError").textContent = "Enter your name and email.";
  const button = $("#confirmBookingBtn");
  button.disabled = true; button.textContent = "Confirming…";
  try {
    const result = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ showId: state.selectedShow.id, seatIds: [...state.selectedSeats], customerName, customerEmail })
    });
    closeModal($("#bookingModal"));
    showToast(`Booking confirmed: ${result.booking.reference}`);
    displayTicket(result.booking, state.selectedMovie, state.selectedShow, [...state.selectedSeats]);
    openModal("#referenceModal");
  } catch (error) {
    $("#bookingError").textContent = error.message;
    // Refresh availability after a conflict so the user sees current seat status.
    if (/seat|booked|available/i.test(error.message)) await loadSeats(state.selectedShow.id);
  } finally {
    button.disabled = false; button.innerHTML = `Confirm booking <span>→</span>`;
  }
}
function displayTicket(booking, movie, show, seatIds) {
  const seats = state.seats.filter((seat) => seatIds.includes(seat.id)).map((seat) => seat.seat_number);
  $("#ticketResult").innerHTML = `<div class="ticket-confirmation"><div class="modal-kicker">BOOKING CONFIRMED</div><h3>${escapeHtml(movie?.title || "Your movie ticket")}</h3><p class="muted">Show this reference when you need to look up your booking.</p><div class="ticket-reference">${escapeHtml(booking.reference)}</div><div class="ticket-details"><div><span>THEATRE</span><strong>${escapeHtml(show?.theatres?.name || "Selected theatre")}</strong></div><div><span>DATE & TIME</span><strong>${show ? `${dateLabel(show.show_date)} · ${timeLabel(show.show_time)}` : "See booking lookup"}</strong></div><div><span>SEATS</span><strong>${escapeHtml(seats.join(", ") || "Confirmed")}</strong></div><div><span>TOTAL</span><strong>${money(booking.total_amount)}</strong></div></div><button class="outline-button" style="margin-top:16px" id="copyReferenceBtn">Copy reference</button></div>`;
  $("#referenceInput").value = booking.reference;
  $("#referenceError").textContent = "";
  $("#copyReferenceBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(booking.reference); showToast("Booking reference copied."); }
    catch { showToast(`Booking reference: ${booking.reference}`); }
  });
}
async function lookupBooking(reference) {
  $("#referenceError").textContent = "";
  $("#ticketResult").innerHTML = "";
  try {
    const result = await api(`/api/bookings/${encodeURIComponent(reference)}`);
    const booking = result.booking;
    const show = booking.shows || {};
    const seats = (booking.booking_seats || []).map((item) => item.seats?.seat_number).filter(Boolean);
    $("#ticketResult").innerHTML = `<div class="ticket-confirmation"><div class="modal-kicker">${escapeHtml(booking.status || "BOOKING")}</div><h3>${escapeHtml(show.movies?.title || "Movie ticket")}</h3><div class="ticket-reference">${escapeHtml(booking.reference)}</div><div class="ticket-details"><div><span>NAME</span><strong>${escapeHtml(booking.customer_name)}</strong></div><div><span>THEATRE</span><strong>${escapeHtml(show.theatres?.name || "Theatre")}</strong></div><div><span>DATE & TIME</span><strong>${show.show_date ? dateLabel(show.show_date) : "—"} ${show.show_time ? "· " + timeLabel(show.show_time) : ""}</strong></div><div><span>SEATS</span><strong>${escapeHtml(seats.join(", ") || "—")}</strong></div><div><span>TOTAL</span><strong>${money(booking.total_amount)}</strong></div></div></div>`;
  } catch (error) { $("#referenceError").textContent = error.message; }
}
$("#movieGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-book]");
  if (button) openBooking(button.dataset.book);
});
$("#searchInput").addEventListener("input", renderMovies);
$("#genreFilter").addEventListener("change", renderMovies);
$("#showSelect").addEventListener("change", (event) => loadSeats(event.target.value));
$("#seatGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-seat]");
  if (!button || button.disabled) return;
  const id = button.dataset.seat;
  if (state.selectedSeats.has(id)) state.selectedSeats.delete(id);
  else if (state.selectedSeats.size < 10) state.selectedSeats.add(id);
  else return showToast("You can select up to 10 seats per booking.");
  renderSeats(); updateSeatSummary();
});
$("#confirmBookingBtn").addEventListener("click", confirmBooking);
$("#findBookingBtn").addEventListener("click", () => { $("#ticketResult").innerHTML = ""; $("#referenceError").textContent = ""; openModal("#referenceModal"); });
$("#referenceForm").addEventListener("submit", (event) => { event.preventDefault(); lookupBooking($("#referenceInput").value.trim()); });
$$("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop"))));
$$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(backdrop); }));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") $$(".modal-backdrop:not(.hidden)").forEach(closeModal); });
$("#year").textContent = new Date().getFullYear();
loadMovies();
