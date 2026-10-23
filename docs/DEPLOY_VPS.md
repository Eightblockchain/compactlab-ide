# Deploying the API and playground to the VPS

The landing page already runs on the VPS (nginx + PM2, `/var/www/compactlab-website`). This guide adds the other two public apps to the same server:

| Host | App | PM2 name | Port | Folder |
|------|-----|----------|------|--------|
| `playground.compactlab.dev` | playground (`compactlab-ide`) | `compactlab-ide` | 3001 | `/var/www/compactlab-ide` |
| `api.compactlab.dev` | API (`compactlab-api`) | `compactlab-api` | 4000 | `/var/www/compactlab-api` |

Do the steps in order. Secrets go only into the `.env` files on the server, never into git, CI logs or chat.

## 1. DNS (Namecheap)

In Namecheap → Domain List → `compactlab.dev` → Advanced DNS, add:

| Type | Host | Value |
|------|------|-------|
| A | `playground` | the VPS IP (same as the `@` record) |
| A | `api` | the VPS IP |

Check from your machine (allow a few minutes):

```bash
dig +short playground.compactlab.dev
dig +short api.compactlab.dev
```

## 2. Server packages

On the VPS, as the deploy user:

```bash
# Node 22 (the landing page uses nvm already)
nvm install 22 && nvm alias default 22
corepack enable && corepack prepare pnpm@10 --activate
npm i -g pm2   # skip if already installed

# PostgreSQL and Redis
sudo apt install -y postgresql redis-server
sudo -u postgres createuser compactlab --pwprompt
sudo -u postgres createdb -O compactlab compactlab

# Compact CLI (needed for Compile), then the pinned compiler
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1
compact --version
```

## 3. Code

`compactlab-api` is private, so the server needs a read-only deploy key for it:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/compactlab_api_deploy -N ""
cat ~/.ssh/compactlab_api_deploy.pub
# GitHub → compactlab-api → Settings → Deploy keys → Add (read-only)
cat >> ~/.ssh/config <<'CFG'
Host github-compactlab-api
  HostName github.com
  IdentityFile ~/.ssh/compactlab_api_deploy
CFG

cd /var/www
git clone git@github-compactlab-api:Eightblockchain/compactlab-api.git
git clone https://github.com/Eightblockchain/compactlab-ide.git
```

## 4. Environment files

**`/var/www/compactlab-api/.env`** (start from `.env.example`; `chmod 600`). Production values:

```
NODE_ENV=production
API_PORT=4000
API_PUBLIC_URL=https://api.compactlab.dev
PLAYGROUND_URL=https://playground.compactlab.dev
LANDING_URL=https://compactlab.dev
CORS_ORIGINS=https://playground.compactlab.dev,https://compactlab.dev,https://admin.compactlab.dev
DATABASE_URL=postgresql://compactlab:<password>@localhost:5432/compactlab?schema=public
REDIS_URL=redis://127.0.0.1:6379
COMPACTLAB_ENABLE_COMPILE=true
COMPACTLAB_JWT_SECRET=<openssl rand -hex 32>
COMPACTLAB_SESSION_SECRET=<openssl rand -hex 32>
ADMIN_EMAIL=<your admin email>
ADMIN_PASSWORD=<a strong password, set before first start>
BLOCKFROST_PREPROD_PROJECT_ID=<Midnight Preprod project id>
```

Leave sponsorship and billing off. OAuth is optional; if you add it, the callback URLs are `https://api.compactlab.dev/v1/auth/oauth/{google,github}/callback`.

**`/var/www/compactlab-ide/.env.production.local`**:

```
NEXT_PUBLIC_API_URL=https://api.compactlab.dev
NEXT_PUBLIC_NETWORK=preprod
NEXT_PUBLIC_APP_URL=https://playground.compactlab.dev
NEXT_PUBLIC_PLAYGROUND_URL=https://playground.compactlab.dev
```

`NEXT_PUBLIC_*` values are baked in at build time, so rebuild after changing them.

## 5. First build and start

```bash
cd /var/www/compactlab-api
pnpm install --frozen-lockfile && pnpm db:migrate:deploy && pnpm build
NODE_ENV=production pm2 start dist/index.js --name compactlab-api
curl -s http://127.0.0.1:4000/v1/health    # expect "ok":true

cd /var/www/compactlab-ide
pnpm install --frozen-lockfile && pnpm build
pm2 start pnpm --name compactlab-ide -- start

pm2 save
```

## 6. nginx and HTTPS

```bash
sudo cp /var/www/compactlab-ide/deploy/nginx-compactlab.conf /etc/nginx/sites-available/compactlab
sudo ln -s /etc/nginx/sites-available/compactlab /etc/nginx/sites-enabled/compactlab
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d playground.compactlab.dev -d api.compactlab.dev
```

The API block passes WebSocket upgrades for indexer subscriptions, allows 12-minute reads for full ZK compiles, and overwrites `X-Forwarded-For` so rate limits can't be dodged.

## 7. Check it end to end

```bash
curl -s https://api.compactlab.dev/v1/health
curl -sI https://playground.compactlab.dev/signup | head -1
```

Then in a browser: sign up at `https://playground.compactlab.dev`, compile the Counter template with ZK, deploy and call it with 1AM on Preprod. Sign in to the admin console and change the seeded admin password.

## 8. Deploy from GitHub

Both repos have a manual **Deploy to VPS** workflow (`.github/workflows/deploy.yml`). Each runs typecheck and tests, then SSHes in, pulls, builds and reloads PM2. Add the same four secrets the landing page uses to both repos: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`. Then run it from the Actions tab. Once you trust it, change its trigger to `push: branches: [main]`.

## 9. Landing page

The landing page links to `NEXT_PUBLIC_PLAYGROUND_URL` (default `https://playground.compactlab.dev`). Make sure the landing page's `.env.local` on the server says the same, then redeploy it.
