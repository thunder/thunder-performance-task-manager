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
  validateBody("imageTag")
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

// Add warmer request handler
const postHandler = (req, res) => {
  // Use provided values.
  let { branchTag, imageTag, composeType } = req.body;

  queue
    .push(
      config.queue.priority.warmer,
      {
        type: "warmup",
        branchTag,
        imageTag,
        composeType
      },
      config.queue.defaultExpire
    )
    .then(() => {
      res.json({ success: true });
    })
    .catch(error => {
      console.log("Failed to add task.", error);
    });
};

module.exports = {
  validations,
  postHandler
};
