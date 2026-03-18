const defaults = {
  luau: [
    'print("Boblox boot")',
    'createBaseplate(90, "#507f50")',
    'setSky("sunset")',
    'createPlayer("Noob")',
    "setSpeed(11)",
    "setJumpPower(10)",
    'spawnPart("Tower", 6, 2, 0, 3, "#ff8844")',
    'setPartMaterial("Tower", "metal")',
    'spinPart("Tower", 0, 45, 0)'
  ].join("\n"),
  python: [
    'print("Boblox boot")',
    'createFloor(90, "#507f50")',
    'setSky("day")',
    'createPlayer("Coder")',
    "setSpeed(11)",
    "setGravity(-24)",
    'spawnBlock("Pad", 0, 0.5, 6, 6, 1, 6, "#44aaff")',
    'pulsePart("Pad", 2.0, 0.9, 1.1)'
  ].join("\n")
};

const languageEl = document.getElementById("language");
const editorEl = document.getElementById("editor");
const logsEl = document.getElementById("logs");
const runBtn = document.getElementById("runBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const sandboxBtn = document.getElementById("sandboxBtn");
const gameInputEl = document.getElementById("gameInput");
const roomInputEl = document.getElementById("roomInput");
const connectBtn = document.getElementById("connectBtn");
const newRoomBtn = document.getElementById("newRoomBtn");
const qrBtn = document.getElementById("qrBtn");
const mpStatusEl = document.getElementById("mpStatus");
const qrWrapEl = document.getElementById("qrWrap");
const qrCodeEl = document.getElementById("qrCode");
const shareUrlEl = document.getElementById("shareUrl");
const canvas = document.getElementById("scene");
const mobileHudEl = document.getElementById("mobileHud");
const movePadEl = document.getElementById("movePad");
const moveKnobEl = document.getElementById("moveKnob");
const lookPadEl = document.getElementById("lookPad");
const jumpBtnEl = document.getElementById("jumpBtn");

const isMobileDevice =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  ((window.matchMedia?.("(pointer:coarse)")?.matches ?? false) && Math.min(window.innerWidth, window.innerHeight) <= 1024);

const peerState = {
  id: `p_${Math.random().toString(36).slice(2, 10)}`,
  room: null,
  transport: "websocket",
  wsUrl: "",
  socket: null,
  timer: null,
  syncTimeout: null,
  awaitingWorldSync: false,
  hadOpen: false,
  remotes: new Map(),
  lastSentAt: 0
};

const world = {
  engine: null,
  scene: null,
  camera: null,
  light: null,
  floor: null,
  floorSize: 70,
  floorColor: "#4f8f4f",
  skyMode: "day",
  sunIntensity: 0.95,
  lightColor: "#ffffff",
  ambientColor: "#000000",
  playerRoot: null,
  playerBody: null,
  playerHead: null,
  playerLabel: "Player",
  playerBodyColor: "#2e86de",
  playerHeadColor: "#f2d2a5",
  speed: 8,
  sprintMultiplier: 1.65,
  acceleration: 42,
  deceleration: 30,
  coyoteTimeWindow: 0.12,
  coyoteTimer: 0,
  jumpBufferWindow: 0.12,
  jumpBufferTimer: 0,
  bufferedJumpPower: 0,
  velocityXZ: new BABYLON.Vector2(0, 0),
  standHeight: 1.6,
  headOffset: 0.9,
  collisionRadius: 0.42,
  jumpPower: 9,
  viewMode: "third",
  firstPersonRotateWithMouse: true,
  thirdPersonRotateWithMouse: false,
  mouseSensitivity: 1.0,
  pitchMinDeg: -80,
  pitchMaxDeg: 80,
  velocityY: 0,
  grounded: false,
  gravity: -22,
  cameraMode: "follow",
  keys: new Set(),
  spawnIndex: 0,
  parts: new Map(),
  dynamicParts: new Set(),
  touchHandlers: new Map(),
  touchActive: new Set(),
  touchLastFired: new Map(),
  touchCooldownMs: 120,
  triggerEnterHandlers: new Map(),
  triggerExitHandlers: new Map(),
  triggerActive: new Set(),
  pointerLocked: false,
  mobileEnabled: false,
  mobileMoveX: 0,
  mobileMoveZ: 0,
  mobileLookDX: 0,
  mobileLookDY: 0,
  mobileJumpPressed: false,
  moveTouchId: null,
  lookTouchId: null,
  lookLastX: 0,
  lookLastY: 0
};

editorEl.value = defaults.luau;
const queryParams = new URLSearchParams(window.location.search);
const roomQuery = queryParams.get("room");
const gameQuery = queryParams.get("game");
if (gameQuery) {
  gameInputEl.value = gameQuery;
}
if (roomQuery) {
  roomInputEl.value = roomQuery;
}
setServerUrl(deriveDefaultWsUrl());

if (new URLSearchParams(window.location.search).get("sandbox") === "1") {
  document.body.classList.add("focus-mode");
  sandboxBtn.textContent = "Exit Focus";
}

if (isMobileDevice) {
  document.body.classList.add("mobile-mode");
}

setMultiplayerStatus("offline");
renderRoomQr();

languageEl.addEventListener("change", () => {
  editorEl.value = defaults[languageEl.value];
});

runBtn.addEventListener("click", () => {
  const language = languageEl.value;
  const code = editorEl.value;
  const result = runScript(language, code);
  logsEl.textContent = result.join("\n");
  if (peerState.socket) {
    sendPeerMessage({ type: "run_script", language, code });
  }
});

fullscreenBtn.addEventListener("click", () => {
  const panel = canvas.closest(".panel");
  if (!document.fullscreenElement) {
    panel.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

sandboxBtn.addEventListener("click", () => {
  if (document.body.classList.contains("focus-mode")) {
    exitFocusMode();
  } else {
    enterFocusMode();
  }
});

document.addEventListener("fullscreenchange", () => {
  world.engine?.resize();
  if (!document.fullscreenElement && document.body.classList.contains("focus-mode")) {
    sandboxBtn.textContent = "Focus Mode";
  }
});

connectBtn.addEventListener("click", () => {
  connectRoom();
});

newRoomBtn.addEventListener("click", () => {
  const current = Math.max(1, Number(roomInputEl.value || 1));
  roomInputEl.value = String(current + 1);
  renderRoomQr();
  qrWrapEl.removeAttribute("hidden");
  qrBtn.textContent = "Hide QR";
  connectRoom();
});

qrBtn.addEventListener("click", () => {
  const hidden = qrWrapEl.hasAttribute("hidden");
  if (hidden) {
    renderRoomQr();
    qrWrapEl.removeAttribute("hidden");
    qrBtn.textContent = "Hide QR";
  } else {
    qrWrapEl.setAttribute("hidden", "");
    qrBtn.textContent = "QR";
  }
});

if (roomQuery || gameQuery) {
  setTimeout(() => connectRoom(), 0);
}

window.addEventListener("keydown", (event) => world.keys.add(event.code));
window.addEventListener("keyup", (event) => world.keys.delete(event.code));
window.addEventListener("beforeunload", () => disconnectRoom());
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyV") {
    toggleViewMode();
  }
  if (event.code === "Escape" && document.body.classList.contains("focus-mode") && !document.fullscreenElement) {
    exitFocusMode();
  }
});

canvas.addEventListener("click", () => {
  if (!isMobileDevice) {
    requestPointerLockIfNeeded();
  }
});

document.addEventListener("pointerlockchange", () => {
  world.pointerLocked = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", (event) => {
  if (!world.pointerLocked) return;
  if (world.viewMode !== "first") return;
  applyLookDelta(event.movementX, event.movementY);
});

function enterFocusMode() {
  document.body.classList.add("focus-mode");
  sandboxBtn.textContent = "Exit Focus";
  const panel = canvas.closest(".panel");
  panel?.requestFullscreen?.().catch?.(() => {});
  setTimeout(() => world.engine?.resize(), 80);
}

function exitFocusMode() {
  document.body.classList.remove("focus-mode");
  sandboxBtn.textContent = "Focus Mode";
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch?.(() => {});
  }
  setTimeout(() => world.engine?.resize(), 80);
}

function requestPointerLockIfNeeded() {
  const rotateWithMouse = world.viewMode === "first" && world.firstPersonRotateWithMouse;
  if (!rotateWithMouse) return;
  if (document.pointerLockElement === canvas) return;
  canvas.requestPointerLock?.();
}

function applyLookDelta(deltaX, deltaY) {
  if (!world.camera) return;
  const factor = 0.002 * world.mouseSensitivity;
  world.camera.alpha -= deltaX * factor;
  world.camera.beta += deltaY * factor;
  const lower = world.camera.lowerBetaLimit ?? BABYLON.Tools.ToRadians(10);
  const upper = world.camera.upperBetaLimit ?? BABYLON.Tools.ToRadians(170);
  world.camera.beta = Math.max(lower + 0.001, Math.min(upper - 0.001, world.camera.beta));
}

