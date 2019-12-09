const { body: validateBody } = require("express-validator");
const queue = require("../queue");

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

  queue
    .push(config.queue.priority.runner, {
      type: "run",
      branchTag,
      composeType
    })
    .then(() => {
      res.json({ success: true });
    });
};

module.exports = {
  validations,
  postHandler
};
