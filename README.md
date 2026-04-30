# Imposter Drawing

A real-time multiplayer drawing game for 3–8 players. One player is secretly the **imposter** — they don't know the word but must draw convincingly and avoid being voted out.

**[Play it live →](https://imposter-drawing.vercel.app)**

---

## How it works

1. One player creates a room and shares the 6-character code
2. Everyone joins — host starts when 3+ players are in
3. Each player is secretly assigned **Artist** (knows the word) or **Imposter** (doesn't)
4. Players draw one stroke at a time in a fixed rotation, two full rounds
5. After drawing, everyone votes for who they think the imposter is
6. Reveal: did the crew catch them?

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Realtime | Socket.IO v4 (WebSocket-only, no long-polling) |
| Backend | Node.js, Express |
| Canvas | Vanilla JS — dual-layer canvas, Pointer Events API |
| Tests | Vitest, React Testing Library (104 tests) |
| CI | GitHub Actions — test + build gates on every PR |
| Deploy | Vercel (frontend) + Render (backend) |

## Architecture decisions

**In-process state, no database.** Rooms live in a `Map` on the server. For a game that resets every round and doesn't need persistence, this is faster and simpler than a database. The SQLite integration point is stubbed for if that ever changes.

**`turnSeq` for race conditions.** Every turn has an incrementing sequence number. `end_turn` is rejected if the client's `turnSeq` doesn't match the server's current one — prevents double-submission and handles the case where a player's turn times out as they click End Turn simultaneously.

**Server-issued session tokens.** Players get a UUID `sessionToken` on join. All subsequent events are authenticated against this token server-side, so spoofing another player's moves is not possible. Tokens also enable reconnection: disconnect mid-game, come back with the same token and rejoin in place.

**Dual-layer canvas.** A committed canvas holds all finished strokes; an active canvas sits on top for the in-progress stroke. Only the active layer is cleared between pointer events — no full redraw on every frame. Coordinates are normalised to `[0, 1]` before sending so the drawing looks the same across different screen sizes.

**Pointer Events API over Touch/Mouse.** One unified event model handles mouse, touch, and stylus. `setPointerCapture` keeps the stroke live even if the pointer leaves the canvas mid-stroke.

## Running locally

```bash
# Clone and install
git clone https://github.com/callmepri2003/imposterDrawing
cd imposterDrawing
npm install          # installs root workspace deps
cd backend && npm install
cd ../frontend && npm install

# Run both servers
cd ..
npm run dev          # backend :3000, frontend :5173
```

Open [http://localhost:5173](http://localhost:5173) in multiple tabs to simulate multiple players.

## Tests

```bash
npm run test:backend   # 42 tests, coverage ≥ 75%
npm run test:frontend  # 62 tests, coverage ≥ 75%
```

Coverage thresholds are enforced in CI — a PR that drops coverage below the threshold won't pass.

## Deployment

**Backend → Render**
1. Connect repo at [render.com](https://render.com) → New Web Service
2. Render auto-detects `render.yaml` — select the `imposter-drawing-backend` service
3. Deploy. Note the URL (e.g. `https://imposter-drawing-backend.onrender.com`)

**Frontend → Vercel**
1. Import repo at [vercel.com](https://vercel.com) → New Project
2. Set **Root Directory** to `frontend`
3. Add environment variable: `VITE_SOCKET_URL` = your Render backend URL
4. Deploy
