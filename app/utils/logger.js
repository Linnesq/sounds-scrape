const fs = require("fs");

const startTime = Date.now();

const report = (text) => {
  const message = `${Date()} - ${text}\n`;
  console.log(message);
  fs.appendFileSync(`${startTime}.log`, message);
};

module.exports = { report };