function setupMobileControls() {
  if (!isMobileDevice || !mobileHudEl) return;
  world.mobileEnabled = true;
  mobileHudEl.setAttribute("aria-hidden", "false");

  const stickRadius = 44;
  const centerKnob = () => {
    moveKnobEl.style.left = "38px";
    moveKnobEl.style.top = "38px";
  };
  centerKnob();

  movePadEl.addEventListener(
    "touchstart",
    (event) => {
      if (world.moveTouchId !== null) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      world.moveTouchId = touch.identifier;
      event.preventDefault();
    },
    { passive: false }
  );

  movePadEl.addEventListener(
    "touchmove",
    (event) => {
      if (world.moveTouchId === null) return;
      let touch = null;
      for (const t of event.changedTouches) {
        if (t.identifier === world.moveTouchId) touch = t;
      }
      if (!touch) return;
      const rect = movePadEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > stickRadius) {
        dx = (dx / len) * stickRadius;
        dy = (dy / len) * stickRadius;
      }
      world.mobileMoveX = dx / stickRadius;
      world.mobileMoveZ = -dy / stickRadius;
      moveKnobEl.style.left = `${38 + dx}px`;
      moveKnobEl.style.top = `${38 + dy}px`;
      event.preventDefault();
    },
    { passive: false }
  );

  const endMove = () => {
    world.moveTouchId = null;
    world.mobileMoveX = 0;
    world.mobileMoveZ = 0;
    centerKnob();
  };
  movePadEl.addEventListener("touchend", endMove, { passive: true });
  movePadEl.addEventListener("touchcancel", endMove, { passive: true });

  lookPadEl.addEventListener(
    "touchstart",
    (event) => {
      if (world.lookTouchId !== null) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      world.lookTouchId = touch.identifier;
      world.lookLastX = touch.clientX;
      world.lookLastY = touch.clientY;
      event.preventDefault();
    },
    { passive: false }
  );

  lookPadEl.addEventListener(
    "touchmove",
    (event) => {
      if (world.lookTouchId === null) return;
      let touch = null;
      for (const t of event.changedTouches) {
        if (t.identifier === world.lookTouchId) touch = t;
      }
      if (!touch) return;
      world.mobileLookDX += touch.clientX - world.lookLastX;
      world.mobileLookDY += touch.clientY - world.lookLastY;
      world.lookLastX = touch.clientX;
      world.lookLastY = touch.clientY;
      event.preventDefault();
    },
    { passive: false }
  );

  const endLook = () => {
    world.lookTouchId = null;
    world.lookLastX = 0;
    world.lookLastY = 0;
  };
  lookPadEl.addEventListener("touchend", endLook, { passive: true });
  lookPadEl.addEventListener("touchcancel", endLook, { passive: true });

  jumpBtnEl.addEventListener(
    "touchstart",
    (event) => {
      world.mobileJumpPressed = true;
      event.preventDefault();
    },
    { passive: false }
  );
  jumpBtnEl.addEventListener("touchend", () => {
    world.mobileJumpPressed = false;
  });
  jumpBtnEl.addEventListener("touchcancel", () => {
    world.mobileJumpPressed = false;
  });
}

function setupScene() {
  world.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  world.scene = new BABYLON.Scene(world.engine);
  setSky("day");

  world.camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2.9,
    24,
    new BABYLON.Vector3(0, 1, 0),
    world.scene
  );
  world.camera.attachControl(canvas, true);
  world.camera.lowerRadiusLimit = 8;
  world.camera.upperRadiusLimit = 90;
  applyCameraSettings();

  world.light = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0), world.scene);
  world.light.intensity = 0.95;

  createFloor(70, "#4f8f4f");
  createPlayer("Noob");
  setViewMode("third");
  setupMobileControls();

  world.engine.runRenderLoop(() => {
    const dt = world.engine.getDeltaTime() / 1000;
    updatePlayer(dt);
    updateDynamicParts(dt);
    updateAnimations(dt);
    updateRemotePlayers();
    maybeBroadcastLocalState();
    world.scene.render();
  });

  window.addEventListener("resize", () => world.engine.resize());
}

function runScript(language, code) {
  const logs = [`[local-runtime] language=${language}`];
  if (!code.trim()) {
    return ["error: code is empty"];
  }

  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--") && !line.startsWith("#"));

  let recognized = 0;
  for (const line of lines) {
    const parsed = parseCall(line);
    if (!parsed) continue;
    const ok = executeCommand(parsed.fn, parsed.args, logs);
    if (ok) recognized += 1;
  }

  if (recognized === 0) {
    logs.push("No recognized commands. See commands hint under editor.");
  }

  return logs;
}

