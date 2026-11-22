const { report } = require("../utils/logger");

const API_BASE = "https://api.spotify.com/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
// Don't let a long rate-limit penalty stall a scheduled run; fail it instead
const MAX_RETRY_WAIT_SECONDS = 60;
// Spotify accepts at most 100 URIs per add/replace request
const MAX_ITEMS_PER_REQUEST = 100;
// Retrying these after a server error can't duplicate anything
const IDEMPOTENT_METHODS = new Set(["GET", "PUT", "DELETE"]);

class SpotifyApiError extends Error {
  constructor(method, path, status, detail) {
    super(`Spotify ${method} ${path} failed (${status}): ${detail}`);
    this.name = "SpotifyApiError";
    this.status = status;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const errorDetail = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text).error?.message ?? text;
  } catch {
    return text || response.statusText;
  }
};

/**
 * Calls the Spotify Web API and returns the parsed JSON response (or null if empty).
 * Rate limits (429) are retried after Retry-After; server errors (5xx) are retried
 * only for idempotent methods. Anything else that isn't a 2xx throws SpotifyApiError.
 */
const request = async (accessToken, method, path, body, attempt = 1) => {
  const url = path.startsWith("https://") ? path : `${API_BASE}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const retryable =
    response.status === 429 ||
    (response.status >= 500 && IDEMPOTENT_METHODS.has(method));
  const waitSeconds =
    Number(response.headers.get("retry-after")) || attempt * 2;

  if (
    retryable &&
    attempt < MAX_ATTEMPTS &&
    waitSeconds <= MAX_RETRY_WAIT_SECONDS
  ) {
    report(
      `Spotify ${method} ${path} returned ${response.status}, retrying in ${waitSeconds}s...`,
    );
    await response.body?.cancel();
    await sleep(waitSeconds * 1000);
    return request(accessToken, method, path, body, attempt + 1);
  }

  if (!response.ok) {
    throw new SpotifyApiError(
      method,
      path,
      response.status,
      await errorDetail(response),
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

/**
 * A minimal Spotify Web API client covering what this app needs.
 */
const createClient = (accessToken) => {
  const call = (method, path, body) => request(accessToken, method, path, body);

  return {
    getCurrentUser: () => call("GET", "/me"),

    /**
     * Every playlist the user owns or follows, as { id, name, trackCount }.
     * Throws if any page fails, so callers never act on a partial list.
     */
    getAllPlaylists: async () => {
      const playlists = [];
      let next = "/me/playlists?limit=50";
      while (next) {
        const page = await call("GET", next);
        for (const playlist of page.items.filter(Boolean)) {
          playlists.push({
            id: playlist.id,
            name: playlist.name,
            // `tracks` is deprecated in favour of `items`; accept either
            trackCount: (playlist.items ?? playlist.tracks)?.total ?? 0,
          });
        }
        next = page.next;
      }
      return playlists;
    },

    createPlaylist: (name, description) =>
      call("POST", "/me/playlists", {
        name,
        description,
        public: false,
        collaborative: false,
      }),

    /**
     * Replaces a playlist's contents with the given track URIs, in order.
     */
    setPlaylistItems: async (playlistId, uris) => {
      const path = `/playlists/${playlistId}/items`;
      await call("PUT", path, { uris: uris.slice(0, MAX_ITEMS_PER_REQUEST) });
      for (
        let start = MAX_ITEMS_PER_REQUEST;
        start < uris.length;
        start += MAX_ITEMS_PER_REQUEST
      ) {
        await call("POST", path, {
          uris: uris.slice(start, start + MAX_ITEMS_PER_REQUEST),
        });
      }
    },
  };
};

module.exports = { createClient, SpotifyApiError };
