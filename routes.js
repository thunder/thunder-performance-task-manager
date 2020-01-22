const { check, validationResult } = require("express-validator");

// The queue
const queue = require("./queue");

// Get config.json
const { config } = require("./config");

// Validation and escaping
const validate = method => {
  const validations = [
    check("branchTag")
      .not()
      .isEmpty()
      .trim()
      .escape(),
    check("composeType")
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

  switch (method) {
    case "runners": {
      return validations;
    }
    case "warmers": {
      return [
        ...validations,
        check("imageTag")
          .not()
          .isEmpty()
          .trim()
          .escape()
      ];
    }
  }
};

// Validation errors handler
const validationErrorHandler = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  next();
};

// Request handler
const postHandler = (req, res, type) => {
  // Use provided values.
  let priority = 0;
  if (type == "run") {
    priority = config.queue.priority.runner;
  } else if (type == "warmup") {
    priority = config.queue.priority.warmer;
  }
  queue
    .push(
      priority,
      {
        type,
        ...req.body
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
  validate,
  validationErrorHandler,
  postHandler
};