function executeCommand(fn, args, logs) {
  if (fn === "print") {
    logs.push(`[print] ${String(args[0] ?? "")}`);
    return true;
  }
  if (fn === "joinroom") {
    if (args.length > 0) {
      const maybeGame = String(args[0] ?? "").trim();
      if (maybeGame) {
        gameInputEl.value = maybeGame.toLowerCase();
      }
    }
    if (args.length > 1) {
      const roomNo = Math.max(1, Number(args[1] || 1));
      roomInputEl.value = String(roomNo);
    }
    connectRoom();
    logs.push(`[mp] joined '${gameInputEl.value}:${roomInputEl.value}'`);
    return true;
  }
  if (fn === "setserver") {
    logs.push("[mp] setServer disabled (uses current site /ws)");
    return true;
  }
  if (fn === "disconnectroom") {
    disconnectRoom();
    logs.push("[mp] disconnected");
    return true;
  }
  if (fn === "createplayer") {
    createPlayer(String(args[0] ?? "Player"));
    logs.push(`[world] createPlayer '${world.playerLabel}'`);
    return true;
  }
  if (fn === "setplayercolor") {
    setPlayerColor(String(args[0] ?? "#2e86de"), String(args[1] ?? "#f2d2a5"));
    logs.push("[player] setPlayerColor");
    return true;
  }
  if (fn === "setspeed") {
    setSpeed(Number(args[0] ?? 8));
    logs.push(`[player] speed=${world.speed}`);
    return true;
  }
  if (fn === "setjumppower") {
    setJumpPower(Number(args[0] ?? 9));
    logs.push(`[player] jumpPower=${world.jumpPower}`);
    return true;
  }
  if (fn === "moveplayer") {
    movePlayer(Number(args[0] ?? 0), Number(args[1] ?? 0));
    logs.push("[player] movePlayer");
    return true;
  }
  if (fn === "teleport") {
    teleport(Number(args[0] ?? 0), Number(args[1] ?? 2), Number(args[2] ?? 0));
    logs.push("[player] teleport");
    return true;
  }
  if (fn === "jump") {
    jump(Number(args[0] ?? world.jumpPower));
    logs.push("[player] jump");
    return true;
  }
  if (fn === "lookat") {
    lookAt(Number(args[0] ?? 0), Number(args[1] ?? 1), Number(args[2] ?? 0));
    logs.push("[player] lookAt");
    return true;
  }
  if (fn === "setcameramode") {
    setCameraMode(String(args[0] ?? "follow"));
    logs.push(`[camera] mode=${world.cameraMode}`);
    return true;
  }
  if (fn === "setviewmode") {
    setViewMode(String(args[0] ?? "third"));
    logs.push(`[camera] view=${world.viewMode}`);
    return true;
  }
  if (fn === "setfirstpersonmouserotate") {
    setFirstPersonMouseRotate(args[0] !== false);
    logs.push(`[camera] firstPersonMouseRotate=${world.firstPersonRotateWithMouse}`);
    return true;
  }
  if (fn === "setthirdpersonmouserotate") {
    setThirdPersonMouseRotate(args[0] === true);
    logs.push(`[camera] thirdPersonMouseRotate=${world.thirdPersonRotateWithMouse}`);
    return true;
  }
  if (fn === "setmousesensitivity") {
    setMouseSensitivity(Number(args[0] ?? 1));
    logs.push(`[camera] mouseSensitivity=${world.mouseSensitivity.toFixed(2)}`);
    return true;
  }
  if (fn === "setcamerapitchlimits") {
    setCameraPitchLimits(Number(args[0] ?? -80), Number(args[1] ?? 80));
    logs.push(`[camera] pitch=[${world.pitchMinDeg}, ${world.pitchMaxDeg}]`);
    return true;
  }
  if (fn === "toggleview") {
    toggleViewMode();
    logs.push(`[camera] view=${world.viewMode}`);
    return true;
  }
  if (fn === "focuspart") {
    const mesh = getPart(String(args[0] ?? ""));
    if (mesh) {
      world.camera.lockedTarget = mesh;
      world.cameraMode = "part";
      logs.push(`[camera] focusPart '${mesh.name}'`);
      return true;
    }
    logs.push("[camera] part not found");
    return true;
  }
  if (fn === "resetcamera") {
    world.camera.lockedTarget = world.playerRoot;
    world.cameraMode = "follow";
    logs.push("[camera] resetCamera");
    return true;
  }
  if (fn === "createfloor" || fn === "createbaseplate") {
    createFloor(Number(args[0] ?? 60), String(args[1] ?? "#4f8f4f"));
    logs.push("[world] createFloor");
    return true;
  }
  if (fn === "setsky") {
    setSky(String(args[0] ?? "day"));
    logs.push("[world] setSky");
    return true;
  }
  if (fn === "setsunintensity") {
    setSunIntensity(Number(args[0] ?? 1));
    logs.push(`[world] sunIntensity=${world.light.intensity.toFixed(2)}`);
    return true;
  }
  if (fn === "setlightcolor") {
    setLightColor(String(args[0] ?? "#ffffff"));
    logs.push("[world] setLightColor");
    return true;
  }
  if (fn === "setambientlight") {
    setAmbientLight(String(args[0] ?? "#ffffff"));
    logs.push("[world] setAmbientLight");
    return true;
  }
  if (fn === "setgravity") {
    setGravity(Number(args[0] ?? -22));
    logs.push(`[world] gravity=${world.gravity}`);
    return true;
  }
  if (fn === "setsprintmultiplier") {
    setSprintMultiplier(Number(args[0] ?? 1.65));
    logs.push(`[player] sprintMultiplier=${world.sprintMultiplier.toFixed(2)}`);
    return true;
  }
  if (fn === "setacceleration") {
    setAcceleration(Number(args[0] ?? 42));
    logs.push(`[player] acceleration=${world.acceleration.toFixed(1)}`);
    return true;
  }
  if (fn === "setdeceleration") {
    setDeceleration(Number(args[0] ?? 30));
    logs.push(`[player] deceleration=${world.deceleration.toFixed(1)}`);
    return true;
  }
  if (fn === "setcoyotetime") {
    setCoyoteTime(Number(args[0] ?? 0.12));
    logs.push(`[player] coyoteTime=${world.coyoteTimeWindow.toFixed(2)}`);
    return true;
  }
  if (fn === "setjumpbuffer") {
    setJumpBuffer(Number(args[0] ?? 0.12));
    logs.push(`[player] jumpBuffer=${world.jumpBufferWindow.toFixed(2)}`);
    return true;
  }
  if (fn === "clearworld") {
    clearWorld();
    logs.push("[world] clearWorld");
    return true;
  }
  if (fn === "listparts") {
    const names = [...world.parts.keys()];
    logs.push(names.length ? `[world] parts: ${names.join(", ")}` : "[world] no parts");
    return true;
  }
  if (fn === "spawnpart" || fn === "createpart") {
    const name = String(args[0] ?? `Part${world.spawnIndex + 1}`);
    const x = Number(args[1] ?? (world.spawnIndex % 8) - 4);
    const y = Number(args[2] ?? 1);
    const z = Number(args[3] ?? Math.floor(world.spawnIndex / 8) * 2 - 4);
    const size = Number(args[4] ?? 1.5);
    const color = String(args[5] ?? "#a4c2ff");
    spawnPart(name, x, y, z, size, color);
    logs.push(`[world] spawnPart '${name}'`);
    return true;
  }
  if (fn === "spawnblock") {
    const name = String(args[0] ?? `Block${world.spawnIndex + 1}`);
    const x = Number(args[1] ?? 0);
    const y = Number(args[2] ?? 1);
    const z = Number(args[3] ?? 0);
    const sx = Number(args[4] ?? 2);
    const sy = Number(args[5] ?? 2);
    const sz = Number(args[6] ?? 2);
    const color = String(args[7] ?? "#a4c2ff");
    spawnBlock(name, x, y, z, sx, sy, sz, color);
    logs.push(`[world] spawnBlock '${name}'`);
    return true;
  }
  if (fn === "clonepart") {
    clonePart(String(args[0] ?? ""), String(args[1] ?? ""));
    logs.push("[part] clonePart");
    return true;
  }
  if (fn === "renamepart") {
    renamePart(String(args[0] ?? ""), String(args[1] ?? ""));
    logs.push("[part] renamePart");
    return true;
  }
  if (fn === "destroypart" || fn === "deletepart") {
    destroyPart(String(args[0] ?? ""));
    logs.push("[part] destroyPart");
    return true;
  }
  if (fn === "setpartcolor") {
    setPartColor(String(args[0] ?? ""), String(args[1] ?? "#ffffff"));
    logs.push("[part] setPartColor");
    return true;
  }
  if (fn === "setpartsize" || fn === "scalepart") {
    setPartSize(String(args[0] ?? ""), Number(args[1] ?? 1));
    logs.push("[part] setPartSize");
    return true;
  }
  if (fn === "setpartposition") {
    setPartPosition(String(args[0] ?? ""), Number(args[1] ?? 0), Number(args[2] ?? 0), Number(args[3] ?? 0));
    logs.push("[part] setPartPosition");
    return true;
  }
  if (fn === "movepart") {
    movePart(String(args[0] ?? ""), Number(args[1] ?? 0), Number(args[2] ?? 0), Number(args[3] ?? 0));
    logs.push("[part] movePart");
    return true;
  }
  if (fn === "rotatepart") {
    rotatePart(String(args[0] ?? ""), Number(args[1] ?? 0), Number(args[2] ?? 0), Number(args[3] ?? 0));
    logs.push("[part] rotatePart");
    return true;
  }
  if (fn === "setpartmaterial") {
    setPartMaterial(String(args[0] ?? ""), String(args[1] ?? "standard"));
    logs.push("[part] setPartMaterial");
    return true;
  }
  if (fn === "setparttransparency") {
    setPartTransparency(String(args[0] ?? ""), Number(args[1] ?? 0));
    logs.push("[part] setPartTransparency");
    return true;
  }
  if (fn === "setpartemissive") {
    setPartEmissive(String(args[0] ?? ""), String(args[1] ?? "#ffffff"), Number(args[2] ?? 0.4));
    logs.push("[part] setPartEmissive");
    return true;
  }
  if (fn === "setanchored") {
    setAnchored(String(args[0] ?? ""), args[1] ?? true);
    logs.push("[part] setAnchored");
    return true;
  }
  if (fn === "createtrigger") {
    const name = String(args[0] ?? `Trigger${world.spawnIndex + 1}`);
    const x = Number(args[1] ?? 0);
    const y = Number(args[2] ?? 1);
    const z = Number(args[3] ?? 0);
    const sx = Number(args[4] ?? 3);
    const sy = Number(args[5] ?? 2);
    const sz = Number(args[6] ?? 3);
    const color = String(args[7] ?? "#00ffaa");
    createTrigger(name, x, y, z, sx, sy, sz, color);
    logs.push("[trigger] createTrigger");
    return true;
  }
  if (fn === "onenter") {
    onEnter(String(args[0] ?? ""), String(args[1] ?? ""));
    logs.push("[trigger] onEnter");
    return true;
  }
  if (fn === "onexit") {
    onExit(String(args[0] ?? ""), String(args[1] ?? ""));
    logs.push("[trigger] onExit");
    return true;
  }
  if (fn === "cleartrigger") {
    clearTrigger(String(args[0] ?? ""));
    logs.push("[trigger] clearTrigger");
    return true;
  }
  if (fn === "ontouched") {
    onTouched(String(args[0] ?? ""), String(args[1] ?? ""));
    logs.push("[part] onTouched");
    return true;
  }
  if (fn === "cleartouched") {
    clearTouched(String(args[0] ?? ""));
    logs.push("[part] clearTouched");
    return true;
  }
  if (fn === "spinpart") {
    spinPart(String(args[0] ?? ""), Number(args[1] ?? 0), Number(args[2] ?? 45), Number(args[3] ?? 0));
    logs.push("[part] spinPart");
    return true;
  }
  if (fn === "stopspin") {
    stopSpin(String(args[0] ?? ""));
    logs.push("[part] stopSpin");
    return true;
  }
  if (fn === "pulsepart") {
    pulsePart(String(args[0] ?? ""), Number(args[1] ?? 2), Number(args[2] ?? 0.9), Number(args[3] ?? 1.1));
    logs.push("[part] pulsePart");
    return true;
  }
  if (fn === "stoppulse") {
    stopPulse(String(args[0] ?? ""));
    logs.push("[part] stopPulse");
    return true;
  }
  return false;
}

function parseCall(line) {
  const match = line.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
  if (!match) return null;
  return { fn: match[1].toLowerCase(), args: splitArgs(match[2]).map(parseArg) };
}

function splitArgs(raw) {
  if (!raw.trim()) return [];
  const args = [];
  let chunk = "";
  let quote = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (!quote && (ch === '"' || ch === "'" || ch === "`")) {
      quote = ch;
      chunk += ch;
      continue;
    }
    if (quote && ch === quote) {
      quote = "";
      chunk += ch;
      continue;
    }
    if (!quote && ch === ",") {
      args.push(chunk.trim());
      chunk = "";
      continue;
    }
    chunk += ch;
  }
  if (chunk.trim()) args.push(chunk.trim());
  return args;
}

function parseArg(token) {
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1);
  }
  if (token.startsWith("`") && token.endsWith("`")) return token.slice(1, -1);
  if (token.toLowerCase() === "true") return true;
  if (token.toLowerCase() === "false") return false;
  const n = Number(token);
  return Number.isNaN(n) ? token : n;
}

function createPlayer(name) {
  if (world.playerRoot) world.playerRoot.dispose();
  world.playerLabel = String(name || "Player");
  world.playerRoot = new BABYLON.TransformNode("playerRoot", world.scene);
  world.playerRoot.position = new BABYLON.Vector3(0, 1.6, 0);
  world.playerBody = BABYLON.MeshBuilder.CreateBox("body", { width: 1.2, height: 1.6, depth: 0.7 }, world.scene);
  world.playerBody.parent = world.playerRoot;
  world.playerBody.position.y = 0;
  world.playerHead = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.9, segments: 16 }, world.scene);
  world.playerHead.parent = world.playerRoot;
  world.playerHead.position.y = 1.25;
  setPlayerColor("#2e86de", "#f2d2a5");
  world.camera.lockedTarget = world.playerRoot;
  applyViewMode();
  broadcastNow();
}

