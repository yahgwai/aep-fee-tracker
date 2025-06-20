#!/bin/bash
# Script to collect all PR comments (direct and review comments) for a given PR and generate gh cli commands
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

# Get PR comments and generate gh commands
echo "Fetching PR comments..." >&2
pr_commands=$(gh api "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments" --paginate | jq -r --arg owner "$OWNER" --arg repo "$REPO" '.[] | "gh api repos/\($owner)/\($repo)/pulls/comments/\(.id)"')

# Get review comments and generate gh commands
echo "Fetching review comments..." >&2
review_ids=$(gh api "repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews" --paginate | jq -r '.[].id')

review_commands=""
if [ -n "$review_ids" ]; then
    review_commands=$(echo "$review_ids" | while read -r review_id; do
        if [ -n "$review_id" ]; then
            gh api "repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews/$review_id/comments" 2>/dev/null | jq -r --arg owner "$OWNER" --arg repo "$REPO" '.[] | "gh api repos/\($owner)/\($repo)/pulls/comments/\(.id)"' || true
        fi
    done)
fi

# Combine all commands and remove duplicates
echo "Combining commands..." >&2
{
    echo "$pr_commands"
    echo "$review_commands"
} | grep -v '^$' | sort -u