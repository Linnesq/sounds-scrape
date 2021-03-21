const {
  extractEpisodeUrls,
  extractEpisodeMetadata,
  extractTracklistInfo,
} = require("./scraper/scraper");

const { init, webApi } = require("./spotify/auth");
const fs = require('fs');

const startTime = Date.now();

const report = (text) => {
  const message = `${Date()} - ${text}\n`;
  console.log(message);
  fs.appendFileSync(`${startTime}.log`, message);
}

const main = async () => {
  const testing = false;
  report(`starting the scrape, is testing? ${testing}`);
  let showTracklists;

  if (testing){
    showTracklists = JSON.parse(fs.readFileSync('latest.json'));
  } else {
    const showUrls = await extractEpisodeUrls();
    const showMetadata = await extractEpisodeMetadata(showUrls);
    showTracklists = extractTracklistInfo(showMetadata);
    fs.writeFileSync('latest.json', JSON.stringify(showTracklists, null, 4));
  }

  report('Initialising the web client...');
  await init();

  let existingPlaylists;
  await webApi
    .getUserPlaylists({ limit: 50 })
    .then((data) => existingPlaylists = data.body.items.map((x) => x.name))
    .catch((err) => console.error(err))
    .finally(() => report('Existing playlists retrieved'));

  for await (const show of Object.values(showTracklists)) {
    const { showNameDate } = show.info

    if (existingPlaylists.includes(showNameDate)) {
      report(`${showNameDate} playlist already exists! Skipping...`);
      continue;
    }
    report(`Creating playlist for ${showNameDate}`)

    await webApi
      .createPlaylist(showNameDate, {
        description: show.info.description,
        collaborative: false,
        public: false,
      })
      .then((data) =>
        webApi.addTracksToPlaylist(data.body.id, show.info.spotifyUris)
      )
      .then((data) => report(`Tracks successfully added to playlist ${showNameDate}`))
      .catch((err) => report(`Error encoutered ${err}`))
      .finally(() => console.log(`Finished attempting to create ${showNameDate}`));
  }
};

main();
