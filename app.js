const defaults = {
  luau: [
    'print("Boblox world boot")',
    'createFloor(80, "#4f8f4f")',
    'setSky("sunset")',
    'createPlayer("Noob")',
    "setSpeed(10)",
    'spawnPart("Spawn", 4, 1, 0, 2, "#ff8844")'
  ].join("\n"),
  python: [
    'print("Boblox world boot")',
    'createFloor(80, "#4f8f4f")',
    'setSky("day")',
    'createPlayer("Coder")',
    "setSpeed(10)",
    'spawnPart("Spawn", 4, 1, 0, 2, "#44aaff")'
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
  playerLabel: "Player",
  speed: 8,
  velocityY: 0,
  grounded: false,
  gravity: -22,
  keys: new Set(),
  spawnIndex: 0
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
    Math.PI / 2.8,
    24,
    new BABYLON.Vector3(0, 0, 0),
    world.scene
  );
  world.camera.attachControl(canvas, true);
  world.camera.lowerRadiusLimit = 8;
  world.camera.upperRadiusLimit = 60;

  world.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), world.scene);
  world.light.intensity = 0.95;

  createFloor(60, "#4f8f4f");
  createPlayer("Noob");

  world.engine.runRenderLoop(() => {
    updatePlayer(world.engine.getDeltaTime() / 1000);
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
    .filter((line) => line.length > 0 && !line.startsWith("--") && !line.startsWith("#"));

  let recognized = 0;
  for (const line of lines) {
    const parsed = parseCall(line);
    if (!parsed) {
      continue;
    }

    const { fn, args } = parsed;

    if (fn === "print") {
      logs.push(`[print] ${String(args[0] ?? "")}`);
      recognized += 1;
      continue;
    }

    if (fn === "createplayer") {
      createPlayer(String(args[0] ?? "Player"));
      logs.push(`[world] createPlayer '${world.playerLabel}'`);
      recognized += 1;
      continue;
    }

    if (fn === "createfloor") {
      createFloor(Number(args[0] ?? 60), String(args[1] ?? "#4f8f4f"));
      logs.push(`[world] createFloor size=${Number(args[0] ?? 60)}`);
      recognized += 1;
      continue;
    }

    if (fn === "setsky") {
      setSky(String(args[0] ?? "day"));
      logs.push(`[world] setSky '${String(args[0] ?? "day")}'`);
      recognized += 1;
      continue;
    }

    if (fn === "setspeed") {
      setSpeed(Number(args[0] ?? 8));
      logs.push(`[player] speed=${world.speed}`);
      recognized += 1;
      continue;
    }

    if (fn === "moveplayer") {
      movePlayer(Number(args[0] ?? 0), Number(args[1] ?? 0));
      logs.push(`[player] move (${Number(args[0] ?? 0)}, ${Number(args[1] ?? 0)})`);
      recognized += 1;
      continue;
    }

    if (fn === "teleport") {
      teleport(Number(args[0] ?? 0), Number(args[1] ?? 2), Number(args[2] ?? 0));
      logs.push(`[player] teleport (${Number(args[0] ?? 0)}, ${Number(args[1] ?? 2)}, ${Number(args[2] ?? 0)})`);
      recognized += 1;
      continue;
    }

    if (fn === "jump") {
      jump(Number(args[0] ?? 8));
      logs.push(`[player] jump ${Number(args[0] ?? 8)}`);
      recognized += 1;
      continue;
    }

    if (fn === "spawnpart" || fn === "createpart") {
      const name = String(args[0] ?? "Part");
      const x = Number(args[1] ?? (world.spawnIndex % 8) - 4);
      const y = Number(args[2] ?? 1);
      const z = Number(args[3] ?? Math.floor(world.spawnIndex / 8) * 2 - 4);
      const size = Number(args[4] ?? 1.5);
      const color = String(args[5] ?? "#a4c2ff");
      spawnPart(name, x, y, z, size, color);
      logs.push(`[world] spawnPart '${name}'`);
      recognized += 1;
      continue;
    }
  }

  if (recognized === 0) {
    logs.push("No recognized commands. See commands hint under editor.");
  }

  return logs;
}

function parseCall(line) {
  const match = line.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
  if (!match) {
    return null;
  }
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
  if (chunk.trim()) {
    args.push(chunk.trim());
  }
  return args;
}

function parseArg(token) {
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1);
  }
  if (token.startsWith("`") && token.endsWith("`")) {
    return token.slice(1, -1);
  }
  const num = Number(token);
  if (!Number.isNaN(num)) {
    return num;
  }
  return token;
}

