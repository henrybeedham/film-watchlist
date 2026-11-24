<img src="assets/icon.svg" width="64" height="64" alt="">

# Watchlist

A shared list of the films and series people keep telling you to watch.

- **Quick add.** Type a title and pick a suggestion, or add it as typed: `x2`/`x3` become a
  suggestion count, `(2022)` or a trailing year helps matching, `(Hugh recommendation)` records
  who suggested it, and anything after `-` is kept as a note. Duplicates are flagged.
- **Import from Letterboxd.** Choose the export ZIP (Settings → Import from Letterboxd): the
  watchlist comes in to watch, seen films as watched, and diary entries with their dates, ratings
  and reviews. Films already on the list are spotted, and importing again doesn't repeat entries.
- **Posters and details** from TMDB, matched automatically (typos included) and marked as a film
  or a series. Any match can be changed.
- **Where to watch in the UK**: streaming, free, rent and buy. Tick the services you have and
  they're shown first, with a filter for them.
- **Tonight**: a random pick, filtered by film or series, length, genre and your services, and
  weighted towards things suggested more often.
- **Coming soon**: unreleased titles wait on their own shelf until their UK release date.
- **Watched diary**: date, half-star rating and a few words for each viewing, per person.
- **Lists for a few people**: invite links (one use, seven days), and a read-only share link.
- **Four themes**, each with light and dark: Repertory programme, Late-night screening, Poster
  wall and Collector’s catalogue. See `DESIGN.md`.
- **Add to Home Screen** on iPhone for an app-like shortcut.

SvelteKit 3 (Svelte 5 runes), shadcn-svelte and Tailwind 4, better-auth, SQLite via `node:sqlite`.
Bun installs packages; Node (22.17 or later) runs everything.

## Running locally

```sh
bun install
cp .env.example .env     # add TMDB_API_KEY for posters and streaming info
bun run dev
```

Open http://localhost:5173. The first account needs the one-time setup code the server prints
when it starts (`[setup] … setup code: …`), owns the first list and is the site’s admin (see
**Admin**); everyone after that needs an invite link from **Lists**.

Checks: `bun run check`, `bun run lint`, `bun run build`.

### Getting a TMDB key

Create a free account at themoviedb.org, then Settings → API → request a developer key. Either
the API key or the API read access token works in `TMDB_API_KEY`.

## Deploying on Coolify

1. **New Resource → Private Repository (with GitHub App)**, pick this repo and branch `main`.
2. Build pack: **Docker Compose**; compose file `/docker-compose.yml`.
3. On the `app` service, set the domain with the container port, e.g.
   `https://watchlist.example.com:3000`.
4. Fill in the environment variables Coolify lists (see `.env.example`). `BETTER_AUTH_URL` must be
   the same public https URL. Add `TMDB_API_KEY`.
5. Deploy. Pushes to `main` redeploy automatically. Then open `/signup` and create the first
   account with the setup code from the deployment logs (`[setup] … setup code: …`).

Don't publish port 3000 directly: the app trusts Coolify's proxy for visitor IPs, which the
sign-in rate limits rely on.

Data lives in the `app-data` volume (`/data`): the database, generated secrets and automatic
database backups (`/data/backups`, taken before each migration and once per deploy, newest 10
kept). Include that volume in Coolify's or the server's backups for an off-site copy.

`/healthz` answers `200 ok` when the database responds; the Docker health check uses it.

## Notes

- The app doesn't send email, so there's no "forgot password" link yet. People can change their
  password in Settings while signed in.
- Streaming availability is refreshed every three days for titles still to watch, and whenever a
  title's page is opened with older data.
- Film data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
  Streaming data from JustWatch, via TMDB.
