# Halal Poker — Frontend

React + Vite client for the private poker portal.

## Stack

- **React 19** + **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin — no PostCSS config needed)
- **Framer Motion** — card deal animations, chip counts, winner overlay
- **Zustand** — auth store + game store
- **Socket.IO client** — real-time game events
- **React Router DOM v7** — client-side routing

## Running

```bash
npm run dev      # Vite dev server on :5173
npm run build    # production build
npm run lint     # eslint
```

## Proxy

`vite.config.ts` proxies:
- `/api/*` → `http://localhost:3001`
- `/socket.io` (ws) → `http://localhost:3001`

So all API calls use relative paths (no CORS issues in dev).

## Pages

| Route | Page | Access |
|-------|------|--------|
| `/login` | `LoginPage` | Public |
| `/lobby` | `LobbyPage` | Auth |
| `/table/:tableId` | `TablePage` | Auth |
| `/leaderboard` | `LeaderboardPage` | Auth |
| `/profile` | `ProfilePage` | Auth |
| `/admin` | `AdminPage` | Auth + Admin |

## State

**`auth.store.ts`** (Zustand)
- `user` — current User object
- `token` — JWT (also in localStorage)
- `setAuth(user, token)` — persists token
- `logout()` — clears token + user

**`game.store.ts`** (Zustand)
- `tables` — live table list from socket
- `currentGame` — full `GameState` from server
- `currentTableId` — active table

## Socket lifecycle

1. `connectSocket()` — creates singleton Socket.IO instance with JWT from localStorage
2. `TablePage` emits `join_table` on mount, listens to `game_state` events
3. `LobbyPage` emits `get_tables` on mount, listens to `tables_updated`
4. Socket disconnects when `TablePage` unmounts

## Key components

| Component | Description |
|-----------|-------------|
| `PlayingCard` | Animated card with suit symbol, faceDown variant for opponents |
| `Avatar` | Gradient initials fallback, yellow ring on active turn |
| `ChipCount` | Animated number, green/red based on value |
| `Layout` | Sticky header with nav links + logout |

## Tailwind v4 notes

- Import: `@import "tailwindcss"` in `index.css` (not `@tailwind` directives)
- Plugin in `vite.config.ts`: `import tailwindcss from '@tailwindcss/vite'` → `plugins: [react(), tailwindcss()]`
- No `tailwind.config.js` needed for basic usage
