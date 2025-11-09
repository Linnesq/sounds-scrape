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

    it("fetches all playlists when there are more than 50", async () => {
      const first50 = Array(50)
        .fill()
        .map((_, i) => ({
          name: `pl${i}`,
          tracks: { total: 1 },
          id: `id${i}`,
        }));
      const next30 = Array(30)
        .fill()
        .map((_, i) => ({
          name: `pl${i + 50}`,
          tracks: { total: 1 },
          id: `id${i + 50}`,
        }));

      auth.webApi.mockReturnValue(mockApi);
      mockApi.getUserPlaylists = jest
        .fn()
        .mockResolvedValueOnce({ body: { items: first50, total: 80 } })
        .mockResolvedValueOnce({ body: { items: next30, total: 80 } });

      const result = await getPlaylists();

      expect(mockApi.getUserPlaylists).toHaveBeenCalledTimes(2);
      expect(mockApi.getUserPlaylists).toHaveBeenNthCalledWith(1, {
        limit: 50,
        offset: 0,
      });
      expect(mockApi.getUserPlaylists).toHaveBeenNthCalledWith(2, {
        limit: 50,
        offset: 50,
      });
      expect(result.existingPlaylistNames).toHaveLength(80);
    });

    it("handles errors when fetching playlists", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      auth.webApi.mockReturnValue(mockApi);
      mockApi.getUserPlaylists = jest
        .fn()
        .mockRejectedValue(new Error("Fetch failed"));

      const result = await getPlaylists();

      expect(consoleSpy).toHaveBeenCalledWith(new Error("Fetch failed"));
      expect(result.existingPlaylistNames).toEqual([]);

      consoleSpy.mockRestore();
    });
  });
});
