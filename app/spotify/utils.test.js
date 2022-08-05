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
            },
          ],
        },
      });
      const actual = await getPlaylists();
      expect(actual).toMatchObject({
        playlistData: {
          playlist1: 1,
        },
        playlists: ["playlist1"],
      });
    });
  });
});
