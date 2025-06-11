#!/bin/bash
# ABOUTME: Safe wrapper for GitHub CLI that prevents merges and Claude/AI references
# ABOUTME: Checks all text content before executing gh commands

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to check for prohibited content
check_prohibited_content() {
    local content="$1"
    local context="$2"
    
    # Check for Claude/AI references (matching commit-msg hook patterns)
    if echo "$content" | grep -iE "claude code|claude\.ai/code|Generated with.*Claude|Claude|AI|Anthropic|artificial intelligence|language model|LLM" > /dev/null 2>&1; then
        echo -e "${RED}Error: $context contains prohibited AI/Claude references${NC}"
        echo "Please remove any Claude, AI, or Anthropic references"
        return 1
    fi
    
    # Check for emoji patterns that might indicate AI-generated content
    if echo "$content" | grep -E "🤖|🧠|🤯|Generated with|Auto-generated" > /dev/null 2>&1; then
        echo -e "${RED}Error: $context contains patterns suggesting AI-generated content${NC}"
        echo "Please remove any auto-generation indicators"
        return 1
    fi
    
    return 0
}

# Function to check if command is a merge operation
is_merge_command() {
    # Check for pr merge
    if [[ "$1" == "pr" && "$2" == "merge" ]]; then
        return 0
    fi
    
    # Check for repo merge
    if [[ "$1" == "repo" && "$2" == "merge" ]]; then
        return 0
    fi
    
    # Check for api calls that might perform merges
    if [[ "$1" == "api" ]] && echo "${@:2}" | grep -iE "merge|pulls/[0-9]+/merge" > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Check if it's a merge command
if is_merge_command "$@"; then
    echo -e "${RED}Error: Merge operations are not allowed${NC}"
    echo "Please use the GitHub web interface or ask a human to perform merges"
    exit 1
fi

# Extract content from various gh commands for checking
content_to_check=""
context=""

# Handle different gh commands that create content
case "$1" in
    "issue")
        if [[ "$2" == "create" ]]; then
            # Check for --title and --body flags
            for ((i=3; i<=$#; i++)); do
                if [[ "${!i}" == "--title" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="Issue title"
                elif [[ "${!i}" == "--body" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="Issue body"
                fi
            done
        elif [[ "$2" == "comment" ]]; then
            # Check for --body flag
            for ((i=3; i<=$#; i++)); do
                if [[ "${!i}" == "--body" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="Issue comment"
                fi
            done
        fi
        ;;
    "pr")
        if [[ "$2" == "create" ]]; then
            # Check for --title and --body flags
            for ((i=3; i<=$#; i++)); do
                if [[ "${!i}" == "--title" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="PR title"
                elif [[ "${!i}" == "--body" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="PR body"
                fi
            done
        elif [[ "$2" == "comment" ]]; then
            # Check for --body flag
            for ((i=3; i<=$#; i++)); do
                if [[ "${!i}" == "--body" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="PR comment"
                fi
            done
        fi
        ;;
    "gist")
        if [[ "$2" == "create" ]]; then
            # Check all arguments for content
            content_to_check="$*"
            context="Gist content"
        fi
        ;;
    "release")
        if [[ "$2" == "create" ]]; then
            # Check for --title and --notes flags
            for ((i=3; i<=$#; i++)); do
                if [[ "${!i}" == "--title" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="Release title"
                elif [[ "${!i}" == "--notes" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="Release notes"
                fi
            done
        fi
        ;;
    "api")
        # For API calls, check the entire command for prohibited content
        content_to_check="$*"
        context="API call"
        ;;
esac

# If we have content to check, validate it
if [[ -n "$content_to_check" ]]; then
    if ! check_prohibited_content "$content_to_check" "$context"; then
        exit 1
    fi
fi

# Also check environment variables that might contain content
if [[ -n "$GH_BODY" ]]; then
    if ! check_prohibited_content "$GH_BODY" "GH_BODY environment variable"; then
        exit 1
    fi
fi

if [[ -n "$GH_TITLE" ]]; then
    if ! check_prohibited_content "$GH_TITLE" "GH_TITLE environment variable"; then
        exit 1
    fi
fi

# Execute the actual gh command
exec gh "$@"
