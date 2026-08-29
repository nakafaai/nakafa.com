#!/bin/sh

set -u

package_name=${1-}
case "$package_name" in
  api | mcp | www) ;;
  *) exit 1 ;;
esac

if [ "${VERCEL_ENV-}" != "production" ]; then
  exit 0
fi

base_revision=${VERCEL_GIT_PREVIOUS_SHA-}
head_revision=${VERCEL_GIT_COMMIT_SHA-}
if [ -z "$base_revision" ] || [ -z "$head_revision" ]; then
  exit 1
fi

repository_root=$(git rev-parse --show-toplevel) || exit 1

git -C "$repository_root" diff --quiet "$base_revision...$head_revision" --
change_status=$?
case "$change_status" in
  0) exit 1 ;;
  1) ;;
  *) exit 1 ;;
esac

production_required=false
git -C "$repository_root" diff --quiet --diff-filter=ACDRTUXB \
  "$base_revision...$head_revision" --
non_modification_status=$?
case "$non_modification_status" in
  0) ;;
  1) production_required=true ;;
  *) exit 1 ;;
esac

if [ "$production_required" = "false" ]; then
  git -C "$repository_root" diff --quiet --diff-filter=M \
    "$base_revision...$head_revision" -- \
    . ':(exclude)**/*.test.ts' ':(exclude)*.test.ts'
  non_test_status=$?
  case "$non_test_status" in
    0) exit 0 ;;
    1) ;;
    *) exit 1 ;;
  esac
fi

exec turbo query affected \
  --base="$base_revision" \
  --packages "$package_name" \
  --exit-code
