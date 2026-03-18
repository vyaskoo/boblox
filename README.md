# boblox

Static GitHub Pages sandbox with Roblox-like scripting commands.

## Deploy

1. Upload `index.html`, `app.js`, `styles.css`, `README.md` to your repo root.
2. GitHub -> `Settings -> Pages`.
3. Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Open `https://<user>.github.io/<repo>/`.

## Script API

- `print("text")`
- `createPlayer("Noob")`
- `setPlayerColor("#2e86de", "#f2d2a5")`
- `setSpeed(12)`
- `setJumpPower(10)`
- `movePlayer(2, 0)`
- `teleport(0, 3, 0)`
- `jump(8)`
- `lookAt(10, 1, 10)`
- `setCameraMode("follow" | "free")`
- `createFloor(80, "#4f8f4f")`
- `createBaseplate(80, "#4f8f4f")`
- `setSky("day" | "sunset" | "night" | "#87ceeb")`
- `setSunIntensity(1.2)`
- `setAmbientLight("#ffffff")`
- `setGravity(-24)`
- `spawnPart("Box", 2, 1, 0, 2, "#ff8844")`
- `createPart(...)` (alias of `spawnPart`)
- `destroyPart("Box")`
- `deletePart("Box")` (alias)
- `setPartColor("Box", "#00ff99")`
- `setPartSize("Box", 3)`
- `setPartPosition("Box", 0, 2, 0)`
- `movePart("Box", 0, 1, 0)`
- `rotatePart("Box", 0, 45, 0)`
- `setPartMaterial("Box", "metal" | "plastic" | "neon" | "standard")`
- `setAnchored("Box", false)`
- `clearWorld()`

## Controls

- `W A S D` move player
- `Space` jump
