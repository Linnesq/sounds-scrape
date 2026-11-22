const fs = require("fs");
const { report } = require("../utils/logger");

const { getShowsConfig } = require("../config/config");

const extractEpisodeUrls = async (showMainUrl) => {
  const raw = await fetch(showMainUrl);
  const html = await raw.text();
  const matches =
    html.match(/(https:\/\/www\.bbc\.co\.uk\/programmes\/.\w*)/g) || [];

  // The listing page also links to the show's own page, which isn't an episode
  const isShowPage = (url) => showMainUrl?.startsWith(`${url}/`);

  return matches
    .filter((url) => !isShowPage(url))
    .map((url) => url.replace("programmes", "sounds/play"));
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
    const match = htmlText.match(
      /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s,
    );

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
  Object.entries(showMetadataMap).forEach(([url, showData]) => {
    // Navigate to the queries array in the new Next.js data structure
    const queries = showData?.props?.pageProps?.dehydratedState?.queries;

    if (!queries || queries.length === 0) {
      const queriesInfo = !queries
        ? "queries is undefined/null"
        : `queries.length = ${queries.length}`;
      report(
        `Unable to find queries data in Next.js structure for ${url} (${queriesInfo})`,
      );
      return;
    }

    // Locate the experience query by its contents rather than its index:
    // BBC has moved it before (queries[1] -> queries[0]).
    const modules = queries
      .map((query) => query?.state?.data?.data)
      .find(
        (data) =>
          Array.isArray(data) && data.some((m) => m?.id === "aod_play_area"),
      );

    if (!modules) {
      report(`Unable to find modules data for ${url}`);
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

    const dj = showInfo.container.title.trim();
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
  // Group shows by showNameDate with their IDs and track counts
  const showGroups = Object.entries(tracklistInfo).reduce(
    (groups, [showId, data]) => {
      const showName = data.info.showNameDate;
      if (!groups[showName]) {
        groups[showName] = [];
      }
      groups[showName].push({
        showId,
        trackCount: data.info.spotifyUris.length,
      });
      return groups;
    },
    {},
  );

  // Find duplicates and determine which to delete (keep the one with more tracks)
  const showsToDelete = Object.entries(showGroups)
    .filter(([_, shows]) => shows.length > 1)
    .flatMap(([showName, shows]) => {
      if (shows.length > 2) {
        report(`${showName} has multiple duplicates!!!`);
        throw new Error("Cannot choose which duplicate to use.");
      }
      // Sort by track count (ascending) and return the one with fewer tracks
      shows.sort((a, b) => a.trackCount - b.trackCount);
      return shows[0].showId;
    });

  // Report and delete duplicates
  if (showsToDelete.length > 0) {
    report(`Duplicates detected and handled, affecting ${showsToDelete}`);
    showsToDelete.forEach((id) => delete tracklistInfo[id]);
  }

  return tracklistInfo;
};

/*
Put it all together to produce a tracklist
*/
const getTracklists = async () => {
  let showTracklists;
  let showUrls = [];

  for (const config of getShowsConfig()) {
    const urls = await extractEpisodeUrls(config);
    const uniq = Array.from(new Set(urls));
    showUrls.push(...uniq);
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
