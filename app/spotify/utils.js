const { webApi } = require("./auth");
const { report } = require("../utils/logger");

const getPlaylists = async () => {
  let existingPlaylistNames;
  const playlistData = {};
  await webApi()
    .getUserPlaylists({ limit: 50 })
    .then((data) => {
      existingPlaylistNames = data.body.items.map((x) => x.name);
      data.body.items.forEach((playlist) => {
        playlistData[playlist.name] = {
          trackCount: playlist.tracks.total,
          id: playlist.id,
        };
      });
    })
    .catch((err) => console.error(err))
    .finally(() => report("Existing playlists retrieved"));

  return { existingPlaylistNames, playlistData };
};

module.exports = {
  getPlaylists,
};
