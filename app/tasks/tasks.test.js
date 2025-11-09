const { createSpotifyPlaylists } = require("./tasks");

const auth = require("../spotify/auth");
jest.mock("../spotify/auth");
const mockApi = require("spotify-web-api-node");
jest.mock("spotify-web-api-node");

const { getTracklists } = require("../scraper/scraper");
jest.mock("../scraper/scraper");

const { report } = require("../utils/logger");
jest.mock("../utils/logger");
report.mockImplementation = (text) => {}; // no-op};

const { getPlaylists } = require("../spotify/utils");
jest.mock("../spotify/utils");

const mockTracklisting = {
  m0010hfn: {
    info: {
      dj: "Benji B",
      showNameDate: "mockShowName",
      description: "Benji explores future beats from around the world.",
      spotifyUris: ["spotify:track:7uafPT7Gvs4rVCHRfym5sI"],
    },
  },
};

describe("createSpotifyPlaylists", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("creates playlist when no pre-existing playlist found", async () => {
    getTracklists.mockResolvedValue(mockTracklisting);

    auth.webApi.mockReturnValue(mockApi);
    mockApi.getUserPlaylists = jest.fn();

    getPlaylists.mockReturnValue({
      existingPlaylistNames: ["My Playlist 1"],
      playlistData: {
        "My Playlist 1": {
          trackCount: 1,
          id: "mpl1",
        },
      },
    });

    mockApi.createPlaylist = jest
      .fn()
      .mockResolvedValue({ body: { id: "an ID" } });

    mockApi.addTracksToPlaylist = jest.fn().mockResolvedValue({});

    // Act
    await createSpotifyPlaylists();

    // Expectations
    expect(auth.init).toHaveBeenCalledTimes(1);
    expect(getPlaylists).toHaveBeenCalledTimes(1);
    expect(mockApi.createPlaylist.mock.calls[0][0]).toEqual("mockShowName");
    expect(mockApi.createPlaylist).toHaveBeenCalledTimes(1);
    expect(mockApi.addTracksToPlaylist).toHaveBeenCalledTimes(1);
    expect(mockApi.addTracksToPlaylist.mock.calls[0]).toEqual([
      "an ID",
      ["spotify:track:7uafPT7Gvs4rVCHRfym5sI"],
    ]);
  });

  it("will not create playlist when pre-existing playlist found", async () => {
    getTracklists.mockResolvedValue(mockTracklisting);

    auth.webApi.mockReturnValue(mockApi);

    getPlaylists.mockReturnValue({
      existingPlaylistNames: ["mockShowName"],
      playlistData: {
        mockShowName: {
          trackCount: 1,
          id: "msn1",
        },
      },
    });

    mockApi.createPlaylist = jest.fn();

    mockApi.addTracksToPlaylist = jest.fn();

    // Act
    await createSpotifyPlaylists();
    // Expectations
    expect(auth.init).toHaveBeenCalledTimes(1);
    expect(getPlaylists).toHaveBeenCalledTimes(1);
    expect(mockApi.createPlaylist).not.toHaveBeenCalled();
    expect(mockApi.addTracksToPlaylist).not.toHaveBeenCalled();
  });

  it("updates a playlist when scrape returns more tracks", async () => {
    getTracklists.mockResolvedValue({
      showId1: {
        info: {
          showNameDate: "show1",
          spotifyUris: ["song1", "song2"],
        },
      },
    });

    auth.webApi.mockReturnValue(mockApi);

    getPlaylists.mockReturnValue({
      existingPlaylistNames: ["show1"],
      playlistData: {
        show1: {
          trackCount: 1,
          id: "msn1",
        },
      },
    });

    mockApi.createPlaylist = jest.fn();
    mockApi.getPlaylist = jest.fn().mockResolvedValue({
      body: {
        tracks: {
          items: [{ track: { uri: "uri1" } }],
        },
      },
    });
    mockApi.removeTracksFromPlaylist = jest.fn().mockResolvedValue({});

    mockApi.addTracksToPlaylist = jest.fn().mockResolvedValue({});

    // Act
    await createSpotifyPlaylists();
    // Expectations
    expect(auth.init).toHaveBeenCalledTimes(1);
    expect(getPlaylists).toHaveBeenCalledTimes(1);
    expect(mockApi.getPlaylist).toHaveBeenCalledWith("msn1");
    expect(mockApi.removeTracksFromPlaylist).toHaveBeenCalledWith("msn1", [
      { uri: "uri1" },
    ]);
    expect(mockApi.createPlaylist).not.toHaveBeenCalled();
    expect(mockApi.addTracksToPlaylist).toHaveBeenCalledWith("msn1", [
      "song1",
      "song2",
    ]);
  });

  it("skips shows with no tracks", async () => {
    getTracklists.mockResolvedValue({
      showId1: {
        info: {
          showNameDate: "Empty Show",
          spotifyUris: [],
        },
      },
    });

    auth.webApi.mockReturnValue(mockApi);

    getPlaylists.mockReturnValue({
      existingPlaylistNames: [],
      playlistData: {},
    });

    mockApi.createPlaylist = jest.fn();
    mockApi.addTracksToPlaylist = jest.fn();

    // Act
    await createSpotifyPlaylists();

    // Expectations
    expect(mockApi.createPlaylist).not.toHaveBeenCalled();
    expect(mockApi.addTracksToPlaylist).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(
      "There were no tracks for Empty Show, skipping...",
    );
  });

  it("handles errors when creating playlist", async () => {
    getTracklists.mockResolvedValue(mockTracklisting);

    auth.webApi.mockReturnValue(mockApi);

    getPlaylists.mockReturnValue({
      existingPlaylistNames: [],
      playlistData: {},
    });

    mockApi.createPlaylist = jest
      .fn()
      .mockRejectedValue(new Error("API Error"));

    // Act
    await createSpotifyPlaylists();

    // Expectations
    expect(report).toHaveBeenCalledWith(
      "Error encountered creating playlist: API Error",
    );
  });

  it("handles errors when fetching playlist for update", async () => {
    getTracklists.mockResolvedValue({
      show1: {
        info: {
          showNameDate: "Show",
          spotifyUris: ["a", "b"],
        },
      },
    });

    auth.webApi.mockReturnValue(mockApi);

    getPlaylists.mockReturnValue({
      existingPlaylistNames: ["Show"],
      playlistData: {
        Show: {
          trackCount: 1,
          id: "pl1",
        },
      },
    });

    mockApi.getPlaylist = jest
      .fn()
      .mockRejectedValue(new Error("Fetch failed"));
    mockApi.removeTracksFromPlaylist = jest.fn().mockResolvedValue({});
    mockApi.addTracksToPlaylist = jest.fn().mockResolvedValue({});

    // Act
    await createSpotifyPlaylists();

    // Expectations
    expect(report).toHaveBeenCalledWith(
      "Error fetching playlist: Fetch failed",
    );
    // When getPlaylist fails, the oldTracks array stays empty, so remove is called with []
    expect(mockApi.removeTracksFromPlaylist).toHaveBeenCalledWith("pl1", []);
  });

  it("handles errors when removing tracks from playlist", async () => {
    getTracklists.mockResolvedValue({
      show1: {
        info: {
          showNameDate: "Show",
          spotifyUris: ["a", "b"],
        },
      },
    });

    auth.webApi.mockReturnValue(mockApi);

    getPlaylists.mockReturnValue({
      existingPlaylistNames: ["Show"],
      playlistData: {
        Show: {
          trackCount: 1,
          id: "pl1",
        },
      },
    });

    mockApi.getPlaylist = jest.fn().mockResolvedValue({
      body: {
        tracks: {
          items: [{ track: { uri: "uri1" } }],
        },
      },
    });
    mockApi.removeTracksFromPlaylist = jest
      .fn()
      .mockRejectedValue(new Error("Remove failed"));
    mockApi.addTracksToPlaylist = jest.fn().mockResolvedValue({});

    // Act
    await createSpotifyPlaylists();

    // Expectations
    expect(report).toHaveBeenCalledWith(
      "Error removing tracks from playlist: Remove failed",
    );
    // After remove fails, add should still be called
    expect(mockApi.addTracksToPlaylist).toHaveBeenCalledWith("pl1", ["a", "b"]);
  });

  it("handles errors when adding tracks to playlist during update", async () => {
    getTracklists.mockResolvedValue({
      show1: {
        info: {
          showNameDate: "Show",
          spotifyUris: ["a", "b"],
        },
      },
    });

    auth.webApi.mockReturnValue(mockApi);

    getPlaylists.mockReturnValue({
      existingPlaylistNames: ["Show"],
      playlistData: {
        Show: {
          trackCount: 1,
          id: "pl1",
        },
      },
    });

    mockApi.getPlaylist = jest.fn().mockResolvedValue({
      body: {
        tracks: {
          items: [{ track: { uri: "uri1" } }],
        },
      },
    });
    mockApi.removeTracksFromPlaylist = jest.fn().mockResolvedValue({});
    mockApi.addTracksToPlaylist = jest
      .fn()
      .mockRejectedValue(new Error("Add failed"));

    // Act
    await createSpotifyPlaylists();

    // Expectations
    expect(report).toHaveBeenCalledWith(
      "Error adding tracks to playlist: Add failed",
    );
  });
});
