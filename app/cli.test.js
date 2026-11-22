const { run } = require("./cli");

const auth = require("./spotify/auth");
jest.mock("./spotify/auth");

const { report } = require("./utils/logger");
jest.mock("./utils/logger");

describe("cli", () => {
  beforeEach(() => jest.resetAllMocks());

  it.each([
    ["login", "login"],
    ["check-auth", "checkAuth"],
    ["auth-url", "printAuthorizeUrl"],
  ])("runs %s", async (command, fn) => {
    expect(await run([command])).toBe(0);
    expect(auth[fn]).toHaveBeenCalledTimes(1);
  });

  it("passes the code to authenticate", async () => {
    expect(await run(["authenticate", "the-code"])).toBe(0);
    expect(auth.initialiseAuthorisation).toHaveBeenCalledWith("the-code");
  });

  it("reports a failure in one line and returns exit code 1", async () => {
    auth.checkAuth.mockRejectedValue(new Error("Invalid refresh token"));

    expect(await run(["check-auth"])).toBe(1);
    expect(report).toHaveBeenCalledWith(
      "check-auth failed: Invalid refresh token",
    );
  });

  it("prints usage and returns exit code 1 for an unknown command", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(await run(["nope"])).toBe(1);
    expect(error).toHaveBeenCalledWith(
      "Usage: node app/cli.js <login|check-auth|auth-url|authenticate> [args]",
    );
    error.mockRestore();
  });
});
