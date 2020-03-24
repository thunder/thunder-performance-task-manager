# Thunder Performance Task Manager

## Services

Task manager has two services.

- API endpoint service
- Worker

**The API endpoint service**

It has purpose to listen on request for running jobs and it will queue tasks in Redis. It's listens by default on port `3000`. It's also protected with Bearer token authentication.

**Worker**

The worker service is there to handle queue tasks in Redis. It will handle them in sequential order.

Worker can handle two types of tasks:

- Warmup
- Run

Warmup task will run warmer to create warmed up container images for Thunder application and database. After warmer has created warmed up docker images, it will also queue run task to run performance tests with newly created images.

Run task will use warmed up container images and run tests on them. After finished runner task, runner will queue next run task for executed performance tests. That means it will run performance test in infinite time.

## How to queue warmup task

To queue new warmup task you have to send POST request to `/warmers` endpoint with required JSON object for warmer task. JSON Object looks like this:

```
{
	"branchTag": "<branch to test>",
	"imageTag": "<image tag for burda/thunder-performance docker image>",
	"composeType": "default"
}
```

Here is an example with CURL command:

```
curl -X POST -k https://localhost:3000/warmers -H 'Authorization: Bearer 123456' -H 'Content-Type: application/json' -d '{"branchTag": "local-test", "imageTag": "local-test", "composeType": "default"}'
```

## How to setup Thunder performance task manager server

**NOTE: This workflow is created on Ubuntu 18.04**

Execute following commands:

```
# Create Thunder PTM user
adduser --disabled-password --gecos "Thunder PTM" thunder-ptm
usermod -aG sudo thunder-ptm
echo "thunder-ptm ALL=(ALL:ALL) NOPASSWD: ALL" | tee -a /etc/sudoers

# Create required groups and add thunder-ptm to these groups
sudo groupadd docker
usermod -aG docker thunder-ptm

sudo usermod -aG systemd-journal thunder-ptm

# Get Git
apt install --yes git

# Checkout repository
su - thunder-ptm --command="git clone https://github.com/thunder/thunder-performance-task-manager.git /home/thunder-ptm/thunder-performance-task-manager"
```

Set correct `ELASTIC_APM_URL` environment variable in file: `/home/thunder-ptm/worker-service.env`. You can use modified command bellow:

```
su - thunder-ptm --command="echo ELASTIC_APM_URL=http://localhost:8200 > /home/thunder-ptm/worker-service.env"
```

After that, you can execute init script with following command:

```
su - thunder-ptm --command="cd /home/thunder-ptm/thunder-performance-task-manager && bash scripts/server-init.sh"
```

## Deploying new code

After you deploy new code, you have to restart services and update crontab definitions. You can do that will following command:

```
bash "${HOME}/thunder-performance-task-manager/scripts/deploy.sh"
```
