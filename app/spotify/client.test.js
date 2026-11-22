const { createClient, SpotifyApiError } = require("./client");

const { report } = require("../utils/logger");
jest.mock("../utils/logger");

global.fetch = jest.fn();

const jsonResponse = (status, body, headers = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers,
  });

const requestOf = (callIndex) => {
  const [url, options] = fetch.mock.calls[callIndex];
  return {
    url,
    method: options.method,
    headers: options.headers,
    body: options.body && JSON.parse(options.body),
  };
};

describe("spotify client", () => {
  const client = createClient("access-token");

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  describe("requests", () => {
    it("sends the bearer token and returns the parsed response", async () => {
      fetch.mockResolvedValueOnce(jsonResponse(200, { id: "user1" }));

      const user = await client.getCurrentUser();

      expect(user).toEqual({ id: "user1" });
      const { url, method, headers } = requestOf(0);
      expect(url).toBe("https://api.spotify.com/v1/me");
      expect(method).toBe("GET");
      expect(headers.Authorization).toBe("Bearer access-token");
    });

    it("throws a SpotifyApiError with Spotify's message on a 4xx, without retrying", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(401, {
          error: { status: 401, message: "The access token expired" },
        }),
      );

      const error = await client.getCurrentUser().catch((e) => e);

      expect(error).toBeInstanceOf(SpotifyApiError);
      expect(error.status).toBe(401);
      expect(error.message).toBe(
        "Spotify GET /me failed (401): The access token expired",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("uses the raw body when an error response isn't JSON", async () => {
      fetch.mockResolvedValueOnce(
        new Response("<html>Bad Gateway</html>", { status: 502 }),
      );

      await expect(
        client.createPlaylist("Show", "description"),
      ).rejects.toThrow("(502): <html>Bad Gateway</html>");
    });

    it("retries a 429 after the Retry-After delay", async () => {
      jest.useFakeTimers();
      fetch
        .mockResolvedValueOnce(jsonResponse(429, {}, { "Retry-After": "3" }))
        .mockResolvedValueOnce(jsonResponse(200, { id: "user1" }));

      const result = client.getCurrentUser();
      await jest.advanceTimersByTimeAsync(2999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);

      await expect(result).resolves.toEqual({ id: "user1" });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(report).toHaveBeenCalledWith(
        "Spotify GET /me returned 429, retrying in 3s...",
      );
    });

    it("gives up after three attempts", async () => {
      jest.useFakeTimers();
      fetch.mockImplementation(async () =>
        jsonResponse(429, {}, { "Retry-After": "1" }),
      );

      const result = client.getCurrentUser().catch((e) => e);
      await jest.advanceTimersByTimeAsync(5000);

      expect((await result).status).toBe(429);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("doesn't wait out a Retry-After longer than a minute", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(429, {}, { "Retry-After": "3600" }),
      );

      await expect(client.getCurrentUser()).rejects.toThrow("(429)");
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("retries a server error for a GET", async () => {
      jest.useFakeTimers();
      fetch
        .mockResolvedValueOnce(jsonResponse(503, {}))
        .mockResolvedValueOnce(jsonResponse(200, { id: "user1" }));

      const result = client.getCurrentUser();
      await jest.advanceTimersByTimeAsync(2000);

      await expect(result).resolves.toEqual({ id: "user1" });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("doesn't retry a server error for a POST, which could duplicate it", async () => {
      fetch.mockResolvedValueOnce(jsonResponse(500, {}));

      await expect(client.createPlaylist("Show", "desc")).rejects.toThrow(
        "(500)",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAllPlaylists", () => {
    it("follows pagination and returns id, name and track count", async () => {
      fetch
        .mockResolvedValueOnce(
          jsonResponse(200, {
            items: [
              { id: "pl1", name: "First", items: { total: 3 } },
              { id: "pl2", name: "Second", tracks: { total: 7 } },
              null,
            ],
            next: "https://api.spotify.com/v1/me/playlists?offset=50&limit=50",
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse(200, {
            items: [{ id: "pl3", name: "Third", items: { total: 0 } }],
            next: null,
          }),
        );

      const playlists = await client.getAllPlaylists();

      expect(playlists).toEqual([
        { id: "pl1", name: "First", trackCount: 3 },
        { id: "pl2", name: "Second", trackCount: 7 },
        { id: "pl3", name: "Third", trackCount: 0 },
      ]);
      expect(requestOf(0).url).toBe(
        "https://api.spotify.com/v1/me/playlists?limit=50",
      );
      expect(requestOf(1).url).toBe(
        "https://api.spotify.com/v1/me/playlists?offset=50&limit=50",
      );
    });

    it("throws if any page fails, rather than returning a partial list", async () => {
      fetch
        .mockResolvedValueOnce(
          jsonResponse(200, {
            items: [{ id: "pl1", name: "First", items: { total: 3 } }],
            next: "https://api.spotify.com/v1/me/playlists?offset=50&limit=50",
          }),
        )
        .mockResolvedValueOnce(jsonResponse(403, { error: { message: "no" } }));

      await expect(client.getAllPlaylists()).rejects.toThrow("(403): no");
    });
  });

  describe("createPlaylist", () => {
    it("creates a private playlist for the current user", async () => {
      fetch.mockResolvedValueOnce(jsonResponse(201, { id: "new-id" }));

      const playlist = await client.createPlaylist("Show 2026-11-18", "desc");

      expect(playlist).toEqual({ id: "new-id" });
      const { url, method, headers, body } = requestOf(0);
      expect(url).toBe("https://api.spotify.com/v1/me/playlists");
      expect(method).toBe("POST");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(body).toEqual({
        name: "Show 2026-11-18",
        description: "desc",
        public: false,
        collaborative: false,
      });
    });
  });

  describe("setPlaylistItems", () => {
    it("replaces the playlist items in one request", async () => {
      fetch.mockResolvedValueOnce(jsonResponse(200, { snapshot_id: "s" }));

      await client.setPlaylistItems("pl1", ["spotify:track:a"]);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(requestOf(0)).toMatchObject({
        url: "https://api.spotify.com/v1/playlists/pl1/items",
        method: "PUT",
        body: { uris: ["spotify:track:a"] },
      });
    });

    it("replaces with the first 100 and appends the rest in batches of 100", async () => {
      const uris = Array.from({ length: 250 }, (_, i) => `spotify:track:${i}`);
      fetch.mockImplementation(async () =>
        jsonResponse(201, { snapshot_id: "s" }),
      );

      await client.setPlaylistItems("pl1", uris);

      expect(fetch.mock.calls.map((_, i) => requestOf(i).method)).toEqual([
        "PUT",
        "POST",
        "POST",
      ]);
      expect(requestOf(0).body.uris).toEqual(uris.slice(0, 100));
      expect(requestOf(1).body.uris).toEqual(uris.slice(100, 200));
      expect(requestOf(2).body.uris).toEqual(uris.slice(200));
    });
  });
});
