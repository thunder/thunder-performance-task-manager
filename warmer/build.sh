#!/bin/bash
#
# Build warmed up thunder performance docker image and database

# The branch tag
BRANCH_TAG=""

# The Thunder performance image name
# Example: burda/thunder-performance:8.x-4.x-261121505
THUNDER_PERFORMANCE_IMAGE_NAME=""

# The docker-compose config file
# Example: docker-compose.yml
DOCKER_COMPOSE_FILE=""

# Process script options
while [ -n "$1" ]; do
    case "$1" in
    --tag)
        # Get param - Branch tag
        BRANCH_TAG="$2"

        shift
        ;;
    --image)
        # Get param - Thunder performance image name
        THUNDER_PERFORMANCE_IMAGE_NAME="$2"

        shift
        ;;
    --file)
        # Get param - docker-compose config file
        DOCKER_COMPOSE_FILE="$2"

        shift
        ;;

    *) echo "Option $1 not recognized." ;;
    esac

    shift
done

# Validate - Branch tag
if [ -z "${BRANCH_TAG}" ]; then
    echo "The Branch tag is required. Please use '--tag' to provide it."

    exit 1
fi

# Validate - Thunder performance image name
if [ -z "${THUNDER_PERFORMANCE_IMAGE_NAME}" ]; then
    echo "The Thunder performance image name is required. Please use '--image' to provide it."

    exit 1
fi

# Validate - docker-compose config file
if [ -z "${DOCKER_COMPOSE_FILE}" ]; then
    echo "The docker-compose config file is required. Please use '--file' to provide it."

    exit 1
fi

# Set Thunder performance image name as evnironment variable that will be used in docker-compose file
export BRANCH_TAG
export THUNDER_PERFORMANCE_IMAGE_NAME

# Export environment for docker-compose
ELASTIC_APM_URL=${ELASTIC_APM_URL:-"http://localhost:8200"}
export ELASTIC_APM_URL

# Run docker-compose with provided file
docker-compose --file "${DOCKER_COMPOSE_FILE}" up -d

# Listen on Docker exit event on Thunder performance container (TODO: limit waiting time to 15mins)
echo "Waiting for warmup build to finish ..."
EXIT_CODE=$(docker wait "warmer-thunder-php-${BRANCH_TAG}")

# Check for the timeout
if [ "${EXIT_CODE}" != "0" ]; then
    echo "The warmup build failed!"

    # Remove all docker-composer containers and volumes
    docker-compose --file "${DOCKER_COMPOSE_FILE}" down --volumes

    exit 1
fi

# Stop all containers and persist warm images
docker-compose --file "${DOCKER_COMPOSE_FILE}" stop

# Persist database and Thunder performance container
docker commit "warmer-db-${BRANCH_TAG}" "warm-db:${BRANCH_TAG}"
docker commit "warmer-thunder-php-${BRANCH_TAG}" "warm-thunder-php:${BRANCH_TAG}"

# Remove all docker-composer containers and volumes
docker-compose --file "${DOCKER_COMPOSE_FILE}" down --volumes
