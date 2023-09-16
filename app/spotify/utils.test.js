const { getPlaylists } = require("./utils");
const auth = require("../spotify/auth");
jest.mock("../spotify/auth");
const mockApi = require("spotify-web-api-node");
jest.mock("spotify-web-api-node");

describe("Spotify Utils", () => {
  describe("getPlaylists", () => {
    it("returns an object with playlist", async () => {
      auth.webApi.mockReturnValue(mockApi);
      mockApi.getUserPlaylists = jest.fn().mockResolvedValue({
        body: {
          items: [
            {
              name: "playlist1",
              tracks: {
                total: 1,
              },
              id: "pl1",
            },
            {
              name: "playlist2",
              tracks: {
                total: 12,
              },
              id: "pl2",
            },
          ],
        },
      });
      const actual = await getPlaylists();
      expect(actual).toMatchObject({
        existingPlaylistNames: ["playlist1", "playlist2"],
        playlistData: {
          playlist1: {
            trackCount: 1,
            id: "pl1",
          },
          playlist2: {
            trackCount: 12,
            id: "pl2",
          },
        },
      });
    });
  });
});
