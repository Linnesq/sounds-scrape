const { report } = require("../utils/logger");
const { refreshAccessToken } = require("../spotify/auth");
const { createClient } = require("../spotify/client");
const { getTracklists } = require("../scraper/scraper");

/**
 * Creates or updates the playlist for one show. Throws if any Spotify call fails.
 */
const syncPlaylist = async (spotify, show, existingPlaylist) => {
  const { showNameDate, description, spotifyUris } = show;

  if (existingPlaylist) {
    const { trackCount } = existingPlaylist;
    if (spotifyUris.length <= trackCount) {
      report(
        `✓ Playlist "${showNameDate}" already exists with ${trackCount} tracks - skipping`,
      );
      return;
    }
    report(
      `⚠️ Playlist "${showNameDate}" has ${trackCount} tracks, latest BBC data has ${spotifyUris.length} - updating...`,
    );
    await spotify.setPlaylistItems(existingPlaylist.id, spotifyUris);
    report(`✓ "${showNameDate}" updated to ${spotifyUris.length} tracks`);
    return;
  }

  if (spotifyUris.length === 0) {
    report(`There were no tracks for ${showNameDate}, skipping...`);
    return;
  }

  report(`Creating playlist: "${showNameDate}" (${spotifyUris.length} tracks)`);
  const playlist = await spotify.createPlaylist(showNameDate, description);
  // If this fails the playlist is left empty, and the next run fills it in
  await spotify.setPlaylistItems(playlist.id, spotifyUris);
  report(`✓ Tracks successfully added to playlist "${showNameDate}"`);
};

const createSpotifyPlaylists = async () => {
  const shows = Object.values(await getTracklists()).map((show) => show.info);
  if (shows.length === 0) {
    throw new Error(
      "No episodes were parsed from BBC Sounds; the page structure may have changed",
    );
  }

  report("Authenticating with Spotify...");
  const spotify = createClient(await refreshAccessToken());

  // If this fails the run stops: without the full list, existing playlists
  // would look missing and be created again
  const playlists = await spotify.getAllPlaylists();
  report(`Existing playlists retrieved: ${playlists.length}`);
  const playlistsByName = new Map(playlists.map((p) => [p.name, p]));

  const failed = [];
  for (const show of shows) {
    try {
      await syncPlaylist(spotify, show, playlistsByName.get(show.showNameDate));
    } catch (error) {
      report(`✗ Failed to sync "${show.showNameDate}": ${error.message}`);
      failed.push(show.showNameDate);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `${failed.length} playlist(s) failed to sync: ${failed.join(", ")}`,
    );
  }
};

module.exports = { createSpotifyPlaylists };
