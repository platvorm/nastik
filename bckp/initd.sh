#!/bin/bash
### BEGIN INIT INFO
# Provides:          nastik_autostart
# Required-Start:    $local_fs $remote_fs $network $syslog $netdaemons
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: nastik
# Description:       nastik
### END INIT INFO

DIR=/var/www/nastik.meelak.net
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
NODE_PATH=/usr/local/lib/node_modules
NODE=/usr/bin/node
NAME=nastik

test -x $NODE || exit 0

function start_app {
  NODE_ENV=production nohup "$NODE" "$DIR/index.js" 1>>"/var/log/$NAME.log" 2>&1 &
  echo $! > "/var/run/$NAME.pid"
}

function stop_app {
  kill `cat /var/run/$NAME.pid`
}

case $1 in
  start)
    start_app ;;
  stop)
    stop_app ;;
  restart)
    stop_app
    start_app
    ;;
  *)
    echo "usage: $NAME {start|stop}" ;;
esac
exit 0