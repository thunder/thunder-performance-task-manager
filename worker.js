const { exec } = require("child_process");
const queue = require("./queue");

// Get .env configuration
require("dotenv").config();

// Get config.json
const { config } = require("./config");

// Build command for different job types
function getCommand(jobData) {
  switch (jobData.type) {
    // WarmUp
    // ../warmer/build.sh --tag test --image burda/thunder-performance:test --file ../warmer/docker-compose.default.yml
    case "warmup":
      const warmerArgs = `--tag ${jobData.branchTag} --image burda/thunder-performance:${jobData.imageTag} --file ${__dirname}/warmer/docker-compose.${jobData.composeType}.yml`;

      return `${__dirname}/warmer/build.sh ${warmerArgs}`;

    // Runner
    // ../runner/build.sh --tag test --file ../runner/docker-compose.default.yml
    case "run":
      const runnerArgs = `--tag ${jobData.branchTag} --file ${__dirname}/runner/docker-compose.${jobData.composeType}.yml`;

      return `${__dirname}/runner/build.sh ${runnerArgs}`;
    default:
      throw new Error(`Job type "${jobData}" is not supported.`);
  }
}

// Wrap exec command in Promise
function execCommand(command) {
  console.log("Executing command: ", command);

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Command execution error: ${error} - output: ${stderr}`);
        reject(error);
      }

      console.log(`Worker finished: ${stdout}`);
      resolve();
    });
  });
}

function loop() {
  console.log("Worker waiting for job...");

  queue
    .fetch()
    .then(jobData => {
      console.log(`Job data: ${JSON.stringify(jobData)}`);

      // return execCommand(getCommand(jobData)).then(() => {
      return execCommand("sleep 5").then(() => {
        // Queue next runner job
        const runnerJobData = {
          type: "run",
          branchTag: jobData.branchTag,
          composeType: jobData.composeType
        };

        console.log(`Added run task: ${JSON.stringify(runnerJobData)}`);
        return queue.push(config.queue.priority.runner, runnerJobData);
      });
    })
    .catch(error => {
      console.error("Worker loop failed with following error.", error);
    })
    .finally(() => {
      // We will always start next loop.
      loop();
    });
}

// Worker will work in infinite loop.
console.log("Worker started");
loop();
