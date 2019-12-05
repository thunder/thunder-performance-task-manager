#!/bin/bash
#
# Run pre-warmed thunder performance docker image and database

# The branch tag
BRANCH_TAG=""

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

# Validate - docker-compose config file
if [ -z "${DOCKER_COMPOSE_FILE}" ]; then
    echo "The docker-compose config file is required. Please use '--file' to provide it."

    exit 1
fi

# Set Thunder performance image name as evnironment variable that will be used in docker-compose file
export BRANCH_TAG

# Run docker-compose with provided file
docker-compose --file "${DOCKER_COMPOSE_FILE}" up -d

# Listen on Docker exit event on Thunder performance container (limit waiting time to 15mins => 900secs)
echo "Waiting for runner to finish ..."
EXIT_CODE=$(docker wait "thunder-php-runner-${BRANCH_TAG}")

# Check for the timeout
if [ "${EXIT_CODE}" != "0" ]; then
    echo "The run has failed!"

    # Remove all docker-composer containers and volumes
    docker-compose --file "${DOCKER_COMPOSE_FILE}" down -v

    exit 1
fi

# Remove all docker-composer containers and volumes
docker-compose --file "${DOCKER_COMPOSE_FILE}" down -v
