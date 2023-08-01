#!/bin/bash


#get the current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Runnnig the tests"

#if arg 1 is podman
if [ "$1" == "podman" ]; then
    echo "Running podman containers"
    sh $DIR/kong-podman.sh start --clean
    echo "Running the tests"
    npm run test
    echo "stoping the containers"
    sh $DIR/kong-podman.sh stop
    exit 0
else
    echo "Running docker containers"
    sh $DIR/kong-docker.sh start --clean
    npm run test
    echo "stoping the containers"
    sh $DIR/kong-docker.sh stop
    exit 0
fi