function setPlayerColor(bodyColor, headColor) {
  if (!world.playerBody || !world.playerHead) return;
  world.playerBodyColor = String(bodyColor);
  world.playerHeadColor = String(headColor);
  const body = new BABYLON.StandardMaterial("bodyMat", world.scene);
  body.diffuseColor = parseColor(bodyColor, new BABYLON.Color3(0.18, 0.52, 0.87));
  world.playerBody.material = body;
  const head = new BABYLON.StandardMaterial("headMat", world.scene);
  head.diffuseColor = parseColor(headColor, new BABYLON.Color3(0.95, 0.82, 0.64));
  world.playerHead.material = head;
  broadcastNow();
}

function setSpeed(speed) {
  if (Number.isFinite(speed)) world.speed = Math.max(1, Math.min(45, speed));
}
function setSprintMultiplier(value) {
  if (Number.isFinite(value)) world.sprintMultiplier = Math.max(1, Math.min(3, value));
}
function setAcceleration(value) {
  if (Number.isFinite(value)) world.acceleration = Math.max(1, Math.min(120, value));
}
function setDeceleration(value) {
  if (Number.isFinite(value)) world.deceleration = Math.max(1, Math.min(120, value));
}
function setCoyoteTime(value) {
  if (Number.isFinite(value)) world.coyoteTimeWindow = Math.max(0, Math.min(0.5, value));
}
function setJumpBuffer(value) {
  if (Number.isFinite(value)) world.jumpBufferWindow = Math.max(0, Math.min(0.5, value));
}
function setJumpPower(power) {
  if (Number.isFinite(power)) world.jumpPower = Math.max(2, Math.min(40, power));
}
function setGravity(value) {
  if (Number.isFinite(value)) world.gravity = Math.max(-80, Math.min(-1, value));
}
function movePlayer(dx, dz) {
  if (!world.playerRoot) return;
  world.playerRoot.position.x += dx;
  world.playerRoot.position.z += dz;
  broadcastNow();
}
function teleport(x, y, z) {
  if (!world.playerRoot) return;
  world.playerRoot.position.set(x, Math.max(1.6, y), z);
  world.velocityY = 0;
  broadcastNow();
}
function lookAt(x, y, z) {
  if (!world.playerRoot) return;
  const dir = new BABYLON.Vector3(x, y, z).subtract(world.playerRoot.position);
  world.playerRoot.rotation.y = Math.atan2(dir.x, dir.z);
  broadcastNow();
}
function performJump(power) {
  world.velocityY = Math.max(2, Math.min(40, power));
  world.grounded = false;
  world.coyoteTimer = 0;
  world.jumpBufferTimer = 0;
}
function jump(power) {
  if (!world.playerRoot) return;
  if (world.grounded || world.coyoteTimer > 0) {
    performJump(power);
    return;
  }
  world.jumpBufferTimer = world.jumpBufferWindow;
  world.bufferedJumpPower = Math.max(world.jumpPower, power);
}

function setCameraMode(mode) {
  const value = String(mode || "follow").toLowerCase();
  if (value === "free") {
    world.cameraMode = "free";
    world.camera.lockedTarget = null;
    return;
  }
  world.cameraMode = "follow";
  world.camera.lockedTarget = world.playerRoot;
}

function setViewMode(mode) {
  const value = String(mode || "third").toLowerCase();
  world.viewMode = value === "first" ? "first" : "third";
  applyViewMode();
}

function setFirstPersonMouseRotate(enabled) {
  world.firstPersonRotateWithMouse = enabled !== false;
}

function setThirdPersonMouseRotate(enabled) {
  world.thirdPersonRotateWithMouse = enabled === true;
}

function setMouseSensitivity(value) {
  if (!Number.isFinite(value)) return;
  world.mouseSensitivity = Math.max(0.1, Math.min(5, value));
  applyCameraSettings();
}

function setCameraPitchLimits(minDeg, maxDeg) {
  if (!Number.isFinite(minDeg) || !Number.isFinite(maxDeg)) return;
  let min = Math.max(-89, Math.min(89, minDeg));
  let max = Math.max(-89, Math.min(89, maxDeg));
  if (min > max) {
    const t = min;
    min = max;
    max = t;
  }
  world.pitchMinDeg = min;
  world.pitchMaxDeg = max;
  applyCameraSettings();
}

function applyCameraSettings() {
  if (!world.camera) return;
  world.camera.lowerBetaLimit = BABYLON.Tools.ToRadians(90 - world.pitchMaxDeg);
  world.camera.upperBetaLimit = BABYLON.Tools.ToRadians(90 - world.pitchMinDeg);
  const pointers = world.camera.inputs?.attached?.pointers;
  if (pointers) {
    const sensitivity = 1000 / world.mouseSensitivity;
    pointers.angularSensibilityX = sensitivity;
    pointers.angularSensibilityY = sensitivity;
  }
}

function toggleViewMode() {
  setViewMode(world.viewMode === "third" ? "first" : "third");
}

function applyViewMode() {
  if (!world.camera || !world.playerRoot) return;
  applyCameraSettings();
  if (world.viewMode === "first") {
    world.camera.lockedTarget = world.playerHead || world.playerRoot;
    world.camera.radius = 0.15;
    world.camera.lowerRadiusLimit = 0.15;
    world.camera.upperRadiusLimit = 0.15;
    if (world.playerBody) world.playerBody.isVisible = false;
    if (world.playerHead) world.playerHead.isVisible = false;
    if (!isMobileDevice) {
      requestPointerLockIfNeeded();
    }
    return;
  }
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
  world.camera.lockedTarget = world.playerRoot;
  world.camera.radius = Math.max(world.camera.radius, 12);
  world.camera.lowerRadiusLimit = 8;
  world.camera.upperRadiusLimit = 90;
  if (world.playerBody) world.playerBody.isVisible = true;
  if (world.playerHead) world.playerHead.isVisible = true;
}

function createFloor(size, color) {
  const floorSize = Number.isFinite(size) ? Math.max(8, Math.min(500, size)) : 60;
  const floorColor = String(color || "#4f8f4f");
  world.floorSize = floorSize;
  world.floorColor = floorColor;
  if (world.floor) world.floor.dispose();
  world.floor = BABYLON.MeshBuilder.CreateGround("floor", { width: floorSize, height: floorSize }, world.scene);
  world.floor.position.y = 0;
  const mat = new BABYLON.StandardMaterial("floorMat", world.scene);
  mat.diffuseColor = parseColor(floorColor, new BABYLON.Color3(0.31, 0.56, 0.31));
  world.floor.material = mat;
}

function setSky(mode) {
  const value = String(mode || "day");
  world.skyMode = value;
  const normalized = value.toLowerCase();
  if (normalized === "night") return (world.scene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.13, 1));
  if (normalized === "sunset") return (world.scene.clearColor = new BABYLON.Color4(0.98, 0.56, 0.32, 1));
  if (normalized === "day") return (world.scene.clearColor = new BABYLON.Color4(0.66, 0.83, 0.97, 1));
  const c = parseColor(mode, new BABYLON.Color3(0.66, 0.83, 0.97));
  world.scene.clearColor = new BABYLON.Color4(c.r, c.g, c.b, 1);
}

function setSunIntensity(value) {
  if (Number.isFinite(value)) {
    world.sunIntensity = Math.max(0, Math.min(4, value));
    world.light.intensity = world.sunIntensity;
  }
}
function setLightColor(color) {
  world.lightColor = String(color || "#ffffff");
  world.light.diffuse = parseColor(world.lightColor, new BABYLON.Color3(1, 1, 1));
}
function setAmbientLight(color) {
  world.ambientColor = String(color || "#000000");
  world.scene.ambientColor = parseColor(world.ambientColor, new BABYLON.Color3(1, 1, 1));
}

function clearWorld() {
  for (const mesh of world.parts.values()) mesh.dispose();
  world.parts.clear();
  world.dynamicParts.clear();
  world.touchHandlers.clear();
  world.touchActive.clear();
  world.touchLastFired.clear();
  world.triggerEnterHandlers.clear();
  world.triggerExitHandlers.clear();
  world.triggerActive.clear();
  world.spawnIndex = 0;
}

function spawnPart(name, x, y, z, size, color) {
  spawnBlock(name, x, y, z, size, size, size, color);
}

function createTrigger(name, x, y, z, sx, sy, sz, color = "#00ffaa") {
  spawnBlock(name, x, y, z, sx, sy, sz, color);
  const mesh = getPart(String(name));
  if (!mesh) return;
  mesh.metadata = mesh.metadata || {};
  mesh.metadata.isTrigger = true;
  mesh.metadata.anchored = true;
  setPartTransparency(mesh.name, 0.6);
  setPartMaterial(mesh.name, "neon");
}

