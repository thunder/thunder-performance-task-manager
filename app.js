const express = require("express");
var fs = require("fs");
const https = require("https");
const passport = require("passport");

const { body: validationResult } = require("express-validator");
const { Strategy: BearerStrategy } = require("passport-http-bearer");

// Routes definitions
const warmersRouter = require("./routes/warmers");
const runnersRouter = require("./routes/runners");

// The queue
const queue = require("./queue");

// Get config.json
const { config } = require("./config");

// Get .env configuration
require("dotenv").config();

// Create express application with parsing of JSON bodies
const app = express();
app.use(express.json());

// Add Logging for every request
app.use((req, res, next) => {
  console.log(`Request on: ${req.originalUrl} - from: ${req.ip}`);

  next();
});

// We will use single Bearer token from .env for all routes
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

    console.log("Unauthorized request!");

    done(null, false);
  })
);
app.all("*", passport.authenticate("bearer", { session: false }));

// Validation errors handler
const validationErrorHandler = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  next();
};

// Add warmer request handler
const postHandler = (req, res, type) => {
  // Use provided values.
  queue
    .push(
      config.queue.priority.warmer,
      {
        type,
        ...req.body
      },
      config.queue.defaultExpire
    )
    .then(() => {
      res.json(type);
    })
    .catch(error => {
      console.log("Failed to add task.", error);
    });
};

// To create warmup task we need following information:
// branchTag - the branch tag used to separate runs
// imageTag - the docker image tag of "burda/thunder-performance" docker
// composeType - the docker composer file type that should be used
app.post(
  "/warmers",
  // Validation and escaping
  warmersRouter.validations,
  // Handle validation errors
  validationErrorHandler,
  // Process request
  (req, res) => {
    postHandler(req, res, "warmup");
  }
);

// To create run task we need following information:
// branchTag - the branch tag used to separate runs
// composeType - the docker composer file type that should be used
app.post(
  "/runners",
  // Validation and escaping
  runnersRouter.validations,
  // Handle validation errors
  validationErrorHandler,
  // Process request
  (req, res) => {
    postHandler(req, res, "run");
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
