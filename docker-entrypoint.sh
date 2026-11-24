#!/bin/sh
# Makes sure the data directory is writable, then runs the app as an unprivileged user.
# PUID / PGID choose that user (default 1000:1000, the image's "node" user).
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
DATA_DIR="${DATA_DIR:-/data}"

if [ "$PUID" = "0" ] || [ "$PGID" = "0" ]; then
	echo "[app] Refusing to run as root: set PUID and PGID to a non-zero user and group." >&2
	exit 1
fi

if [ "$(id -u)" = "0" ]; then
	mkdir -p "$DATA_DIR"
	# Only walk the tree when ownership is wrong, so restarts stay fast on large volumes.
	if [ "$(stat -c %u "$DATA_DIR")" != "$PUID" ] || [ "$(stat -c %g "$DATA_DIR")" != "$PGID" ]; then
		echo "[app] Setting ownership of $DATA_DIR to $PUID:$PGID"
		chown -R "$PUID:$PGID" "$DATA_DIR"
	fi
	chmod 700 "$DATA_DIR"
	exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups -- "$@"
fi

exec "$@"
