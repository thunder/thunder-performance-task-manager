/**
 * Implementation of queue with Redis as backend
 *
 * We need following functionality from queue:
 * 1. Order by priority (1st order)
 * 2. Order by time of adding (2nd order)
 * 3. Unique branches in queue
 * 4. Time to live for queued branches
 *
 * With Redis we can achieve these functionalities:
 * 1. out of box with SORTED SETS
 * 2. we need to work around priority and use timestamp with multiplying it with priority
 * 3. we need to queue only branch name with priorities
 * 4. we need additional STRING value that contains job data for branch. That value should have TTL
 *
 * TODO:
 * - unique JobID is now only branch, but maybe we should extend it to use also "composeType"
 */

const Redis = require("ioredis");

// Ensure that .env configuration is loaded
require("dotenv").config();

// Get config.json
const { config } = require("./config");

/**
 * Get redis connection
 *
 * @returns {object}
 */
getRedis = () => {
  return new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST);
};

/**
 * Get timestamp ordered priority
 *
 * @returns {int}
 */
getTimestampPriority = priority => {
  return Date.now() * priority;
};

/**
 * Add new job
 *
 * @param {int} priority
 * @param {object} jobData
 *
 * @returns {Promise}
 */
const push = (priority, jobData, ttl = 0) => {
  const redis = getRedis();

  // We are going to execute all commands in one pipeline
  let redisCommands = [];

  // Push is done in following steps
  const { branchTag } = jobData;

  // 1. set key with branch containing jobInfo with TTL - STRING
  // when TTL is not provided, we are not going to set new job data
  if (ttl > 0) {
    redisCommands.push(["set", branchTag, JSON.stringify(jobData), "ex", ttl]);
  }

  // 2. queue branch with priority - SORTED SET
  redisCommands.push([
    "zadd",
    config.redis.queueName,
    getTimestampPriority(priority),
    branchTag
  ]);

  return redis.pipeline(redisCommands).exec();
};

/**
 * Fetch next job
 *
 * @returns {Promise}
 */
const fetch = () => {
  const redis = getRedis();

  const loopResolver = () => {
    // Fetching is done in following way
    // 1. Pop next queued branch - SORTED SET
    // BZPOPMIN waits for queue data until available and pops first element (with biggest priority)
    return redis
      .bzpopmin(config.redis.queueName, config.queue.fetchTimeout)
      .then(([_, branchTag]) => {
        // 2. Get job data for branch - STRING
        return redis.get(branchTag);
      })
      .then(result => {
        // If job data is not available for branch we are going to check for next job
        if (!result) {
          return loopResolver();
        }

        return new Promise(resolve => {
          resolve(JSON.parse(result));
        });
      });
  };

  return loopResolver();
};

module.exports = {
  push,
  fetch
};
