const { createSpotifyPlaylists } = require("./tasks");

const { refreshAccessToken } = require("../spotify/auth");
jest.mock("../spotify/auth");

const { createClient } = require("../spotify/client");
jest.mock("../spotify/client");

const { getTracklists } = require("../scraper/scraper");
jest.mock("../scraper/scraper");

const { report } = require("../utils/logger");
jest.mock("../utils/logger");

const show = (showNameDate, spotifyUris) => ({
  info: {
    showNameDate,
    description: `${showNameDate} description`,
    spotifyUris,
  },
});

describe("createSpotifyPlaylists", () => {
  let spotify;

  beforeEach(() => {
    jest.resetAllMocks();
    refreshAccessToken.mockResolvedValue("access-token");
    spotify = {
      getAllPlaylists: jest.fn().mockResolvedValue([]),
      createPlaylist: jest.fn().mockResolvedValue({ id: "new-id" }),
      setPlaylistItems: jest.fn().mockResolvedValue(),
    };
    createClient.mockReturnValue(spotify);
  });

  it("creates a playlist and adds its tracks when none exists", async () => {
    getTracklists.mockResolvedValue({ ep1: show("Show A", ["uri1", "uri2"]) });

    await createSpotifyPlaylists();

    expect(createClient).toHaveBeenCalledWith("access-token");
    expect(spotify.createPlaylist).toHaveBeenCalledWith(
      "Show A",
      "Show A description",
    );
    expect(spotify.setPlaylistItems).toHaveBeenCalledWith("new-id", [
      "uri1",
      "uri2",
    ]);
  });

  it("skips a show whose playlist already has as many tracks", async () => {
    getTracklists.mockResolvedValue({ ep1: show("Show A", ["uri1"]) });
    spotify.getAllPlaylists.mockResolvedValue([
      { id: "pl1", name: "Show A", trackCount: 1 },
    ]);

    await createSpotifyPlaylists();

    expect(spotify.createPlaylist).not.toHaveBeenCalled();
    expect(spotify.setPlaylistItems).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(
      '✓ Playlist "Show A" already exists with 1 tracks - skipping',
    );
  });

  it("replaces the tracks when BBC now lists more than the playlist has", async () => {
    getTracklists.mockResolvedValue({ ep1: show("Show A", ["uri1", "uri2"]) });
    spotify.getAllPlaylists.mockResolvedValue([
      { id: "pl1", name: "Show A", trackCount: 1 },
    ]);

    await createSpotifyPlaylists();

    expect(spotify.createPlaylist).not.toHaveBeenCalled();
    expect(spotify.setPlaylistItems).toHaveBeenCalledWith("pl1", [
      "uri1",
      "uri2",
    ]);
  });

  it("skips shows with no tracks", async () => {
    getTracklists.mockResolvedValue({ ep1: show("Empty Show", []) });

    await createSpotifyPlaylists();

    expect(spotify.createPlaylist).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(
      "There were no tracks for Empty Show, skipping...",
    );
  });

  it("fails before touching Spotify when no episodes were parsed", async () => {
    getTracklists.mockResolvedValue({});

    await expect(createSpotifyPlaylists()).rejects.toThrow(
      "No episodes were parsed from BBC Sounds",
    );
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("fails without creating anything when Spotify auth fails", async () => {
    getTracklists.mockResolvedValue({ ep1: show("Show A", ["uri1"]) });
    refreshAccessToken.mockRejectedValue(new Error("token refresh failed"));

    await expect(createSpotifyPlaylists()).rejects.toThrow(
      "token refresh failed",
    );
    expect(spotify.createPlaylist).not.toHaveBeenCalled();
  });

  it("fails without creating anything when the playlist list can't be fetched", async () => {
    getTracklists.mockResolvedValue({ ep1: show("Show A", ["uri1"]) });
    spotify.getAllPlaylists.mockRejectedValue(new Error("503"));

    await expect(createSpotifyPlaylists()).rejects.toThrow("503");
    expect(spotify.createPlaylist).not.toHaveBeenCalled();
    expect(spotify.setPlaylistItems).not.toHaveBeenCalled();
  });

  it("carries on past a failing show, then fails the run naming it", async () => {
    getTracklists.mockResolvedValue({
      ep1: show("Show A", ["uri1"]),
      ep2: show("Show B", ["uri2"]),
    });
    spotify.createPlaylist
      .mockRejectedValueOnce(new Error("API Error"))
      .mockResolvedValueOnce({ id: "id-b" });

    await expect(createSpotifyPlaylists()).rejects.toThrow(
      "1 playlist(s) failed to sync: Show A",
    );
    expect(report).toHaveBeenCalledWith('✗ Failed to sync "Show A": API Error');
    expect(spotify.setPlaylistItems).toHaveBeenCalledTimes(1);
    expect(spotify.setPlaylistItems).toHaveBeenCalledWith("id-b", ["uri2"]);
  });
});
