/// <reference path="babylon.d.ts" />


const canvas = document.getElementById("renderCanvas"); // Get the canvas element
const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
const scene = new BABYLON.Scene(engine);

let camera;
let ground; 
let box;

const playerSpeed = 0.05; 
let player;
let direction = BABYLON.Vector3.Zero();
let facing = BABYLON.Vector3.Zero();
let canSpawnBullet = true;

const bulletSpeed = 0.25;
const bulletMaterial = new BABYLON.StandardMaterial("bullet");

let bulletList = [];
let badguyList = [];


const createMeshContainer = function (result) {
    const meshContainer = new BABYLON.AssetContainer(scene);
    meshContainer.meshes = result.meshes;
    meshContainer.transformNodes = result.transformNodes;
    meshContainer.skeletons = result.skeletons;
    meshContainer.animationGroups = result.animationGroups;

    return meshContainer;
}


const loadMeshContainers = async function () {
    const idleResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/lizard_prince_idle.glb", scene);
    const walkResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/lizard_prince_walk.glb", scene);
    const attackResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/lizard_prince_attack.glb", scene);

    let meshContainers = {
        idle: createMeshContainer(idleResult),
        walk: createMeshContainer(walkResult),
        attack: createMeshContainer(attackResult),
    };

    meshContainers.idle.removeAllFromScene();
    meshContainers.walk.removeAllFromScene();
    meshContainers.attack.removeAllFromScene();

    return meshContainers;
}


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


const createCharacter = function (idle, walk, attack, collision) {
    let newPlayer = {
        idleMesh: idle.clone(),
        walkMesh: walk.clone(),
        attackMesh: attack.clone(),
        collisionMesh: collision.clone(),
        transform: new BABYLON.TransformNode("player", scene),
    };

    newPlayer.idleMesh.setParent(newPlayer.transform);
    newPlayer.walkMesh.setParent(newPlayer.transform);
    newPlayer.attackMesh.setParent(newPlayer.transform);
    newPlayer.collisionMesh.setParent(newPlayer.transform);

    newPlayer.collisionMesh.isVisible = false;
    newPlayer.collisionMesh.showBoundingBox = true;
    
    return newPlayer;
};


const destroyCharacter = function (character) {
    character.transform.dispose();
};


const setCharacterState = function (character, state) {
    character.idleMesh.setEnabled(false);
    character.walkMesh.setEnabled(false);
    character.attackMesh.setEnabled(false);

    switch (state) {
        case "idle":
            character.idleMesh.setEnabled(true);
            break;
        case "walk":
            character.walkMesh.setEnabled(true);
            break;
        case "attack":
            character.attackMesh.setEnabled(true);
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

    bullet.material = bulletMaterial;
    bullet.material.diffuseColor = BABYLON.Color3.Random();

    bulletList.push(bullet);
}


const start = async function () {
    let meshContainers = await loadMeshContainers();

    player = createCharacter(
        meshContainers.idle.meshes[0],
        meshContainers.walk.meshes[0],
        meshContainers.attack.meshes[0],
        meshContainers.idle.meshes[1],
    );

    player.transform.position = new BABYLON.Vector3(-3, 3, 0);
    setCharacterState(player, "idle");

    for (let i = 0; i < 5; ++i) {
        let badguy = createCharacter(
            meshContainers.idle.meshes[0],
            meshContainers.walk.meshes[0],
            meshContainers.attack.meshes[0],
            meshContainers.idle.meshes[1],
        );
    
        badguy.transform.position = new BABYLON.Vector3(3, 0, 4 + (i * -2));
        setCharacterState(badguy, "walk");
        badguyList.push(badguy);
    }
    
    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(function () {
        scene.render();
    });
};


const update = function () {
    direction.normalize();

    const deltaTime = scene.getAnimationRatio();

    // Update bullets
    let dead_bullets = [];
    let dead_badguys = [];
    for (let bullet of bulletList) {
        bullet.position.addInPlace(bullet.forward.scale(bulletSpeed * deltaTime));

        for (let badguy of badguyList) {
            if (bullet.intersectsMesh(badguy.collisionMesh, true)) {
                console.log("Bullet collided with badguy!");
                dead_badguys.push(badguy);
                dead_bullets.push(bullet);
                destroyCharacter(badguy);
                bullet.dispose();
                break;
            }
        }
    }

    // Remove dead bullets and badguys.
    for (let bullet of dead_bullets) {
        const index = bulletList.indexOf(bullet);
        if (index !== -1) bulletList.splice(index, 1);
    }
    
    for (let badguy of dead_badguys) {
        const index = badguyList.indexOf(badguy);
        if (index !== -1) badguyList.splice(index, 1);
    }


    // Rotate to face direction of movement
    if (!direction.equalsWithEpsilon(BABYLON.Vector3.ZeroReadOnly, 0.001)) {
        facing = direction.clone();
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
        // if (direction.equalsWithEpsilon(BABYLON.Vector3.ZeroReadOnly, 0.001)) {
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
            
            if (!direction.equalsWithEpsilon(BABYLON.Vector3.ZeroReadOnly, 0.001)) {
                setCharacterState(player, "walk");
            }
        // }

        if (canSpawnBullet && kbInfo.event.key == " ") {
            spawnBullet(player);
            setCharacterState(player, "attack");
            canSpawnBullet = false;

            setTimeout(() => {
                canSpawnBullet = true;
            }, 250);
        }
    }
    else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP) {
        if (kbInfo.event.key == "a" || kbInfo.event.key == "d") {
            direction.x = 0;
        }
        else if (kbInfo.event.key == "w" || kbInfo.event.key == "s") {
            direction.z = 0;
        }

        if (direction.equalsWithEpsilon(BABYLON.Vector3.ZeroReadOnly, 0.001)) {
            setCharacterState(player, "idle");
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