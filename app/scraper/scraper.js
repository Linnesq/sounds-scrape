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
Extracts window.__PRELOADED_STATE__ metadata from bbc.co.uk/sounds/play/xyz pages
from an array of page urls
*/

const extractEpisodeMetadata = async (urls) => {
  let results = {};

  for (const url of urls) {
    const raw = await fetch(url);
    const htmlText = await raw.text();
    const target = htmlText
      .split("\n")
      .filter((line) => line.indexOf("window.__PRELOADED_STATE__") > 0)[0];

    if (!target) {
      report(`No show data for ${url}`);
      continue;
    }

    const startCut = target.indexOf("{");
    const endCut = target.lastIndexOf("}") + 1;
    const jsonString = target.substring(startCut, endCut);
    const parsed = JSON.parse(jsonString);
    results[url] = parsed;
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
    const showInfo = showData.programmes.current;
    const spotifyTrackUrls = [];
    const spotifyTrackUris = [];
    showData.tracklist.tracks.forEach((elem) => {
      const uris = elem.uris.filter(
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
