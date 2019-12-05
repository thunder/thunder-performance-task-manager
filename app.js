const express = require("express");
var fs = require("fs");
const https = require("https");
const passport = require("passport");

const { body: validateBody, validationResult } = require("express-validator");
const { default: BeanstalkdClient } = require("beanstalkd");
const { Strategy: BearerStrategy } = require("passport-http-bearer");

// Get .env configuration
require("dotenv").config();

// Get config.json
const { config } = require("./config");

// Create express application
const app = express();

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

// We will use single Bearer token from .env
passport.use(
  new BearerStrategy(function(token, done) {
    if (
      process.env.EXPRESS_TOKEN &&
      process.env.EXPRESS_TOKEN.length > 0 &&
      process.env.EXPRESS_TOKEN === token
    ) {
      done(
        null,
        { user: "admin", token: process.env.EXPRESS_TOKEN },
        { scope: "all" }
      );

      return;
    }

    done(null, false);
  })
);

// To create warmup task we need following information:
// branchTag - the branch tag used to separate runs
// imageTag - the docker image tag of "burda/thunder-performance" docker
// composeType - the docker composer file type that should be used
app.post(
  "/add/warmup",
  // Authentication
  passport.authenticate("bearer", { session: false }),
  // Validation and escaping
  [
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
  ],
  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    next();
  },
  // Process request
  (req, res) => {
    // Use provided values.
    let { branchTag, imageTag, composeType } = req.body;

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
          type: "warmup",
          branchTag,
          imageTag,
          composeType
        });

        console.log(`Added queue with data: ${jobData}`);
        return bs.put(config.queue.priority.warmer, 1, 1800, jobData);
      })
      .then(jobId => {
        res.json({ jobId, branchTag, imageTag, composeType });
      })
      .finally(() => {
        bs.quit();
      });
  }
);

// To create run task we need following information:
// branchTag - the branch tag used to separate runs
// composeType - the docker composer file type that should be used
app.post(
  "/add/run",
  // Authentication
  passport.authenticate("bearer", { session: false }),
  // Validation and escaping
  [
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
  ],
  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    next();
  },
  // Process request
  (req, res) => {
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
  }
);

// Use SSL
https
  .createServer(
    {
      key: fs.readFileSync(`${__dirname}/server.key`),
      cert: fs.readFileSync(`${__dirname}/server.cert`)
    },
    app
  )
  .listen(process.env.EXPRESS_PORT, () =>
    console.log(
      `Thunder performance queue API is listening on HTTPS - port ${process.env.EXPRESS_PORT}!`
    )
  );
