// Application configuration
// TODO: Add
const config = {
  queue: {
    priority: {
      warmer: 10,
      runner: 100
    }
  },
  beanstalk: {
    tube: "thunder-performance",
    timeout: 1800
  }
};

exports.config = config;
