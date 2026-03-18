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
- `joinRoom("main", "wss://your-server/ws")` (optional WS URL)
- `disconnectRoom()`
- `setServer("wss://your-server/ws")`
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
- `setFirstPersonMouseRotate(true | false)` (default `true`)
- `setThirdPersonMouseRotate(true | false)` (default `false`)
- `setMouseSensitivity(1.0)`
- `setCameraPitchLimits(-80, 80)`
- `createFloor(80, "#4f8f4f")`
- `createBaseplate(80, "#4f8f4f")`
- `setSky("day" | "sunset" | "night" | "#87ceeb")`
- `setSunIntensity(1.2)`
- `setAmbientLight("#ffffff")`
- `setGravity(-24)`
- `setSprintMultiplier(1.65)`
- `setAcceleration(42)`
- `setDeceleration(30)`
- `setCoyoteTime(0.12)`
- `setJumpBuffer(0.12)`
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
- `onTouched("Pad", "print:Checkpoint")`
- `onTouched("Pad", "jump:12")`
- `onTouched("Portal", "teleport:0,3,0")`
- `clearTouched("Pad")`
- `createTrigger("Gate", 8, 1, 0, 3, 2, 3, "#00ffaa")`
- `onEnter("Gate", "print:Entered")`
- `onExit("Gate", "print:Exited")`
- `clearTrigger("Gate")`
- `spinPart("Box", 0, 45, 0)` and `stopSpin("Box")`
- `pulsePart("Box", 2.0, 0.9, 1.1)` and `stopPulse("Box")`
- `listParts()`
- `focusPart("Box")`
- `resetCamera()`
- `clearWorld()`

## Sandbox & Fullscreen

- `Fullscreen` button: opens the 3D viewport in native fullscreen.
- `Focus Mode` button: hides editor UI and switches to full viewport mode in the same tab.
- `Esc` exits fullscreen; pressing `Esc` again exits focus mode.
- In first-person on desktop, mouse uses pointer lock for FPS-style camera look.

## Multiplayer (no backend)

- Use `Room` input + `Connect` button.
- Other players appear as live avatars in the scene.
- `Run` now broadcasts the script to all players in the same room, so code executes for everyone.
- New players now receive current shared world state on join (floor, sky, parts, materials, animations).
- This uses `BroadcastChannel`, so it works between tabs/windows of the same site origin (browser-local).

## Multiplayer Between Devices (WebSocket)

1. Run relay server from `server/`:
   - `npm install`
   - `npm start`
2. Expose it on public URL (for example via VPS/Cloud/Render/Fly).
3. In UI, put websocket URL into `server` field and connect room.
4. Now rooms work across different devices/browsers.

## Controls

- `W A S D` move relative to camera direction
- `Shift` sprint
- `Space` jump
- `V` toggle first/third person
- Mobile auto-detection: shows touch joystick + look pad + jump button only on mobile/touch devices.

## Movement Notes

- By default: first-person rotates with mouse, third-person does not.
- Player now has acceleration/deceleration, coyote time, and jump buffering.
- Player collides with spawned parts and can stand on top of them.
