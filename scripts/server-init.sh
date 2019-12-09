
#!/bin/bash
#
# Init server script

# Deployment directory
export DEPLOYMENT_DIR="/home/${USER}/thunder-ptm"

# Install Docker
sudo apt-get update
sudo apt-get install --yes apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install --yes docker-ce

# Add user to docker group
sudo groupadd docker
sudo usermod -aG docker $USER

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.25.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install NVM and NodeJS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
nvm install --lts node

# Checkout repository
git clone https://github.com/thunder/thunder-performance-task-manager.git "${DEPLOYMENT_DIR}"
cd "${DEPLOYMENT_DIR}"

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
echo "EXPRESS_TOKEN=$(openssl rand -hex 64)" >> "${DEPLOYMENT_DIR}/.env"

# Build project
npm install --prefix "${DEPLOYMENT_DIR}"

# Set .env for Elastic APM
cp "${DEPLOYMENT_DIR}/warmer/.env.example" "${DEPLOYMENT_DIR}/warmer/.env"

# Start Redis
docker run -p 127.0.0.1:6379:6379 --name redis-server -d redis

# Start services
sudo systemctl start thunder-ptm-worker
sudo systemctl start thunder-ptm-service
