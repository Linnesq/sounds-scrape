const scraper = require("./scraper");

const fetch = require("node-fetch");
jest.mock("node-fetch");

const { getShowsConfig } = require("../config/config");
jest.mock("../config/config");

const fs = require("fs");
jest.mock("fs");
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
<script> window.__PRELOADED_STATE__ = {"tracklist":{"tracks": []},"programmes": {"current": {"container":{"title":"someShow"},"release":{"date": "2021T9"},"urn":"some:ting","synopses":{"short":"blah"} }}}; </script>
<script src="https://rmp.files.bbci.co.uk/playspace/js/sounds.something.js" defer="defer"></script>
</div>
`;

describe("scraper", () => {
  beforeEach(() => jest.resetAllMocks());

  describe("extractEpisodeUrls", () => {
    test("returns array of URLs", async () => {
      fetch.mockResolvedValue({ text: async () => htmlString });
      const actual = await scraper.extractEpisodeUrls();
      expect(actual.length).toBe(1);
      expect(actual[0]).toContain("https://www.bbc.co.uk/sounds/play/testing");
    });

    test("returns empty array when no URLs found", async () => {
      fetch.mockResolvedValue({ text: async () => `<div></div>` });
      const actual = await scraper.extractEpisodeUrls();
      expect(actual.length).toBe(0);
    });
  });

  describe("extractEpisodeMetadata", () => {
    test("can extract valid state", async () => {
      const url = "fake-url";
      fetch.mockResolvedValue({ text: async () => htmlStateString });
      const actual = await scraper.extractEpisodeMetadata([url]);

      expect(actual[url].programmes.current.container.title).toEqual(
        "someShow"
      );
      expect(Object.keys(actual).length).toEqual(1);
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
        "slowthai joins Benji for the full 2 hours."
      );
      expect(actual.m000s9h5.info.spotifyUris.length).toEqual(25);
    });
  });

  describe("getTracklists()", () => {
    test("produces an object of show data", async () => {
      getShowsConfig.mockReturnValue(["link1", "link2"]);
      fetch.mockResolvedValueOnce({ text: async () => htmlString });
      fetch.mockResolvedValueOnce({ text: async () => htmlString });
      fetch.mockResolvedValueOnce({ text: async () => htmlStateString });
      fetch.mockResolvedValueOnce({ text: async () => htmlStateString });

      const result = await scraper.getTracklists();

      expect(fetch).toHaveBeenCalledTimes(4);
      expect(fetch).toHaveBeenNthCalledWith(1, "link1");
      expect(fetch).toHaveBeenNthCalledWith(2, "link2");
      expect(fetch).toHaveBeenNthCalledWith(
        3,
        "https://www.bbc.co.uk/sounds/play/testing"
      );
      expect(fetch).toHaveBeenNthCalledWith(
        4,
        "https://www.bbc.co.uk/sounds/play/testing"
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
