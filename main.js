/// <reference path="babylon.d.ts" />


const canvas = document.getElementById("renderCanvas"); // Get the canvas element
const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
const scene = new BABYLON.Scene(engine);

let camera;
let ground; 
let box;

const playerSpeed = 0.125; 
let player;
let direction = BABYLON.Vector3.Zero();
let facing = BABYLON.Vector3.Zero();

const bulletSpeed = 0.25;
let bulletList = [];


const loadEnvironment = function () {
    camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, 10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);

    box = BABYLON.MeshBuilder.CreateBox("box1", { width: 2, height: 2, depth: 2 }, scene);
    box.position = new BABYLON.Vector3(-3, 1, 0);
    const boxMaterial = new BABYLON.StandardMaterial("box1");
    boxMaterial.diffuseColor = BABYLON.Color3.Red();
    box.material = boxMaterial;
};


const loadPlayer = async function () {
    const idleResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/rop_gltfcharacteroutput_idle_29F.glb", scene);
    const walkResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/rop_gltfcharacteroutput_walk_29F.glb", scene);
    const attackResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/rop_gltfcharacteroutput_attack_10F.glb", scene);
    
    let newPlayer = {
        idleMesh: idleResult.meshes[0],
        walkMesh: walkResult.meshes[0],
        attackMesh: attackResult.meshes[0],
        collisionMesh: idleResult.meshes[1].clone(),
        transform: new BABYLON.TransformNode("player", scene),
    };

    newPlayer.idleMesh.setParent(newPlayer.transform);
    newPlayer.walkMesh.setParent(newPlayer.transform);
    newPlayer.attackMesh.setParent(newPlayer.transform);
    newPlayer.collisionMesh.setParent(newPlayer.transform);

    newPlayer.transform.position = new BABYLON.Vector3(-3, 3, 0);
    return newPlayer;
};


const setPlayerState = function (state) {
    player.idleMesh.setEnabled(false);
    player.walkMesh.setEnabled(false);
    player.attackMesh.setEnabled(false);

    switch (state) {
        case "idle":
            player.idleMesh.setEnabled(true);
            break;
        case "walk":
            player.walkMesh.setEnabled(true);
            break;
        case "attack":
            player.attackMesh.setEnabled(true);
            break;            
        default:
            break;
    }
};


function spawnBullet(origin) {
    const bullet = BABYLON.MeshBuilder.CreateBox("bullet", { width: 0.25, height: 0.25, depth: 0.5 });
    bullet.position = origin.transform.position.clone();
    bullet.position.y += 0.75;
    bullet.lookAt(bullet.position.add(origin.transform.forward));

    const bulletMaterial = new BABYLON.StandardMaterial("bullet");
    bulletMaterial.diffuseColor = BABYLON.Color3.Magenta();
    bullet.material = bulletMaterial;

    bulletList.push(bullet);
}


const start = async function () {
    player = await loadPlayer();
    
    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(function () {
        scene.render();
    });
};


const update = function () {
    direction.normalize();

    const deltaTime = scene.getAnimationRatio();

    // Update bullets
    bulletList.forEach((bullet) => {
        bullet.position.addInPlace(bullet.forward.scale(bulletSpeed * deltaTime));
    });

    // Rotate to face direction of movement
    if (!direction.equalsWithEpsilon(BABYLON.Vector3.ZeroReadOnly, 0.001)) {
        facing = direction.clone();
        setPlayerState("walk");
    }
    else {
        setPlayerState("idle");
    }

    const targetPosition = player.transform.position.add(facing.normalize());
    player.transform.lookAt(targetPosition);

    // Movement & gravity
    let previousPosition = player.transform.position.clone();

    player.transform.position.y -= 0.1;
    if (player.collisionMesh.intersectsMesh(ground, true)) {
        player.transform.position.y = previousPosition.y;
    }

    player.transform.position.addInPlace(direction.scale(playerSpeed * deltaTime));

    // Collisions
    if (player.collisionMesh.intersectsMesh(box, true)) {
        if (player.transform.position.y > 0) {
            player.transform.position.y = previousPosition.y;
        }
        else {
            player.transform.position.x = previousPosition.x;
            player.transform.position.z = previousPosition.z;
        }
    }
};


const handleInput = function (kbInfo) {
    if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYDOWN) {
        if (direction.equalsWithEpsilon(BABYLON.Vector3.ZeroReadOnly, 0.001)) {
            if (kbInfo.event.key == "a") {
                direction.x = 1;
            }
            else if (kbInfo.event.key == "d") {
                direction.x = -1;
            }
            else if (kbInfo.event.key == "w") {
                direction.z = -1;
            }
            else if (kbInfo.event.key == "s") {
                direction.z = 1;
            }    
        }

        if (kbInfo.event.key == " ") {
            spawnBullet(player);
        }
    }
    else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP) {
        if (kbInfo.event.key == "a" || kbInfo.event.key == "d") {
            direction.x = 0;
        }

        if (kbInfo.event.key == "w" || kbInfo.event.key == "s") {
            direction.z = 0;
        }
    }
};


// Watch for browser/canvas resize events
window.addEventListener("resize", function () {
    engine.resize();
});

loadEnvironment();

scene.onKeyboardObservable.add(handleInput);
scene.onBeforeRenderObservable.add(update);

// Do the thing
start();