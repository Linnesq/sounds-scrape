const fs = require("fs");
const { isMainThread } = require("worker_threads");
jest.mock("fs");

const { report } = require("./logger");

describe("logger", () => {
  describe("report", () => {
    it("logs to a file", () => {
      report("something");
      expect(fs.appendFileSync).toHaveBeenCalledTimes(1);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("something")
      );
    });
  });
});
