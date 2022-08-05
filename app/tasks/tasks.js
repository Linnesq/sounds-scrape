const { report } = require("../utils/logger");
const fs = require("fs");
const { init, webApi } = require("../spotify/auth");
const { getTracklists } = require("../scraper/scraper");
const { getPlaylists } = require("../spotify/utils");

const createSpotifyPlaylists = async () => {
  const showTracklists = await getTracklists();

  report("Initialising the web client...");
  await init();

  const { playlists, playlistData } = await getPlaylists();

  for await (const show of Object.values(showTracklists)) {
    const { showNameDate, spotifyUris } = show.info;
    const actualTrackCount = spotifyUris.length;

    if (playlists.includes(showNameDate)) {
      const playlistTrackCount = playlistData[showNameDate];
      if (actualTrackCount > playlistTrackCount) {
        report(
          `⚠️ Saved playlist ${showNameDate} has ${playlistTrackCount} tracks, latest BBC data has ${actualTrackCount}`
        );
        // todo - delete/remove/diff tracks
      }
      report(`${showNameDate} playlist already exists! Skipping...`);
      continue;
    }
    if (spotifyUris.length === 0) {
      report(`There were no tracks for ${showNameDate}, skipping...`);
      continue;
    }

    report(`Creating playlist for ${showNameDate}`);

    await webApi()
      .createPlaylist(showNameDate, {
        description: show.info.description,
        collaborative: false,
        public: false,
      })
      .then((data) =>
        webApi().addTracksToPlaylist(data.body.id, show.info.spotifyUris)
      )
      .then((data) =>
        report(`Tracks successfully added to playlist ${showNameDate}`)
      )
      .catch((err) => report(`Error encoutered ${err}`));
  }
};

module.exports = { createSpotifyPlaylists };
