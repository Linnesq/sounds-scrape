const { webApi } = require("./auth");
const { report } = require("../utils/logger");

const getPlaylists = async () => {
  let existingPlaylists;
  const playlistData = {};
  const playlistDataExtra = {};
  await webApi()
    .getUserPlaylists({ limit: 50 })
    .then((data) => {
      existingPlaylists = data.body.items.map((x) => x.name);
      data.body.items.forEach((playlist) => {
        playlistData[playlist.name] = playlist.tracks.total;
        playlistDataExtra[playlist.name] = {
          playlistId: playlist.id,
        };
      });
    })
    .catch((err) => console.error(err))
    .finally(() => report("Existing playlists retrieved"));

  return { playlists: existingPlaylists, playlistData, playlistDataExtra };
};

module.exports = {
  getPlaylists,
};
