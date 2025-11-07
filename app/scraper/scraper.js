const fs = require("fs");
const { report } = require("../utils/logger");

const { getShowsConfig } = require("../config/config");
const { url } = require("inspector");

const extractEpisodeUrls = async (showMainUrl) => {
  const raw = await fetch(showMainUrl);
  const html = await raw.text();
  const matches =
    html.match(/(https:\/\/www\.bbc\.co\.uk\/programmes\/.\w*)/g) || [];

  const urls = matches.map((node) => node.replace("programmes", "sounds/play"));
  return urls;
};

/*
Extracts __NEXT_DATA__ metadata from bbc.co.uk/sounds/play/xyz pages
from an array of page urls
*/

const extractEpisodeMetadata = async (urls) => {
  let results = {};

  for (const url of urls) {
    const raw = await fetch(url);
    const htmlText = await raw.text();

    // Use regex to extract the JSON content from inside the script tag
    const match = htmlText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);

    if (!match || !match[1]) {
      report(`No show data for ${url}`);
      continue;
    }

    try {
      const parsed = JSON.parse(match[1]);
      results[url] = parsed;
    } catch (error) {
      report(`Failed to parse JSON for ${url}: ${error.message}`);
      continue;
    }
  }

  return results;
};

/**
 * Extracts info from metadata to be used in playlist creation
 * returns show info (date, descriptions, tracklists)
 */

const extractTracklistInfo = (showMetadataMap) => {
  const results = {};
  Object.values(showMetadataMap).forEach((showData) => {
    // Navigate to the queries array in the new Next.js data structure
    const queries = showData?.props?.pageProps?.dehydratedState?.queries;

    if (!queries || queries.length < 2) {
      report("Unable to find queries data in Next.js structure");
      return;
    }

    // Get the modules data array
    const modules = queries[1]?.state?.data?.data;

    if (!modules || modules.length < 2) {
      report("Unable to find modules data");
      return;
    }

    // Find the player module (aod_play_area) for show info
    const playerModule = modules.find((m) => m.id === "aod_play_area");

    // Find the tracklist module (aod_tracks) for track data
    const tracklistModule = modules.find((m) => m.id === "aod_tracks");

    if (!playerModule || !tracklistModule) {
      report("Unable to find player or tracklist module");
      return;
    }

    const showInfo = playerModule.data?.[0];

    if (!showInfo) {
      report("Unable to find show info in player module");
      return;
    }

    const spotifyTrackUrls = [];
    const spotifyTrackUris = [];

    tracklistModule.data.forEach((elem) => {
      const uris = elem.uris?.filter(
        (uri) => uri.id === "commercial-music-service-spotify",
      )[0];
      if (uris && uris.uri && !uris.uri.includes("album")) {
        spotifyTrackUrls.push(uris.uri);
        spotifyTrackUris.push("spotify:track:" + uris.uri.split("/").pop());
      }
    });

    const dj = showInfo.container.title;
    const showNameDate = `${dj} ${showInfo.release.date.split("T")[0]}`;
    results[showInfo.urn.split(":").pop()] = {
      info: {
        dj,
        showNameDate,
        description: showInfo.synopses.short,
        spotifyUris: spotifyTrackUris,
      },
    };
  });

  return handleDuplicateShows(results);
};

const handleDuplicateShows = (tracklistInfo) => {
  const showsByShowName = {};
  for (const showId in tracklistInfo) {
    const showInfo = tracklistInfo[showId].info;
    const showName = showInfo.showNameDate;
    const showData = { showId, trackCount: showInfo.spotifyUris.length };

    if (showsByShowName[showName]) {
      showsByShowName[showName].push(showData);
    } else {
      showsByShowName[showName] = [showData];
    }
  }

  const showsIdsToDelete = [];
  for (const showName in showsByShowName) {
    if (showsByShowName[showName].length > 1) {
      showsByShowName[showName].sort((a, b) => a.trackCount - b.trackCount);
      showsIdsToDelete.push(showsByShowName[showName][0].showId);
    }
    if (showsByShowName[showName].length > 2) {
      report(`${showName} has multiple duplicates!!!`);
      throw new Error("Can not choose which duplicate to use.");
    }
  }
  if (showsIdsToDelete.length > 0) {
    report(`Duplicates detected and handled, affecting ${showsIdsToDelete}`);
  }
  showsIdsToDelete.forEach((id) => {
    delete tracklistInfo[id];
  });
  return tracklistInfo;
};

/*
Put it all together to produce a tracklist
*/
const getTracklists = async () => {
  let showTracklists;
  let showUrls = [];

  for (const config of getShowsConfig()) {
    await extractEpisodeUrls(config).then((urls) => {
      uniq = Array.from(new Set(urls));
      showUrls.push(...uniq);
    });
  }

  const showMetadata = await extractEpisodeMetadata(showUrls);
  showTracklists = extractTracklistInfo(showMetadata);
  fs.writeFileSync("latest.json", JSON.stringify(showTracklists, null, 4));

  return showTracklists;
};

module.exports = {
  extractEpisodeUrls,
  extractEpisodeMetadata,
  extractTracklistInfo,
  getTracklists,
  handleDuplicateShows,
};
