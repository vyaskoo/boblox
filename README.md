# boblox

Static GitHub Pages sandbox with Roblox-like scripting commands.

## Deploy

1. Upload `index.html`, `app.js`, `styles.css`, `README.md` to your repo root.
2. GitHub -> `Settings -> Pages`.
3. Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Open `https://<user>.github.io/<repo>/`.

## Script API

- `print("text")`
- `joinRoom("main")`
- `disconnectRoom()`
- `createPlayer("Noob")`
- `setPlayerColor("#2e86de", "#f2d2a5")`
- `setSpeed(12)`
- `setJumpPower(10)`
- `movePlayer(2, 0)`
- `teleport(0, 3, 0)`
- `jump(8)`
- `lookAt(10, 1, 10)`
- `setCameraMode("follow" | "free")`
- `setViewMode("first" | "third")`
- `toggleView()`
- `createFloor(80, "#4f8f4f")`
- `createBaseplate(80, "#4f8f4f")`
- `setSky("day" | "sunset" | "night" | "#87ceeb")`
- `setSunIntensity(1.2)`
- `setAmbientLight("#ffffff")`
- `setGravity(-24)`
- `spawnPart("Box", 2, 1, 0, 2, "#ff8844")`
- `createPart(...)` (alias of `spawnPart`)
- `spawnBlock("Pad", x, y, z, sx, sy, sz, "#44aaff")`
- `clonePart("Box", "Box2")`
- `renamePart("Box2", "Crate")`
- `destroyPart("Box")`
- `deletePart("Box")` (alias)
- `setPartColor("Box", "#00ff99")`
- `setPartSize("Box", 3)`
- `setPartPosition("Box", 0, 2, 0)`
- `movePart("Box", 0, 1, 0)`
- `rotatePart("Box", 0, 45, 0)`
- `setPartMaterial("Box", "metal" | "plastic" | "neon" | "standard")`
- `setPartTransparency("Box", 0.35)` (`0` solid, `1` invisible)
- `setPartEmissive("Box", "#00ff99", 0.5)`
- `setAnchored("Box", false)`
- `spinPart("Box", 0, 45, 0)` and `stopSpin("Box")`
- `pulsePart("Box", 2.0, 0.9, 1.1)` and `stopPulse("Box")`
- `listParts()`
- `focusPart("Box")`
- `resetCamera()`
- `clearWorld()`

## Sandbox & Fullscreen

- `Fullscreen` button: opens the 3D viewport in native fullscreen.
- `Sandbox Window` button: opens a new window (`?sandbox=1`) with only the sandbox view.

## Multiplayer (no backend)

- Use `Room` input + `Connect` button.
- Other players appear as live avatars in the scene.
- `Run` now broadcasts the script to all players in the same room, so code executes for everyone.
- New players now receive current shared world state on join (floor, sky, parts, materials, animations).
- This uses `BroadcastChannel`, so it works between tabs/windows of the same site origin (browser-local).

## Controls

- `W A S D` move relative to camera direction
- `Space` jump
- `V` toggle first/third person
