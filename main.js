import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

const canvas = document.getElementById("viewer");
const resetBtn = document.getElementById("reset-btn");

// --- Renderer & Tone Mapping ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x22252a);

// Camera setup
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 0, 100);

// Orbit Controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 200;
controls.maxDistance = 250;
controls.target.set(0, 0, 0);

// --- Daylight Lighting Setup ---
// Hemisphere Light: simulates sky light (cool blue-white above, warm ground bounce below)
const hemiLight = new THREE.HemisphereLight(0xf0f4ff, 0x44403b, 1.6);
scene.add(hemiLight);

// Main "Sun" Light: strong, bright white light from above/front
const sunLight = new THREE.DirectionalLight(0xfffaf0, 2.2);
sunLight.position.set(10, 25, 15);
scene.add(sunLight);

// Secondary Fill Light: softer cool light from the opposite side to open up shadows
const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.0);
fillLight.position.set(-15, 10, -10);
scene.add(fillLight);

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
    const cameraDist = (maxDim / 2) / Math.tan(fov / 2) * 1.8;

    defaultCamPos.set(cameraDist * 0.7, cameraDist * 0.4, cameraDist);
    camera.position.copy(defaultCamPos);
    
    controls.minDistance = maxDim * 0.5;
    controls.maxDistance = maxDim * 3;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2;

    createMaterialControls(model);
    model.updateMatrixWorld(true);  
    addLogoDecal(model);
    addLatchDecals(model);

    
  },
  undefined,
  (error) => console.error("Error loading model:", error)
);

// 10 Preset Colors Palette
const PRESET_COLORS = [
  { name: "Matte Black", hex: "#000000", metalness: 0.0, roughness: 0.85},
  { name: "Gunmetal", hex: "#97999b", metalness: 0.0, roughness: 0.85},
  { name: "Olive Drab", hex: "#84ae84", metalness: 0.0, roughness: 0.85},
  { name: "Desert Tan", hex: "#cfc3b0", metalness: 0.0, roughness: 0.85},
  { name: "Brass / Gold", hex: "#fff552", metalness: 0.9, roughness: 0.25},
  { name: "Powder Puff", hex: "#eeaacb", metalness: 0.0, roughness: 0.85},
  { name: "Crimson Red", hex: "#BC2726", metalness: 0.0, roughness: 0.85},
  { name: "Electric Blue", hex: "#4b6fb4", metalness: 0.0, roughness: 0.85},
  { name: "Safety Orange", hex: "#f08d5a", metalness: 0.0, roughness: 0.85},
  { name: "Pure White", hex: "#FFFFFF", metalness: 0.0, roughness: 0.85}
];

