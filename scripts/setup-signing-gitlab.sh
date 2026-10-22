#!/usr/bin/env bash
# Makes ONE permanent signing key for Raindrops and prints the four values to paste into
# GitLab > Settings > CI/CD > Variables (mask them, protect them). Needs: keytool (openjdk), base64.
set -uo pipefail
TMP="${TMPDIR:-/tmp}"
command -v keytool >/dev/null 2>&1 || { echo "missing keytool: pkg install openjdk-17"; exit 1; }
command -v base64 >/dev/null 2>&1 || { echo "missing base64: pkg install coreutils"; exit 1; }
echo "WARNING: a new key has a new signature. Android will not update over an app signed with a different key:"
echo "export your recordings, uninstall once, install the new APK."
printf 'Continue? (yes/no): '; read -r OK; [ "$OK" = "yes" ] || { echo "Cancelled."; exit 0; }
KD="$HOME/.raindrops-signing"; mkdir -p "$KD"; chmod 700 "$KD"
KS="$KD/release.keystore"; ENVF="$KD/release.env"; ALIAS="raindrops"
if [ -f "$KS" ] && [ -f "$ENVF" ]; then
  PASS="$(grep '^PASS=' "$ENVF" | head -1 | cut -d= -f2-)"; echo "Re-using the key in $KD"
else
  PASS="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  keytool -genkeypair -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 36500 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=Grant Festers, OU=S.O.I, O=Bojack Security, L=Cape Town, C=ZA" || { echo "keytool failed"; exit 1; }
  printf 'PASS=%s\nALIAS=%s\n' "$PASS" "$ALIAS" > "$ENVF"; chmod 600 "$KS" "$ENVF"
fi
OUT="$TMP/raindrops-gitlab-vars.txt"
{
  echo "RELEASE_KEYSTORE_B64=$(base64 -w0 "$KS")"
  echo "RELEASE_KEYSTORE_PASSWORD=$PASS"
  echo "RELEASE_KEY_PASSWORD=$PASS"
  echo "RELEASE_KEY_ALIAS=$ALIAS"
} > "$OUT"; chmod 600 "$OUT"
echo "Four variables written to: $OUT"
echo "Paste each NAME=VALUE into GitLab CI/CD Variables, then delete that file. Back up $KD safely."
