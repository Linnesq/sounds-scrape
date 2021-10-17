const SpotifyWebApi = require("spotify-web-api-node");
const fs = require("fs");
const authFile = "auth.json";
const { report } = require("../utils/logger");

/**
 * Read config from json file
 */
const getAuthConfig = () => JSON.parse(fs.readFileSync(authFile));

/**
 * Write config to json file
 */
const saveAuthConfig = (config) =>
  fs.writeFileSync(authFile, JSON.stringify(config, null, 4));

/**
 * Web API client
 */
const webApi = () => new SpotifyWebApi(getAuthConfig());

/**
 * Basic init - will either get a resource or refresh tokens
 * You're ready to RnR after this runs
 */

const init = async () => {
  let errorObj;

  const api = webApi();

  // make an api call to see if tokens are out of date
  await api
    .getMe()
    .then((data) => report("init success"))
    .catch((err) => {
      report(`Initialising client failed, ${err}`);
      // TODO check status code in err
      errorObj = err;
    });

  if (errorObj) {
    await api
      .refreshAccessToken()
      .then((data) => {
        api.setAccessToken(data.body.access_token);
        saveAuthConfig(api.getCredentials());
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
  console.log(webApi().createAuthorizeURL(scopes, state));
};

/**
 * Given a code from above, put it in here
 */
const initialiseAuthorisation = async (code) => {
  const api = webApi();
  await api
    .authorizationCodeGrant(code)
    .then((data) => {
      api.setAccessToken(data.body["access_token"]);
      api.setRefreshToken(data.body["refresh_token"]);
      saveAuthConfig(api.getCredentials());
      report("Auth Success");
    })
    .catch((err) => report(err));
};

module.exports = {
  webApi,
  init,
  printAuthorizeUrl,
  initialiseAuthorisation,
};
