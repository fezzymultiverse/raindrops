#!/usr/bin/env bash
# Push Raindrops to GitLab. GitLab CI then builds raindrops.apk (Build > Pipelines > download artifact).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
command -v git >/dev/null || { echo "Run: pkg install git"; exit 1; }
[ -d .git ] || { git init -b main >/dev/null; echo "git repo created"; }
[ -n "$(git config user.name || true)" ] || { printf 'Name: '; read -r N; git config user.name "${N:-philfesters}"; }
[ -n "$(git config user.email || true)" ] || { printf 'Email: '; read -r E; git config user.email "${E:-philfesters@users.noreply.gitlab.com}"; }
git remote get-url gitlab >/dev/null 2>&1 || {
  printf 'GitLab repo path (example username/raindrops): '; read -r R
  [ -n "$R" ] || { echo "repo needed"; exit 1; }
  git remote add gitlab "https://gitlab.com/$R.git"
}
git add -A
git diff --cached --quiet || git commit -q -m "${1:-V1.9.8 update}" && echo "committed"
git branch -M main
printf 'GitLab username: '; read -r U
printf 'GitLab access token (hidden): '; read -r -s T; printf '\n'
AP="$(mktemp)"; printf '#!/usr/bin/env bash\ncase "$1" in *sername*) printf "%%s" "$RD_U";; *) printf "%%s" "$RD_T";; esac\n' > "$AP"; chmod 700 "$AP"
RD_U="$U" RD_T="$T" GIT_ASKPASS="$AP" GIT_TERMINAL_PROMPT=0 git push -u gitlab main
RC=$?; rm -f "$AP"
[ $RC -eq 0 ] && echo "Pushed. Watch Build > Pipelines in your GitLab project." || echo "Push failed. The token needs write_repository scope."
