# Beta invites and email confirmation (roadmap S05, Gate A)

## What testers see

1. They open the invite link, e.g. `https://playground.compactlab.dev/join/midnight-beta`. The page shows how many sponsored seats are left and the three steps.
2. They sign up with GitHub, Google or email and password. Email signups pass a Cloudflare Turnstile check, and throwaway inbox domains are refused.
3. Email signups get a "Confirm your CompactLab email" message. Until they click it, they can look around and compile, but Deploy and Call stay disabled, and a yellow bar offers **Resend email**. GitHub and Google accounts count as confirmed.
4. The playground joins the invite, opens **Hello, Midnight!** on Preprod with Sponsored fees, and shows a welcome dialog with the steps.

## How seats work

- Joining doesn't hold a seat. A seat goes to each of the first `seats` members whose **sponsored deploy or call succeeds**.
- Once every seat is taken, members without one are waitlisted in join order. They see "Beta waitlist #N" and can still deploy with Self-pay.
- In admin → **Beta invites** you can raise the seat count, **Approve** a waitlisted member (sponsored access past the cap), **Remove** one, or close the link to new members.
- While any invite exists (or `COMPACTLAB_SPONSOR_ALLOWLIST` is set), sponsored fees are invite-only: the allow-list or a beta seat. With neither, every confirmed user can use them.
- Two deploys finishing at the same instant can both take the last seat, so a link can end one or two over. Raise or ignore; Gate A counts distinct users.
- Accounts created before this change are marked confirmed by the migration.

## Setup

### 1. Email (Resend)

1. Create an account at https://resend.com.
2. **Domains → Add domain**: `compactlab.dev`. Add the DNS records Resend shows (SPF and MX on the `send` subdomain, DKIM `resend._domainkey`) at your DNS provider, then click **Verify**. Without this, emails land in spam or bounce.
3. **API Keys → Create API key** with *Sending access*, limited to `compactlab.dev`.
4. On the VPS, add to `/var/www/compactlab-api/.env`:
   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=CompactLab <noreply@compactlab.dev>
   ```

Without a key, dev prints the confirmation link in the API log; production can't send it, so new email/password users can't deploy.

### 2. Bot check (Cloudflare Turnstile)

1. In the Cloudflare dashboard (a free account; the domain doesn't need to be on Cloudflare), open **Turnstile → Add widget**.
2. Hostname: `playground.compactlab.dev`. Mode: **Managed**. Create it, and keep the site key and secret key.
3. Playground first: add `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>` to `/var/www/compactlab-ide/.env.production.local`, then run the playground's **Deploy to VPS** workflow (the key is baked in at build time).
4. Then the API: add `TURNSTILE_SECRET_KEY=<secret key>` to `/var/www/compactlab-api/.env`.

Do it in that order. An API with a secret and a playground without the site key refuses every email signup.

### 3. Apply

```bash
cd /var/www/compactlab-api && pm2 restart compactlab-api --update-env
```

The API deploy workflow runs `pnpm db:migrate:deploy`, which adds the tables.

### 4. Create the link

Admin → **Beta invites** → name `Midnight Discord beta`, code `midnight-beta`, seats `10` → **Create link**, then copy it.

Put your own email in `COMPACTLAB_SPONSOR_ALLOWLIST` instead of joining the link yourself: you already have a sponsored deploy, so joining would take a seat.

### 5. Check before announcing

In a private window, open the link, sign up with a second email, confirm it, deploy Hello, Midnight! and call `storeMessage`. Admin should show that member with a **Seat**.
