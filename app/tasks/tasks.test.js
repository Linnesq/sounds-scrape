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

    mockApi.getUserPlaylists = jest
      .fn()
      .mockResolvedValue({ body: { items: [{ name: "My Playlist 1" }] } });

    mockApi.createPlaylist = jest
      .fn()
      .mockResolvedValue({ body: { id: "an ID" } });

    mockApi.addTracksToPlaylist = jest.fn().mockResolvedValue({});

    // Act
    await createSpotifyPlaylists();

    // Expectations
    expect(auth.init).toHaveBeenCalledTimes(1);
    expect(mockApi.getUserPlaylists).toHaveBeenCalledTimes(1);
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

    const mockGetPlaylists = jest.fn();
    mockGetPlaylists.mockResolvedValue({
      body: { items: [{ name: "mockShowName" }] },
    });
    mockApi.getUserPlaylists = mockGetPlaylists;

    mockApi.createPlaylist = jest.fn();

    mockApi.addTracksToPlaylist = jest.fn();

    // Act
    await createSpotifyPlaylists();
    // Expectations
    expect(auth.init).toHaveBeenCalledTimes(1);
    expect(mockApi.getUserPlaylists).toHaveBeenCalledTimes(1);
    expect(mockApi.createPlaylist).not.toHaveBeenCalled();
    expect(mockApi.addTracksToPlaylist).not.toHaveBeenCalled();
  });
});
