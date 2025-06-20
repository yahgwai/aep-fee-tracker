#!/bin/bash
# Script to collect all PR comments (direct and review comments) for a given PR
# Usage: ./collect-pr-comments.sh <owner> <repo> <pr_number>
# Example: ./collect-pr-comments.sh yahgwai aep-fee-tracker 127

set -e

# Check if required arguments are provided
if [ $# -ne 3 ]; then
    echo "Usage: $0 <owner> <repo> <pr_number>"
    echo "Example: $0 yahgwai aep-fee-tracker 127"
    exit 1
fi

OWNER=$1
REPO=$2
PR_NUMBER=$3

# Get PR comments
echo "Fetching PR comments..." >&2
pr_comments=$(gh api "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments" --paginate | jq '[.[] | {url: .html_url, body: .body}]')

# Get review comments
echo "Fetching review comments..." >&2
review_ids=$(gh api "repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews" --paginate | jq -r '.[].id')

review_comments="[]"
if [ -n "$review_ids" ]; then
    review_comments=$(echo "$review_ids" | while read -r review_id; do
        if [ -n "$review_id" ]; then
            gh api "repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews/$review_id/comments" 2>/dev/null | jq '[.[] | {url: .html_url, body: .body}]' || echo "[]"
        fi
    done | jq -s 'add // []')
fi

# Combine and output
echo "Combining results..." >&2
echo "$pr_comments" "$review_comments" | jq -s 'add | sort_by(.url) | unique_by(.url)'