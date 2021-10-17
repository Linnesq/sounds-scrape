const { createSpotifyPlaylists } = require("./tasks");

const auth = require("../spotify/auth");
jest.mock("../spotify/auth");

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

    auth.webApi.getUserPlaylists = jest
      .fn()
      .mockResolvedValue({ body: { items: [{ name: "My Playlist 1" }] } });

    auth.webApi.createPlaylist = jest
      .fn()
      .mockResolvedValue({ body: { id: "an ID" } });

    auth.webApi.addTracksToPlaylist = jest.fn().mockResolvedValue({});

    // Act
    actual = await createSpotifyPlaylists();
    // Expectations
    expect(auth.init).toHaveBeenCalledTimes(1);
    expect(auth.webApi.getUserPlaylists).toHaveBeenCalledTimes(1);
    expect(auth.webApi.createPlaylist.mock.calls[0][0]).toEqual("mockShowName");
    expect(auth.webApi.createPlaylist).toHaveBeenCalledTimes(1);
    expect(auth.webApi.addTracksToPlaylist).toHaveBeenCalledTimes(1);
    expect(auth.webApi.addTracksToPlaylist.mock.calls[0]).toEqual([
      "an ID",
      ["spotify:track:7uafPT7Gvs4rVCHRfym5sI"],
    ]);
  });

  it("will not create playlist when pre-existing playlist found", async () => {
    getTracklists.mockResolvedValue(mockTracklisting);

    auth.webApi.getUserPlaylists = jest
      .fn()
      .mockResolvedValue({ body: { items: [{ name: "mockShowName" }] } });

    auth.webApi.createPlaylist = jest.fn();

    auth.webApi.addTracksToPlaylist = jest.fn();

    // Act
    actual = await createSpotifyPlaylists();
    // Expectations
    expect(auth.init).toHaveBeenCalledTimes(1);
    expect(auth.webApi.getUserPlaylists).toHaveBeenCalledTimes(1);
    expect(auth.webApi.createPlaylist).not.toHaveBeenCalled();
    expect(auth.webApi.addTracksToPlaylist).not.toHaveBeenCalled();
  });
});
