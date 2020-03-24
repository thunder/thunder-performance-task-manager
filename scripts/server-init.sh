#!/bin/bash
#
# Init server script

# Define used software versions
export DOCKER_COMPOSE_VERSION="1.25.3"
export NVM_VERSION="v0.35.2"

# Deployment directory
export DEPLOYMENT_DIR="${HOME}/thunder-performance-task-manager"

# Install Docker
sudo apt update
sudo apt install --yes apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install --yes docker-ce

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install NVM and NodeJS
curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
export NVM_DIR="${HOME}/.nvm"
# shellcheck source=/dev/null
[ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh"
nvm install --lts node

# Switch to deployed directory
cd "${DEPLOYMENT_DIR}" || exit

# Add certificates
openssl req -nodes -new -x509 -keyout "${DEPLOYMENT_DIR}/server.key" -out "${DEPLOYMENT_DIR}/server.cert" -subj "/C=DE/ST=Bavaria/L=Munich/O=Thunder/OU=Thunder"

# Install systemd services from project
sudo cp "${DEPLOYMENT_DIR}/scripts/thunder-ptm-worker.service" /etc/systemd/system
sudo cp "${DEPLOYMENT_DIR}/scripts/thunder-ptm-service.service" /etc/systemd/system

sudo systemctl enable thunder-ptm-worker
sudo systemctl enable thunder-ptm-service

# Set .env
cp "${DEPLOYMENT_DIR}/.env.example" "${DEPLOYMENT_DIR}/.env"

# Generate TOKEN
echo "EXPRESS_TOKEN=$(openssl rand -hex 64)" >>"${DEPLOYMENT_DIR}/.env"

# Build project
npm install --prefix "${DEPLOYMENT_DIR}"

# Start Redis
docker run -p 127.0.0.1:6379:6379 --name redis-server -d redis

# Start services
sudo systemctl restart thunder-ptm-worker
sudo systemctl restart thunder-ptm-service

# Create crontab
echo "2 2 * * * systemd-cat -t \"docker-prune\" bash ${DEPLOYMENT_DIR}/scripts/docker-prune.sh" >"${DEPLOYMENT_DIR}/.crontab"
crontab "${DEPLOYMENT_DIR}/.crontab"
