const auth = require("./spotify/auth");
const { report } = require("./utils/logger");

const commands = {
  login: () => auth.login(),
  "check-auth": () => auth.checkAuth(),
  "auth-url": () => auth.printAuthorizeUrl(),
  authenticate: (code) => auth.initialiseAuthorisation(code),
};

/**
 * Runs one Spotify auth command, e.g. `node app/cli.js login`.
 * Returns the process exit code.
 */
const run = async ([name, ...args]) => {
  const command = commands[name];
  if (!command) {
    console.error(
      `Usage: node app/cli.js <${Object.keys(commands).join("|")}> [args]`,
    );
    return 1;
  }

  try {
    await command(...args);
    return 0;
  } catch (error) {
    report(`${name} failed: ${error.message}`);
    return 1;
  }
};

if (require.main === module) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}

module.exports = { run };
