# Nyx phone sounds

Source drop folder. Served files live in `public/sounds/` (copy or sync there for the app).

Naming:
- `welcomeN.mp3` — played once when Nyx picks up (e.g. `welcome1.mp3`, `welcome2.mp3`)
- `listeningN.mp3` — short listening cues while your turn is processing (e.g. `listening1.mp3`)

Add new numbered files to **both** this folder (backup) and `public/sounds/` so `/api/nyx/phone/sounds` picks them up automatically.