function spawnBlock(name, x, y, z, sx, sy, sz, color) {
  const partName = uniqueName(String(name || "Part"));
  const mesh = BABYLON.MeshBuilder.CreateBox(partName, { size: 1 }, world.scene);
  mesh.scaling.set(Math.max(0.2, sx), Math.max(0.2, sy), Math.max(0.2, sz));
  mesh.position.set(x, y, z);
  mesh.metadata = {
    anchored: true,
    isTrigger: false,
    velocityY: 0,
    spinDegPerSec: new BABYLON.Vector3(0, 0, 0),
    pulse: null,
    materialKind: "standard"
  };
  const mat = new BABYLON.StandardMaterial(`${partName}-mat`, world.scene);
  mat.diffuseColor = parseColor(color, new BABYLON.Color3(0.64, 0.76, 1));
  mesh.material = mat;
  world.parts.set(partName, mesh);
  world.spawnIndex += 1;
}

function clonePart(sourceName, newName) {
  const src = getPart(sourceName);
  if (!src) return;
  const cloneName = uniqueName(newName || `${sourceName}_copy`);
  const box = BABYLON.MeshBuilder.CreateBox(cloneName, { size: 1 }, world.scene);
  box.position = src.position.add(new BABYLON.Vector3(1.5, 0, 0));
  box.rotation = src.rotation.clone();
  box.scaling = src.scaling.clone();
  const srcMeta = src.metadata || {};
  box.metadata = {
    anchored: srcMeta.anchored !== false,
    isTrigger: srcMeta.isTrigger === true,
    velocityY: Number(srcMeta.velocityY || 0),
    spinDegPerSec: srcMeta.spinDegPerSec ? srcMeta.spinDegPerSec.clone() : new BABYLON.Vector3(0, 0, 0),
    pulse: null,
    materialKind: String(srcMeta.materialKind || "standard")
  };
  const mat = new BABYLON.StandardMaterial(`${cloneName}-mat`, world.scene);
  const srcMat = ensureStandardMaterial(src);
  mat.diffuseColor = srcMat.diffuseColor.clone();
  mat.emissiveColor = srcMat.emissiveColor.clone();
  mat.alpha = srcMat.alpha;
  box.material = mat;
  world.parts.set(cloneName, box);
}

function renamePart(oldName, newName) {
  const mesh = getPart(oldName);
  const target = String(newName || "").trim();
  if (!mesh || !target || world.parts.has(target)) return;
  if (world.touchHandlers.has(mesh.name)) {
    world.touchHandlers.set(target, world.touchHandlers.get(mesh.name));
    world.touchHandlers.delete(mesh.name);
  }
  if (world.triggerEnterHandlers.has(mesh.name)) {
    world.triggerEnterHandlers.set(target, world.triggerEnterHandlers.get(mesh.name));
    world.triggerEnterHandlers.delete(mesh.name);
  }
  if (world.triggerExitHandlers.has(mesh.name)) {
    world.triggerExitHandlers.set(target, world.triggerExitHandlers.get(mesh.name));
    world.triggerExitHandlers.delete(mesh.name);
  }
  if (world.touchActive.has(mesh.name)) {
    world.touchActive.delete(mesh.name);
    world.touchActive.add(target);
  }
  if (world.triggerActive.has(mesh.name)) {
    world.triggerActive.delete(mesh.name);
    world.triggerActive.add(target);
  }
  world.parts.delete(mesh.name);
  mesh.name = target;
  world.parts.set(target, mesh);
}

function destroyPart(name) {
  const mesh = getPart(name);
  if (!mesh) return;
  world.dynamicParts.delete(mesh);
  world.touchHandlers.delete(mesh.name);
  world.touchActive.delete(mesh.name);
  world.touchLastFired.delete(mesh.name);
  world.triggerEnterHandlers.delete(mesh.name);
  world.triggerExitHandlers.delete(mesh.name);
  world.triggerActive.delete(mesh.name);
  world.parts.delete(mesh.name);
  mesh.dispose();
}

function setPartColor(name, color) {
  const mesh = getPart(name);
  if (!mesh) return;
  ensureStandardMaterial(mesh).diffuseColor = parseColor(color, new BABYLON.Color3(1, 1, 1));
}

function setPartTransparency(name, alpha01) {
  const mesh = getPart(name);
  if (!mesh) return;
  const alpha = Math.max(0, Math.min(1, Number(alpha01)));
  ensureStandardMaterial(mesh).alpha = 1 - alpha;
}

function setPartEmissive(name, color, intensity) {
  const mesh = getPart(name);
  if (!mesh) return;
  ensureStandardMaterial(mesh).emissiveColor = parseColor(color, new BABYLON.Color3(1, 1, 1)).scale(
    Math.max(0, Math.min(3, intensity))
  );
}

function setPartSize(name, size) {
  const mesh = getPart(name);
  if (!mesh || !Number.isFinite(size)) return;
  mesh.scaling.setAll(Math.max(0.2, size));
}

function setPartPosition(name, x, y, z) {
  const mesh = getPart(name);
  if (!mesh) return;
  mesh.position.set(x, y, z);
}

function movePart(name, dx, dy, dz) {
  const mesh = getPart(name);
  if (!mesh) return;
  mesh.position.addInPlace(new BABYLON.Vector3(dx, dy, dz));
}

function rotatePart(name, rx, ry, rz) {
  const mesh = getPart(name);
  if (!mesh) return;
  mesh.rotation.x += BABYLON.Tools.ToRadians(rx);
  mesh.rotation.y += BABYLON.Tools.ToRadians(ry);
  mesh.rotation.z += BABYLON.Tools.ToRadians(rz);
}

function setPartMaterial(name, material) {
  const mesh = getPart(name);
  if (!mesh) return;
  const mat = ensureStandardMaterial(mesh);
  const key = String(material || "standard").toLowerCase();
  mesh.metadata = mesh.metadata || {};
  mesh.metadata.materialKind = key;
  if (key === "metal") {
    mat.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    mat.roughness = 0.2;
    return;
  }
  if (key === "neon") {
    mat.emissiveColor = mat.diffuseColor.scale(0.6);
    mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    return;
  }
  if (key === "plastic") {
    mat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    mat.emissiveColor = BABYLON.Color3.Black();
    return;
  }
  mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  mat.emissiveColor = BABYLON.Color3.Black();
}

function setAnchored(name, anchored) {
  const mesh = getPart(name);
  if (!mesh) return;
  mesh.metadata = mesh.metadata || {};
  mesh.metadata.anchored = anchored !== false;
  if (mesh.metadata.anchored) {
    world.dynamicParts.delete(mesh);
    mesh.metadata.velocityY = 0;
  } else {
    world.dynamicParts.add(mesh);
  }
}

function spinPart(name, degX, degY, degZ) {
  const mesh = getPart(name);
  if (!mesh) return;
  mesh.metadata = mesh.metadata || {};
  mesh.metadata.spinDegPerSec = new BABYLON.Vector3(degX, degY, degZ);
}
function stopSpin(name) {
  const mesh = getPart(name);
  if (!mesh || !mesh.metadata) return;
  mesh.metadata.spinDegPerSec = new BABYLON.Vector3(0, 0, 0);
}
function pulsePart(name, speed, minScale, maxScale) {
  const mesh = getPart(name);
  if (!mesh) return;
  mesh.metadata = mesh.metadata || {};
  mesh.metadata.pulse = {
    speed: Math.max(0.1, speed),
    min: Math.max(0.2, Math.min(minScale, maxScale)),
    max: Math.max(minScale, maxScale),
    base: mesh.scaling.clone(),
    t: 0
  };
}
function stopPulse(name) {
  const mesh = getPart(name);
  if (!mesh || !mesh.metadata || !mesh.metadata.pulse) return;
  mesh.scaling.copyFrom(mesh.metadata.pulse.base);
  mesh.metadata.pulse = null;
}

function onTouched(name, action) {
  const partName = String(name || "").trim();
  if (!partName) return;
  const text = String(action || "").trim();
  if (!text) return;
  world.touchHandlers.set(partName, text);
}

function clearTouched(name) {
  const partName = String(name || "").trim();
  if (!partName) return;
  world.touchHandlers.delete(partName);
}

function onEnter(name, action) {
  const partName = String(name || "").trim();
  const text = String(action || "").trim();
  if (!partName || !text) return;
  world.triggerEnterHandlers.set(partName, text);
}

function onExit(name, action) {
  const partName = String(name || "").trim();
  const text = String(action || "").trim();
  if (!partName || !text) return;
  world.triggerExitHandlers.set(partName, text);
}

function clearTrigger(name) {
  const partName = String(name || "").trim();
  if (!partName) return;
  world.triggerEnterHandlers.delete(partName);
  world.triggerExitHandlers.delete(partName);
  world.triggerActive.delete(partName);
}

