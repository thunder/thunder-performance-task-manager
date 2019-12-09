const { default: BeanstalkdClient } = require("beanstalkd");

// Get config.json
const { config } = require("./config");

// Get worker
const getWorker = () => {
  return new BeanstalkdClient(
    process.env.BEANSTALKD_LISTEN,
    process.env.BEANSTALKD_PORT
  );
};

// TODO:
// We need following functionality
// 1. Order by priority (1st order)
// 2. Order by time of adding (2nd order)
// 3. Unique branches in queue
// 4. Time to live for queued branches
// --
// With Redis we can achieve these functionalities
// 1. out of box with sorted sets
// 2. we need to work around priority and use timestamp with +/- priority times
// 3. we need to queue only branch name and compose type, to have unique values over different builds
// 4. we need additionally key-value entry with TTL on it for every branch

/**
 * Add new job
 *
 * @param {int} priority
 * @param {object} jobData
 *
 * @returns {Promise}
 */
const push = (priority, jobData) => {
  const worker = getWorker();

  return worker
    .connect()
    .then(() => {
      return worker.use(config.beanstalk.tube);
    })
    .then(() => {
      const jobDataString = JSON.stringify(jobData);

      console.log(`Added queue with data: ${jobDataString}`);
      return worker.put(priority, 1, 1800, jobDataString);
    })
    .finally(() => {
      worker.quit();
    });
};

/**
 * Fetch next job
 *
 * @returns {Promise}
 */
const fetch = () => {
  const worker = getWorker();

  return worker
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
      return worker
        .reserveWithTimeout(config.beanstalk.timeout)
        .spread((reserveId, body) => {
          console.log(`Processing JobID: ${reserveId}`);
          worker.destroy(reserveId);

          return new Promise((resolve, reject) => {
            resolve(JSON.parse(body.toString()));
          });
        });
    })
    .catch(error => {
      if (error.message === "TIMED_OUT") {
        return console.log("Wait timed out.");
      }

      console.log("Queue error.", error);
    })
    .finally(() => {
      worker.quit();
    });
};

module.exports = {
  push,
  fetch
};
