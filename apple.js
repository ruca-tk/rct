
// Import THREE.js core and its GLTFLoader addon.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- SETUP -------------------------------------------------
// Grab the canvas container and loading overlay DOM elements.
const container = document.getElementById('canvas-container');
const loadingEl = document.getElementById('loading');

// Create a new 3D scene.
const scene = new THREE.Scene();

// Set up a perspective camera (FOV=35, correct aspect, near/far planes).
const camera = new THREE.PerspectiveCamera(
  35,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
// Position the camera a little away from the center (z = 5).
camera.position.set(0, 0, 5);

// Create a WebGL renderer with anti-aliasing, alpha, and performance hints.
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
// Make the renderer use the size of the container.
renderer.setSize(container.clientWidth, container.clientHeight);
// Control rendering resolution, but cap to 2× for perf.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Enable filmic tone mapping to make lighting look nice.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Slightly boost scene brightness.
renderer.toneMappingExposure = 1.2;
// Use sRGB output color space for correct color rendering.
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Add the renderer's <canvas> to the page.
container.appendChild(renderer.domElement);

// --- LIGHTING ---------------------------------------------
// Add a soft ambient light for general illumination.
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Add a strong white key light (primary directional illumination).
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

// A bluish fill light to soften shadows.
const fillLight = new THREE.DirectionalLight(0xddeeff, 0.8);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);

// A warm rim light for subtle edge highlighting.
const rimLight = new THREE.DirectionalLight(0xffeedd, 1.0);
rimLight.position.set(0, -2, -4);
scene.add(rimLight);

// ------------------------ 
// Set up a baked-in environment for realistic reflections.
const pmremGenerator = new THREE.PMREMGenerator(renderer);   // PMREM creates cube map for env mapping.
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x1a1a2e);             // Slightly blue bg for reflections.

// Add directional lights to our environment map scene.
const envLight1 = new THREE.DirectionalLight(0xffffff, 1);
envLight1.position.set(1, 1, 1);
envScene.add(envLight1);

const envLight2 = new THREE.DirectionalLight(0x8888ff, 0.5);
envLight2.position.set(-1, -0.5, -1);
envScene.add(envLight2);

// Generate the environment map (used for shiny reflections).
const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
scene.environment = envMap;   // Attach to scene for use in PBR materials.
pmremGenerator.dispose();     // We're done with PMREM generator.

// --- STATE ------------------------------------------------
let appleGroup = null;     // Holds loaded and centered apple model.
let modelLoaded = false;   // Flag to show if GLTF is ready.

// Mouse coordinates, normalized (-1..1), and their smoothed versions for inertia.
const mouse = { x: 0, y: 0 };
const smoothMouse = { x: 0, y: 0 };

// Drag and spin handling
let isDragging = false;                   // Are we currently dragging?
let prevDrag = { x: 0, y: 0 };            // Last known drag pointer position
const dragVelocity = { x: 0, y: 0 };      // Per-frame drag movement
const spinMomentum = { x: 0, y: 0 };      // Spinning velocity from quick mouse release

const autoRotationSpeed = 0.003;          // Speed for idle auto-spin.

// Stores the current accumulated drag/spin rotation as a quaternion.
const dragQuaternion = new THREE.Quaternion();
dragQuaternion.setFromEuler(new THREE.Euler(0.8, 0, 0));

// --- LOAD THE MODEL ---------------------------------------
// Set up a GLTF loader for the 3D apple.
const loader = new GLTFLoader();

loader.load(
  './apple.glb',           // Model URL (must be in same folder).
  (gltf) => {              // On load success:
    const model = gltf.scene;

    // Compute model's bounding box for proper centering/scaling.
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.8 / maxDim; // Fit model into a box of ~2.2 units.

    model.position.sub(center);        // Center the model at origin.
    model.scale.setScalar(scale);      // Uniformly scale model to target size.

    // Put it in a group, to isolate interactive rotation logic.
    appleGroup = new THREE.Group();
    appleGroup.add(model);
    scene.add(appleGroup);

    // Mark as ready and hide loading overlay.
    modelLoaded = true;
    loadingEl.classList.add('hidden');
  },
  (progress) => {
    // (Unused) Will run as model loads—could show progress bar here.
  },
  (error) => {
    // Show error message if loading fails.
    console.error('Error loading model:', error);
    loadingEl.querySelector('.loading-text').textContent = 'Failed to load model';
  }
);

// --- INTERACTION ------------------------------------------
// Update mouse position and apply drag forces if dragging.
container.addEventListener('pointermove', (e) => {
  // Calculate normalized device coordinates of pointer.
  const rect = container.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  if (isDragging) {
    // Difference in pointer position.
    const dx = e.clientX - prevDrag.x;
    const dy = e.clientY - prevDrag.y;
    dragVelocity.x = dx;
    dragVelocity.y = dy;

    // Each small drag movement is converted to a rotation around X and Y axes.
    const angleX = dy * 0.006;
    const angleY = dx * 0.006;

    // Build quaternions for X and Y axis rotation.
    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleX);

    const qy = new THREE.Quaternion();
    qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);

    // Apply (premultiply) those rotations to our stored drag rotation.
    dragQuaternion.premultiply(qy);
    dragQuaternion.premultiply(qx);

    // Update memory of last pointer position for next move event.
    prevDrag.x = e.clientX;
    prevDrag.y = e.clientY;
  }
});

