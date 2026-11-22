const fs = require("fs");
jest.mock("fs");

const { report } = require("../utils/logger");
jest.mock("../utils/logger");

const { createClient } = require("./client");
jest.mock("./client");

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

const tokenRequest = () => {
  const [url, options] = fetch.mock.calls[0];
  return {
    url,
    headers: options.headers,
    params: Object.fromEntries(options.body),
  };
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

  describe("init", () => {
    it("refreshes the token and confirms it works by fetching the user", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(200, { access_token: "new-access" }),
      );
      const getCurrentUser = jest
        .fn()
        .mockResolvedValue({ id: "user1", display_name: "Someone" });
      createClient.mockReturnValue({ getCurrentUser });

      await underTest.init();

      expect(createClient).toHaveBeenCalledWith("new-access");
      expect(report).toHaveBeenCalledWith(
        "init success - authenticated as Someone",
      );
    });

    it("fails if the token can't be refreshed", async () => {
      fetch.mockResolvedValueOnce(
        jsonResponse(401, { error: "invalid_client" }),
      );

      await expect(underTest.init()).rejects.toThrow("invalid_client");
      expect(createClient).not.toHaveBeenCalled();
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
        state: "should-appear-on-callback-url",
      });
      expect(url.search).toContain("scope=playlist-modify-private%20");
      log.mockRestore();
    });
  });
});
