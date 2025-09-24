#!/bin/bash

# Easy command runner for containerized development
# Usage: ./run-in-container.sh "your command here"

if [ -z "$1" ]; then
    echo "Usage: ./run-in-container.sh 'command'"
    echo "Example: ./run-in-container.sh 'npm install express'"
    exit 1
fi

docker exec mcp-dev bash -c "$1"
