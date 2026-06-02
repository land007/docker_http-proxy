#!/bin/bash
/etc/init.d/ssh start &
nohup /analytics.sh > /dev/null 2>&1 &
nohup node /node_/admin-api.js > /tmp/admin-api.log 2>&1 &
supervisor -w /node/ -i node_modules /node/server.js