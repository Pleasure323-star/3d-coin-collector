# 3D Coin Collector

A beginner-friendly static browser game for an individual assignment. It uses HTML, CSS, JavaScript, and Three.js, with no backend, npm install, or build step.

## Project files

- `index.html` is the root entry page.
- `style.css` contains the responsive game and identity interface styles.
- `game.js` contains the Three.js arena, player, coin collection rules, controls, and start.ng identity connection.
- `plan.md` records the game rules, start.ng requirements, implementation status, and remaining tasks.

## Play locally

1. Open `index.html` directly in Chrome. An internet connection is needed to load Three.js from cdnjs.
2. Move with WASD or the arrow keys and walk into each coin.
3. Check that the score increases, coins remaining decreases, the completion message appears after the last coin, and **Restart game** resets the round.

A local file or localhost page shows a labeled **Local preview** character. This is expected: start.ng's connect page only responds to games served from a `*.start.ng` address, so local play cannot verify start.ng identity.

## start.ng identity

On a `*.start.ng` address the game asks the hidden `https://start.ng/connect` iframe for `startng:whoami`. It validates both the message origin and iframe source, plus the reply type and request ID. The procedural low-poly character is built from the documented style values: body presentation, top and lower-clothing colors, skin and hair colors, hairstyle, hat, and accessory. The model uses a simple trouser silhouette for both body presentations because the documented schema supplies no separate skirt/trouser choice. start.ng documents appearance settings and a face image, not a 3D model, so this is a recognizable game-style adaptation rather than an exact copy of the profile artwork. A guest uses start.ng's returned guest style and receives a sign-in button. Identity is requested again when the tab becomes visible or regains focus.

The integration code is implemented but its live behavior still needs verification on the actual start.ng game address. Publishing, public GitHub setup, the start.ng pre-publish check, and the cover image are also outstanding. No leaderboard is planned.
