const defaults = {
  luau: 'print("hello from luau")\ncreatePart("SpawnCube")',
  python: 'print("hello from python")\ncreatePart("SpawnCube")'
};

const languageEl = document.getElementById("language");
const editorEl = document.getElementById("editor");
const logsEl = document.getElementById("logs");
const runBtn = document.getElementById("runBtn");
const canvas = document.getElementById("scene");

let spawnIndex = 0;
let sceneRef = null;

editorEl.value = defaults.luau;

languageEl.addEventListener("change", () => {
  editorEl.value = defaults[languageEl.value];
});

runBtn.addEventListener("click", () => {
  const result = runScript(languageEl.value, editorEl.value);
  logsEl.textContent = result.join("\n");
});

function runScript(language, code) {
  const logs = [`[local-runtime] language=${language}`];
  if (!code.trim()) {
    return ["error: code is empty"];
  }

  const printMatches = [...code.matchAll(/print\((["'`])(.+?)\1\)/g)];
  const partMatches = [...code.matchAll(/createPart\((["'`])(.+?)\1\)/g)];

  for (const match of printMatches) {
    logs.push(`[print] ${match[2]}`);
  }

  for (const match of partMatches) {
    const name = match[2];
    logs.push(`[world] createPart '${name}'`);
    createPart(name);
  }

  if (printMatches.length === 0 && partMatches.length === 0) {
    logs.push('No recognized commands. Try print("Hi") or createPart("Block").');
  }

  return logs;
}

function setupScene() {
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.95, 0.97, 1, 1);

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2.7,
    20,
    new BABYLON.Vector3(0, 0, 0),
    scene
  );
  camera.attachControl(canvas, true);

  const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.95;

  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 30, height: 30 }, scene);
  ground.position.y = -1;

  const starter = BABYLON.MeshBuilder.CreateBox("starter", { size: 2 }, scene);
  starter.position.y = 0.5;

  engine.runRenderLoop(() => {
    starter.rotation.y += 0.008;
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
  sceneRef = scene;
}

function createPart(name) {
  if (!sceneRef) return;
  const part = BABYLON.MeshBuilder.CreateBox(name, { size: 1.5 }, sceneRef);
  part.position = new BABYLON.Vector3((spawnIndex % 8) - 4, 0.5, Math.floor(spawnIndex / 8) * 2 - 4);
  spawnIndex += 1;
}

setupScene();
