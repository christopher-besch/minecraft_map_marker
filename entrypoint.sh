#!/bin/bash

echo "run MinedMap at $(date)"

cd /minedmap
./minedmap /world/ /web/data/ || echo "MinedMap failed"
