#!/usr/bin/env bash

set -euo pipefail

: "${GH_TOKEN:?GitHub token is required.}"
: "${GITHUB_EVENT_NAME:?GitHub event name is required.}"
: "${GITHUB_REPOSITORY:?GitHub repository is required.}"
: "${GITHUB_REPOSITORY_OWNER:?GitHub repository owner is required.}"
: "${GITHUB_SHA:?GitHub SHA is required.}"
: "${MERGE_GROUP_BASE_REF:?Merge group base ref is required.}"
: "${MERGE_GROUP_HEAD_REF:?Merge group head ref is required.}"
: "${MERGE_GROUP_HEAD_SHA:?Merge group head SHA is required.}"

if [ "$GITHUB_EVENT_NAME" != "merge_group" ]; then
  echo "Signed merge admission requires a merge_group event." >&2
  exit 1
fi

if [ "$MERGE_GROUP_BASE_REF" != "refs/heads/main" ]; then
  echo "Merge group does not target protected main." >&2
  exit 1
fi

if [ "$MERGE_GROUP_HEAD_SHA" != "$GITHUB_SHA" ]; then
  echo "Merge group head does not match the checked candidate." >&2
  exit 1
fi

if [[ "$MERGE_GROUP_HEAD_REF" =~ ^refs/heads/gh-readonly-queue/main/pr-([0-9]+)- ]]; then
  pull_request_number="${BASH_REMATCH[1]}"
else
  echo "Merge group head ref does not identify a main pull request." >&2
  exit 1
fi

repository_name="${GITHUB_REPOSITORY#*/}"
# GraphQL variables are bound by gh, not expanded by Bash.
# shellcheck disable=SC2016
if ! queue="$(
  gh api graphql \
    -f query='query($owner: String!, $name: String!, $branch: String!) {
      repository(owner: $owner, name: $name) {
        mergeQueue(branch: $branch) {
          configuration {
            checkResponseTimeout
            maximumEntriesToBuild
            maximumEntriesToMerge
            mergeMethod
            mergingStrategy
            minimumEntriesToMerge
            minimumEntriesToMergeWaitTime
          }
          entries(first: 100) {
            nodes {
              enqueuer { login }
              position
              pullRequest {
                author { login }
                baseRefName
                baseRepository { nameWithOwner }
                headRepository { nameWithOwner }
                number
                state
              }
            }
          }
        }
      }
    }' \
    -f owner="$GITHUB_REPOSITORY_OWNER" \
    -f name="$repository_name" \
    -f branch=main \
    2> /dev/null
)"; then
  echo "Unable to inspect merge queue provenance." >&2
  exit 1
fi

if ! jq -e \
  --argjson pull_request_number "$pull_request_number" \
  --arg repository "$GITHUB_REPOSITORY" \
  '
    .data.repository.mergeQueue as $queue
    | ($queue.entries.nodes
      | map(select(.pullRequest.number == $pull_request_number))) as $matches
    | ($queue.configuration.checkResponseTimeout == 60)
      and ($queue.configuration.maximumEntriesToBuild == 2)
      and ($queue.configuration.maximumEntriesToMerge == 1)
      and ($queue.configuration.mergeMethod == "SQUASH")
      and ($queue.configuration.mergingStrategy == "ALLGREEN")
      and ($queue.configuration.minimumEntriesToMerge == 1)
      and ($queue.configuration.minimumEntriesToMergeWaitTime == 0)
      and ($matches | length == 1)
      and ($matches[0].position as $position
        | all(
          $queue.entries.nodes[];
          (.position > $position)
          or (
            .enqueuer.login == "nabilfatih"
            and .pullRequest.author.login == "nabilfatih"
            and .pullRequest.baseRefName == "main"
            and .pullRequest.baseRepository.nameWithOwner == $repository
            and .pullRequest.headRepository.nameWithOwner == $repository
            and .pullRequest.state == "OPEN"
          )
        ))
  ' <<< "$queue" > /dev/null; then
  echo "Merge group provenance is not trusted for signed acceptance." >&2
  exit 1
fi

echo "Merge group provenance verified for signed acceptance."
