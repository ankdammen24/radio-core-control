# Radio Core — Driftsättning

Komplett guide för att sätta upp Radio Core på en egen Linux-server med Docker, Cloudflare och Vercel.

---

## Arkitektur

```
Internet
  └─ Cloudflare (DNS + TLS-terminering)
       └─ nginx-proxy :80 (Docker)
            ├─ /api/*       → radio-core-api:3000
            ├─ /auth/*      → radio-core-api:3000
            └─ /media-api/* → radio-core-media:3001

Vercel (frontend: studio.radiouppsala.se)
  └─ fetch("https://api.radiouppsala.se/api/...")
```

Alla backend-containrar kommunicerar via det interna Docker-nätverket `radio_core_network`. Inga backend-portar är exponerade på host-maskinen.

---

## Serverkrav

| Resurs | Minimum | Rekommenderat |
|--------|---------|---------------|
| CPU    | 2 vCPU  | 4 vCPU        |
| RAM    | 2 GB    | 4 GB          |
| Disk   | 20 GB   | 100 GB (media)|
| OS     | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

Öppna portar i brandväggen: **80** och **443** (Cloudflare IP-ranges).

---

## Installation

### 1. Docker

```bash
# Ubuntu 22.04/24.04
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logga ut och in igen
docker --version
```

### 2. Klona repot

```bash
git clone https://github.com/ditt-org/radio-core-control.git /opt/radio-core
cd /opt/radio-core
```

### 3. Konfigurera miljövariabler

```bash
cp infra/.env.example infra/.env
nano infra/.env
```

Fyll i minst:
- `MONGODB_ROOT_PASSWORD` — välj ett starkt lösenord
- `MONGODB_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET` — `openssl rand -base64 32`
- `AUTH_SECRET` — `openssl rand -base64 32`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`

### 4. Starta

```bash
./scripts/prod-up.sh
```

### 5. Verifiera

```bash
./scripts/healthcheck.sh
```

Förväntat resultat:
```
✓ nginx proxy          (http://localhost/health)        → 200
✓ radio-core-api       (http://localhost/api/health)    → 200
✓ radio-core-media     (http://localhost/media-api/health) → 200
```

---

## Cloudflare DNS

Skapa följande A-records i Cloudflare Dashboard → DNS:

| Namn    | Typ | Värde          | Proxy |
|---------|-----|----------------|-------|
| api     | A   | DIN-SERVER-IP  | ✅ ON |
| studio  | A   | (Vercel CNAME) | ✅ ON |
| stream  | A   | DIN-SERVER-IP  | ✅ ON |
| podcast | A   | DIN-SERVER-IP  | ✅ ON |

SSL/TLS-inställning i Cloudflare:
- SSL/TLS → Overview → **Full** (inte "Full (strict)" — nginx har inget certifikat)
- SSL/TLS → Edge Certificates → **Always Use HTTPS**: ON
- SSL/TLS → Edge Certificates → **Minimum TLS Version**: 1.2

---

## Vercel (frontend)

I Vercel Dashboard → ditt projekt → Settings → Environment Variables:

| Nyckel         | Värde                              | Miljö       |
|----------------|------------------------------------|-------------|
| `VITE_API_URL` | `https://api.radiouppsala.se`      | Production  |
| `VITE_API_URL` | `` (tom)                           | Preview/Dev |

TanStack Start kräver Node.js 20+ runtime i Vercel:
- Settings → General → Node.js Version: **20.x**

---

## Daglig drift

### Visa status

```bash
docker compose -f infra/compose.yml ps
```

### Loggar

```bash
# Alla tjänster
./scripts/prod-logs.sh

# Specifik tjänst
./scripts/prod-logs.sh radio-core-api
./scripts/prod-logs.sh nginx-proxy
./scripts/prod-logs.sh mongodb
```

### Stoppa

```bash
docker compose -f infra/compose.yml -f infra/compose.production.yml down
```

### Uppdatera (ny release)

```bash
git pull
./scripts/prod-up.sh  # bygger om och startar om
```

---

## Felsökning

### nginx svarar inte

```bash
./scripts/nginx-test.sh          # Kontrollera config-syntax
docker compose -f infra/compose.yml logs nginx-proxy
```

### API svarar inte

```bash
docker compose -f infra/compose.yml logs radio-core-api
# Kontrollera om containern är healthy:
docker compose -f infra/compose.yml ps radio-core-api
```

### MongoDB ansluter inte

```bash
docker compose -f infra/compose.yml exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### Redis ansluter inte

```bash
docker compose -f infra/compose.yml exec redis redis-cli ping
# Svar: PONG
```

### CORS-fel i frontend

Kontrollera att `VITE_API_URL` är satt korrekt i Vercel. Kontrollera att `STUDIO_DOMAIN` i `infra/.env` matchar din Vercel-domän.

---

## Backup (MongoDB)

### Manuell backup

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker compose -f infra/compose.yml exec mongodb \
  mongodump --authenticationDatabase admin \
  -u root -p "$MONGODB_ROOT_PASSWORD" \
  --out /data/backup_$TIMESTAMP

# Kopiera ut från containern
docker compose -f infra/compose.yml cp \
  mongodb:/data/backup_$TIMESTAMP \
  ./backups/mongodb_$TIMESTAMP
```

### Automatisk backup (cron på host)

```bash
# Lägg till i crontab: crontab -e
0 2 * * * /opt/radio-core/scripts/backup-mongodb.sh >> /var/log/radio-core-backup.log 2>&1
```

Skapa `scripts/backup-mongodb.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
source /opt/radio-core/infra/.env
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/radio-core/backups"
mkdir -p "$BACKUP_DIR"
docker compose -f /opt/radio-core/infra/compose.yml exec -T mongodb \
  mongodump --authenticationDatabase admin \
  -u root -p "$MONGODB_ROOT_PASSWORD" \
  --archive --gzip > "$BACKUP_DIR/mongodb_$TIMESTAMP.archive.gz"
# Behåll 30 dagars backup
find "$BACKUP_DIR" -name "*.archive.gz" -mtime +30 -delete
echo "[$TIMESTAMP] Backup klar: $BACKUP_DIR/mongodb_$TIMESTAMP.archive.gz"
```

---

## Rollback

### Rollback till föregående version

```bash
# 1. Hitta föregående commit
git log --oneline -10

# 2. Checka ut
git checkout <commit-hash>

# 3. Bygg om och starta
./scripts/prod-up.sh
```

### Rollback MongoDB-backup

```bash
# Stoppa API:et under återställning
docker compose -f infra/compose.yml stop radio-core-api radio-core-worker scheduler

# Återställ
source infra/.env
docker compose -f infra/compose.yml exec -T mongodb \
  mongorestore --authenticationDatabase admin \
  -u root -p "$MONGODB_ROOT_PASSWORD" \
  --archive --gzip < backups/mongodb_TIMESTAMP.archive.gz

# Starta om
docker compose -f infra/compose.yml start radio-core-api radio-core-worker scheduler
```

---

## MongoDB-volym

MongoDB-data lagras i Docker-volymen `radio_core_mongodb`. Volymen lever kvar vid `docker compose down` men tas bort med `docker compose down -v` — **kör aldrig `-v` i produktion**.

Verifiera volymstorlek:
```bash
docker system df -v | grep radio_core_mongodb
```
