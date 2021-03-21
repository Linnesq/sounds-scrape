const SpotifyWebApi = require("spotify-web-api-node");
const fs = require("fs");
const authFile = "auth.json";

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
      console.error("init failed", err);
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
      .catch((err) => console.error("error when refreshing token!", err))
      .finally(() => console.log("refreshed token, init complete 🍻"));
  }
};

/**
 * Print the Authorise URL
 * - copy the URL into your browser, authorise,
 * and grab the URL param 'code' from the redirect
 */

const printAuthorizeUrl = () => {
  const scopes = ["playlist-modify-private", "playlist-read-private"];
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