function processTouchedEvents() {
  if (!world.playerRoot) return;
  const x = world.playerRoot.position.x;
  const y = world.playerRoot.position.y;
  const z = world.playerRoot.position.z;
  const feet = y - world.standHeight;
  const head = y + world.headOffset;
  const nextActive = new Set();
  const now = Date.now();

  for (const [partName, action] of world.touchHandlers.entries()) {
    const mesh = getPart(partName);
    if (!mesh || mesh.isDisposed()) continue;
    const halfX = mesh.scaling.x * 0.5;
    const halfY = mesh.scaling.y * 0.5;
    const halfZ = mesh.scaling.z * 0.5;
    const minX = mesh.position.x - halfX;
    const maxX = mesh.position.x + halfX;
    const minY = mesh.position.y - halfY;
    const maxY = mesh.position.y + halfY;
    const minZ = mesh.position.z - halfZ;
    const maxZ = mesh.position.z + halfZ;
    const overlapX = x + world.collisionRadius > minX && x - world.collisionRadius < maxX;
    const overlapY = head > minY && feet < maxY;
    const overlapZ = z + world.collisionRadius > minZ && z - world.collisionRadius < maxZ;
    if (!(overlapX && overlapY && overlapZ)) continue;

    nextActive.add(partName);
    const cooldownOk = now - (world.touchLastFired.get(partName) || 0) > world.touchCooldownMs;
    if (!world.touchActive.has(partName) || cooldownOk) {
      world.touchLastFired.set(partName, now);
      fireTouchedAction(partName, action);
    }
  }

  world.touchActive = nextActive;
}

function processTriggerEvents() {
  if (!world.playerRoot) return;
  const x = world.playerRoot.position.x;
  const y = world.playerRoot.position.y;
  const z = world.playerRoot.position.z;
  const feet = y - world.standHeight;
  const head = y + world.headOffset;
  const activeNow = new Set();

  for (const [name, mesh] of world.parts.entries()) {
    if (!mesh || mesh.isDisposed() || !mesh.metadata?.isTrigger) continue;
    const halfX = mesh.scaling.x * 0.5;
    const halfY = mesh.scaling.y * 0.5;
    const halfZ = mesh.scaling.z * 0.5;
    const minX = mesh.position.x - halfX;
    const maxX = mesh.position.x + halfX;
    const minY = mesh.position.y - halfY;
    const maxY = mesh.position.y + halfY;
    const minZ = mesh.position.z - halfZ;
    const maxZ = mesh.position.z + halfZ;
    const overlap =
      x + world.collisionRadius > minX &&
      x - world.collisionRadius < maxX &&
      head > minY &&
      feet < maxY &&
      z + world.collisionRadius > minZ &&
      z - world.collisionRadius < maxZ;
    if (overlap) activeNow.add(name);
  }

  for (const name of activeNow) {
    if (!world.triggerActive.has(name)) {
      const action = world.triggerEnterHandlers.get(name);
      if (action) fireTouchedAction(name, action);
    }
  }

  for (const name of world.triggerActive) {
    if (!activeNow.has(name)) {
      const action = world.triggerExitHandlers.get(name);
      if (action) fireTouchedAction(name, action);
    }
  }

  world.triggerActive = activeNow;
}

function fireTouchedAction(partName, action) {
  const text = String(action || "");
  if (!text) return;
  const lower = text.toLowerCase();
  if (lower.startsWith("print:")) {
    const message = text.slice(6).trim();
    appendLog(`[touch:${partName}] ${message}`);
    return;
  }
  if (lower.startsWith("jump:")) {
    const power = Number(text.slice(5).trim());
    jump(Number.isFinite(power) ? power : world.jumpPower);
    appendLog(`[touch:${partName}] jump`);
    return;
  }
  if (lower.startsWith("teleport:")) {
    const values = text
      .slice(9)
      .split(",")
      .map((v) => Number(v.trim()));
    if (values.length >= 3 && values.every((v) => Number.isFinite(v))) {
      teleport(values[0], values[1], values[2]);
      appendLog(`[touch:${partName}] teleport`);
      return;
    }
  }
  appendLog(`[touch:${partName}] ${text}`);
}

function appendLog(line) {
  const current = logsEl.textContent ? logsEl.textContent.split("\n") : [];
  current.push(line);
  logsEl.textContent = current.slice(-120).join("\n");
}

function updatePlayer(dt) {
  if (!world.playerRoot) return;
  world.coyoteTimer = Math.max(0, world.coyoteTimer - dt);
  world.jumpBufferTimer = Math.max(0, world.jumpBufferTimer - dt);
  if (world.mobileEnabled && (world.mobileLookDX !== 0 || world.mobileLookDY !== 0)) {
    applyLookDelta(world.mobileLookDX, world.mobileLookDY);
    world.mobileLookDX = 0;
    world.mobileLookDY = 0;
  }
  const inputX =
    (world.keys.has("KeyD") ? 1 : 0) - (world.keys.has("KeyA") ? 1 : 0) + (world.mobileEnabled ? world.mobileMoveX : 0);
  const inputZ =
    (world.keys.has("KeyW") ? 1 : 0) - (world.keys.has("KeyS") ? 1 : 0) + (world.mobileEnabled ? world.mobileMoveZ : 0);
  const sprinting = world.keys.has("ShiftLeft") || world.keys.has("ShiftRight");
  if (world.keys.has("Space") || world.mobileJumpPressed) jump(world.jumpPower);

  const cameraForward = world.camera.getForwardRay().direction;
  const forward = new BABYLON.Vector3(cameraForward.x, 0, cameraForward.z);
  if (forward.lengthSquared() < 1e-6) {
    forward.set(0, 0, 1);
  } else {
    forward.normalize();
  }
  const right = new BABYLON.Vector3(forward.z, 0, -forward.x);
  const moveDir = right.scale(inputX).add(forward.scale(inputZ));
  if (moveDir.lengthSquared() > 1e-6) {
    moveDir.normalize();
  }

  const targetSpeed = world.speed * (sprinting ? world.sprintMultiplier : 1);
  const targetVx = moveDir.x * targetSpeed;
  const targetVz = moveDir.z * targetSpeed;
  const accel = moveDir.lengthSquared() > 1e-6 ? world.acceleration : world.deceleration;
  world.velocityXZ.x = moveTowards(world.velocityXZ.x, targetVx, accel * dt);
  world.velocityXZ.y = moveTowards(world.velocityXZ.y, targetVz, accel * dt);

  let nextX = world.playerRoot.position.x + world.velocityXZ.x * dt;
  let nextZ = world.playerRoot.position.z;
  if (collidesAt(nextX, nextZ, world.playerRoot.position.y)) {
    nextX = world.playerRoot.position.x;
    world.velocityXZ.x = 0;
  }

  nextZ = world.playerRoot.position.z + world.velocityXZ.y * dt;
  if (collidesAt(nextX, nextZ, world.playerRoot.position.y)) {
    nextZ = world.playerRoot.position.z;
    world.velocityXZ.y = 0;
  }

  world.playerRoot.position.x = nextX;
  world.playerRoot.position.z = nextZ;

  const rotateWithMouse =
    (world.viewMode === "first" && world.firstPersonRotateWithMouse) ||
    (world.viewMode === "third" && world.thirdPersonRotateWithMouse);
  if (rotateWithMouse) {
    world.playerRoot.rotation.y = Math.atan2(forward.x, forward.z);
  } else if (moveDir.lengthSquared() > 1e-6) {
    world.playerRoot.rotation.y = Math.atan2(moveDir.x, moveDir.z);
  }

  world.velocityY += world.gravity * dt;
  const wasGrounded = world.grounded;
  let nextY = world.playerRoot.position.y + world.velocityY * dt;
  const groundY = computeGroundY(world.playerRoot.position.x, world.playerRoot.position.z, world.playerRoot.position.y, nextY);
  if (nextY <= groundY) {
    nextY = groundY;
    world.velocityY = 0;
    world.grounded = true;
  } else {
    world.grounded = false;
  }
  world.playerRoot.position.y = nextY;

  if (world.grounded) {
    world.coyoteTimer = world.coyoteTimeWindow;
    if (world.jumpBufferTimer > 0) {
      performJump(world.bufferedJumpPower || world.jumpPower);
    }
  } else if (wasGrounded) {
    world.coyoteTimer = world.coyoteTimeWindow;
  }

  processTouchedEvents();
  processTriggerEvents();
}

function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function collidesAt(x, z, y) {
  const feet = y - world.standHeight;
  const head = y + world.headOffset;
  for (const mesh of world.parts.values()) {
    if (!mesh || mesh.isDisposed()) continue;
    if (mesh.metadata?.isTrigger) continue;
    const halfX = mesh.scaling.x * 0.5;
    const halfY = mesh.scaling.y * 0.5;
    const halfZ = mesh.scaling.z * 0.5;
    const minX = mesh.position.x - halfX;
    const maxX = mesh.position.x + halfX;
    const minY = mesh.position.y - halfY;
    const maxY = mesh.position.y + halfY;
    const minZ = mesh.position.z - halfZ;
    const maxZ = mesh.position.z + halfZ;
    const verticalOverlap = head > minY && feet < maxY;
    if (!verticalOverlap) continue;
    const overlapX = x + world.collisionRadius > minX && x - world.collisionRadius < maxX;
    const overlapZ = z + world.collisionRadius > minZ && z - world.collisionRadius < maxZ;
    if (overlapX && overlapZ) return true;
  }
  return false;
}

