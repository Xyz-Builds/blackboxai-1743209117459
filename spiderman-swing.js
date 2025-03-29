// Enhanced Spider-Man Swing Simulation
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Initialize scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Physics setup
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Game state
let player, playerBody, buildings = [], web = null, webConstraint = null, isSwinging = false;
const webMaxLength = 15;
const webStrength = 20;

// Load NYC model
new GLTFLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/gltf/NewYork/NewYork.glb', (gltf) => {
    const nyc = gltf.scene;
    nyc.scale.set(0.5, 0.5, 0.5);
    scene.add(nyc);

    // Add physics for buildings
    nyc.traverse(child => {
        if (child.isMesh) {
            buildings.push(child);
            const size = new THREE.Vector3();
            child.geometry.computeBoundingBox();
            child.geometry.boundingBox.getSize(size);
            const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
            const body = new CANNON.Body({ mass: 0 });
            body.addShape(shape);
            body.position.copy(child.position);
            world.addBody(body);
        }
    });
});

// Load Spider-Man
new GLTFLoader().load('https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/SciFiHelmet/glTF/SciFiHelmet.gltf', (gltf) => {
    player = gltf.scene;
    player.scale.set(0.5, 0.5, 0.5);
    player.position.set(0, 10, 0);
    scene.add(player);

    // Player physics
    playerBody = new CANNON.Body({ mass: 1 });
    playerBody.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5)));
    playerBody.position.set(0, 10, 0);
    world.addBody(playerBody);

    // Start game loop
    animate(0);
});

// Controls
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'e' && !isSwinging) attachWeb();
});
document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'e' && isSwinging) detachWeb();
});

function attachWeb() {
    let nearest = null;
    let minDist = Infinity;
    
    buildings.forEach(b => {
        const dist = player.position.distanceTo(b.position);
        if (dist < minDist && dist < webMaxLength) {
            minDist = dist;
            nearest = b;
        }
    });
    
    if (nearest) {
        isSwinging = true;
        web = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([player.position, nearest.position]),
            new THREE.LineBasicMaterial({ color: 0xffffff })
        );
        scene.add(web);

        const bBody = world.bodies.find(b => 
            b.position.x === nearest.position.x &&
            b.position.y === nearest.position.y &&
            b.position.z === nearest.position.z
        );
        
        if (bBody) {
            webConstraint = new CANNON.DistanceConstraint(
                playerBody,
                bBody,
                minDist,
                webStrength
            );
            world.addConstraint(webConstraint);
        }
    }
}

function detachWeb() {
    if (web) scene.remove(web);
    if (webConstraint) world.removeConstraint(webConstraint);
    web = null;
    webConstraint = null;
    isSwinging = false;
}

function handleMovement(delta) {
    const speed = 5;
    const force = new CANNON.Vec3();
    
    if (keys['w']) force.z -= speed;
    if (keys['s']) force.z += speed;
    if (keys['a']) force.x -= speed;
    if (keys['d']) force.x += speed;
    
    if (force.length() > 0) {
        force.normalize().scale(speed * delta);
        playerBody.velocity.x += force.x;
        playerBody.velocity.z += force.z;
    }
}

// Game loop
let lastTime = 0;
function animate(time) {
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    
    world.step(1/60, delta, 3);
    if (player) player.position.copy(playerBody.position);
    
    if (isSwinging && web) {
        const points = web.geometry.attributes.position.array;
        points[0] = player.position.x;
        points[1] = player.position.y;
        points[2] = player.position.z;
        web.geometry.attributes.position.needsUpdate = true;
    }
    
    handleMovement(delta);
    
    camera.position.set(
        playerBody.position.x,
        playerBody.position.y + 5,
        playerBody.position.z + 10
    );
    camera.lookAt(playerBody.position);
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
