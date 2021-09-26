const { report } = require("../utils/logger");
const fs = require("fs");
const { init, webApi } = require("../spotify/auth");
const { getTracklists } = require("../scraper/scraper");

const createSpotifyPlaylists = async () => {
  const showTracklists = await getTracklists();

  report("Initialising the web client...");
  await init();

  let existingPlaylists;
  await webApi
    .getUserPlaylists({ limit: 50 })
    .then((data) => (existingPlaylists = data.body.items.map((x) => x.name)))
    .catch((err) => console.error(err))
    .finally(() => report("Existing playlists retrieved"));

  for await (const show of Object.values(showTracklists)) {
    const { showNameDate } = show.info;

    if (existingPlaylists.includes(showNameDate)) {
      report(`${showNameDate} playlist already exists! Skipping...`);
      continue;
    }
    if (show.info.spotifyUris.length === 0) {
      report(`There were no tracks for ${showNameDate}, skipping...`);
      continue;
    }

    report(`Creating playlist for ${showNameDate}`);

    await webApi
      .createPlaylist(showNameDate, {
        description: show.info.description,
        collaborative: false,
        public: false,
      })
      .then((data) =>
        webApi.addTracksToPlaylist(data.body.id, show.info.spotifyUris)
      )
      .then((data) =>
        report(`Tracks successfully added to playlist ${showNameDate}`)
      )
      .catch((err) => report(`Error encoutered ${err}`))
      .finally(() =>
        console.log(`Finished attempting to create ${showNameDate}`)
      );
  }
};

module.exports = { createSpotifyPlaylists };
