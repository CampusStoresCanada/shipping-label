#!/bin/bash
set -a
source .env.local
set +a
npx tsx test-pickup.ts
