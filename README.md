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

On a `*.start.ng` address the game asks the hidden `https://start.ng/connect` iframe for `startng:whoami`. It validates both the message origin and iframe source, plus the reply type and request ID. The reply documents `style` appearance settings and a `face` PNG data URL for profile cards; it does not document a GLB/GLTF asset, avatar model URL, or 3D avatar renderer API. The game therefore builds a recognizable low-poly humanoid from the documented body, clothing colors, skin and hair colors, hairstyle, hat, and accessory values. The face image is not a full character model and is not used as a body texture. The schema has no skirt/trouser choice, so the model uses trousers for both body presentations. This is a game-style adaptation, not an exact copy of start.ng's avatar mesh or artwork. A guest uses start.ng's returned guest style and receives a sign-in button. Identity is requested again when the tab becomes visible or regains focus.

The existing start.ng integration has been exercised on the published game, where the player appearance was reported as too robot-like. This revised humanoid model is local only and has not been committed or deployed. After review and approval, verify the signed-in character, guest appearance, sign-in return, and identity refresh on the published address. No leaderboard is planned.
