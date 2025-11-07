const { webApi } = require("./auth");
const { report } = require("../utils/logger");

const getPlaylists = async () => {
  let existingPlaylistNames = [];
  const playlistData = {};
  let offset = 0;
  const limit = 50;
  let total = 0;
  let fetchedCount = 0;

  // Fetch all playlists using pagination
  do {
    await webApi()
      .getUserPlaylists({ limit, offset })
      .then((data) => {
        total = data.body.total;
        const playlists = data.body.items.map((x) => x.name);
        existingPlaylistNames.push(...playlists);

        data.body.items.forEach((playlist) => {
          playlistData[playlist.name] = {
            trackCount: playlist.tracks.total,
            id: playlist.id,
          };
        });

        fetchedCount += data.body.items.length;
        offset += limit;
      })
      .catch((err) => console.error(err));
  } while (fetchedCount < total);

  report(
    `Existing playlists retrieved: ${fetchedCount} of ${total} total playlists`,
  );

  return { existingPlaylistNames, playlistData };
};

module.exports = {
  getPlaylists,
};
