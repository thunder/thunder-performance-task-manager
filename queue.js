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
 * 3. we need to queue only branch name with priorities and keep separate STRING value for Job Data
 * 4. we need additional STRING value that keeps TTL for branch.
 *
 * TODO:
 * - unique JobID is now only branch, but maybe we should extend it to use also "composeType"
 */

const Redis = require('ioredis');

// Ensure that .env configuration is loaded
require('dotenv').config();

// Get config.json
const { config } = require('./config');

// Keep single redis connection for process
let redisConnection = null;

/**
 * Get redis connection
 *
 * @returns {object}
 */
const getRedis = () => {
  if (!redisConnection) {
    redisConnection = new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST);
  }

  return redisConnection;
};

/**
 * Get timestamp ordered priority
 *
 * @returns {int}
 */
const getTimestampPriority = (priority) => Date.now() * priority;

/**
 * Get key name for TTL Holder of branch.
 *
 * @returns {string}
 */
const getBranchTTLHolderKey = (branchTag) => `${branchTag}_TTL_HOLDER`;

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
  const redisCommands = [];

  // Push is done in following steps
  const { branchTag } = jobData;

  // 1. set key with branch with TTL - STRING
  if (ttl > 0) {
    redisCommands.push(['set', getBranchTTLHolderKey(branchTag), branchTag, 'ex', ttl]);
  }

  // 2. set key with branch name that contains Job Data (no expire time on it) - STRING
  redisCommands.push(['set', branchTag, JSON.stringify(jobData)]);

  // 3. queue branch with priority - SORTED SET
  redisCommands.push(['zadd', config.redis.queueName, getTimestampPriority(priority), branchTag]);

  return redis.pipeline(redisCommands).exec();
};

/**
 * Fetch next job
 *
 * @returns {Promise}
 */
const fetch = () => {
  const redis = getRedis();

  // Fetching is done in following way
  // 1. Pop next queued branch - SORTED SET
  // BZPOPMIN waits for queue data until available and pops first element (with biggest priority)
  const loopResolver = () => redis
    .bzpopmin(config.redis.queueName, config.queue.fetchTimeout)
  // 2. Get TTL Holder for branch - STRING
  // and Job Data - STRING
  /* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
    .then((result) => {
      if (!result) {
        return Promise.reject(new Error('Fetch wait did timed out.'));
      }

      const branchTag = result[1];
      return redis.mget(getBranchTTLHolderKey(branchTag), branchTag);
    })
    .then(([ttlBranchTag, jobDefinition]) => {
      const jobData = JSON.parse(jobDefinition);

      // If job has expired, we should clean-up Job Data and check for next job.
      if (!ttlBranchTag) {
        redis.del(jobData.branchTag);

        // Returns new Promise for fetch
        return loopResolver();
      }

      return new Promise((resolve) => {
        resolve(jobData);
      });
    });
  return loopResolver();
};

module.exports = {
  push,
  fetch,
};
