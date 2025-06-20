#!/bin/bash
# ABOUTME: Safe wrapper for GitHub CLI that prevents merges and Claude/AI references
# ABOUTME: Checks all text content before executing gh commands
# ABOUTME: Redirects PR comment fetching to use collect-pr-comments.sh + TodoWrite process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to check for prohibited content
check_prohibited_content() {
    local content="$1"
    local context="$2"
    
    # Check for Claude/Anthropic references (matching commit-msg hook patterns)
    # This includes direct mentions, co-authorship, and generation notices
    if echo "$content" | grep -iE "claude|anthropic|co-authored-by:.*claude|generated with.*claude|claude\.ai|🤖.*generated.*claude" > /dev/null 2>&1; then
        echo -e "${RED}Error: $context contains prohibited Claude/Anthropic references${NC}"
        echo "Please remove any Claude or Anthropic references"
        echo "This includes Co-Authored-By lines and 'Generated with' notices"
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

# Function to check if command is trying to fetch PR comments
is_pr_comment_fetch() {
    # Check for pr view with comments
    if [[ "$1" == "pr" && "$2" == "view" ]] && echo "${@:3}" | grep -E "comment|review" > /dev/null 2>&1; then
        return 0
    fi
    
    # Check for pr comment list
    if [[ "$1" == "pr" && "$2" == "comment" && "$3" == "list" ]]; then
        return 0
    fi
    
    # Don't block gh api calls - those are needed for scripts
    # Don't block issue commands - we're only handling PR comments
    
    return 1
}

# Check if it's a merge command
if is_merge_command "$@"; then
    echo -e "${RED}Error: Merge operations are not allowed${NC}"
    echo "Please use the GitHub web interface or ask a human to perform merges"
    exit 1
fi

# Check if it's a PR comment fetch command
if is_pr_comment_fetch "$@"; then
    echo -e "${RED}Error: Direct PR comment fetching is not allowed${NC}"
    echo ""
    echo "To properly handle PR comments, you MUST follow this process:"
    echo ""
    echo "1. Run the collection script:"
    echo "   ./scripts/collect-pr-comments.sh <owner> <repo> <pr_number>"
    echo "   Example: ./scripts/collect-pr-comments.sh yahgwai aep-fee-tracker 127"
    echo ""
    echo "2. For EVERY SINGLE comment returned, create a todo using TodoWrite:"
    echo '   Format: "{first 20 chars}..." - MUST execute: {command}'
    echo ""
    echo "   Example todo: \"Fix type error in...\" - MUST execute: gh api repos/owner/repo/pulls/comments/123"
    echo "   Each todo REQUIRES executing the command to complete it."
    echo ""
    echo "   Example: If the script returns 17 comments, you MUST create 17 todos."
    echo "   Each comment needs its own todo - do not skip any!"
    echo "   DO NOT execute these commands now, just create todos for them"
    echo "   After creating the todos address them ONE BY ONE not all together"
    echo ""
    echo "This ensures ALL comments are tracked and NONE are missed."
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
            pr_body=""
            for ((i=3; i<=$#; i++)); do
                if [[ "${!i}" == "--title" ]]; then
                    ((i++))
                    content_to_check+=" ${!i}"
                    context="PR title"
                elif [[ "${!i}" == "--body" ]]; then
                    ((i++))
                    pr_body="${!i}"
                    content_to_check+=" ${!i}"
                    context="PR body"
                fi
            done
            
            # Check if PR body contains issue reference or explicit "no issue"
            if [[ -n "$pr_body" ]]; then
                # Check for issue references: #123, fixes #123, closes #123, resolves #123, etc.
                if ! echo "$pr_body" | grep -iE "(close[sd]?|fix(es|ed)?|resolve[sd]?)\s+#[0-9]+|#[0-9]+|no[- ]issue" > /dev/null 2>&1; then
                    echo -e "${RED}Error: PR description must contain either an issue reference (e.g., 'fixes #123', 'closes #456') or explicitly state 'no-issue'${NC}"
                    echo "Examples:"
                    echo "  - 'This PR fixes #123'"
                    echo "  - 'Closes #456'"
                    echo "  - 'no-issue: this is a minor documentation update'"
                    echo "  - 'no issue: refactoring without a specific issue'"
                    exit 1
                fi
            fi
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
    
    # For PR creation, also check if GH_BODY contains issue reference
    if [[ "$1" == "pr" && "$2" == "create" ]]; then
        if ! echo "$GH_BODY" | grep -iE "(close[sd]?|fix(es|ed)?|resolve[sd]?)\s+#[0-9]+|#[0-9]+|no[- ]issue" > /dev/null 2>&1; then
            echo -e "${RED}Error: PR description must contain either an issue reference (e.g., 'fixes #123', 'closes #456') or explicitly state 'no-issue'${NC}"
            echo "Examples:"
            echo "  - 'This PR fixes #123'"
            echo "  - 'Closes #456'"
            echo "  - 'no-issue: this is a minor documentation update'"
            echo "  - 'no issue: refactoring without a specific issue'"
            exit 1
        fi
    fi
fi

if [[ -n "$GH_TITLE" ]]; then
    if ! check_prohibited_content "$GH_TITLE" "GH_TITLE environment variable"; then
        exit 1
    fi
fi

# Execute the actual gh command
exec gh "$@"
