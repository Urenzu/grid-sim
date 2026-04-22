#!/bin/sh
set -e

echo "Syncing historical data from R2..."
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
aws s3 sync "s3://${R2_BUCKET}/" /data/ \
    --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    --region auto \
    --no-progress
echo "R2 sync complete."

exec ./server --data-dir /data
