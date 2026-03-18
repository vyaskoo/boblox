const defaults = {
  luau: [
    'print("Boblox boot")',
    'createBaseplate(90, "#507f50")',
    'setSky("sunset")',
    'createPlayer("Noob")',
    "setSpeed(11)",
    "setJumpPower(10)",
    'spawnPart("Tower", 6, 2, 0, 3, "#ff8844")',
    'setPartMaterial("Tower", "metal")'
  ].join("\n"),
  python: [
    'print("Boblox boot")',
    'createFloor(90, "#507f50")',
    'setSky("day")',
    'createPlayer("Coder")',
    "setSpeed(11)",
    "setGravity(-24)",
    'spawnPart("Pad", 0, 0.6, 6, 2, "#44aaff")'
  ].join("\n")
};

const languageEl = document.getElementById("language");
const editorEl = document.getElementById("editor");
const logsEl = document.getElementById("logs");
const runBtn = document.getElementById("runBtn");
const canvas = document.getElementById("scene");

const world = {
  engine: null,
  scene: null,
  camera: null,
  light: null,
  floor: null,
  playerRoot: null,
  playerBody: null,
  playerHead: null,
  playerLabel: "Player",
  speed: 8,
  jumpPower: 9,
  velocityY: 0,
  grounded: false,
  gravity: -22,
  cameraMode: "follow",
  keys: new Set(),
  spawnIndex: 0,
  parts: new Map(),
  dynamicParts: new Set()
};

editorEl.value = defaults.luau;

languageEl.addEventListener("change", () => {
  editorEl.value = defaults[languageEl.value];
});

runBtn.addEventListener("click", () => {
  const result = runScript(languageEl.value, editorEl.value);
  logsEl.textContent = result.join("\n");
});

