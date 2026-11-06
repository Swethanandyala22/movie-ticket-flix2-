-- Run after schema.sql in Supabase SQL Editor. Inserts demo data safely if it is not already present.
insert into public.cities(name, state)
select v.name, v.state
from (values ('Hyderabad','Telangana'), ('Chennai','Tamil Nadu'), ('Bengaluru','Karnataka'), ('Mumbai','Maharashtra'), ('Delhi','Delhi')) as v(name,state)
where not exists (select 1 from public.cities c where c.name = v.name);

-- Seed sample movies, one theatre, one screen, seats and upcoming shows.insert into public.movies(title, description, genre, language, duration_minutes, release_year, rating, poster_url, is_featured)
select v.title, v.description, v.genre, v.language, v.duration, v.year, v.rating, v.poster, v.featured
from (values
 ('The Last Horizon','A team of explorers follows a mysterious signal beyond the edge of known space.','Sci-Fi','English',128,2026,8.4,'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=700&q=85',true),
 ('Midnight Run','One unexpected night turns a quiet city into a race against time.','Thriller','English',116,2026,7.8,'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=85',true),
 ('Letters to June','A heartfelt story about old letters, new beginnings, and finding your way home.','Romance','English',109,2025,8.1,'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=700&q=85',true),
 ('Wild Circuit','A young racer enters the underground circuit to save the family garage.','Action','English',134,2026,7.6,'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=700&q=85',false),
 ('Ocean of Stars','Two siblings uncover a secret hidden in a forgotten coastal town.','Adventure','English',121,2025,8.0,'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=700&q=85',false),
 ('The Quiet House','A new home holds a mystery that changes everything a family believes.','Mystery','English',112,2026,7.9,'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=700&q=85',false),
 ('Laugh Track','Three friends try to turn a failed café into the city’s happiest place.','Comedy','English',101,2025,7.4,'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=700&q=85',false),
 ('Beyond the Blue','A diver discovers a thriving world hidden beneath the waves.','Adventure','English',126,2026,8.2,'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=700&q=85',false)
) as v(title,description,genre,language,duration,year,rating,poster,featured)
where not exists (select 1 from public.movies m where m.title = v.title);

insert into public.theatres(name, location)
select 'Flix Central', 'Hyderabad'
where not exists (select 1 from public.theatres where name = 'Flix Central' and location = 'Hyderabad');

insert into public.screens(theatre_id, screen_name)
select t.id, 'Screen 1'
from public.theatres t
where t.name = 'Flix Central' and t.location = 'Hyderabad'
and not exists (select 1 from public.screens s where s.theatre_id = t.id and s.screen_name = 'Screen 1');

-- Add 32 seats (A1-D8) to the sample screen if it has no seats.
insert into public.seats(screen_id, seat_number, seat_type)
select sc.id, chr(65 + rows.row_num) || cols.col_num,
  case when rows.row_num = 0 then 'premium' else 'standard' end
from public.screens sc
cross join generate_series(0,3) as rows(row_num)
cross join generate_series(1,8) as cols(col_num)
where sc.screen_name = 'Screen 1'
and not exists (select 1 from public.seats s where s.screen_id = sc.id);

-- Create shows for every seeded movie, 3 days from today and later.
insert into public.shows(movie_id, theatre_id, screen_id, screen_name, show_date, show_time, ticket_price)
select m.id, t.id, sc.id, sc.screen_name, current_date + day_offset.n, show_time.show_time, 180
from public.movies m
cross join public.theatres t
join public.screens sc on sc.theatre_id = t.id
cross join generate_series(0, 6) as day_offset(n)
cross join (values ('11:00'::time), ('14:30'::time), ('18:00'::time), ('21:15'::time)) as show_time(show_time)
where t.name = 'Flix Central'
and not exists (
  select 1 from public.shows sh
  where sh.movie_id = m.id and sh.theatre_id = t.id
    and sh.show_date = current_date + day_offset.n and sh.show_time = show_time.show_time
);

grant execute on function public.get_show_seats(uuid) to anon, authenticated, service_role;
grant execute on function public.create_booking(uuid, uuid[], text, text) to anon, authenticated, service_role;
