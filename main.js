// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Earth gravity
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Load NYC model (using simplified version for performance)
const nycLoader = new THREE.ObjectLoader();
const nycModel = await fetch('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/json/landscape.json')
    .then(res => res.json())
    .then(data => nycLoader.parse(data));
scene.add(nycModel);

// Create physics bodies for buildings
nycModel.traverse(child => {
    if (child.isMesh) {
        const shape = new CANNON.Box(new CANNON.Vec3(
            child.geometry.boundingBox.max.x,
            child.geometry.boundingBox.max.y,
            child.geometry.boundingBox.max.z
        ));
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.copy(child.position);
        world.addBody(body);
    }
});

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Load Spider-Man model from Sketchfab
const loader = new THREE.GLTFLoader();
const spiderman = await loader.loadAsync('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxAnimated/glTF/BoxAnimated.gltf');
const player = spiderman.scene;
player.scale.set(0.5, 0.5, 0.5);
player.position.set(0, 10, 0);
scene.add(player);

// Player physics
const playerShape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
const playerBody = new CANNON.Body({ mass: 1 });
playerBody.addShape(playerShape);
playerBody.position.set(0, 10, 0);
world.addBody(playerBody);

// Web swinging variables
let web = null;
let webConstraint = null;
let isSwinging = false;
const webMaxLength = 15;
const webStrength = 20;

// Keyboard controls
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // Start swinging when E is pressed
    if (e.key.toLowerCase() === 'e' && !isSwinging) {
        attachWeb();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    
    // Release web when E is released
    if (e.key.toLowerCase() === 'e' && isSwinging) {
        detachWeb();
    }
});

function attachWeb() {
    // Find nearest building to attach web to
    let nearestBuilding = null;
    let minDistance = Infinity;
    
    for (const building of buildings) {
        const distance = player.position.distanceTo(building.position);
        if (distance < minDistance && distance < webMaxLength) {
            minDistance = distance;
            nearestBuilding = building;
        }
    }
    
    if (nearestBuilding) {
        isSwinging = true;
        
        // Create web line
        const webGeometry = new THREE.BufferGeometry().setFromPoints([
            player.position,
            nearestBuilding.position
        ]);
        const webMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        web = new THREE.Line(webGeometry, webMaterial);
        scene.add(web);
        
        // Create physics constraint
        const buildingBody = world.bodies.find(b => 
            b.position.x === nearestBuilding.position.x &&
            b.position.y === nearestBuilding.position.y &&
            b.position.z === nearestBuilding.position.z
        );
        
        if (buildingBody) {
            const localAnchor = new CANNON.Vec3(0, 0, 0);
            const webAnchor = new CANNON.Vec3(
                nearestBuilding.position.x - player.position.x,
                nearestBuilding.position.y - player.position.y,
                nearestBuilding.position.z - player.position.z
            ).scale(0.5);
            
            webConstraint = new CANNON.DistanceConstraint(
                playerBody,
                buildingBody,
                webAnchor.length(),
                webStrength
            );
            world.addConstraint(webConstraint);
        }
    }
}

function detachWeb() {
    if (web) {
        scene.remove(web);
        web = null;
    }
    if (webConstraint) {
        world.removeConstraint(webConstraint);
        webConstraint = null;
    }
    isSwinging = false;
}

// Movement controls
function handleMovement(delta) {
    const moveSpeed = 5;
    const moveForce = new CANNON.Vec3();
    
    if (keys['w']) moveForce.z -= moveSpeed;
    if (keys['s']) moveForce.z += moveSpeed;
    if (keys['a']) moveForce.x -= moveSpeed;
    if (keys['d']) moveForce.x += moveSpeed;
    
    // Apply movement force
    if (moveForce.length() > 0) {
        moveForce.normalize();
        moveForce.scale(moveSpeed * delta, moveForce);
        playerBody.velocity.x += moveForce.x;
        playerBody.velocity.z += moveForce.z;
    }
}

// Animation loop
let lastTime = 0;
function animate(time) {
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    
    // Update physics
    world.step(1/60, delta, 3);
    
    // Update player position
    player.position.copy(playerBody.position);
    
    // Update web line if swinging
    if (isSwinging && web) {
        const points = web.geometry.attributes.position.array;
        points[0] = player.position.x;
        points[1] = player.position.y;
        points[2] = player.position.z;
        web.geometry.attributes.position.needsUpdate = true;
    }
    
    // Handle movement
    handleMovement(delta);
    
    // Update camera position
    camera.position.set(
        player.position.x,
        player.position.y + 5,
        player.position.z + 10
    );
    camera.lookAt(player.position);
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate(0);