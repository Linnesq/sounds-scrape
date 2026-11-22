const fs = require("fs");
const { report } = require("../utils/logger");
const { createClient } = require("./client");

const AUTH_FILE = "auth.json";
const ACCOUNTS_BASE = "https://accounts.spotify.com";
const REQUEST_TIMEOUT_MS = 30_000;
const SCOPES = [
  "playlist-modify-private",
  "playlist-read-private",
  "user-library-read",
  "user-library-modify",
];
const STATE = "should-appear-on-callback-url";

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
      `No refreshToken in ${AUTH_FILE}; follow the auth steps in the readme`,
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
 * Checks the stored credentials work (`make check-auth`)
 */
const init = async () => {
  const user = await createClient(await refreshAccessToken()).getCurrentUser();
  report(`init success - authenticated as ${user.display_name ?? user.id}`);
};

/**
 * Print the Authorise URL
 * - copy the URL into your browser, authorise,
 * and grab the URL param 'code' from the redirect
 */
const printAuthorizeUrl = () => {
  const { clientId, redirectUri } = readAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state: STATE,
  });
  // URLSearchParams encodes spaces as "+"; use %20 as Spotify's docs do
  console.log(
    `${ACCOUNTS_BASE}/authorize?${params.toString().replaceAll("+", "%20")}`,
  );
};

/**
 * Given a code from above, exchange it for tokens and save them
 */
const initialiseAuthorisation = async (code) => {
  if (!code) {
    throw new Error("No authorisation code given; set AUTH_CODE");
  }
  const config = readAuthConfig();
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
  report("Auth Success");
};

module.exports = {
  refreshAccessToken,
  init,
  printAuthorizeUrl,
  initialiseAuthorisation,
};
