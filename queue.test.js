/**
 * Queue tests with Redis backend.
 *
 * We need following functionality from queue:
 * 1. Order by priority (1st order)
 * 2. Order by time of adding (2nd order)
 * 3. Unique branches in queue
 * 4. Time to live for queued branches
 */

const Docker = require("dockerode");
const Redis = require("ioredis");

// Testing package.
const queue = require("./queue");

// Start Redis Docker container.
let redisContainer;
let redisConnection;
beforeAll(async () => {
  try {
    const docker = new Docker();

    // Fetch Redis docker image from DockerHub.
    const stream = await docker.createImage({ fromImage: "redis:alpine" });
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) =>
        err ? reject(err) : resolve(res)
      );
    });

    // Start Redis docker container.
    redisContainer = await docker.createContainer({
      Image: "redis:alpine",
      HostConfig: {
        PortBindings: {
          "6379/tcp": [
            {
              HostPort: "6380"
            }
          ]
        }
      }
    });
    await redisContainer.start();
    console.log("Redis container is ready on port: 6380");

    // Set env variables for Redis connection in Queue.
    process.env.REDIS_PORT = 6380;
    process.env.REDIS_HOST = "127.0.0.1";

    // Create Redis connection.
    redisConnection = new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST);
  } catch (error) {
    console.log("beforeAll", error);
  }
}, 10000);

// Remove Redis Docker container.
afterAll(async () => {
  try {
    await redisContainer.stop();
    await redisContainer.remove();

    console.log("Redis container is removed.");
  } catch (error) {
    console.log("afterAll", error);
  }
}, 10000);

// Clean up Redis before every test.
beforeEach(async () => {
  await redisConnection.flushall();
});

// Test Queue - with Redis background
describe("queue", () => {
  it("queue should be defined", () => {
    expect(queue).toBeDefined();
  });

  it("we should be able to push in queue", async () => {
    await expect(
      queue.push(10, { branchTag: "test_push" }, 1)
    ).resolves.toEqual([
      [null, "OK"],
      [null, 1]
    ]);
  });

  it("we should be able to fetch from queue", async () => {
    await queue.push(1, { branchTag: "test_fetch" }, 100).then(() => {
      return expect(queue.fetch()).resolves.toEqual({
        branchTag: "test_fetch"
      });
    });
  });

  it("priority should be primary sort ordering", async () => {
    await queue
      .push(2, { branchTag: "priority_2" }, 100)
      .then(() => {
        return queue.push(1, { branchTag: "priority_1" }, 100);
      })
      .then(() => {
        return expect(queue.fetch()).resolves.toEqual({
          branchTag: "priority_1"
        });
      });
  });

  it("push time should be secondary sort ordering", async () => {
    await queue
      .push(1, { branchTag: "time_1" }, 100)
      .then(() => {
        return queue.push(1, { branchTag: "time_2" }, 100);
      })
      .then(() => {
        return expect(queue.fetch()).resolves.toEqual({
          branchTag: "time_1"
        });
      });
  });

  it("branch tags in queue should be unique", async () => {
    await queue
      .push(1, { branchTag: "branch_1", dummy: "push_1" }, 100)
      .then(() => {
        return queue.push(1, { branchTag: "branch_1", dummy: "push_2" }, 100);
      })
      .then(() => {
        return expect(queue.fetch()).resolves.toEqual({
          branchTag: "branch_1",
          dummy: "push_2"
        });
      });
  });

  it("queue should support TTL", async () => {
    await queue
      .push(1, { branchTag: "ttl_2" }, 2)
      .then(() => {
        return expect(queue.fetch()).resolves.toEqual({
          branchTag: "ttl_2"
        });
      })
      .then(() => {
        return queue.push(1, { branchTag: "ttl_2" }, 2);
      })
      .then(() => {
        return queue.push(100, { branchTag: "low_priority_ttl_100" }, 100);
      })
      .then(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve();
          }, 2000);
        });
      })
      .then(() => {
        return expect(queue.fetch()).resolves.toEqual({
          branchTag: "low_priority_ttl_100"
        });
      });
  }, 5000);
});