window.addEventListener("keydown", (event) => world.keys.add(event.code));
window.addEventListener("keyup", (event) => world.keys.delete(event.code));

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

  world.light = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0), world.scene);
  world.light.intensity = 0.95;

  createFloor(70, "#4f8f4f");
  createPlayer("Noob");

  world.engine.runRenderLoop(() => {
    const dt = world.engine.getDeltaTime() / 1000;
    updatePlayer(dt);
    updateDynamicParts(dt);
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
    const { fn, args } = parsed;

    const ok = executeCommand(fn, args, logs);
    if (ok) {
      recognized += 1;
    }
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

  if (fn === "clearworld") {
    clearWorld();
    logs.push("[world] clearWorld");
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

  if (fn === "destroypart" || fn === "deletepart") {
    const name = String(args[0] ?? "");
    destroyPart(name);
    logs.push(`[world] destroyPart '${name}'`);
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

  if (fn === "setanchored") {
    setAnchored(String(args[0] ?? ""), args[1] ?? true);
    logs.push("[part] setAnchored");
    return true;
  }

  return false;
}

function parseCall(line) {
  const match = line.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
  if (!match) return null;
  return {
    fn: match[1].toLowerCase(),
    args: splitArgs(match[2]).map(parseArg)
  };
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
  if (token.startsWith("`") && token.endsWith("`")) {
    return token.slice(1, -1);
  }
  if (token.toLowerCase() === "true") return true;
  if (token.toLowerCase() === "false") return false;
  const num = Number(token);
  return Number.isNaN(num) ? token : num;
}

function createPlayer(name) {
  if (world.playerRoot) {
    world.playerRoot.dispose();
  }

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
}

function setPlayerColor(bodyColor, headColor) {
  if (!world.playerBody || !world.playerHead) return;
  const bodyMat = new BABYLON.StandardMaterial("bodyMat", world.scene);
  bodyMat.diffuseColor = parseColor(bodyColor, new BABYLON.Color3(0.18, 0.52, 0.87));
  world.playerBody.material = bodyMat;

  const headMat = new BABYLON.StandardMaterial("headMat", world.scene);
  headMat.diffuseColor = parseColor(headColor, new BABYLON.Color3(0.95, 0.82, 0.64));
  world.playerHead.material = headMat;
}

function setSpeed(speed) {
  if (Number.isFinite(speed)) {
    world.speed = Math.max(1, Math.min(45, speed));
  }
}

function setJumpPower(power) {
  if (Number.isFinite(power)) {
    world.jumpPower = Math.max(2, Math.min(40, power));
  }
}

function setGravity(value) {
  if (Number.isFinite(value)) {
    world.gravity = Math.max(-80, Math.min(-1, value));
  }
}

function movePlayer(dx, dz) {
  if (!world.playerRoot) return;
  world.playerRoot.position.x += dx;
  world.playerRoot.position.z += dz;
}

function teleport(x, y, z) {
  if (!world.playerRoot) return;
  world.playerRoot.position.set(x, Math.max(1.6, y), z);
  world.velocityY = 0;
}

function lookAt(x, y, z) {
  if (!world.playerRoot) return;
  const dir = new BABYLON.Vector3(x, y, z).subtract(world.playerRoot.position);
  world.playerRoot.rotation.y = Math.atan2(dir.x, dir.z);
}

function jump(power) {
  if (!world.playerRoot || !world.grounded) return;
  world.velocityY = Math.max(2, Math.min(40, power));
  world.grounded = false;
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

function createFloor(size, color) {
  const floorSize = Number.isFinite(size) ? Math.max(8, Math.min(500, size)) : 60;
  if (world.floor) world.floor.dispose();
  world.floor = BABYLON.MeshBuilder.CreateGround("floor", { width: floorSize, height: floorSize }, world.scene);
  world.floor.position.y = 0;
  const floorMat = new BABYLON.StandardMaterial("floorMat", world.scene);
  floorMat.diffuseColor = parseColor(color, new BABYLON.Color3(0.31, 0.56, 0.31));
  world.floor.material = floorMat;
}

function setSky(mode) {
  const value = String(mode || "day").toLowerCase();
  if (value === "night") {
    world.scene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.13, 1);
    return;
  }
  if (value === "sunset") {
    world.scene.clearColor = new BABYLON.Color4(0.98, 0.56, 0.32, 1);
    return;
  }
  if (value === "day") {
    world.scene.clearColor = new BABYLON.Color4(0.66, 0.83, 0.97, 1);
    return;
  }
  const c = parseColor(mode, new BABYLON.Color3(0.66, 0.83, 0.97));
  world.scene.clearColor = new BABYLON.Color4(c.r, c.g, c.b, 1);
}

function setSunIntensity(value) {
  if (Number.isFinite(value)) {
    world.light.intensity = Math.max(0, Math.min(4, value));
  }
}

function setAmbientLight(color) {
  world.scene.ambientColor = parseColor(color, new BABYLON.Color3(1, 1, 1));
}

function clearWorld() {
  for (const mesh of world.parts.values()) {
    mesh.dispose();
  }
  world.parts.clear();
  world.dynamicParts.clear();
  world.spawnIndex = 0;
}

function spawnPart(name, x, y, z, size, color) {
  const partName = uniqueName(String(name || "Part"));
  const mesh = BABYLON.MeshBuilder.CreateBox(partName, { size: 1 }, world.scene);
  mesh.scaling.setAll(Math.max(0.2, size));
  mesh.position.set(x, y, z);
  mesh.metadata = { anchored: true, velocityY: 0 };
  const mat = new BABYLON.StandardMaterial(`${partName}-mat`, world.scene);
  mat.diffuseColor = parseColor(color, new BABYLON.Color3(0.64, 0.76, 1));
  mesh.material = mat;
  world.parts.set(partName, mesh);
  world.spawnIndex += 1;
}

function destroyPart(name) {
  const mesh = getPart(name);
  if (!mesh) return;
  world.dynamicParts.delete(mesh);
  world.parts.delete(mesh.name);
  mesh.dispose();
}

function setPartColor(name, color) {
  const mesh = getPart(name);
  if (!mesh) return;
  ensureStandardMaterial(mesh).diffuseColor = parseColor(color, new BABYLON.Color3(1, 1, 1));
}

function setPartSize(name, size) {
  const mesh = getPart(name);
  if (!mesh || !Number.isFinite(size)) return;
  const s = Math.max(0.2, size);
  mesh.scaling.setAll(s);
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

function updatePlayer(dt) {
  if (!world.playerRoot) return;

  const dir = new BABYLON.Vector3(0, 0, 0);
  if (world.keys.has("KeyW")) dir.z += 1;
  if (world.keys.has("KeyS")) dir.z -= 1;
  if (world.keys.has("KeyA")) dir.x -= 1;
  if (world.keys.has("KeyD")) dir.x += 1;
  if (world.keys.has("Space")) jump(world.jumpPower);

  if (dir.length() > 0) {
    dir.normalize();
    world.playerRoot.position.x += dir.x * world.speed * dt;
    world.playerRoot.position.z += dir.z * world.speed * dt;
    world.playerRoot.rotation.y = Math.atan2(dir.x, dir.z);
  }

  world.velocityY += world.gravity * dt;
  world.playerRoot.position.y += world.velocityY * dt;
  if (world.playerRoot.position.y <= 1.6) {
    world.playerRoot.position.y = 1.6;
    world.velocityY = 0;
    world.grounded = true;
  }
}

function updateDynamicParts(dt) {
  for (const mesh of world.dynamicParts) {
    if (!mesh || mesh.isDisposed()) continue;
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
  if (mesh.material instanceof BABYLON.StandardMaterial) {
    return mesh.material;
  }
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

setupScene();
