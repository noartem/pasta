#!/usr/bin/env bash
# Редактор sops-зашифрованных секретов в deploy/ через $VISUAL/$EDITOR.
# Ничего никуда не отправляет: sops сам расшифровывает во временный файл (0600),
# открывает редактор и перезашифровывает после сохранения. Доставку на прод делает
# git push в master → .github/workflows/ci.yml (расшифрованный .env rsync'ится на VPS).
#
#   npm run edit            # только deploy/env
#   npm run edit env        # только deploy/env
#   npm run edit ssh        # только deploy/ssh-key
#
# Ключ: SOPS_AGE_KEY, либо keys.txt в платформенной конфиг-папке sops —
# Linux/macOS: ~/.config/sops/age/keys.txt, Windows: %APPDATA%\sops\age\keys.txt.
# На Windows $EDITOR должен быть Windows-исполняемым путём (sops.exe запускает
# редактор напрямую), например EDITOR="code -w".
set -euo pipefail

cd "$(dirname "$0")/.."

command -v sops >/dev/null || { echo "sops не найден в PATH (см. PROD.md «Секреты»)" >&2; exit 1; }

SELECT="${1:-env}"
case "$SELECT" in
  env) FILES=(deploy/env.enc) ;;
  ssh) FILES=(deploy/ssh-key.enc) ;;
  all) FILES=(deploy/env.enc deploy/ssh-key.enc) ;;
  *) echo "Неизвестный аргумент: $SELECT (env|ssh|all)" >&2; exit 1 ;;
esac

have_key=0
for k in "$HOME/.config/sops/age/keys.txt" "${APPDATA:-$HOME/AppData/Roaming}/sops/age/keys.txt"; do
  [[ -f "$k" ]] && have_key=1
done
if [[ -z "${SOPS_AGE_KEY:-}" && "$have_key" -eq 0 ]]; then
  echo "age-ключ не найден: задай SOPS_AGE_KEY или положи keys.txt в ~/.config/sops/age/ (Windows: %APPDATA%\\sops\\age\\)" >&2
  exit 1
fi

for f in "${FILES[@]}"; do
  echo "=== $f ==="
  # sops возвращает 200, если файл не изменился после редактирования — это не ошибка.
  rc=0
  case "$f" in
    deploy/env.enc) sops edit --input-type dotenv --output-type dotenv "$f" || rc=$? ;;
    *)              sops edit "$f" || rc=$? ;;
  esac
  if [[ "$rc" -ne 0 && "$rc" -ne 200 ]]; then
    echo "Ошибка редактирования $f (exit $rc)" >&2
    exit "$rc"
  fi
done
