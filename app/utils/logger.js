const fs = require("fs");

const startTime = Date.now();

const report = (text) => {
  const message = `${new Date().toISOString()} - ${text}`;
  console.log(message);
  fs.appendFileSync(`${startTime}.log`, `${message}\n`);
};

module.exports = { report };
