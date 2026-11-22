const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const { report } = require("../utils/logger");
const { createClient } = require("./client");

const AUTH_FILE = "auth.json";
const ACCOUNTS_BASE = "https://accounts.spotify.com";
const REQUEST_TIMEOUT_MS = 30_000;
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const LOOPBACK_HOSTS = ["127.0.0.1", "[::1]", "localhost"];
const SCOPES = [
  "playlist-modify-private",
  "playlist-read-private",
  "user-library-read",
  "user-library-modify",
];

/**
 * auth.json holds clientId, clientSecret, redirectUri, accessToken and refreshToken
 */
const readAuthConfig = () => JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));

const saveAuthConfig = (config) =>
  fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 4));

/**
 * POSTs to Spotify's token endpoint and returns the token response, or throws.
 */
const requestTokens = async ({ clientId, clientSecret }, params) => {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const response = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = body.error_description ?? body.error ?? response.statusText;
    throw new Error(
      `Spotify token request failed (${response.status}): ${detail}`,
    );
  }
  return body;
};

/**
 * Exchanges the stored refresh token for a new access token and returns it.
 * Both tokens are saved, since Spotify may issue a new refresh token.
 */
const refreshAccessToken = async () => {
  const config = readAuthConfig();
  if (!config.refreshToken) {
    throw new Error(
      `No refreshToken in ${AUTH_FILE}; run \`make login\` (see the readme)`,
    );
  }

  const tokens = await requestTokens(config, {
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
  });
  saveAuthConfig({
    ...config,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? config.refreshToken,
  });
  return tokens.access_token;
};

/**
 * Confirms the stored credentials work, reporting which account they belong to
 */
const checkAuth = async (prefix = "Auth OK") => {
  const user = await createClient(await refreshAccessToken()).getCurrentUser();
  report(`${prefix} - authenticated as ${user.display_name ?? user.id}`);
};

const authorizeUrl = ({ clientId, redirectUri }, state) => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  });
  // URLSearchParams encodes spaces as "+"; use %20 as Spotify's docs do
  return `${ACCOUNTS_BASE}/authorize?${params.toString().replaceAll("+", "%20")}`;
};

/**
 * Exchanges an authorisation code for tokens and saves them
 */
const saveTokensForCode = async (config, code) => {
  const tokens = await requestTokens(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  saveAuthConfig({
    ...config,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });
};

const callbackPage = (message) =>
  `<!doctype html><title>sounds-scrape</title><p>${message}</p>`;

/**
 * Listens on the redirect URI's port until Spotify redirects the browser
 * there, and resolves with the authorisation code from that request.
 * `onListening` runs once the server is ready for the redirect.
 */
const receiveAuthorisationCode = (redirectUri, state, onListening, timeoutMs) =>
  new Promise((resolve, reject) => {
    const callback = new URL(redirectUri);

    const finish = (error, code) => {
      clearTimeout(timer);
      server.close();
      error ? reject(error) : resolve(code);
    };

    const server = http.createServer((req, res) => {
      const { pathname, searchParams } = new URL(req.url, callback);
      const send = (status, message) =>
        res
          .writeHead(status, {
            "Content-Type": "text/html; charset=utf-8",
            Connection: "close",
          })
          .end(callbackPage(message));

      if (pathname !== callback.pathname) {
        send(404, "Not found");
        return;
      }

      const error = searchParams.get("error");
      const code = searchParams.get("code");
      if (error) {
        send(400, "Spotify authorisation failed. Check the terminal.");
        finish(new Error(`Spotify authorisation failed: ${error}`));
      } else if (searchParams.get("state") !== state || !code) {
        send(400, "Unexpected request. Check the terminal.");
        finish(
          new Error(
            "The callback didn't match this login attempt; run `make login` again",
          ),
        );
      } else {
        send(200, "Done! You can close this tab and return to the terminal.");
        finish(null, code);
      }
    });

    const timer = setTimeout(
      () => finish(new Error("Timed out waiting for Spotify to redirect back")),
      timeoutMs,
    );
    server.on("error", (error) => finish(error));
    // Inside Docker the server must listen on all interfaces; the Makefile
    // only publishes the port on the host's 127.0.0.1
    server.listen(Number(callback.port || 80), "0.0.0.0", onListening);
  });

/**
 * Interactive login (`make login`): prints the authorise URL, waits for
 * Spotify to redirect back to the local redirect URI, then saves the tokens.
 */
const login = async ({ timeoutMs = LOGIN_TIMEOUT_MS } = {}) => {
  const config = readAuthConfig();
  const { hostname, port } = new URL(config.redirectUri);
  if (!LOOPBACK_HOSTS.includes(hostname)) {
    throw new Error(
      `make login needs a local redirectUri such as http://127.0.0.1:80/callback (auth.json has ${config.redirectUri}); use make auth-url and make authenticate instead`,
    );
  }
  const publishedPort = process.env.AUTH_PORT;
  if (publishedPort && Number(publishedPort) !== Number(port || 80)) {
    throw new Error(
      `auth.json's redirectUri uses port ${port || 80} but port ${publishedPort} is published; run AUTH_PORT=${port || 80} make login`,
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const code = await receiveAuthorisationCode(
    config.redirectUri,
    state,
    () => {
      report("Open this URL in your browser and approve access:");
      console.log(`\n${authorizeUrl(config, state)}\n`);
      report("Waiting for Spotify to redirect back...");
    },
    timeoutMs,
  );

  await saveTokensForCode(config, code);
  await checkAuth("Login complete");
};

/**
 * Manual alternative to `login`: print the authorise URL, then pass the
 * `code` from the redirect to initialiseAuthorisation
 */
const printAuthorizeUrl = () => {
  const state = crypto.randomBytes(16).toString("hex");
  console.log(authorizeUrl(readAuthConfig(), state));
};

const initialiseAuthorisation = async (code) => {
  if (!code) {
    throw new Error("No authorisation code given; set AUTH_CODE");
  }
  await saveTokensForCode(readAuthConfig(), code);
  report("Auth Success");
};

module.exports = {
  refreshAccessToken,
  checkAuth,
  login,
  printAuthorizeUrl,
  initialiseAuthorisation,
};
