const MockApi = require("spotify-web-api-node");
jest.mock("spotify-web-api-node");

const { report } = require("../utils/logger");
jest.mock("../utils/logger");

const fs = require("fs");
jest.mock("fs");

const underTest = require("./auth");

describe("auth.js", () => {
  beforeEach(() => jest.resetAllMocks());

  describe(".init", () => {
    it("refreshes the authToken if it has expired", async () => {
      const mockGetMe = jest.fn();
      MockApi.prototype.getMe = mockGetMe;
      mockGetMe.mockRejectedValue(new Error("uFailed"));

      const mockRefreshToken = jest
        .fn()
        .mockResolvedValue({ body: { access_token: "token" } });
      MockApi.prototype.refreshAccessToken = mockRefreshToken;

      const mockSetToken = jest.fn();
      MockApi.prototype.setAccessToken = mockSetToken;

      const mockGetCredentials = jest.fn().mockReturnValue("creds");
      MockApi.prototype.getCredentials = mockGetCredentials;

      mockFs = jest.fn();
      fs.writeFileSync = mockFs;
      mockFsRead = jest.fn().mockReturnValue("{}");
      fs.readFileSync = mockFsRead;

      // act
      await underTest.init();

      // expect
      expect(mockGetMe).toHaveBeenCalledTimes(1);
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
      expect(mockSetToken).toHaveBeenCalledTimes(1);
      expect(mockSetToken).toHaveBeenCalledWith("token");
      expect(mockGetCredentials).toHaveBeenCalledTimes(1);
      expect(mockFs).toHaveBeenCalledWith(
        "auth.json",
        expect.stringContaining("creds")
      );
    });

    it("initialises if the token is valid", async () => {
      // setup
      const mockGetMe = jest.fn().mockResolvedValue({ stuff: "" });
      MockApi.prototype.getMe = mockGetMe;

      const mockRefreshToken = jest.fn();

      mockFsRead = jest.fn().mockReturnValue("{}");
      fs.readFileSync = mockFsRead;

      // act
      await underTest.init();

      // expect
      expect(mockGetMe).toHaveBeenCalledTimes(1);
      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(report).toHaveBeenCalledWith("init success");
    });
  });

  describe(".initialiseAuthorisation", () => {
    it("saves an authToken when successful", async () => {
      mockFs = jest.fn();
      fs.writeFileSync = mockFs;
      const mockAuthCodeGrant = jest.fn().mockResolvedValue({
        body: {
          access_token: "a-token",
          refresh_token: "r-token",
        },
      });
      mockFsRead = jest.fn().mockReturnValue("{}");
      fs.readFileSync = mockFsRead;

      MockApi.prototype.authorizationCodeGrant = mockAuthCodeGrant;

      const mockSetToken = jest.fn();
      MockApi.prototype.setAccessToken = mockSetToken;

      const mockSetRefreshToken = jest.fn();
      MockApi.prototype.setRefreshToken = mockSetRefreshToken;

      const mockGetCredentials = jest.fn().mockReturnValue({ what: "ever" });
      MockApi.prototype.getCredentials = mockGetCredentials;
      const mockCode = "mockCode";

      await underTest.initialiseAuthorisation(mockCode);

      expect(mockAuthCodeGrant).toHaveBeenCalledWith(mockCode);

      expect(mockSetToken).toHaveBeenCalledWith("a-token");
      expect(mockSetRefreshToken).toHaveBeenCalledWith("r-token");
      expect(mockGetCredentials).toHaveBeenCalledTimes(1);

      expect(mockFs).toHaveBeenCalledWith(
        "auth.json",
        expect.stringContaining("what")
      );
    });
  });

  describe("printAuthorizeUrl", () => {
    it("is called with the correct scopes", () => {
      mockFs = jest.fn().mockReturnValue("{}");
      fs.readFileSync = mockFs;
      const mockCreateAuthUrl = jest.fn();
      MockApi.prototype.createAuthorizeURL = mockCreateAuthUrl;

      underTest.printAuthorizeUrl();

      expect(mockCreateAuthUrl).toHaveBeenCalledWith(
        [
          "playlist-modify-private",
          "playlist-read-private",
          "user-library-read",
          "user-library-modify",
        ],
        "should-appear-on-callback-url"
      );
    });
  });
});
