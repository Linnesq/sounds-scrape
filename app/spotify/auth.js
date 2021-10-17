const SpotifyWebApi = require("spotify-web-api-node");
const fs = require("fs");
const authFile = "auth.json";
const { report } = require("../utils/logger");

/**
 * Read config from json file
 */
const getAuthConfig = () => {
  try {
    JSON.parse(fs.readFileSync(authFile));
  } catch {
    // required for tests/CI
    report("Could not find authFile...");
  }
};

/**
 * Write config to json file
 */
const saveAuthConfig = (config) =>
  fs.writeFileSync(authFile, JSON.stringify(config, null, 4));

/**
 * Web API client for duration of application
 */
const webApi = new SpotifyWebApi(getAuthConfig());

/**
 * Basic init - will either get a resource or refresh tokens
 * You're ready to RnR after this runs
 */

const init = async () => {
  let errorObj;

  // make an api call to see if tokens are out of date
  await webApi
    .getMe()
    .then((data) => console.log("init success"))
    .catch((err) => {
      report(`Initialising client failed, ${err}`);
      // TODO check status code in err
      errorObj = err;
    });

  if (errorObj) {
    await webApi
      .refreshAccessToken()
      .then((data) => {
        webApi.setAccessToken(data.body.access_token);
        saveAuthConfig(webApi.getCredentials());
      })
      .catch((err) => report(`error when refreshing token, ${err})`))
      .finally(() => report("refreshed token, init complete 🍻"));
  }
};

/**
 * Print the Authorise URL
 * - copy the URL into your browser, authorise,
 * and grab the URL param 'code' from the redirect
 */

const printAuthorizeUrl = () => {
  const scopes = [
    "playlist-modify-private",
    "playlist-read-private",
    "user-library-read",
    "user-library-modify",
  ];
  const state = "should-appear-on-callback-url";
  console.log(webApi.createAuthorizeURL(scopes, state));
};

/**
 * Given a code from above, put it in here
 */
const initialiseAuthorisation = (code) => {
  // TODO - defo needs tested for real
  webApi.authorizationCodeGrant(code).then(
    (data) => {
      webApi.setAccessToken(data.body["access_token"]);
      webApi.setRefreshToken(data.body["refresh_token"]);
      saveAuthConfig(webApi.getCredentials());
    },
    (err) => console.error(err)
  );
};

module.exports = {
  webApi,
  init,
  printAuthorizeUrl,
  initialiseAuthorisation,
};
