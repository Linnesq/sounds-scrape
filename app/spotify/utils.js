const { webApi } = require("./auth");
const { report } = require("../utils/logger");

const getPlaylists = async () => {
  let existingPlaylists;
  const playlistData = {};
  await webApi()
    .getUserPlaylists({ limit: 50 })
    .then((data) => {
      existingPlaylists = data.body.items.map((x) => x.name);
      data.body.items.forEach(
        (playlist) => (playlistData[playlist.name] = playlist.tracks.total)
      );
    })
    .catch((err) => console.error(err))
    .finally(() => report("Existing playlists retrieved"));

  return { playlists: existingPlaylists, playlistData };
};

module.exports = {
  getPlaylists,
};
