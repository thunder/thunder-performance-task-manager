const { body: validateBody } = require("express-validator");
const { default: BeanstalkdClient } = require("beanstalkd");

// Get config.json
const { config } = require("../config");

// Validation and escaping
const validations = [
  validateBody("branchTag")
    .not()
    .isEmpty()
    .trim()
    .escape(),
  validateBody("composeType")
    .not()
    .isEmpty()
    .trim()
    .custom(value => {
      if (!["default"].includes(value)) {
        return Promise.reject("Provided composeType is not supported.");
      }

      return true;
    })
    .escape()
];

// Add runner request handler
const postHandler = (req, res) => {
  // Use provided values.
  let { branchTag, composeType } = req.body;

  // Create connection and add job.
  const bs = new BeanstalkdClient(
    process.env.BEANSTALKD_LISTEN,
    process.env.BEANSTALKD_PORT
  );

  bs.connect()
    .then(() => {
      return bs.use(config.beanstalk.tube);
    })
    .then(() => {
      const jobData = JSON.stringify({
        type: "run",
        branchTag,
        composeType
      });

      console.log(`Added queue with data: ${jobData}`);
      return bs.put(config.queue.priority.runner, 1, 1800, jobData);
    })
    .then(jobId => {
      res.json({ jobId, branchTag, composeType });
    })
    .finally(() => {
      bs.quit();
    });
};

module.exports = {
  validations,
  postHandler
};
