const { default: BeanstalkdClient } = require("beanstalkd");
const { exec } = require("child_process");
const path = require("path");

// Get .env configuration
require("dotenv").config();

// Get config.json
const { config } = require("./config");

// Beanstalk client
const worker = new BeanstalkdClient(
  process.env.BEANSTALKD_LISTEN,
  process.env.BEANSTALKD_PORT
);

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

  // Worker will wait for next job.
  worker
    .reserveWithTimeout(config.beanstalk.timeout)
    .spread((reserveId, body) => {
      console.log(`Processing JobID: ${reserveId}`);
      worker.destroy(reserveId);

      const jobData = JSON.parse(body.toString());
      console.log(`Job data: ${body.toString()}`);

      return execCommand(getCommand(jobData)).then(() => {
        // Queue next runner job
        const runnerJobData = JSON.stringify({
          type: "run",
          branchTag: jobData.branchTag,
          composeType: jobData.composeType
        });

        console.log(`Added run task with data: ${runnerJobData}`);
        return worker.put(config.queue.priority.runner, 1, 1800, runnerJobData);
      });
    })
    .catch(error => {
      if (error.message === "TIMED_OUT") {
        return console.log("Wait timed out.");
      }

      console.error("Worker loop failed with error.", error);
    })
    .finally(() => {
      // We will always start next loop.
      loop();
    });
}

// Worker will work in infinite loop.
worker
  .connect()
  .then(() => {
    return worker.use(config.beanstalk.tube);
  })
  .then(() => {
    return worker.watch(config.beanstalk.tube);
  })
  .then(() => {
    return worker.ignore("default");
  })
  .then(() => {
    console.log("Worker started");
    loop();
  })
  .catch(error => {
    console.error("Worker init failed with error.", error);
  });
