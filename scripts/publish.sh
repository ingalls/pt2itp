#!/bin/bash

set -eo pipefail

if [[ -z ${CIRCLE_TAG} ]]; then
  echo "ok - No tag, skipping release."
  exit
fi

echo "ok - Publishing release."

export NODE_PRE_GYP_GITHUB_TOKEN=$(node ./scripts/token.js ${GITHUB_APP_PREFIX})
if [[ -z ${NODE_PRE_GYP_GITHUB_TOKEN} ]]; then
  echo "not ok - Unable to retrieve GitHub token."
  exit 1
fi

yarn package
