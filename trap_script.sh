#!/bin/bash

# This is the script the server runs.

cp -r /minedmap/minecraft_map_marker/* /web/
# This is where the MinedMap renderer places its files.
mkdir -p /web/data

# await SIGHUP and then run MinedMap
trap 'bash /minedmap/entrypoint.sh' HUP
while :; do
    sleep 10 & wait ${!}
done