// On pointer down, start dragging and record pointer position.
container.addEventListener('pointerdown', (e) => {
  isDragging = true;                     // Drag begins
  prevDrag.x = e.clientX;
  prevDrag.y = e.clientY;
  dragVelocity.x = 0;
  dragVelocity.y = 0;
  container.setPointerCapture(e.pointerId); // Exclusively capture moves/drags for this pointer.
});

// On pointer up, stop dragging; if we were dragging, apply "momentum".
container.addEventListener('pointerup', (e) => {
  if (isDragging) {
    // At end of drag, capture velocity to spin after user lets go.
    spinMomentum.x = dragVelocity.y * 0.006; // y drag becomes X rotation
    spinMomentum.y = dragVelocity.x * 0.006; // x drag becomes Y rotation
  }
  isDragging = false;
  container.releasePointerCapture(e.pointerId);
});

// When user touches on mobile, block scroll to allow interaction if single finger.
container.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    e.preventDefault();
  }
}, { passive: false });

// If mouse leaves the container, reset mouse position gradually.
container.addEventListener('pointerleave', () => {
  mouse.x = 0;
  mouse.y = 0;
});

// --- RESPONSIVE RESIZING ----------------------------------
// Keep 3D render aligned with container size and aspect ratio.
const onResize = () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix(); // Let camera know about new aspect ratio.
  renderer.setSize(w, h);          // Actually resize the renderer's canvas.
};
window.addEventListener('resize', onResize);

// --- MAIN ANIMATION LOOP ----------------------------------
const clock = new THREE.Clock(); // For accurate frame timing.

function animate() {
  // Ask browser to call animate() again before the next repaint.
  requestAnimationFrame(animate);

  // If model isn't loaded, just draw what we have (typically empty/overlay).
  if (!modelLoaded || !appleGroup) {
    renderer.render(scene, camera);
    return;
  }

  // Compute time elapsed since last frame (cap at 50ms to avoid jumps).
  const dt = Math.min(clock.getDelta(), 0.05);

  // ---- (1) Mouse smoothing for inertia/lag:
  // Smoothly interpolate virtual mouse toward physical mouse (prevents jitter).
  const lerpFactor = 1 - Math.pow(0.05, dt);
  smoothMouse.x += (mouse.x - smoothMouse.x) * lerpFactor;
  smoothMouse.y += (mouse.y - smoothMouse.y) * lerpFactor;

  // ---- (2) Cursor-following tilt:
  // Compute tilt angles in radians (smaller = less tilt).
  const followRadius = 0.15;
  const targetTiltX = -smoothMouse.y * followRadius;
  const targetTiltY = smoothMouse.x * followRadius;

  // ---- (3) Auto-rotation (slowly spins when not dragging)
  if (!isDragging) {
    const autoQuat = new THREE.Quaternion();
    autoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), autoRotationSpeed);
    dragQuaternion.premultiply(autoQuat);
  }

  // ---- (4) Spin momentum after drag fling (spins down due to 'friction')
  if (
    !isDragging &&
    (Math.abs(spinMomentum.x) > 0.0001 || Math.abs(spinMomentum.y) > 0.0001)
  ) {
    // Build quaternions for momentum-based X and Y increments.
    const mx = new THREE.Quaternion();
    mx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), spinMomentum.x);

    const my = new THREE.Quaternion();
    my.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spinMomentum.y);

    // Apply them to our drag rotation.
    dragQuaternion.premultiply(my);
    dragQuaternion.premultiply(mx);

    // Exponentially decay momentum so spinning slows over time.
    const decay = Math.pow(0.04, dt);
    spinMomentum.x *= decay;
    spinMomentum.y *= decay;
  }

  // ---- (5) Compose final rotation from tilt+drag quaternions:
  const cursorTilt = new THREE.Quaternion();
  // Euler combines our X and Y tilts (from smoothed mouse, around X, then Y).
  const euler = new THREE.Euler(targetTiltX, targetTiltY, 0, 'XYZ');
  cursorTilt.setFromEuler(euler);

  const finalQuat = new THREE.Quaternion();
  finalQuat.copy(cursorTilt);
  finalQuat.multiply(dragQuaternion); // Compose (cursor tilt first, then drag).

  appleGroup.quaternion.copy(finalQuat); // Set the rotation of the model.

  // Add a very slight floating effect (oscillate up/down).
  const t = clock.elapsedTime;
  appleGroup.position.y = Math.sin(t * 0.8) * 0.06;

  // Draw scene from current camera pov.
  renderer.render(scene, camera);
}

// Start animation loop.
animate();

