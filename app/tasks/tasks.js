const { report } = require("../utils/logger");
const fs = require("fs");
const { init, webApi } = require("../spotify/auth");
const { getTracklists } = require("../scraper/scraper");
const { getPlaylists } = require("../spotify/utils");

const createSpotifyPlaylists = async () => {
  const showTracklists = await getTracklists();

  report("Initialising the web client...");
  await init();

  const { existingPlaylistNames, playlistData } = await getPlaylists();

  for await (const show of Object.values(showTracklists)) {
    const { showNameDate, spotifyUris } = show.info;
    const actualTrackCount = spotifyUris.length;

    if (existingPlaylistNames.includes(showNameDate)) {
      const matchingPlaylist = playlistData[showNameDate];
      const playlistTrackCount = matchingPlaylist["trackCount"];
      if (actualTrackCount > playlistTrackCount) {
        report(
          `⚠️ Saved playlist ${showNameDate} has ${playlistTrackCount} tracks, latest BBC data has ${actualTrackCount}`,
        );
        const playlistId = matchingPlaylist["id"];
        let oldTracks = [];
        await webApi()
          .getPlaylist(playlistId)
          .then(
            (data) =>
              (oldTracks = data.body.tracks.items.map((e) => {
                return { uri: e.track.uri };
              })),
          )
          .catch((err) => {
            console.error(err);
          });

        await webApi()
          .removeTracksFromPlaylist(playlistId, oldTracks)
          .catch((err) => console.error(err));

        await webApi()
          .addTracksToPlaylist(playlistId, show.info.spotifyUris)
          .catch((err) => console.error(err));

        report(`👍🏼 ${showNameDate} updated with missing tracks`);
      } else {
        report(`${showNameDate} playlist already exists! Skipping...`);
      }
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
        webApi().addTracksToPlaylist(data.body.id, show.info.spotifyUris),
      )
      .then((data) =>
        report(`Tracks successfully added to playlist ${showNameDate}`),
      )
      .catch((err) => report(`Error encoutered ${err}`));
  }
};

module.exports = { createSpotifyPlaylists };
