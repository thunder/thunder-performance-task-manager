
#!/bin/bash
#
# Init server script

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

# Install Redis
sudo apt-get install --yes redis

# Add certificates
openssl req -nodes -new -x509 -keyout ../server.key -out ../server.cert -subj "/C=DE/ST=Bavaria/L=Munich/O=Thunder/OU=Thunder"

# Install systemd services from project
sudo cp thunder-ptm-worker.service /etc/systemd/system
sudo cp thunder-ptm-service.service /etc/systemd/system

sudo systemctl enable thunder-ptm-worker
sudo systemctl enable thunder-ptm-service

sudo systemctl start thunder-ptm-worker
sudo systemctl start thunder-ptm-service
