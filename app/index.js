const { createSpotifyPlaylists } = require("./tasks/tasks");
const { report } = require("./utils/logger");

const main = async () => {
  try {
    await createSpotifyPlaylists();
    report("Application completed successfully");
  } catch (error) {
    report(`Application failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

main();
