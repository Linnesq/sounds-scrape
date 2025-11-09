const scraper = require("./scraper");

global.fetch = jest.fn();

const { getShowsConfig } = require("../config/config");
jest.mock("../config/config");

const fs = require("fs");
jest.mock("fs");

const { report } = require("../utils/logger");
jest.mock("../utils/logger");

fs.writeFileSync = jest.fn().mockImplementation(() => {});

const htmlString = `
<div class="programme__body">
    <h2 class="programme__titles">
    <a href="https://www.bbc.co.uk/programmes/testing" class="br-blocklink__link block-link__target">
    <span class="programme__title gamma">
    <span>With Alfa Mist</span></span></a>
    </h2>            
    <p class="programme__synopsis text--subtle centi">
        <span>Pianist and producer, Alfa Mist, describes himself in 3 records.</span>
    </p>
</div>
`;
const htmlStateString = `
<div id="orb-modules">
  <script type="text/javascript">
    (function () {
      var el = document.getElementById('main');
      if (el.className.indexOf('hasJs') === -1) {
        el.className += el.className ? ' hasJs' : 'hasJs';
      }
    })();
  </script>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"dehydratedState":{"queries":[{},{"state":{"data":{"data":[{"id":"aod_play_area","data":[{"container":{"title":"someShow"},"release":{"date":"2021T9"},"urn":"some:ting","synopses":{"short":"blah"}}]},{"id":"aod_tracks","data":[]}]}}}]}}}}</script>
<script src="https://rmp.files.bbci.co.uk/playspace/js/sounds.something.js" defer="defer"></script>
</div>
`;

