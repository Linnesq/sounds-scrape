# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A BBC Sounds scraper that extracts show tracklists and creates Spotify playlists. It scrapes episode pages, parses `__NEXT_DATA__` JSON from `<script>` tags, extracts Spotify track URIs, and creates/updates playlists via the Spotify Web API.

## Development Environment

**Always use Docker for all commands** — do not run npm/node directly on the host. Use Makefile targets or `docker run --rm soundscrape <command>` for ad-hoc commands (e.g. `docker run --rm soundscrape npm outdated`). Run `make build` after changing code before running tests.

## Commands

```bash
# Build the Docker image (required first)
make build

# Run tests
make tests

# Run tests in watch mode
make tests-interactive

# Run test coverage (80% function threshold)
make coverage

# Run the app (scrape + create playlists)
make playlists

# Auth setup
make auth-url
AUTH_CODE=your_code make authenticate
make check-auth
```

To run a single test file or other ad-hoc commands, use `make shell` to get an interactive shell inside the container.

## Architecture

**Entry point:** `app/index.js` calls `createSpotifyPlaylists()` from tasks.

**Pipeline (app/tasks/tasks.js):**
1. **Scrape** (`app/scraper/scraper.js`): For each show URL in config, fetch the episodes listing page, extract episode URLs via regex, then fetch each episode page and parse `__NEXT_DATA__` JSON to get tracklists with Spotify URIs. Deduplicates episodes that appear multiple times (keeps the one with more tracks). Writes results to `latest.json`.
2. **Auth** (`app/spotify/auth.js`): Initialize Spotify Web API client, auto-refresh tokens if expired. Credentials stored in `auth.json` (root-level, git-ignored).
3. **Playlists** (`app/spotify/utils.js` + `tasks.js`): Fetch all user playlists (paginated), then for each scraped show: skip if playlist exists with same track count, update if playlist exists with fewer tracks, or create new playlist.

**Config** (`app/config/config.js`): Array of BBC Sounds show URLs to scrape.

## Conventions

- Node.js with CommonJS (`require`/`module.exports`)
- Formatting: Prettier (no ESLint)
- Testing: Jest with tests co-located as `*.test.js` beside source files
- Logging: Custom `report()` function from `app/utils/logger.js` (writes to both console and timestamped log file)
- No TypeScript, no build step
