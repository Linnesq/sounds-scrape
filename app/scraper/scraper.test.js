const {
  extractEpisodeUrls,
  extractEpisodeMetadata,
  extractTracklistInfo,
} = require("./scraper");

const fetch = require("node-fetch");
jest.mock("node-fetch");

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
<script> window.__PRELOADED_STATE__ = {"tests": "super cool"}; </script>
<script src="https://rmp.files.bbci.co.uk/playspace/js/sounds.something.js" defer="defer"></script>
</div>
`;

describe("extractEpisodeUrls", () => {
  test("returns array of URLs", async () => {
    fetch.mockResolvedValue({ text: async () => htmlString });
    const actual = await extractEpisodeUrls();
    expect(actual.length).toBe(1);
    expect(actual[0]).toContain("https://www.bbc.co.uk/sounds/play/testing");
  });

  test("returns empty array when no URLs found", async () => {
    fetch.mockResolvedValue({ text: async () => `<div></div>` });
    const actual = await extractEpisodeUrls();
    expect(actual.length).toBe(0);
  });
});

describe("extractEpisodeMetadata", () => {
  test("can extract valid state", async () => {
    const url = "fake-url";
    fetch.mockResolvedValue({ text: async () => htmlStateString });
    const actual = await extractEpisodeMetadata([url]);

    expect(actual[url].tests).toEqual("super cool");
    expect(Object.keys(actual).length).toEqual(1);
  });
});

describe("extractTracklistInfo", () => {
  test("extracts track list data", () => {
    const mockData = require("../../samples/tracks");
    const showMap = { "fake-url": mockData };
    const actual = extractTracklistInfo(showMap);

    expect(Object.keys(actual)[0]).toEqual('m000s9h5');

    expect(actual.m000s9h5.info.showNameDate).toEqual('Benji B 2021-02-18');
    expect(actual.m000s9h5.info.description).toEqual(
      "slowthai joins Benji for the full 2 hours."
    );
    expect(actual.m000s9h5.info.spotifyUris.length).toEqual(25);
  });
});
