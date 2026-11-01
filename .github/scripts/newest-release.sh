#!/bin/sh
# Says whether release X.Y.Z is the newest vX.Y.Z tag on a remote (origin,
# unless another is given), so that only the newest moves the image's
# :latest. Pre-releases like v0.1.0-rc.1 aren't releases, and versions
# compare by their numbers, so v0.0.10 is newer than v0.0.9. Prints a line
# for the log, and latest=true or latest=false to $GITHUB_OUTPUT when
# there is one (test/newest-release.test.js).
#
#   .github/scripts/newest-release.sh 0.0.3 [remote]
set -eu

version=$1
remote=${2:-origin}

newest=$(git ls-remote --tags --refs "$remote" 'v*' | sed 's|.*refs/tags/||' \
  | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
if [ "v$version" = "$newest" ]; then latest=true; else latest=false; fi
echo "v$version is the newest release: $latest (newest is $newest)"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "latest=$latest" >> "$GITHUB_OUTPUT"; fi