function computeGroundY(x, z, prevY, nextY) {
  let bestGround = world.standHeight;
  const prevFeet = prevY - world.standHeight;
  const nextFeet = nextY - world.standHeight;
  for (const mesh of world.parts.values()) {
    if (!mesh || mesh.isDisposed()) continue;
    if (mesh.metadata?.isTrigger) continue;
    const halfX = mesh.scaling.x * 0.5;
    const halfY = mesh.scaling.y * 0.5;
    const halfZ = mesh.scaling.z * 0.5;
    const minX = mesh.position.x - halfX;
    const maxX = mesh.position.x + halfX;
    const minZ = mesh.position.z - halfZ;
    const maxZ = mesh.position.z + halfZ;
    const topY = mesh.position.y + halfY;
    const withinX = x + world.collisionRadius > minX && x - world.collisionRadius < maxX;
    const withinZ = z + world.collisionRadius > minZ && z - world.collisionRadius < maxZ;
    if (!withinX || !withinZ) continue;
    if (prevFeet >= topY && nextFeet <= topY) {
      bestGround = Math.max(bestGround, topY + world.standHeight);
    }
  }
  return bestGround;
}

function updateDynamicParts(dt) {
  for (const mesh of world.dynamicParts) {
    if (!mesh || mesh.isDisposed()) continue;
    if (mesh.metadata?.isTrigger) continue;
    mesh.metadata = mesh.metadata || {};
    mesh.metadata.velocityY = Number(mesh.metadata.velocityY || 0) + world.gravity * dt;
    mesh.position.y += mesh.metadata.velocityY * dt;
    const floorY = 0.5 * mesh.scaling.y;
    if (mesh.position.y <= floorY) {
      mesh.position.y = floorY;
      mesh.metadata.velocityY = 0;
    }
  }
}

function updateAnimations(dt) {
  for (const mesh of world.parts.values()) {
    if (!mesh || mesh.isDisposed() || !mesh.metadata) continue;
    if (mesh.metadata.spinDegPerSec) {
      mesh.rotation.x += BABYLON.Tools.ToRadians(mesh.metadata.spinDegPerSec.x * dt);
      mesh.rotation.y += BABYLON.Tools.ToRadians(mesh.metadata.spinDegPerSec.y * dt);
      mesh.rotation.z += BABYLON.Tools.ToRadians(mesh.metadata.spinDegPerSec.z * dt);
    }
    if (mesh.metadata.pulse) {
      const p = mesh.metadata.pulse;
      p.t += dt * p.speed;
      const k = p.min + (p.max - p.min) * (0.5 + 0.5 * Math.sin(p.t * Math.PI * 2));
      mesh.scaling.set(p.base.x * k, p.base.y * k, p.base.z * k);
    }
  }
}

function getRoomKey() {
  const game = (gameInputEl.value || "obby").trim().toLowerCase().replace(/\s+/g, "-");
  const roomNo = Math.max(1, Number(roomInputEl.value || 1));
  roomInputEl.value = String(roomNo);
  gameInputEl.value = game || "obby";
  return `${game || "obby"}:${roomNo}`;
}

function connectRoom() {
  const room = getRoomKey();
  disconnectRoom(false);
  setServerUrl(deriveDefaultWsUrl());
  if (!peerState.wsUrl) {
    setMultiplayerStatus("ws-missing");
    return;
  }
  peerState.room = room;
  peerState.awaitingWorldSync = true;
  peerState.hadOpen = false;
  peerState.transport = "websocket";
  setMultiplayerStatus(`connecting:${room}:websocket`);
  peerState.socket = new WebSocket(peerState.wsUrl);
  peerState.socket.addEventListener("open", () => {
    peerState.hadOpen = true;
    sendTransportMessage({ type: "join", room, id: peerState.id });
    onConnectedTransport(room);
    renderRoomQr();
  });
  peerState.socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(String(event.data || "{}"));
      handlePeerMessageData(data);
    } catch (_) {}
  });
  peerState.socket.addEventListener("close", () => {
    if (peerState.room === room) {
      setMultiplayerStatus(peerState.hadOpen ? `offline:${room}:websocket` : `no-ws-endpoint:/ws`);
    }
  });
  peerState.socket.addEventListener("error", () => {
    setMultiplayerStatus(`ws-error:${room}`);
  });
}

function onConnectedTransport(room) {
  peerState.timer = window.setInterval(() => maybeBroadcastLocalState(true), 120);
  if (peerState.syncTimeout) clearTimeout(peerState.syncTimeout);
  peerState.syncTimeout = window.setTimeout(() => {
    if (peerState.awaitingWorldSync) {
      peerState.awaitingWorldSync = false;
      setMultiplayerStatus(`connected:${room}:${peerState.transport}`);
    }
  }, 1400);
  setMultiplayerStatus(`syncing:${room}:${peerState.transport}`);
  sendPeerMessage({ type: "hello", state: getLocalSnapshot() });
}

function disconnectRoom(updateStatus = true) {
  sendPeerMessage({ type: "bye", id: peerState.id });
  if (peerState.timer) {
    clearInterval(peerState.timer);
    peerState.timer = null;
  }
  if (peerState.socket) {
    peerState.socket.close();
    peerState.socket = null;
  }
  if (peerState.syncTimeout) {
    clearTimeout(peerState.syncTimeout);
    peerState.syncTimeout = null;
  }
  peerState.awaitingWorldSync = false;
  peerState.room = null;
  peerState.transport = "websocket";
  for (const remote of peerState.remotes.values()) {
    remote.root.dispose();
  }
  peerState.remotes.clear();
  if (updateStatus) setMultiplayerStatus("offline");
}

function handlePeerMessageData(data) {
  if (!data || data.id === peerState.id) return;
  if (data.type === "join" || data.type === "joined") return;
  if (data.type === "hello") {
    upsertRemotePlayer(data.id, data.state);
    sendPeerMessage({ type: "state", state: getLocalSnapshot() });
    sendPeerMessage({ type: "room_state", targetId: data.id, snapshot: buildWorldSnapshot() });
    return;
  }
  if (data.type === "state") {
    upsertRemotePlayer(data.id, data.state);
    return;
  }
  if (data.type === "room_state") {
    if (data.targetId !== peerState.id || !peerState.awaitingWorldSync) {
      return;
    }
    applyWorldSnapshot(data.snapshot);
    peerState.awaitingWorldSync = false;
    if (peerState.syncTimeout) {
      clearTimeout(peerState.syncTimeout);
      peerState.syncTimeout = null;
    }
    setMultiplayerStatus(`connected:${peerState.room}:${peerState.transport}`);
    return;
  }
  if (data.type === "run_script") {
    const language = String(data.language || "luau");
    const code = String(data.code || "");
    const result = runScript(language, code);
    logsEl.textContent = [`[mp] script from ${data.id}`, ...result].join("\n");
    return;
  }
  if (data.type === "bye") {
    removeRemotePlayer(data.id);
  }
}

function maybeBroadcastLocalState(force = false) {
  if (!peerState.socket || !world.playerRoot) return;
  const now = performance.now();
  if (!force && now - peerState.lastSentAt < 100) return;
  peerState.lastSentAt = now;
  sendPeerMessage({ type: "state", state: getLocalSnapshot() });
}

function broadcastNow() {
  maybeBroadcastLocalState(true);
}

function getLocalSnapshot() {
  if (!world.playerRoot) return null;
  return {
    name: world.playerLabel,
    x: world.playerRoot.position.x,
    y: world.playerRoot.position.y,
    z: world.playerRoot.position.z,
    ry: world.playerRoot.rotation.y,
    bodyColor: world.playerBodyColor,
    headColor: world.playerHeadColor
  };
}

function sendPeerMessage(payload) {
  sendTransportMessage({ ...payload, id: peerState.id, room: peerState.room, ts: Date.now() });
}

function sendTransportMessage(payload) {
  if (peerState.socket && peerState.socket.readyState === WebSocket.OPEN) {
    peerState.socket.send(JSON.stringify(payload));
  }
}

function upsertRemotePlayer(id, state) {
  if (!state) return;
  let remote = peerState.remotes.get(id);
  if (!remote) {
    const root = new BABYLON.TransformNode(`remote_${id}`, world.scene);
    const body = BABYLON.MeshBuilder.CreateBox(`rbody_${id}`, { width: 1.2, height: 1.6, depth: 0.7 }, world.scene);
    body.parent = root;
    body.position.y = 0;
    const head = BABYLON.MeshBuilder.CreateSphere(`rhead_${id}`, { diameter: 0.9, segments: 16 }, world.scene);
    head.parent = root;
    head.position.y = 1.25;
    remote = { root, body, head, lastSeen: Date.now() };
    peerState.remotes.set(id, remote);
  }
  remote.root.position.set(Number(state.x || 0), Number(state.y || 1.6), Number(state.z || 0));
  remote.root.rotation.y = Number(state.ry || 0);
  const bodyMat = new BABYLON.StandardMaterial(`rbm_${id}`, world.scene);
  bodyMat.diffuseColor = parseColor(state.bodyColor, new BABYLON.Color3(0.9, 0.4, 0.4));
  remote.body.material = bodyMat;
  const headMat = new BABYLON.StandardMaterial(`rhm_${id}`, world.scene);
  headMat.diffuseColor = parseColor(state.headColor, new BABYLON.Color3(0.95, 0.82, 0.64));
  remote.head.material = headMat;
  remote.lastSeen = Date.now();
}