describe("scraper", () => {
  beforeEach(() => jest.resetAllMocks());

  describe("extractEpisodeUrls", () => {
    test("returns array of URLs", async () => {
      global.fetch.mockResolvedValue({ text: async () => htmlString });
      const actual = await scraper.extractEpisodeUrls();
      expect(actual.length).toBe(1);
      expect(actual[0]).toContain("https://www.bbc.co.uk/sounds/play/testing");
    });

    test("returns empty array when no URLs found", async () => {
      global.fetch.mockResolvedValue({ text: async () => `<div></div>` });
      const actual = await scraper.extractEpisodeUrls();
      expect(actual.length).toBe(0);
    });
  });

  describe("extractEpisodeMetadata", () => {
    test("can extract valid state", async () => {
      const url = "fake-url";
      global.fetch.mockResolvedValue({ text: async () => htmlStateString });
      const actual = await scraper.extractEpisodeMetadata([url]);

      expect(
        actual[url].props.pageProps.dehydratedState.queries[1].state.data
          .data[0].data[0].container.title,
      ).toEqual("someShow");
      expect(Object.keys(actual).length).toEqual(1);
    });

    test("skips when there is no show data", async () => {
      const url = "fake";
      global.fetch.mockResolvedValue({ text: async () => "" });

      const actual = await scraper.extractEpisodeMetadata([url]);

      expect(actual).toEqual({});
      expect(report).toHaveBeenCalled();
    });

    test("handles malformed JSON gracefully", async () => {
      const url = "fake-url";
      const badJson = '<script id="__NEXT_DATA__">{ invalid json }</script>';
      global.fetch.mockResolvedValue({ text: async () => badJson });

      const actual = await scraper.extractEpisodeMetadata([url]);

      expect(actual).toEqual({});
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON"),
      );
    });
  });

  describe("extractTracklistInfo", () => {
    test("extracts track list data", () => {
      const mockData = require("../../samples/tracks");
      const showMap = { "fake-url": mockData };
      const actual = scraper.extractTracklistInfo(showMap);

      expect(Object.keys(actual)[0]).toEqual("m000s9h5");

      expect(actual.m000s9h5.info.showNameDate).toEqual("Benji B 2021-02-18");
      expect(actual.m000s9h5.info.description).toEqual(
        "slowthai joins Benji for the full 2 hours.",
      );
      expect(actual.m000s9h5.info.spotifyUris.length).toEqual(22);
    });

    test("handles missing queries data", () => {
      const invalidData = { url: { props: {} } };
      const result = scraper.extractTracklistInfo(invalidData);
      expect(result).toEqual({});
      expect(report).toHaveBeenCalledWith(
        "Unable to find queries data in Next.js structure",
      );
    });

    test("handles missing modules data", () => {
      const invalidData = {
        url: {
          props: {
            pageProps: {
              dehydratedState: {
                queries: [{}, { state: { data: { data: [] } } }],
              },
            },
          },
        },
      };
      const result = scraper.extractTracklistInfo(invalidData);
      expect(result).toEqual({});
      expect(report).toHaveBeenCalledWith("Unable to find modules data");
    });

    test("handles missing player or tracklist module", () => {
      const invalidData = {
        url: {
          props: {
            pageProps: {
              dehydratedState: {
                queries: [
                  {},
                  {
                    state: {
                      data: {
                        data: [
                          { id: "wrong_module", data: [] },
                          { id: "another_wrong_module", data: [] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      };
      const result = scraper.extractTracklistInfo(invalidData);
      expect(result).toEqual({});
      expect(report).toHaveBeenCalledWith(
        "Unable to find player or tracklist module",
      );
    });

    test("handles missing show info in player module", () => {
      const invalidData = {
        url: {
          props: {
            pageProps: {
              dehydratedState: {
                queries: [
                  {},
                  {
                    state: {
                      data: {
                        data: [
                          { id: "aod_play_area", data: [] },
                          { id: "aod_tracks", data: [] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      };
      const result = scraper.extractTracklistInfo(invalidData);
      expect(result).toEqual({});
      expect(report).toHaveBeenCalledWith(
        "Unable to find show info in player module",
      );
    });
  });

  describe("handleDuplicateShows", () => {
    test("handles when 2 shows have the same show name", () => {
      const duplicatedData = {
        info: {
          dj: "Benji B",
          showNameDate: "Benji B 2023-09-13",
          description: "Some info",
          spotifyUris: [
            "spotify:track:3XiIO5kw2UxoY6Aph8Tcd5",
            "spotify:track:7qRCVfjifWMt3q2MVfV8mV",
          ],
        },
      };
      const testdata = {
        dupe1: duplicatedData,
        dupe2: duplicatedData,
      };

      const actual = scraper.handleDuplicateShows(testdata);

      expect(Object.keys(actual)).toEqual(["dupe2"]);
    });

    test("throws error when more than 2 duplicates exist", () => {
      const testData = {
        dupe1: {
          info: {
            showNameDate: "Show 2023-01-01",
            spotifyUris: ["a"],
          },
        },
        dupe2: {
          info: {
            showNameDate: "Show 2023-01-01",
            spotifyUris: ["a", "b"],
          },
        },
        dupe3: {
          info: {
            showNameDate: "Show 2023-01-01",
            spotifyUris: ["a", "b", "c"],
          },
        },
      };

      expect(() => scraper.handleDuplicateShows(testData)).toThrow(
        "Cannot choose which duplicate to use",
      );
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining("multiple duplicates"),
      );
    });
  });

  describe("getTracklists()", () => {
    test("produces an object of show data", async () => {
      getShowsConfig.mockReturnValue(["link1", "link2"]);
      global.fetch.mockResolvedValueOnce({ text: async () => htmlString });
      global.fetch.mockResolvedValueOnce({ text: async () => htmlString });
      global.fetch.mockResolvedValueOnce({ text: async () => htmlStateString });
      global.fetch.mockResolvedValueOnce({ text: async () => htmlStateString });

      const result = await scraper.getTracklists();

      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(global.fetch).toHaveBeenNthCalledWith(1, "link1");
      expect(global.fetch).toHaveBeenNthCalledWith(2, "link2");
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        "https://www.bbc.co.uk/sounds/play/testing",
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        4,
        "https://www.bbc.co.uk/sounds/play/testing",
      );
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      expect(result.ting.info).toEqual({
        description: "blah",
        dj: "someShow",
        showNameDate: "someShow 2021",
        spotifyUris: [],
      });
    });
  });
});
