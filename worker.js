const { exec } = require('child_process');
const queue = require('./queue');

// Get .env configuration
require('dotenv').config();

// Get config.json
const { config } = require('./config');

// Graceful termination flag and handling of system signal
let shouldTerminate = false;
process.on('SIGTERM', () => {
  console.log('Worker received SIGTERM!');
  console.log('It can take several minutes before the worker terminates.');

  shouldTerminate = true;
});

// Build command for different job types
function getCommand(jobData) {
  switch (jobData.type) {
    // WarmUp
    // eslint-disable-next-line max-len
    // ../warmer/build.sh --tag test --image burda/thunder-performance:test --file ../warmer/docker-compose.default.yml
    case 'warmup': {
      const warmerArgs = `--tag ${jobData.branchTag} --image burda/thunder-performance:${jobData.imageTag} --file ${__dirname}/warmer/docker-compose.${jobData.composeType}.yml`;

      return `${__dirname}/warmer/build.sh ${warmerArgs}`;
    }
    // Runner
    // ../runner/build.sh --tag test --file ../runner/docker-compose.default.yml
    case 'run': {
      const runnerArgs = `--tag ${jobData.branchTag} --file ${__dirname}/runner/docker-compose.${jobData.composeType}.yml`;

      return `${__dirname}/runner/build.sh ${runnerArgs}`;
    }
    default:
      throw new Error(`Job type "${jobData}" is not supported.`);
  }
}

// Wrap exec command in Promise
function execCommand(command) {
  console.log('Executing command: ', command);

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      console.log('Command finished with following output:');
      console.log('--- stdout ---');
      console.log(stdout);
      console.log('--- stderr ---');
      console.log(stderr);
      console.log('--- end ---');

      if (error) {
        console.error(`Command execution error: ${error}`);
        reject(error);
      }

      resolve();
    });
  });
}

function loop() {
  if (shouldTerminate) {
    console.log('Worker stopped!');
    process.exit();
  }

  console.log('Worker waiting for job...');
  queue
    .fetch()
    .then(async (jobData) => {
      console.log(`Job data: ${JSON.stringify(jobData)}`);
      await execCommand(getCommand(jobData));

      // Queue next runner job
      const runnerJobData = { ...jobData, type: 'run' };
      console.log(`Added run task: ${JSON.stringify(runnerJobData)}`);
      return queue.push(config.queue.priority.runner, runnerJobData);
    })
    .catch((error) => {
      console.error('Worker loop failed with following error.', error);
    })
    .finally(() => {
      // We will always start next loop.
      loop();
    });
}

// Worker will work in infinite loop.
console.log('Worker started');
loop();
