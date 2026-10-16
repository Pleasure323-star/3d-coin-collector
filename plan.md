# Project plan: 3D Coin Collector

## Assignment goal

Build a simple 3D coin collection browser game for an individual assignment, then publish it on start.ng. Keep the game small and beginner-friendly.

## Game rules

- The player moves around a small 3D arena using the keyboard.
- Coins are scattered around the arena; the objective is to collect every coin.
- Each collected coin increases the score by one.
- The game displays the current score and how many coins remain.
- When all coins have been collected, show a clear completion message.
- Include a restart button so the player can start the collection again.
- Keep the arena, controls, and mechanics simple enough for a beginner-friendly individual assignment.
- Do not add unnecessary features or a leaderboard.

## start.ng requirements from the supplied documentation

- The game is a static frontend: HTML, CSS, JavaScript, and static assets. Three.js is allowed. There is no game server or database to build.
- Commit a ready-to-play `index.html` at the repository root (or in one of start.ng's recognized output folders). This project keeps it at the root.
- start.ng serves committed files as-is. It does not install packages or run a build. Do not require npm or a build step; do not publish source that needs compiling.
- Use relative paths for local files (for example, `./game.js` and `assets/coin.png`), and keep assets to supported static file types.
- The published project must be in a public GitHub repository. Do not include secrets.
- File limits: at most 2,000 files, 100 MB total, and 25 MB per file. Hidden files/folders, `node_modules`, and links are excluded. Unsupported file types are skipped.
- Every game must identify the start.ng player. The connect page uses `postMessage` with origin validation; alternatively, the HTTP API requires a start.ng game session. This project uses the documented connect page method.
- Every game must show the player's start.ng character. This game maps the documented `style` fields (body, clothing colors, hair, hat, and accessory) onto the 3D character, with sensible fallbacks for missing or unknown fields.
- Guests use the `guest` appearance returned by start.ng and must have a sign-in option. Refresh identity when the tab becomes visible or focused.
- The connect page at `https://start.ng/connect` only answers games served from a `*.start.ng` address. Local runs therefore show a clearly labeled local preview and cannot verify start.ng identity.
- Leaderboards are optional. This game will not add a leaderboard or custom stats schema.
- A `cover.png`, `cover.jpg`, or `cover.webp` is recommended by the publish checklist: 16:10, at least 640 × 400, under 2 MB, next to `index.html` or at the repo root. Missing cover is a warning, not a publish-blocking error.

## Project structure

- `index.html`: root document, game interface, identity display, and sign-in button.
- `style.css`: responsive page, HUD, and identity display styles.
- `game.js`: Three.js scene, coin gameplay, and start.ng connect-page integration.
- `README.md`: setup, local play instructions, and integration verification status.
- `plan.md`: assignment scope, requirements, and remaining work.

## Implementation status

- Core game implemented and reported tested successfully in Chrome: keyboard movement, coin collection, score, completion, restart, and responsive rendering.
- start.ng identity integration implemented using the documented hidden iframe and `startng:whoami` message. Message replies are checked against both `https://start.ng` origin and the connect iframe's `contentWindow`, and must match the requested reply type and request ID.
- Signed-in player and guest styles are mapped onto the in-game character. Guests see a sign-in button using the documented return URL format.
- Identity refresh is attached to focus and visible-tab events.
- Live start.ng behavior has not yet been verified. The connect page does not respond to local file or localhost pages; identity and sign-in must be tested on the actual `*.start.ng` game address.
- The project has not been published.

## Remaining steps

1. Once published on a `*.start.ng` address, verify signed-in player identity, guest appearance, sign-in return, and identity refresh after focus/visibility changes.
2. Add a suitable cover image and verify the repo respects file and type limits.
3. Push the ready-to-play project to a public GitHub repo. Call `POST https://api.start.ng/games/check` with the repo details, fix errors, and review warnings.
4. Publish with `POST https://api.start.ng/games/publish`. For a first-time unsigned publish, open the returned one-time `approve_url` within its 30-day validity and approve the game. Later updates normally publish from pushes to the linked branch; use the documented API when an immediate update is needed.
