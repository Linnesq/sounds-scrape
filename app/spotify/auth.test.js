const fs = require("fs");
jest.mock("fs");

const { report } = require("../utils/logger");
jest.mock("../utils/logger");

const { createClient } = require("./client");
jest.mock("./client");

// Keep the real fetch to call login's local callback server
const realFetch = global.fetch;
global.fetch = jest.fn();

const underTest = require("./auth");

const storedConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:80/callback",
  accessToken: "old-access",
  refreshToken: "old-refresh",
};

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status });

const savedConfig = () => {
  const [path, contents] = fs.writeFileSync.mock.calls[0];
  expect(path).toBe("auth.json");
  return JSON.parse(contents);
};

const tokenRequest = (callIndex = 0) => {
  const [url, options] = fetch.mock.calls[callIndex];
  return {
    url,
    headers: options.headers,
    params: Object.fromEntries(options.body),
  };
};

const mockCurrentUser = (user) => {
  const getCurrentUser = jest.fn().mockResolvedValue(user);
  createClient.mockReturnValue({ getCurrentUser });
};

describe("auth.js", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fs.readFileSync.mockReturnValue(JSON.stringify(storedConfig));
  });

  describe("refreshAccessToken", () => {
    it("exchanges the refresh token and saves the new access token", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(200, { access_token: "new-access" }),
      );

      const token = await underTest.refreshAccessToken();

      expect(token).toBe("new-access");
      const { url, headers, params } = tokenRequest();
      expect(url).toBe("https://accounts.spotify.com/api/token");
      expect(headers.Authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(params).toEqual({
        grant_type: "refresh_token",
        refresh_token: "old-refresh",
      });
      expect(savedConfig()).toEqual({
        ...storedConfig,
        accessToken: "new-access",
      });
    });

    it("saves a new refresh token when Spotify issues one", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "new-access",
          refresh_token: "new-refresh",
        }),
      );

      await underTest.refreshAccessToken();

      expect(savedConfig().refreshToken).toBe("new-refresh");
    });

    it("throws with Spotify's error and saves nothing when the refresh fails", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(400, {
          error: "invalid_grant",
          error_description: "Refresh token revoked",
        }),
      );

      await expect(underTest.refreshAccessToken()).rejects.toThrow(
        "Spotify token request failed (400): Refresh token revoked",
      );
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("throws without calling Spotify when there is no refresh token", async () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ clientId: "id" }));

      await expect(underTest.refreshAccessToken()).rejects.toThrow(
        "No refreshToken in auth.json",
      );
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("checkAuth", () => {
    it("refreshes the token and confirms it works by fetching the user", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(200, { access_token: "new-access" }),
      );
      mockCurrentUser({ id: "user1", display_name: "Someone" });

      await underTest.checkAuth();

      expect(createClient).toHaveBeenCalledWith("new-access");
      expect(report).toHaveBeenCalledWith("Auth OK - authenticated as Someone");
    });

    it("fails if the token can't be refreshed", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(401, { error: "invalid_client" }),
      );

      await expect(underTest.checkAuth()).rejects.toThrow("invalid_client");
      expect(createClient).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    const redirectUri = "http://127.0.0.1:38765/callback";
    let log;

    beforeEach(() => {
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ ...storedConfig, redirectUri }),
      );
      log = jest.spyOn(console, "log").mockImplementation(() => {});
      delete process.env.AUTH_PORT;
    });

    afterEach(() => log.mockRestore());

    // Starts a login and waits until it has printed the authorise URL
    const startLogin = async (options) => {
      const loggedIn = underTest.login(options);
      loggedIn.catch(() => {}); // asserted on by each test
      while (log.mock.calls.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      const authoriseUrl = new URL(log.mock.calls[0][0].trim());
      return { loggedIn, authoriseUrl };
    };

    const redirectBack = (query) => realFetch(`${redirectUri}?${query}`);

    it("captures the code from Spotify's redirect, saves the tokens and checks them", async () => {
      fetch
        .mockResolvedValueOnce(
          jsonResponse(200, { access_token: "a-token", refresh_token: "r" }),
        )
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "fresh" }));
      mockCurrentUser({ id: "user1", display_name: "Someone" });

      const { loggedIn, authoriseUrl } = await startLogin();
      const state = authoriseUrl.searchParams.get("state");
      const page = await redirectBack(`code=the-code&state=${state}`);

      expect(page.status).toBe(200);
      expect(await page.text()).toContain("You can close this tab");
      await loggedIn;

      expect(state).toMatch(/^[0-9a-f]{32}$/);
      expect(authoriseUrl.searchParams.get("redirect_uri")).toBe(redirectUri);
      expect(tokenRequest(0).params).toEqual({
        grant_type: "authorization_code",
        code: "the-code",
        redirect_uri: redirectUri,
      });
      expect(savedConfig()).toMatchObject({
        accessToken: "a-token",
        refreshToken: "r",
      });
      expect(report).toHaveBeenCalledWith(
        "Login complete - authenticated as Someone",
      );
    });

    it("ignores requests for other paths and keeps waiting", async () => {
      fetch.mockResolvedValue(jsonResponse(200, { access_token: "t" }));
      mockCurrentUser({ id: "user1" });

      const { loggedIn, authoriseUrl } = await startLogin();
      const favicon = await realFetch("http://127.0.0.1:38765/favicon.ico");
      expect(favicon.status).toBe(404);

      const state = authoriseUrl.searchParams.get("state");
      await redirectBack(`code=the-code&state=${state}`);
      await expect(loggedIn).resolves.toBeUndefined();
    });

    it("rejects a redirect whose state doesn't match", async () => {
      const { loggedIn } = await startLogin();

      const page = await redirectBack("code=the-code&state=someone-elses");

      expect(page.status).toBe(400);
      await expect(loggedIn).rejects.toThrow("didn't match this login attempt");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("fails when the user declines access", async () => {
      const { loggedIn, authoriseUrl } = await startLogin();
      const state = authoriseUrl.searchParams.get("state");

      await redirectBack(`error=access_denied&state=${state}`);

      await expect(loggedIn).rejects.toThrow(
        "Spotify authorisation failed: access_denied",
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("gives up if Spotify never redirects back", async () => {
      const { loggedIn } = await startLogin({ timeoutMs: 50 });

      await expect(loggedIn).rejects.toThrow("Timed out");
    });

    it("needs a local redirect URI", async () => {
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          ...storedConfig,
          redirectUri: "https://example.com/callback",
        }),
      );

      await expect(underTest.login()).rejects.toThrow(
        "make login needs a local redirectUri",
      );
    });

    it("explains a mismatch between the redirect URI port and the published port", async () => {
      process.env.AUTH_PORT = "8080";

      await expect(underTest.login()).rejects.toThrow(
        "run AUTH_PORT=38765 make login",
      );
      delete process.env.AUTH_PORT;
    });
  });

  describe("initialiseAuthorisation", () => {
    it("exchanges the code for tokens and saves them", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "a-token",
          refresh_token: "r-token",
        }),
      );

      await underTest.initialiseAuthorisation("the-code");

      expect(tokenRequest().params).toEqual({
        grant_type: "authorization_code",
        code: "the-code",
        redirect_uri: "http://127.0.0.1:80/callback",
      });
      expect(savedConfig()).toEqual({
        ...storedConfig,
        accessToken: "a-token",
        refreshToken: "r-token",
      });
      expect(report).toHaveBeenCalledWith("Auth Success");
    });

    it("throws when no code is given", async () => {
      await expect(underTest.initialiseAuthorisation()).rejects.toThrow(
        "No authorisation code given",
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("throws and saves nothing when Spotify rejects the code", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(400, {
          error: "invalid_grant",
          error_description: "Invalid authorization code",
        }),
      );

      await expect(
        underTest.initialiseAuthorisation("stale-code"),
      ).rejects.toThrow("Invalid authorization code");
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe("printAuthorizeUrl", () => {
    it("prints the authorise URL with the client, redirect, scopes and state", () => {
      const log = jest.spyOn(console, "log").mockImplementation(() => {});

      underTest.printAuthorizeUrl();

      const url = new URL(log.mock.calls[0][0]);
      expect(url.origin + url.pathname).toBe(
        "https://accounts.spotify.com/authorize",
      );
      expect(Object.fromEntries(url.searchParams)).toEqual({
        client_id: "client-id",
        response_type: "code",
        redirect_uri: "http://127.0.0.1:80/callback",
        scope:
          "playlist-modify-private playlist-read-private user-library-read user-library-modify",
        state: expect.stringMatching(/^[0-9a-f]{32}$/),
      });
      expect(url.search).toContain("scope=playlist-modify-private%20");
      log.mockRestore();
    });
  });
});
