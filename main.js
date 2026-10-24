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
camera.position.set(0, 0, 100);

// Orbit Controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 10;
controls.maxDistance = 500;
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
    controls.maxDistance = maxDim * 10;
    controls.target.set(0, 0, 0);
    controls.update();

    createMaterialControls(model);
  },
  undefined,
  (error) => console.error("Error loading model:", error)
);

function createMaterialControls(object) {
  const container = document.getElementById("color-controls");
  container.innerHTML = "";
  materials.clear();

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat, index) => {
      let name = child.name || mat.name || `Part ${materials.size + 1}`;
      if (mats.length > 1) name += ` (${index + 1})`;

      if (materials.has(name)) return;

      // Unique material per part
      const uniqueMat = mat.clone();
      if (Array.isArray(child.material)) {
        child.material[index] = uniqueMat;
      } else {
        child.material = uniqueMat;
      }

      materials.set(name, uniqueMat);

      // Create UI Control Card
      const card = document.createElement("div");
      card.className = "color-row";

      const label = document.createElement("label");
      label.textContent = name;
      card.appendChild(label);

      // Color Picker
      const inputColor = document.createElement("input");
      inputColor.type = "color";
      const initialColor = uniqueMat.color || new THREE.Color(0xffffff);
      inputColor.value = "#" + initialColor.getHexString();

      inputColor.addEventListener("input", (e) => {
        uniqueMat.color.set(e.target.value).convertSRGBToLinear();
        uniqueMat.needsUpdate = true;
      });
      card.appendChild(inputColor);

      // Roughness slider (if standard/physical material)
      if (uniqueMat.roughness !== undefined) {
        const roughLabel = document.createElement("span");
        roughLabel.className = "control-sublabel";
        roughLabel.textContent = "R";
        
        const inputRoughness = document.createElement("input");
        inputRoughness.type = "range";
        inputRoughness.min = "0";
        inputRoughness.max = "1";
        inputRoughness.step = "0.05";
        inputRoughness.value = uniqueMat.roughness;
        inputRoughness.className = "material-slider";

        inputRoughness.addEventListener("input", (e) => {
          uniqueMat.roughness = parseFloat(e.target.value);
        });

        card.appendChild(roughLabel);
        card.appendChild(inputRoughness);
      }

      container.appendChild(card);
    });
  });

  if (materials.size === 0) {
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
