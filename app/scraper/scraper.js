const fetch = require("node-fetch");
const xpath = require("xpath");
const dom = require("xmldom").DOMParser;
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config'))

const extractEpisodeUrls = async () => {
  const raw = await fetch(config.episodesPageUrl);
  const html = await raw.text();
  const doc = new dom().parseFromString(html);
  const query = '//h2[@class="programme__titles"]/a/@href';

  const nodes = xpath.select(query, doc);
    
  return nodes.map(node => node.value.replace("programmes", "sounds/play"))
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
    const doc = new dom().parseFromString(htmlText);
    const rawText = xpath.select(
      'string(//div[@id="orb-modules"]//script[2])',
      doc
    );
    const t = rawText.trim().replace("window.__PRELOADED_STATE__ = ", "");
    const clean = t.substring(0, t.length - 1); //remove final ;
    const parsed = JSON.parse(clean);
    results[url] = parsed
  }

  return results;
};

/**
 * Extracts info from metadata to be used in playlist creation
 * returns show info (date, descriptions, tracklists)
 */

const extractTracklistInfo = (showMetadataMap) => {
  const results = {}
  Object.values(showMetadataMap).forEach(showData => {
    const showInfo = showData.programmes.current;
    const spotifyTrackUrls = [];
    const spotifyTrackUris = [];
    showData.tracklist.tracks.forEach(elem => {
      const uris = elem.uris.filter(uri => uri.id === 'commercial-music-service-spotify')[0]
      if (uris && uris.uri) {
        spotifyTrackUrls.push(uris.uri);
        spotifyTrackUris.push('spotify:track:' + uris.uri.split('/').pop());
      }
    });
    const dj = showInfo.container.title
    const showNameDate = `${dj} ${showInfo.release.date.split('T')[0]}`
    results[showInfo.urn.split(':').pop()] = {
      info: {
        dj,
        showNameDate,
        description: showInfo.synopses.short,
        spotifyUris: spotifyTrackUris,
      }
    }
  });
  return results;
};

module.exports = { 
  extractEpisodeUrls, 
  extractEpisodeMetadata,
  extractTracklistInfo,
 };