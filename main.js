import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const canvas = document.getElementById("viewer");
const resetBtn = document.getElementById("reset-btn");

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Camera
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(2, 1.5, 3);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 125;
controls.maxDistance = 300;
controls.target.set(0, 0, 0);

// Better lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-5, 2, -5);
scene.add(fillLight);

// Draco + GLTF
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);


// Model
// ... keep all the previous imports and setup the same ...

let model = null;
const materials = new Map(); // name → material

loader.load(
  "Assets/556Case.glb",
  (gltf) => {
    model = gltf.scene;
    scene.add(model);

    // Center and frame the model (same as before)
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2.8; // your preferred zoom-out value

    camera.position.set(cameraZ * 0.8, cameraZ * 0.5, cameraZ);
    controls.target.set(0, 0, 0);
    controls.update();

    // --- Collect materials and build color pickers ---
    createColorPickers(model);
  },
  undefined,
  (error) => console.error(error)
);

function createColorPickers(object) {
  const container = document.getElementById("color-controls");
  container.innerHTML = "";
  materials.clear();

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    // Handle both single materials and material arrays
    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat, index) => {
      // Give it a readable name
      let name = child.name || mat.name || `Part ${materials.size + 1}`;
      if (mats.length > 1) name += ` (${index + 1})`;

      // Avoid duplicates if the same material is reused
      if (materials.has(name)) return;

      // Clone the material so changing one part doesn’t affect others
      // that share the original material
      const uniqueMat = mat.clone();
      if (Array.isArray(child.material)) {
        child.material[index] = uniqueMat;
      } else {
        child.material = uniqueMat;
      }

      materials.set(name, uniqueMat);

      // Create the UI row
      const row = document.createElement("div");
      row.className = "color-row";

      const label = document.createElement("label");
      label.textContent = name;

      const input = document.createElement("input");
      input.type = "color";

      // Set the initial color from the material
      const color = uniqueMat.color || new THREE.Color(0xffffff);
      input.value = "#" + color.getHexString();

      input.addEventListener("input", (e) => {
        uniqueMat.color.set(e.target.value);
        // If the material has a map (texture), you may also want:
        // uniqueMat.map = null;  // optional – removes texture so pure color shows
        uniqueMat.needsUpdate = true;
      });

      row.appendChild(label);
      row.appendChild(input);
      container.appendChild(row);
    });
  });

  if (materials.size === 0) {
    container.innerHTML = "<p style='color:#777;font-size:0.85rem'>No materials found</p>";
  }
}


// Resize handler
function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

window.addEventListener("resize", resize);
resize(); // initial size

// Reset button
resetBtn.addEventListener("click", () => {
  if (!model) return;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 100;  // was 1.6

  camera.position.set(cameraZ * 0.8, cameraZ * 0.5, cameraZ);
  controls.target.set(0, 0, 0);
  controls.update();
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
