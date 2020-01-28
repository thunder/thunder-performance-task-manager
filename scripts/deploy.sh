#!/bin/bash
#
# Deployment script.

# Restart services
sudo systemctl restart thunder-ptm-service.service
sudo systemctl restart thunder-ptm-worker.service

# Update crontab
echo "2 2 * * * systemd-cat -t \"docker-prune\" bash ${HOME}/scripts/docker-prune.sh" >"${HOME}/.crontab"
crontab "${HOME}/.crontab"
