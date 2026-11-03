#!/bin/sh
# Stops a release that's already on Docker Hub from being pushed again, so
# that an image people have pulled can't change under them. Only the
# registry saying there's no such tag lets a push go ahead: anything else,
# like the registry being down, stops it too, since it can't be known that
# the tag is free (test/newest-release.test.js).
#
#   .github/scripts/unpushed-release.sh jzheaux/reader 0.0.3
set -u

image=$1
version=$2

if said=$(docker buildx imagetools inspect "$image:$version" 2>&1); then
  echo "::error::$image:$version is already pushed, and is left as it is"
  exit 1
fi
case "$said" in
  *": not found"*) echo "$image:$version isn't pushed yet" ;;
  *)
    echo "$said"
    echo "::error::Couldn't tell whether $image:$version is already pushed"
    exit 1
    ;;
esac