function createFloor(size, color) {
  const floorSize = Number.isFinite(size) ? Math.max(8, Math.min(500, size)) : 60;
  if (world.floor) {
    world.floor.dispose();
  }
  world.floor = BABYLON.MeshBuilder.CreateGround("floor", { width: floorSize, height: floorSize }, world.scene);
  world.floor.position.y = 0;
  const material = new BABYLON.StandardMaterial("floorMat", world.scene);
  material.diffuseColor = parseColor(color, new BABYLON.Color3(0.31, 0.56, 0.31));
  world.floor.material = material;
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
  world.scene.clearColor = new BABYLON.Color4(
    parseColor(mode, new BABYLON.Color3(0.66, 0.83, 0.97)).r,
    parseColor(mode, new BABYLON.Color3(0.66, 0.83, 0.97)).g,
    parseColor(mode, new BABYLON.Color3(0.66, 0.83, 0.97)).b,
    1
  );
}

function createPlayer(name) {
  if (world.playerRoot) {
    world.playerRoot.dispose();
  }

  world.playerLabel = String(name || "Player");
  world.playerRoot = new BABYLON.TransformNode("playerRoot", world.scene);
  world.playerRoot.position = new BABYLON.Vector3(0, 1.6, 0);

  const body = BABYLON.MeshBuilder.CreateBox("body", { width: 1.2, height: 1.6, depth: 0.7 }, world.scene);
  body.parent = world.playerRoot;
  body.position.y = 0;

  const head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.9, segments: 16 }, world.scene);
  head.parent = world.playerRoot;
  head.position.y = 1.25;

  const matBody = new BABYLON.StandardMaterial("bodyMat", world.scene);
  matBody.diffuseColor = new BABYLON.Color3(0.2, 0.55, 0.9);
  body.material = matBody;

  const matHead = new BABYLON.StandardMaterial("headMat", world.scene);
  matHead.diffuseColor = new BABYLON.Color3(0.95, 0.82, 0.62);
  head.material = matHead;

  world.camera.lockedTarget = world.playerRoot;
}

function setSpeed(speed) {
  if (Number.isFinite(speed)) {
    world.speed = Math.max(1, Math.min(40, speed));
  }
}

function movePlayer(dx, dz) {
  if (!world.playerRoot) return;
  world.playerRoot.position.x += dx;
  world.playerRoot.position.z += dz;
}

function teleport(x, y, z) {
  if (!world.playerRoot) return;
  world.playerRoot.position.x = x;
  world.playerRoot.position.y = Math.max(1.6, y);
  world.playerRoot.position.z = z;
  world.velocityY = 0;
}

function jump(power) {
  if (!world.playerRoot || !world.grounded) return;
  world.velocityY = Math.max(2, Math.min(40, power));
  world.grounded = false;
}

function updatePlayer(delta) {
  if (!world.playerRoot) return;
  const movement = new BABYLON.Vector3(0, 0, 0);

  if (world.keys.has("KeyW")) movement.z += 1;
  if (world.keys.has("KeyS")) movement.z -= 1;
  if (world.keys.has("KeyA")) movement.x -= 1;
  if (world.keys.has("KeyD")) movement.x += 1;
  if (world.keys.has("Space")) jump(9);

  if (movement.length() > 0) {
    movement.normalize();
    world.playerRoot.position.x += movement.x * world.speed * delta;
    world.playerRoot.position.z += movement.z * world.speed * delta;
  }

  world.velocityY += world.gravity * delta;
  world.playerRoot.position.y += world.velocityY * delta;

  if (world.playerRoot.position.y <= 1.6) {
    world.playerRoot.position.y = 1.6;
    world.velocityY = 0;
    world.grounded = true;
  }
}

function spawnPart(name, x, y, z, size, color) {
  const part = BABYLON.MeshBuilder.CreateBox(name, { size: Math.max(0.2, size) }, world.scene);
  part.position = new BABYLON.Vector3(x, y, z);
  const material = new BABYLON.StandardMaterial(`${name}-mat`, world.scene);
  material.diffuseColor = parseColor(color, new BABYLON.Color3(0.64, 0.76, 1));
  part.material = material;
  world.spawnIndex += 1;
}

function parseColor(value, fallback) {
  try {
    return BABYLON.Color3.FromHexString(String(value));
  } catch (_) {
    return fallback;
  }
}

setupScene();
