#!/usr/bin/env bash
# save-deliverable.sh — park a finished work product somewhere it will survive.
#
# Sessions run in throwaway containers. A PDF, deck, or export that is only
# sitting on disk dies when the container is reclaimed, and there is no way to
# get it back. This copies finished files into deliverables/, records what they
# are and where they came from, commits, and pushes.
#
# Usage:
#   scripts/save-deliverable.sh brochure.pdf
#   scripts/save-deliverable.sh out/*.pdf --slug rhlc-brochure --note "print-ready v4"
#   scripts/save-deliverable.sh deck.pptx --no-push
#   scripts/save-deliverable.sh --dry-run report.pdf

set -euo pipefail

usage() {
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
}

files=()
slug=""
note=""
push=1
dry=0

while [ $# -gt 0 ]; do
  case "$1" in
    --slug)    slug="${2:?--slug needs a value}"; shift 2 ;;
    --note)    note="${2:?--note needs a value}"; shift 2 ;;
    --no-push) push=0; shift ;;
    --dry-run) dry=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*)        echo "save-deliverable: unknown option $1" >&2; usage >&2; exit 2 ;;
    *)         files+=("$1"); shift ;;
  esac
done

if [ ${#files[@]} -eq 0 ]; then
  echo "save-deliverable: no files given" >&2
  usage >&2
  exit 2
fi

root=$(git rev-parse --show-toplevel)
branch=$(git rev-parse --abbrev-ref HEAD)
session="${CLAUDE_SESSION_ID:-}"
date=$(date -u +%Y-%m-%d)
stamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | tr -s '-' \
    | sed 's/^-//; s/-$//'
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

bytes() { wc -c < "$1" | tr -d ' '; }

json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

# Default the slug off the branch name (claude/rhlc-brochure-ab12cd -> rhlc-brochure-ab12cd),
# falling back to the first filename.
if [ -z "$slug" ]; then
  if [ "$branch" != "HEAD" ] && [ "$branch" != "main" ]; then
    slug=$(slugify "${branch#claude/}")
  else
    first=$(basename "${files[0]}")
    slug=$(slugify "${first%.*}")
  fi
fi

dest="$root/deliverables/$date-$slug"
rel="deliverables/$date-$slug"

for f in "${files[@]}"; do
  [ -f "$f" ] || { echo "save-deliverable: not a file: $f" >&2; exit 1; }
done

if [ "$dry" -eq 1 ]; then
  echo "would save into $rel/"
  for f in "${files[@]}"; do
    printf '  %s  (%s bytes)\n' "$(basename "$f")" "$(bytes "$f")"
  done
  exit 0
fi

mkdir -p "$dest"

entries=""
for f in "${files[@]}"; do
  name=$(basename "$f")
  cp "$f" "$dest/$name"
  [ -n "$entries" ] && entries="$entries,"
  entries="$entries
    {\"name\": \"$(json_escape "$name")\", \"bytes\": $(bytes "$f"), \"sha256\": \"$(sha256 "$f")\"}"
done

cat > "$dest/manifest.json" <<JSON
{
  "slug": "$(json_escape "$slug")",
  "saved_at": "$stamp",
  "branch": "$(json_escape "$branch")",
  "session_id": "$(json_escape "$session")",
  "note": "$(json_escape "$note")",
  "files": [$entries
  ]
}
JSON

index="$root/deliverables/index.md"
if [ ! -f "$index" ]; then
  cat > "$index" <<'HEADER'
# Deliverables

Finished work products, saved so they outlive the session that built them.
Append to this table with `scripts/save-deliverable.sh` — do not edit by hand.

| Saved (UTC) | Folder | Files | Note |
| --- | --- | --- | --- |
HEADER
fi

names=$(for f in "${files[@]}"; do basename "$f"; done | paste -sd ', ' -)
printf '| %s | `%s` | %s | %s |\n' "$stamp" "$rel" "$names" "${note:-—}" >> "$index"

git -C "$root" add "$rel" "deliverables/index.md"

if git -C "$root" diff --cached --quiet; then
  echo "save-deliverable: nothing changed — $rel already holds these exact files"
  exit 0
fi

msg="Save deliverable: $slug"
[ -n "$note" ] && msg="$msg ($note)"
git -C "$root" commit -q -m "$msg"
echo "saved and committed -> $rel"

if [ "$push" -eq 1 ]; then
  git -C "$root" push -u origin "$branch"
  echo "pushed -> origin/$branch"
else
  echo "not pushed (--no-push). Run: git push -u origin $branch"
fi
