#!/bin/bash
# Script to verify all PR comment commands work correctly
# Usage: ./verify-pr-commands.sh <commands_file>

set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <commands_file>"
    echo "Example: $0 /tmp/pr127-commands.txt"
    exit 1
fi

COMMANDS_FILE=$1

if [ ! -f "$COMMANDS_FILE" ]; then
    echo "Error: Commands file not found: $COMMANDS_FILE"
    exit 1
fi

echo "Verifying PR comment commands from: $COMMANDS_FILE"
echo "================================================="

success_count=0
fail_count=0
total_count=0

while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue
    
    total_count=$((total_count + 1))
    
    # Execute command and capture result
    if result=$(eval "$cmd" 2>/dev/null); then
        # Extract key fields
        comment_id=$(echo "$result" | jq -r '.id')
        user=$(echo "$result" | jq -r '.user.login')
        body_length=$(echo "$result" | jq -r '.body | length')
        created_at=$(echo "$result" | jq -r '.created_at')
        
        # Verify we got valid data
        if [ "$comment_id" != "null" ] && [ "$comment_id" != "" ]; then
            success_count=$((success_count + 1))
            echo "✓ Command $total_count: SUCCESS"
            echo "  ID: $comment_id | User: $user | Body length: $body_length chars | Created: $created_at"
        else
            fail_count=$((fail_count + 1))
            echo "✗ Command $total_count: FAILED (invalid response)"
            echo "  Command: $cmd"
        fi
    else
        fail_count=$((fail_count + 1))
        echo "✗ Command $total_count: FAILED (command error)"
        echo "  Command: $cmd"
    fi
done < "$COMMANDS_FILE"

echo "================================================="
echo "Summary:"
echo "  Total commands: $total_count"
echo "  Successful: $success_count"
echo "  Failed: $fail_count"
echo "  Success rate: $(( (success_count * 100) / total_count ))%"

if [ $fail_count -gt 0 ]; then
    exit 1
fi