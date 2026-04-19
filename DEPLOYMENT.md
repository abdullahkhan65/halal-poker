# Deployment Guide — Free Tier

This stack deploys **100% free** using:

| Service | What | Free limits |
|---------|------|-------------|
| **Supabase** | PostgreSQL database | 500 MB, unlimited rows |
| **Railway** | NestJS backend | $5/mo credit (plenty for this) |
| **Vercel** | React frontend | Unlimited hobby projects |

---

## 1. Supabase (Database) — already set up

You should already have a Supabase project from local dev. For production:

1. Go to your project → **Settings → Database**
2. Copy the **Connection string (URI)** — use the **pooler** URL (port 6543) for production:
   ```
   postgresql://postgres.xxxx:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
3. Run migrations from your local machine pointing at the prod DB:
   ```bash
   cd backend
   DATABASE_URL="<prod_url>" npx prisma migrate deploy
   ```

> `migrate deploy` (not `dev`) — safe for production, no prompts.

---

## 2. Railway (Backend)

Railway gives $5/month free credit which easily covers a small NestJS app.

### Steps

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select your repo, set the **Root Directory** to `backend`
3. Railway auto-detects Node.js. Set the **Start Command**:
   ```
   npm run start:prod
   ```
4. Set **Build Command**:
   ```
   npm install && npm run build
   ```

### Environment variables on Railway

Go to your service → **Variables** and add:

```
DATABASE_URL        = postgresql://postgres.xxxx:[pw]@...pooler.supabase.com:6543/postgres
SUPABASE_URL        = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY= eyJ...
JWT_SECRET          = <generate a long random string>
PORT                = 3001
```

> Generate a good JWT secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

5. After deploy, Railway gives you a URL like `https://halal-poker-backend.up.railway.app`
6. Note this URL — you need it for the frontend.

### WebSocket support

Railway supports WebSockets out of the box. No extra config needed for Socket.IO.

---

## 3. Vercel (Frontend)

### Steps

1. Go to [vercel.com](https://vercel.com) → **Add New Project → Import Git Repository**
2. Select your repo, set **Root Directory** to `frontend`
3. Vercel auto-detects Vite. Framework preset: **Vite**
4. Build settings (auto-detected, but verify):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Environment variables on Vercel

Go to your project → **Settings → Environment Variables**:

```
VITE_API_URL = https://halal-poker-backend.up.railway.app
```

### Update frontend to use the env var

Update [frontend/src/lib/api.ts](frontend/src/lib/api.ts) — change the `BASE` const:

```ts
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';
```

Update [frontend/src/lib/socket.ts](frontend/src/lib/socket.ts) — change the `io()` URL:

```ts
socket = io(import.meta.env.VITE_API_URL ?? 'http://localhost:3001', {
```

### CORS on the backend

In [backend/src/main.ts](backend/src/main.ts), update CORS to allow your Vercel domain:

```ts
app.enableCors({
  origin: [
    'http://localhost:5173',
    'https://your-app.vercel.app',   // ← add this
  ],
  credentials: true,
});
```

Set `FRONTEND_URL` as a Railway env var and read it dynamically:

```ts
app.enableCors({
  origin: process.env.FRONTEND_URL?.split(',') ?? 'http://localhost:5173',
  credentials: true,
});
```

Then set `FRONTEND_URL=https://your-app.vercel.app` on Railway.

---

## 4. Git setup before pushing

Make sure these are in `.gitignore` (already done):
- `node_modules/`
- `dist/`
- `.env` and `.env.*`

Initialize git if not done:
```bash
cd /path/to/halal-poker
git init
git add .
git commit -m "initial commit"
```

Create a GitHub repo and push:
```bash
git remote add origin https://github.com/your-username/halal-poker.git
git branch -M main
git push -u origin main
```

Both Railway and Vercel will auto-deploy on every push to `main`.

---

## 5. Custom domain (optional, free)

Both Railway and Vercel allow adding a custom domain for free:
- Vercel: Settings → Domains → Add
- Railway: Service → Settings → Domains → Add Custom Domain

---

## 6. Post-deploy checklist

- [ ] Run `npx prisma migrate deploy` against prod DB
- [ ] Set `isAdmin = true` for your user in Supabase Table Editor
- [ ] Test magic link login (check Supabase Auth → Users)
- [ ] Create first invite code from the admin panel
- [ ] Create a test table and verify Socket.IO connects (check browser console)
- [ ] Test voice chat between two browser tabs

---

## Costs at scale

If you outgrow free tiers:

| Service | Paid plan | When you need it |
|---------|-----------|-----------------|
| Supabase | $25/mo | >500 MB database |
| Railway | ~$5-10/mo | Hits $5 credit (unlikely for friend group) |
| Vercel | $20/mo Pro | >100 GB bandwidth/mo (very unlikely) |

For a private poker group, **you will almost certainly never leave the free tier.**
