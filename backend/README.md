# Halal Poker — Backend

NestJS REST API + Socket.IO server.

## Stack

- **NestJS** — framework
- **Prisma 7** + `@prisma/adapter-pg` — ORM (requires driver adapter, no binary engine)
- **@supabase/supabase-js** — magic link auth
- **@nestjs/jwt** + **passport-jwt** — JWT issuance + validation
- **Socket.IO** — real-time poker game

## Running

```bash
npm run start:dev    # watch mode
npm run build        # compile to dist/
npm run start:prod   # run compiled
```

## Environment (`backend/.env`)

```env
DATABASE_URL="postgresql://..."
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_SERVICE_KEY="eyJ..."
JWT_SECRET="some-long-random-string"
PORT=3001
```

## Database

```bash
npx prisma migrate dev --name <name>   # apply schema changes
npx prisma generate                    # regenerate client after schema edit
npx prisma studio                      # visual DB browser
```

## Modules

| Module | Responsibility |
|--------|---------------|
| `PrismaModule` | Global DB client (pg adapter). No need to import elsewhere. |
| `AuthModule` | Magic link send, token verify, JWT issue, JwtStrategy |
| `UsersModule` | Leaderboard, profile update, invite CRUD |
| `SessionsModule` | Session create, finalize (profit calc + earnings update) |
| `PokerModule` | In-memory table state, poker engine, Socket.IO gateway |

## Poker engine

`src/poker/poker.engine.ts` — pure functions, no side effects:

- `buildDeck()` + `shuffle()` — 52-card deck, Fisher-Yates
- `initGame()` — create fresh game state
- `dealHoleCards()` — post blinds, deal 2 cards per player, set first actor
- `applyAction()` — fold / check / call / raise, advances round when betting complete
- Hand evaluation: enumerate all C(7,5)=21 five-card combos, score best hand

## Guards

- `JwtAuthGuard` — requires valid JWT (`Authorization: Bearer`)
- `AdminGuard` — requires `user.isAdmin === true` (checked after JWT validation)
