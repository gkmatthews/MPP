import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const canvas = document.getElementById("viewer");
const resetBtn = document.getElementById("reset-btn");

// Renderer setup
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111118);

// Camera setup
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 0, 75);

// Orbit Controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 200;
controls.maxDistance = 250;
controls.target.set(0, 0, 0);

// Lighting setup
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 1.2);
scene.add(hemiLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight1.position.set(5, 10, 7);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight2.position.set(-5, -2, -5);
scene.add(dirLight2);

// Draco & GLTF Loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

let model = null;
let defaultCamPos = new THREE.Vector3();
const materials = new Map();

loader.load(
  "Assets/556Case.glb",
  (gltf) => {
    model = gltf.scene;
    scene.add(model);

    // Center model geometry
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    model.position.sub(center);

    // Frame model into camera view dynamically
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraDist = (maxDim / 2) / Math.tan(fov / 2) * 2.2;

    defaultCamPos.set(cameraDist * 0.7, cameraDist * 0.4, cameraDist);
    camera.position.copy(defaultCamPos);
    
    controls.minDistance = maxDim * 0.5;
    controls.maxDistance = maxDim * 3;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.minPolarAngle = 0;                  // looking straight down from above
    controls.maxPolarAngle = Math.PI / 2;        // looking straight from the side (horizon)

    createMaterialControls(model);
  },
  undefined,
  (error) => console.error("Error loading model:", error)
);

// 10 Preset Colors Palette
const PRESET_COLORS = [
  { name: "Matte Black", hex: "#000000", metalness: 0.0, roughness: 0.85},
  { name: "Gunmetal", hex: "#75787B", metalness: 0.0, roughness: 0.85},
  { name: "Olive Drab", hex: "#5A6D3D", metalness: 0.0, roughness: 0.85},
  { name: "Desert Tan", hex: "#C2B29A", metalness: 0.0, roughness: 0.85},
  { name: "Brass / Gold", hex: "#F1BE48", metalness: 0.9, roughness: 0.25},
  { name: "Powder Puff", hex: "#E684B4", metalness: 0.0, roughness: 0.85},
  { name: "Crimson Red", hex: "#BC2726", metalness: 0.0, roughness: 0.85},
  { name: "Electric Blue", hex: "#1729AB", metalness: 0.0, roughness: 0.85},
  { name: "Safety Orange", hex: "#ED7334", metalness: 0.0, roughness: 0.85},
  { name: "Pure White", hex: "#FFFFFF", metalness: 0.0, roughness: 0.85}
];

function createMaterialControls(object) {
  const container = document.getElementById("color-controls");
  container.innerHTML = "";
  materials.clear();

  // Grouping map: Category Name -> Array of unique materials
  const materialGroups = new Map();

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat, index) => {
      let rawName = child.name || mat.name || `Part`;
      
      // Grouping logic: If the part name includes "latch" (case-insensitive), group them together!
      let groupKey = rawName;
      if (rawName.toLowerCase().includes("latch")) {
        groupKey = "Latches";
      }

      // Avoid duplicate material processing within the same group
      if (materials.has(groupKey)) {
        // If it's already registered, ensure this mesh uses the cloned material instance
        const existingMat = materials.get(groupKey);
        if (Array.isArray(child.material)) {
          child.material[index] = existingMat;
        } else {
          child.material = existingMat;
        }
        return;
      }

      // Clone the material so changes are isolated
      const uniqueMat = mat.clone();
      if (Array.isArray(child.material)) {
        child.material[index] = uniqueMat;
      } else {
        child.material = uniqueMat;
      }

      materials.set(groupKey, uniqueMat);
      materialGroups.set(groupKey, uniqueMat);
    });
  });

  // Build UI controls for each unique material / group
  materialGroups.forEach((mat, groupName) => {
    const card = document.createElement("div");
    card.className = "color-row";

    const label = document.createElement("label");
    label.textContent = groupName;
    card.appendChild(label);

    // Swatch container
    const swatchContainer = document.createElement("div");
    swatchContainer.className = "swatch-container";

    let currentHex = "#" + (mat.color || new THREE.Color(0xffffff)).getHexString();

    PRESET_COLORS.forEach((preset) => {
      const swatch = document.createElement("button");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = preset.hex;
      swatch.title = preset.name;

      // Check if this swatch matches the initial material color closely
      if (preset.hex.toLowerCase() === currentHex.toLowerCase()) {
        swatch.classList.add("active");
      }

        swatch.addEventListener("click", () => {
        // Update active class on sibling swatches
        swatchContainer.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");

        // Apply color, metalness, and roughness
        mat.color.set(preset.hex).convertSRGBToLinear();
        
        if (mat.metalness !== undefined) {
          mat.metalness = preset.metalness;
        }
        if (mat.roughness !== undefined) {
          mat.roughness = preset.roughness;
        }
        
        mat.needsUpdate = true;
      });

        // Apply color to material (converted to Linear space for Three.js)
        mat.color.set(preset.hex).convertSRGBToLinear();
        mat.needsUpdate = true;
      });

      swatchContainer.appendChild(swatch);
    });

    card.appendChild(swatchContainer);
    container.appendChild(card);
  });

  if (materialGroups.size === 0) {
    container.innerHTML = "<p style='color:#777;font-size:0.85rem'>No configurable materials found</p>";
  }
}
// Window resize handler
function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (canvas.width !== width || canvas.height !== height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
}

window.addEventListener("resize", resize);

// Reset camera view
resetBtn.addEventListener("click", () => {
  if (!model) return;
  camera.position.copy(defaultCamPos);
  controls.target.set(0, 0, 0);
  controls.update();
});

// Render loop
function animate() {
  requestAnimationFrame(animate);
  resize();
  controls.update();
  renderer.render(scene, camera);
}
animate();
