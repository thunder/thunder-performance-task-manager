// Application configuration
const config = {
  queue: {
    priority: {
      warmer: 10,
      runner: 100
    },
    // 3 days
    defaultExpire: 259200,
    // Fetch time out in seconds. 0 = infinite
    fetchTimeout: 0
  },
  redis: {
    queueName: "thunder-ptm-queue"
  }
};

exports.config = config;
