#!/usr/bin/env bash
# check-unsaved-deliverables.sh — warn about generated files that would die
# with this container.
#
# Wired to the Stop hook in .claude/settings.json, so it runs when a turn ends.
# It only says anything when there is something to lose. Never blocks.

set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" 2>/dev/null || exit 0

pattern='\.(pdf|pptx|potx|docx|dotx|xlsx|csv|png|jpe?g|svg|webp|mp4|mov|ai|psd|indd|eps|zip)$'

found=""
count=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  count=$((count + 1))
  if [ "$count" -le 10 ]; then
    found="$found  $f
"
  fi
done <<EOF
$( { git ls-files --others --exclude-standard; git diff --name-only; } 2>/dev/null \
     | grep -Ei "$pattern" | sort -u )
EOF

[ "$count" -eq 0 ] && exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
extra=""
[ "$count" -gt 10 ] && extra="  ...and $((count - 10)) more
"

msg="$count generated file(s) are not committed on $branch. This container is
throwaway — anything uncommitted is gone when it is reclaimed.

$found$extra
Save them:  scripts/save-deliverable.sh <file> --note \"what it is\""

esc=$(printf '%s' "$msg" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk '{printf "%s\\n", $0}')
printf '{"systemMessage":"%s"}\n' "$esc"
exit 0
