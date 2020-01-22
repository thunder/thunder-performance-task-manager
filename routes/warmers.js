const { body: validateBody } = require("express-validator");

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

module.exports = {
  validations
};
