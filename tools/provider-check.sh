#!/usr/bin/env bash
# Raindrops provider check - run in Termux:  bash tools/provider-check.sh
# Pings every service the app talks to and prints OK / FAIL, the HTTP code and the time.
# Tells you which provider is down vs which is an app bug. Needs curl.
set -u
command -v curl >/dev/null 2>&1 || { echo "curl not found: pkg install curl"; exit 1; }
ok=0; bad=0
chk() { # name url [accept4xx]
  local name="$1" url="$2" out code t
  out=$(curl -s -o /dev/null -L --max-time 15 -w '%{http_code} %{time_total}' "$url" 2>/dev/null) || out="000 0"
  code=${out%% *}; t=${out##* }
  if [[ "$code" =~ ^2 ]] || { [ "${3:-}" = "4xx" ] && [[ "$code" =~ ^4 ]]; }; then printf '  OK    %-22s HTTP %s  %ss\n' "$name" "$code" "$t"; ok=$((ok+1))
  else printf '  FAIL  %-22s HTTP %s  %ss\n' "$name" "$code" "$t"; bad=$((bad+1)); fi
}
echo "Raindrops provider check  ($(date '+%Y-%m-%d %H:%M'))"
chk "Deezer search"    "https://api.deezer.com/search?q=drake&limit=1"
chk "Deezer rap chart" "https://api.deezer.com/chart/116/tracks?limit=1"
chk "Audius discovery" "https://api.audius.co"
chk "Internet Archive" "https://archive.org/advancedsearch.php?q=beat&fl%5B%5D=identifier&rows=1&output=json"
chk "Jamendo (site)"   "https://api.jamendo.com/v3.0/tracks/?format=json&limit=1" 4xx
chk "LRCLIB search"    "https://lrclib.net/api/search?q=drake%20nonstop"
chk "lyrics.ovh"       "https://api.lyrics.ovh/v1/Drake/Nonstop"
chk "Wikipedia"        "https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=drake&srlimit=1"
echo "Result: $ok OK, $bad FAIL"
echo "Note: Jamendo answers 4xx without a client id. That is normal, it only proves the site is up."
echo "Note: lyrics.ovh and Audius are community services and go down now and then."
[ "$bad" -eq 0 ]
