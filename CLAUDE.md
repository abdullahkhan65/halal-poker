# Halal Poker — Claude Context

Private invite-only poker portal. React frontend + NestJS backend + Supabase PostgreSQL.

## Running the project

```bash
npm run dev              # both servers via concurrently
# backend:  http://localhost:3001
# frontend: http://localhost:5173
```

## Key architectural decisions

### Prisma 7 (breaking changes from v5/v6)
- `datasource db` in `schema.prisma` has **no `url` field** — URL lives in `prisma.config.ts` under `datasource.url`
- `PrismaClient` constructor **no longer accepts** `datasources` or `datasourceUrl`
- Must use a driver adapter: `@prisma/adapter-pg` is installed
- `PrismaService` passes the adapter via `super({ adapter })` — see `backend/src/prisma/prisma.service.ts`
- `PrismaClient` is still imported from `@prisma/client` after running `npx prisma generate`

### Auth
- Supabase magic link → user pastes token from URL → backend verifies with `supabase.auth.getUser(token)` → issues 30-day JWT
- New users require an invite code; existing users skip it
- JWT is stored in `localStorage` and sent as `Authorization: Bearer` header
- Socket.IO auth: token passed via `socket.handshake.auth.token` and verified in `handleConnection`

### Poker engine
- Pure TypeScript in `backend/src/poker/poker.engine.ts` — no framework dependencies
- Server is fully authoritative: all game state lives in `PokerService` (in-memory Map)
- Client receives `GameState` after every action via `game_state` socket event
- Hand evaluation uses 5-card combination enumeration (C(7,5) = 21 combos)
- `deepClone` via `JSON.parse(JSON.stringify(...))` — game state is always plain objects

### Game state (in-memory)
- Tables stored in `Map<tableId, Table>` in `PokerService` — **not persisted to DB**
- Online game results must be manually finalized via admin panel or future automation
- Player-to-table mapping tracked in `playerTableMap` for disconnect handling

### Starting chips
- Always **20,000** per player — defined as `START_CHIPS = 20000` in `sessions.service.ts`
- Profit = `endChips - 20000`
- `totalEarnings` on `User` is the running cumulative sum, updated on each `finalizeSession`

### Admin guard
- `AdminGuard` checks `req.user.isAdmin` (from JWT → DB lookup in `JwtStrategy.validate`)
- Set `isAdmin = true` directly in Supabase table editor or SQL

## File map

```
backend/src/
  app.module.ts          root module — imports all feature modules
  main.ts                bootstrap: global prefix /api, CORS, ValidationPipe, port 3001
  auth/
    auth.service.ts      sendMagicLink, verifyToken (invite check here), validateUser
    auth.controller.ts   POST /auth/magic-link, POST /auth/verify, GET /auth/me
    jwt.strategy.ts      validates JWT, returns User from DB
    jwt-auth.guard.ts    standard AuthGuard('jwt')
  common/
    admin.guard.ts       checks user.isAdmin, throws ForbiddenException
  poker/
    poker.engine.ts      pure functions: initGame, dealHoleCards, applyAction, evaluateHand
    poker.service.ts     stateful table manager (in-memory), wraps engine
    poker.gateway.ts     Socket.IO gateway: join/leave/start/action/create/list + WebRTC voice signaling relay
    poker.module.ts      imports JwtModule for socket auth
  prisma/
    prisma.service.ts    extends PrismaClient with PrismaPg adapter, global module
    prisma.module.ts     @Global() — no need to import PrismaModule in feature modules
  sessions/
    sessions.service.ts  create, findAll, findOne, addResult, finalizeSession
    sessions.controller.ts  CRUD endpoints, /finalize requires AdminGuard
  users/
    users.service.ts     findAll, leaderboard, update, createInvite, listInvites
    users.controller.ts  GET /users, GET /users/leaderboard, PATCH /users/me, invite endpoints

frontend/src/
  App.tsx                BrowserRouter + routes + boot-time auth restore (GET /auth/me)
  index.css              Tailwind v4 (@import "tailwindcss") + dark body
  hooks/
    useVoiceChat.ts      WebRTC peer manager: getUserMedia, createPeerConnection per peer, offer/answer/ICE via socket
  lib/
    api.ts               typed fetch wrapper, reads token from localStorage
    socket.ts            Socket.IO singleton, connectSocket/disconnectSocket
  store/
    auth.store.ts        Zustand: user, token, setAuth, logout
    game.store.ts        Zustand: tables, currentGame, currentTableId
  components/
    Layout.tsx           sticky header with nav + logout
    Avatar.tsx           gradient initials fallback, ring on active turn
    PlayingCard.tsx      animated card with rank+suit, faceDown variant
    VoiceChat.tsx        join/leave voice button, mute toggle, per-peer avatar bubbles
    ChipCount.tsx        animated number, green/red coloring
  pages/
    LoginPage.tsx        email → magic link → token paste → invite code (new users)
    LobbyPage.tsx        create/join tables, live list from socket
    TablePage.tsx        full felt table, player seats, D/SB/BB badges, action controls
    LeaderboardPage.tsx  ranked users + session history
    AdminPage.tsx        create sessions, enter chip counts, finalize, invite manager
    ProfilePage.tsx      name + avatar URL editor, earnings display
```

## Environment variables (backend/.env)

```
DATABASE_URL          PostgreSQL connection string (Supabase)
SUPABASE_URL          https://[ref].supabase.co
SUPABASE_SERVICE_KEY  service_role key (not anon key)
JWT_SECRET            random string, 30-day tokens
PORT                  3001
```

## Common tasks

**Add a new API endpoint:**
1. Add method to the relevant `*.service.ts`
2. Add route to `*.controller.ts`
3. Apply `@UseGuards(JwtAuthGuard)` + optionally `AdminGuard`

**Add a new socket event:**
1. Add `@SubscribeMessage('event_name')` handler in `poker.gateway.ts`
2. Call `this.broadcastTable(tableId)` to push updated state to all players

**Change starting chip amount:**
- `backend/src/sessions/sessions.service.ts` — `START_CHIPS` constant
- `frontend/src/pages/AdminPage.tsx` — update the label text

**Run migrations after schema change:**
```bash
cd backend && npx prisma migrate dev --name describe_change
```

**Regenerate Prisma client after schema change:**
```bash
cd backend && npx prisma generate
```

## Gotchas

- Tailwind v4 uses `@import "tailwindcss"` not `@tailwind base/components/utilities`
- Tailwind v4 plugin in vite.config.ts is `tailwindcss()` from `@tailwindcss/vite`, not the postcss plugin
- `PrismaModule` is `@Global()` — never import it in feature modules, `PrismaService` is available everywhere
- Socket tables are in-memory only — server restart clears all active games
- The `usedBy` relation on `Invite` is checked by querying `User.inviteUsedId`, not a direct field on `Invite`
- Frontend proxy in `vite.config.ts` forwards `/api` → `localhost:3001` and `/socket.io` (ws) → `localhost:3001`
