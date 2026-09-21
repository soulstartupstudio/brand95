# Hosting the command center

The app is one Node process with a SQLite file. It needs a host that runs a long-lived container with a **persistent disk**. A password gate (`JARVIS_PASSWORD`) protects everything: dashboard, API, chat.

## Why not Vercel

Vercel runs serverless functions on an ephemeral filesystem. The SQLite file would be lost on every deploy and cold start. Making it Vercel-safe means replacing the database layer with hosted Postgres (Supabase or Neon) and turning every service call async. That is a day of refactoring with no gain for a single-founder tool. If you later want multi-user or edge hosting, that is the moment to do it.

## Fly.io (recommended, ~€3/month)

```bash
brew install flyctl && fly auth login          # once
git clone https://github.com/soulstartupstudio/brand95.git && cd brand95
fly launch --copy-config --no-deploy           # accept the app name or pick one; region ams
fly volumes create jarvis_data --size 1 --region ams
fly secrets set JARVIS_PASSWORD='choose-a-long-passphrase' ANTHROPIC_API_KEY='sk-ant-...'
fly deploy
fly open                                       # https://<app>.fly.dev → login page
```

Updates: `git pull && fly deploy`. The volume keeps `/data/jarvis.db` across deploys. Backups: `fly ssh console -C "sqlite3 /data/jarvis.db .dump" > backup.sql` or `jarvis export` over SSH.

Machines auto-stop when idle and start on the first request (about a second of cold start). Set `min_machines_running = 1` in `fly.toml` if you want it always warm.

## Railway

1. New project → Deploy from GitHub repo → `soulstartupstudio/brand95`. Railway detects the Dockerfile.
2. Service → Variables: `JARVIS_PASSWORD`, `ANTHROPIC_API_KEY`. `PORT` is injected automatically.
3. Service → Volumes: add a volume mounted at `/data`.
4. Settings → Networking → Generate domain.

## Any Docker host

```bash
docker build -t jarvis .
docker run -d -p 8080:8080 -v jarvis_data:/data -e JARVIS_PASSWORD='…' -e ANTHROPIC_API_KEY='…' jarvis
```

## Security notes

- The server refuses to bind a public interface without `JARVIS_PASSWORD`.
- Sessions are an HttpOnly, SameSite=Lax cookie, 30 days, marked `Secure` behind HTTPS (`x-forwarded-proto`). Change the password to invalidate every session.
- Five wrong passwords per minute per IP → 60-second lockout.
- Scripts and the CLI against a hosted instance: `Authorization: Bearer <password>` on `/api/*`.
- Keep the Anthropic key as a host secret, never in the repo. Chat cost is bounded by `JARVIS_EFFORT=low` by default.
- This is a single-founder gate, not a multi-user auth system. Do not share the password; add a second person by putting an identity proxy (Cloudflare Access, Tailscale) in front instead.