function createMaterialControls(object) {
  const container = document.getElementById("color-controls");
  container.innerHTML = "";
  materials.clear();

  const materialGroups = new Map();

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat, index) => {
      let rawName = child.name || mat.name || `Part`;
      
      let groupKey = rawName;
      if (rawName.toLowerCase().includes("latch")) {
        groupKey = "Latches";
      }

      if (materials.has(groupKey)) {
        const existingMat = materials.get(groupKey);
        if (Array.isArray(child.material)) {
          child.material[index] = existingMat;
        } else {
          child.material = existingMat;
        }
        return;
      }

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

  materialGroups.forEach((mat, groupName) => {
    const card = document.createElement("div");
    card.className = "color-row";

    const label = document.createElement("label");
    label.textContent = groupName;
    card.appendChild(label);

    const swatchContainer = document.createElement("div");
    swatchContainer.className = "swatch-container";

    let currentHex = "#" + (mat.color || new THREE.Color(0xffffff)).getHexString();

    PRESET_COLORS.forEach((preset) => {
      const swatch = document.createElement("button");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = preset.hex;
      swatch.title = preset.name;

      if (preset.hex.toLowerCase() === currentHex.toLowerCase()) {
        swatch.classList.add("active");
      }

      swatch.addEventListener("click", () => {
        swatchContainer.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");

        mat.color.set(preset.hex).convertSRGBToLinear();
        
        if (mat.metalness !== undefined) {
          mat.metalness = preset.metalness;
        }
        if (mat.roughness !== undefined) {
          mat.roughness = preset.roughness;
        }
        
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

function createSvgDecalTexture(svgUrl, onReady) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 765;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    ctx.clearRect(0, 0, 1024, 765);
    ctx.drawImage(img, 0, 0, 1024, 765);
    texture.needsUpdate = true;
  };
  img.onerror = () => {
    console.warn("Could not load SVG from URL:", svgUrl, "- using fallback colored badge.");
  };
  img.src = svgUrl;

  onReady(texture);
}

function addLogoDecal(model) {
  // Find top mesh
  let targetMesh = null;
  model.traverse((child) => {
    if (child.isMesh && !targetMesh) {
      const name = child.name.toLowerCase();
      if (name.includes("lid") || name.includes("top") || name.includes("cover")) {
        targetMesh = child;
      }
    }
  });

  // Fallback to first available mesh if naming convention doesn't match
  if (!targetMesh) {
    model.traverse((child) => {
      if (child.isMesh && !targetMesh) targetMesh = child;
    });
  }

  if (!targetMesh) {
    console.error("No mesh found inside GLTF model to project decal.");
    return;
  }

  // Ensure matrix transforms are completely up to date
  model.updateMatrixWorld(true);

  // Compute bounding box in World Coordinates
  const box = new THREE.Box3().setFromObject(targetMesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const logoWidth = size.x * 0.875;    // resize: bigger number = bigger logo
  const logoOffsetX = size.x * -0.05;   // + moves right, - moves left
  const logoOffsetZ = size.z * 0.35;   // + moves toward the front (camera side), - toward the back
  const logoRotation = 0;             // spin the logo in radians (Math.PI / 2 = 90°)

  const position = new THREE.Vector3(center.x + logoOffsetX, box.max.y, center.z + logoOffsetZ);
  const orientation = new THREE.Euler(-Math.PI / 2, 0, logoRotation);
  const decalSize = new THREE.Vector3(logoWidth, logoWidth, size.y * 2);

  createSvgDecalTexture('Assets/556Image.svg', (decalTexture) => {
    const decalMaterial = new THREE.MeshStandardMaterial({
      map: decalTexture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      side: THREE.DoubleSide, // Renders both front & back faces so orientation isn't culled
      roughness: 0.5,
      metalness: 0.1
    });

    try {

      if (!targetMesh.geometry.attributes.normal) {
         targetMesh.geometry.computeVertexNormals();
      }
      
      console.log("Target mesh:", targetMesh.name, Object.keys(targetMesh.geometry.attributes));
      
      const decalGeo = new DecalGeometry(targetMesh, position, orientation, decalSize);
      const decalMesh = new THREE.Mesh(decalGeo, decalMaterial);
      
      // Add directly to the main scene in world coordinates
      scene.add(decalMesh);
      console.log("Decal projected successfully at position:", position);
    } catch (err) {
      console.error("Error building DecalGeometry:", err);
    }
  });
}

function loadSvgTexture(svgUrl, width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    texture.needsUpdate = true;
  };
  img.onerror = () => console.warn("Could not load SVG:", svgUrl);
  img.src = svgUrl;

  return texture;
}

function addLatchDecals(model) {
  // Settings to tweak
  const svgUrl = 'Assets/556Latch.svg';  // your new file
  const svgW = 512, svgH = 512;           // the new SVG's width/height attributes
  const widthRatio = 0.75;                 // logo width as a fraction of the latch width
  const offsetX = 0;                      // fraction of latch width: + right, - left
  const offsetY = -.25;                      // fraction of latch height: + up, - down
  const FRONT = 1;                        // 1 = +Z side, -1 = -Z side (flip if it lands on the back)

  model.updateMatrixWorld(true);

  const material = new THREE.MeshStandardMaterial({
    map: loadSvgTexture(svgUrl, svgW, svgH),
    transparent: true,
    alphaTest: 0.01,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: 0.5,
    metalness: 0.1
  });

  model.traverse((child) => {
    if (!child.isMesh || !child.name.toLowerCase().includes('latch')) return;

    if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();

    const box = new THREE.Box3().setFromObject(child);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const w = size.x * widthRatio;
    const h = w * (svgH / svgW);

    const position = new THREE.Vector3(
      center.x + size.x * offsetX,
      center.y + size.y * offsetY,
      FRONT > 0 ? box.max.z : box.min.z
    );
    const orientation = new THREE.Euler(0, FRONT > 0 ? 0 : Math.PI, 0);
    const decalSize = new THREE.Vector3(w, h, Math.max(size.z * 0.3, 0.5));

    try {
      const geo = new DecalGeometry(child, position, orientation, decalSize);
      scene.add(new THREE.Mesh(geo, material));
      console.log("Latch decal added on:", child.name);
    } catch (err) {
      console.error("Latch decal failed on", child.name, err);
    }
  });
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
