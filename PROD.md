# PROD — памятка для себя

Production runbook для pasta.noartem.ru.

## Где что живёт

| Ресурс | Где | Примечание |
|---|---|---|
| Исходники | `github.com/noartem/pasta` | ветка `master` |
| Образ | `ghcr.io/noartem/pasta` | теги `sha-<commit>` + `latest`; хранятся 4 последних версии |
| CI/CD | `.github/workflows/ci.yml` | пуш в `master` → test → docker → deploy |
| Prod compose | `compose.yml` в репо | rsync'ится на VPS при деплое |
| Секреты | `deploy/*.enc` в репо (sops/age) + GitHub secret `SOPS_AGE_KEY` | см. «Секреты» |
| VPS | `84.54.30.169` — тот же, что у weight-secret-bot | |
| Контейнер на VPS | `/opt/pasta/` (`compose.yml`, `.env`) | owner `deployer` |
| SQLite | docker volume `pasta_data` → `/data/database.sqlite` | uid 65532 |
| Caddy | на хосте, `/etc/caddy/Caddyfile`, блок `pasta.noartem.ru` | wildcard Origin CA `*.noartem.ru`, проксирует на 127.0.0.1:8000 |

```
Internet ──TLS──▶ Cloudflare (orange) ──▶ 84.54.30.169:443 (ufw: только CF IP)
                                              ▼
                                   Caddy (host) — Origin CA cert
                                              │ reverse_proxy 127.0.0.1:8000
                                              ▼
                        pasta (Docker, distroless nonroot, read-only fs)
                                              ▼
                                   volume pasta_data (SQLite)
```

DNS: `pasta.noartem.ru` — A-запись на `84.54.30.169`, proxied (оранжевое облако),
SSL mode Full (strict), как у остальных поддоменов.

## Подключение

```bash
ssh weight-secret-bot                 # noartem, полный sudo (Caddy, разовый setup)
ssh -i ~/.ssh/weight-secret-deploy deployer@84.54.30.169   # docker — всё дежурное
```

## Проверка и логи

```bash
curl -I https://pasta.noartem.ru/up                       # 200 = жив
ssh weight-secret-bot 'curl -s http://127.0.0.1:8000/up'  # мимо Cloudflare/Caddy
ssh weight-secret-bot 'docker logs -f --tail 200 pasta'
ssh weight-secret-bot 'cd /opt/pasta && sudo docker compose ps'
```

## Деплой и откат

Пуш в `master` деплоит автоматически. Вручную: `gh workflow run ci.yml --ref master`.

Откат на одну из 4 версий, оставшихся в GHCR (GitHub → Packages → pasta):

```bash
ssh weight-secret-bot 'cd /opt/pasta && sudo IMAGE_TAG=sha-<commit> docker compose up -d'
```

Или re-run старого workflow run в Actions.

## Бэкап и восстановление

```bash
# Онлайн-копия БД (sqlite3 в distroless нет — копируем файл из volume)
ssh weight-secret-bot 'docker run --rm -v pasta_data:/data:ro alpine tar -C /data -czf - .' > pasta-backup.tar.gz

# Восстановление
ssh weight-secret-bot 'cd /opt/pasta && sudo docker compose stop'
ssh weight-secret-bot 'docker run --rm -i -v pasta_data:/data alpine sh -c "tar -C /data -xzf - && chown -R 65532:65532 /data"' < pasta-backup.tar.gz
ssh weight-secret-bot 'cd /opt/pasta && sudo docker compose start'
```

## Секреты

sops-зашифрованные файлы в `deploy/` (age X25519, тот же ключ, что у
weight-secret-bot: `age1hlz6gyg…`):

| Файл | Содержимое | Формат |
|---|---|---|
| `deploy/env.enc` | env приложения (`ADMIN_LOGIN`, `ADMIN_PASSWORD`, `RUST_LOG`) + deploy-параметры (`SSH_HOST`, `SSH_USER`, `GHCR_USER`, `GHCR_TOKEN`, `REMOTE_DIR`) | dotenv |
| `deploy/ssh-key.enc` | приватный SSH-ключ `deployer` | binary |

На VPS попадает только app-часть env: deploy-параметры CI вырезает перед rsync.
Единственный GitHub secret — `SOPS_AGE_KEY`. Плейнтексты `deploy/env`,
`deploy/ssh-key` в `.gitignore`.

```bash
npm run edit            # deploy/env через $EDITOR (на Windows: EDITOR="code -w")
npm run edit ssh        # deploy/ssh-key
# коммит deploy/*.enc → push в master → деплой с новым .env

# Посмотреть пароль от /all
sops -d --input-type dotenv --output-type dotenv deploy/env.enc | grep ADMIN_

# Ротация age-ключа: новый keypair → перешифровать deploy/*.enc с --age <новый-публичный>
#   → gh secret set SOPS_AGE_KEY -R noartem/pasta < keys.txt
```

## Разовый setup VPS (уже сделан 2026-10-27)

```bash
sudo install -d -m 755 -o deployer -g deployer /opt/pasta
# + блок pasta.noartem.ru в /etc/caddy/Caddyfile (копия weight-secret, upstream 127.0.0.1:8000)
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy
```
