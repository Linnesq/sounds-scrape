const { createSpotifyPlaylists } = require("./tasks/tasks");

const main = async () => {
  await createSpotifyPlaylists();
};

main();