function updateRemotePlayers() {
  const now = Date.now();
  for (const [id, remote] of peerState.remotes) {
    if (now - remote.lastSeen > 5000) {
      removeRemotePlayer(id);
    }
  }
}

function removeRemotePlayer(id) {
  const remote = peerState.remotes.get(id);
  if (!remote) return;
  remote.root.dispose();
  peerState.remotes.delete(id);
}

function setMultiplayerStatus(text) {
  mpStatusEl.textContent = text;
}

function setServerUrl(url) {
  const value = String(url || "").trim();
  peerState.wsUrl = value;
  renderRoomQr();
}

function deriveDefaultWsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  if (!host) return "";
  if (host === "localhost" || host === "127.0.0.1") {
    return `${protocol}//${host}:8787`;
  }
  return `${protocol}//${window.location.host}/ws`;
}

function renderRoomQr() {
  if (!qrCodeEl || !shareUrlEl) return;
  const roomNumber = Number(roomInputEl.value || 1);
  const game = (gameInputEl.value || "obby").trim().toLowerCase();
  const url = new URL(window.location.href);
  url.searchParams.set("room", String(roomNumber));
  url.searchParams.set("game", game);
  url.searchParams.delete("sandbox");
  const share = url.toString();
  shareUrlEl.textContent = share;
  qrCodeEl.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    const canvasEl = document.createElement("canvas");
    QRCode.toCanvas(
      canvasEl,
      share,
      {
        width: 110,
        margin: 1,
        color: { dark: "#0d1220", light: "#ffffff" }
      },
      (error) => {
        if (error) {
          const img = document.createElement("img");
          img.width = 110;
          img.height = 110;
          img.alt = "Room QR";
          img.src = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(share)}`;
          qrCodeEl.appendChild(img);
          return;
        }
        qrCodeEl.appendChild(canvasEl);
      }
    );
  } else {
    const img = document.createElement("img");
    img.width = 110;
    img.height = 110;
    img.alt = "Room QR";
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(share)}`;
    qrCodeEl.appendChild(img);
  }
}

function buildWorldSnapshot() {
  const parts = [];
  for (const [name, mesh] of world.parts.entries()) {
    if (!mesh || mesh.isDisposed()) continue;
    const mat = ensureStandardMaterial(mesh);
    const meta = mesh.metadata || {};
    parts.push({
      name,
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      rx: mesh.rotation.x,
      ry: mesh.rotation.y,
      rz: mesh.rotation.z,
      sx: mesh.scaling.x,
      sy: mesh.scaling.y,
      sz: mesh.scaling.z,
      color: colorToHex(mat.diffuseColor, "#a4c2ff"),
      emissive: colorToHex(mat.emissiveColor, "#000000"),
      alpha: Number.isFinite(mat.alpha) ? mat.alpha : 1,
      anchored: meta.anchored !== false,
      isTrigger: meta.isTrigger === true,
      materialKind: String(meta.materialKind || "standard"),
      spin: meta.spinDegPerSec
        ? { x: meta.spinDegPerSec.x, y: meta.spinDegPerSec.y, z: meta.spinDegPerSec.z }
        : { x: 0, y: 0, z: 0 },
      pulse: meta.pulse
        ? { speed: meta.pulse.speed, min: meta.pulse.min, max: meta.pulse.max, t: meta.pulse.t }
        : null
    });
  }

  return {
    floorSize: world.floorSize,
    floorColor: world.floorColor,
    skyMode: world.skyMode,
    sunIntensity: world.sunIntensity,
    lightColor: world.lightColor,
    ambientColor: world.ambientColor,
    gravity: world.gravity,
    sprintMultiplier: world.sprintMultiplier,
    acceleration: world.acceleration,
    deceleration: world.deceleration,
    coyoteTimeWindow: world.coyoteTimeWindow,
    jumpBufferWindow: world.jumpBufferWindow,
    mouseSensitivity: world.mouseSensitivity,
    pitchMinDeg: world.pitchMinDeg,
    pitchMaxDeg: world.pitchMaxDeg,
    firstPersonRotateWithMouse: world.firstPersonRotateWithMouse,
    thirdPersonRotateWithMouse: world.thirdPersonRotateWithMouse,
    touchHandlers: Object.fromEntries(world.touchHandlers.entries()),
    triggerEnterHandlers: Object.fromEntries(world.triggerEnterHandlers.entries()),
    triggerExitHandlers: Object.fromEntries(world.triggerExitHandlers.entries()),
    parts
  };
}

function applyWorldSnapshot(snapshot) {
  if (!snapshot) return;
  clearWorld();
  createFloor(Number(snapshot.floorSize ?? 70), String(snapshot.floorColor ?? "#4f8f4f"));
  setSky(String(snapshot.skyMode ?? "day"));
  setSunIntensity(Number(snapshot.sunIntensity ?? 0.95));
  setLightColor(String(snapshot.lightColor ?? "#ffffff"));
  setAmbientLight(String(snapshot.ambientColor ?? "#000000"));
  setGravity(Number(snapshot.gravity ?? -22));
  setSprintMultiplier(Number(snapshot.sprintMultiplier ?? world.sprintMultiplier));
  setAcceleration(Number(snapshot.acceleration ?? world.acceleration));
  setDeceleration(Number(snapshot.deceleration ?? world.deceleration));
  setCoyoteTime(Number(snapshot.coyoteTimeWindow ?? world.coyoteTimeWindow));
  setJumpBuffer(Number(snapshot.jumpBufferWindow ?? world.jumpBufferWindow));
  setMouseSensitivity(Number(snapshot.mouseSensitivity ?? world.mouseSensitivity));
  setCameraPitchLimits(Number(snapshot.pitchMinDeg ?? world.pitchMinDeg), Number(snapshot.pitchMaxDeg ?? world.pitchMaxDeg));
  setFirstPersonMouseRotate(snapshot.firstPersonRotateWithMouse !== false);
  setThirdPersonMouseRotate(snapshot.thirdPersonRotateWithMouse === true);

  const handlers = snapshot.touchHandlers && typeof snapshot.touchHandlers === "object" ? snapshot.touchHandlers : {};
  for (const [partName, action] of Object.entries(handlers)) {
    onTouched(partName, String(action));
  }
  const enterHandlers =
    snapshot.triggerEnterHandlers && typeof snapshot.triggerEnterHandlers === "object" ? snapshot.triggerEnterHandlers : {};
  for (const [partName, action] of Object.entries(enterHandlers)) {
    onEnter(partName, String(action));
  }
  const exitHandlers =
    snapshot.triggerExitHandlers && typeof snapshot.triggerExitHandlers === "object" ? snapshot.triggerExitHandlers : {};
  for (const [partName, action] of Object.entries(exitHandlers)) {
    onExit(partName, String(action));
  }

  const parts = Array.isArray(snapshot.parts) ? snapshot.parts : [];
  for (const part of parts) {
    spawnBlock(
      String(part.name ?? `Part${world.spawnIndex + 1}`),
      Number(part.x ?? 0),
      Number(part.y ?? 1),
      Number(part.z ?? 0),
      Number(part.sx ?? 1),
      Number(part.sy ?? 1),
      Number(part.sz ?? 1),
      String(part.color ?? "#a4c2ff")
    );
    const name = String(part.name);
    const mesh = getPart(name);
    if (!mesh) continue;
    mesh.rotation.set(Number(part.rx ?? 0), Number(part.ry ?? 0), Number(part.rz ?? 0));
    setPartMaterial(name, String(part.materialKind ?? "standard"));
    setPartTransparency(name, 1 - Number(part.alpha ?? 1));
    setPartEmissive(name, String(part.emissive ?? "#000000"), 1);
    setAnchored(name, part.anchored !== false);
    if (part.isTrigger === true) {
      const mesh = getPart(name);
      if (mesh) {
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.isTrigger = true;
      }
    }
    if (part.spin) {
      spinPart(name, Number(part.spin.x ?? 0), Number(part.spin.y ?? 0), Number(part.spin.z ?? 0));
    }
    if (part.pulse) {
      pulsePart(name, Number(part.pulse.speed ?? 1), Number(part.pulse.min ?? 1), Number(part.pulse.max ?? 1));
    }
  }
}

function getPart(name) {
  return world.parts.get(String(name || ""));
}

function uniqueName(baseName) {
  let name = baseName;
  let counter = 2;
  while (world.parts.has(name)) {
    name = `${baseName}_${counter}`;
    counter += 1;
  }
  return name;
}

function ensureStandardMaterial(mesh) {
  if (mesh.material instanceof BABYLON.StandardMaterial) return mesh.material;
  const mat = new BABYLON.StandardMaterial(`${mesh.name}-mat`, world.scene);
  mat.diffuseColor = new BABYLON.Color3(0.64, 0.76, 1);
  mesh.material = mat;
  return mat;
}

function parseColor(value, fallback) {
  try {
    return BABYLON.Color3.FromHexString(String(value));
  } catch (_) {
    return fallback;
  }
}

function colorToHex(color, fallback = "#ffffff") {
  if (!color || !Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) {
    return fallback;
  }
  const hex = color.toHexString?.();
  return typeof hex === "string" ? hex : fallback;
}

setupScene();
