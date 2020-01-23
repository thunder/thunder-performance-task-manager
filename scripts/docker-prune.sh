#!/bin/bash
#
# Prune docker images

### 1. Prune dangling images
echo "Prune dangling images"
docker image prune --force

### 2. Remove old warm-db images
# Retention period threshold for image pruning
# We are using format "+%F %T %z %Z" - because it's same for Docker "{{.CreatedAt}}"
THRESHOLD_TIME=$(date --utc --date="-7 days" "+%F %T %z %Z")

# First function param should be repository name for warm images (fe. warm-db, warm-thunder-php, etc.)
function prune_warm_images() {
    while IFS= read -r IMAGE_LS_LINE; do
        # Get image ID and create time from "docker image ls" command
        IFS=' ' read -r IMAGE_ID CREATE_TIME <<<"${IMAGE_LS_LINE}"

        # Remove image if crate time is older then retention period threshold
        if [[ "${THRESHOLD_TIME}" > "${CREATE_TIME}" ]]; then
            echo "Removing image: ${IMAGE_ID}"

            # Referenced images will not be removed.
            # For example: if image "repo1:tag1" reference image "repo2:tag2", then it's not possible to remove "repo2:tag2"
            docker image rm "${IMAGE_ID}"
        fi
    done <<<"$(docker image ls "${1}" --format "{{.ID}} {{.CreatedAt}}")"
}

prune_warm_images "warm-db"
prune_warm_images "warm-thunder-php"
prune_warm_images "burda/thunder-performance"
