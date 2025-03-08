/// <reference path="babylon.d.ts" />

const canvas = document.getElementById("renderCanvas"); // Get the canvas element
const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
const scene = new BABYLON.Scene(engine);

let camera;
let ground; 

let merged_mesh_for_nav;
let navigation_plugin;
let crowd;
let pathLine;

let is_debugger_showing = false;

const playerSpeed = 5 * 1.45; // in meters per second
let player;
let direction = BABYLON.Vector3.Zero();
let facing = BABYLON.Vector3.Zero();
let canSpawnBullet = true;

const bulletSpeed = 6.10; // in meters per second
const bulletMaterial = new BABYLON.StandardMaterial("bullet");

const NUM_BADDIES = 50;
const badguySpeed = 0.3; // in meters per second
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

const loadBadMeshContainers = async function () {
    const idleResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/bad_lizard_idle.glb", scene);
    const walkResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/bad_lizard_walk.glb", scene);
    const attackResult = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/bad_lizard_attack.glb", scene);

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
    camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(00, 15, 30));
    camera.setTarget(BABYLON.Vector3.Zero());

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0));
    light.intensity = 1.0;

    scene.clearColor = new BABYLON.Color3(0.04, 0.04, 0.04);

    ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 30, height: 30 });
    ground.checkCollisions = true;
    const groundMaterial= new BABYLON.StandardMaterial("ground");
    groundMaterial.diffuseColor = new BABYLON.Color3(0.19, 0.19, 0.19);
    ground.material = groundMaterial;

    const boxMaterial = new BABYLON.StandardMaterial("boxMaterial");
    boxMaterial.diffuseColor = new BABYLON.Color3(0.20, 0.05, 0.05);

    let mesh_list = [];
    for (let i = 0; i < 20; ++i) {
      let box = BABYLON.MeshBuilder.CreateBox("box" + i, { size: 3 });
      box.position.x = 20.0 * Math.random() - 10.0;
      box.position.y = 0.0;
      box.position.z = 20.0 * Math.random() - 10.0;
      box.checkCollisions = true;
      box.material = boxMaterial;

      mesh_list.push(box);      
    }

    mesh_list.push(ground);
    merged_mesh_for_nav = BABYLON.Mesh.MergeMeshes(mesh_list);

    let navmesh_parameters = {
      cs: 0.2,
      ch: 0.2,
      walkableSlopeAngle: 35,
      walkableHeight: 1.0,
      walkableClimb: 1.0,
      walkableRadius: 1.0,
      maxEdgeLen: 12.0,
      maxSimplificationError: 1.3,
      minRegionArea: 8.0,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
    };

    navigation_plugin.createNavMesh([merged_mesh_for_nav], navmesh_parameters);

    // debug
    let debug = navigation_plugin.createDebugNavMesh(scene);
    debug.position = new BABYLON.Vector3(0.0, 0.1, 0.0);
    let debugMat = new BABYLON.StandardMaterial("debug", scene);
    debugMat.diffuseColor = new BABYLON.Color3(0.1, 0.2, 1.0);
    debugMat.alpha = 0.2;
    debug.material = debugMat;
};

const createCharacter = function (idle, walk, attack, id) {
    const boundingBox = BABYLON.MeshBuilder.CreateBox("characterBoundingBox", { width: 1, height: 2, depth: 1 });
    boundingBox.position = new BABYLON.Vector3(0, 1, 0);

    let newPlayer = {
        idleMesh: idle.clone(),
        walkMesh: walk.clone(),
        attackMesh: attack.clone(),
        collisionMesh: boundingBox.clone(),
        agentMesh: BABYLON.MeshBuilder.CreateSphere("agentmesh " + id, {diameter: 0.4}),
        id: id,
    };

    newPlayer.idleMesh.setParent(newPlayer.collisionMesh);
    newPlayer.walkMesh.setParent(newPlayer.collisionMesh);
    newPlayer.attackMesh.setParent(newPlayer.collisionMesh);

    newPlayer.collisionMesh.isVisible = false;
    newPlayer.collisionMesh.showBoundingBox = true;
    newPlayer.collisionMesh.checkCollisions = true;

    boundingBox.dispose();
    
    return newPlayer;
};

const destroyCharacter = function (character) {
    crowd.removeAgent(character.id);
    character.collisionMesh.dispose();
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
    const bullet = BABYLON.MeshBuilder.CreateBox("bullet", { width: 0.05, height: 0.05, depth: 0.15 });
    bullet.position = origin.position.clone();
    bullet.position.y += 0.10;
    bullet.position.x += 0.55;
    bullet.lookAt(bullet.position.add(origin.forward));

    bullet.material = bulletMaterial;
    bullet.material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 0.3);

    bulletList.push(bullet);
}

const start = async function () {
    let meshContainers = await loadMeshContainers();

    player = createCharacter(
        meshContainers.idle.meshes[0],
        meshContainers.walk.meshes[0],
        meshContainers.attack.meshes[0],
        0,
    );

    player.collisionMesh.position = new BABYLON.Vector3(2, 1, -6);
    setCharacterState(player, "idle");

    let badMeshContainers = await loadBadMeshContainers();
    
    for (let i = 0; i < NUM_BADDIES; ++i) {
        let badguy = createCharacter(
            badMeshContainers.idle.meshes[0],
            badMeshContainers.walk.meshes[0],
            badMeshContainers.attack.meshes[0],
            i,
        );
    
        badguy.collisionMesh.position.x = 12 * Math.sin(i * 6.28/NUM_BADDIES);
        badguy.collisionMesh.position.z = 12 * Math.cos(i * 6.28/NUM_BADDIES);
        setCharacterState(badguy, "idle");
        badguyList.push(badguy);
    }

    setCharacterState(badguyList[0], "walk");

    await Recast();
    navigation_plugin = new BABYLON.RecastJSPlugin();

    loadEnvironment();

    crowd = navigation_plugin.createCrowd(NUM_BADDIES, 0.1, scene);

    let agentParms = {
      radius: 0.4,
      height: 0.4,
      maxAcceleration: 4.0,
      maxSpeed: badguySpeed,
      collisionQueryRange: 0.5,
      pathOptimizationRange: 0.0,
      separationWeight: 1.0,
    };

    for (let bg of badguyList) {
      let navmesh_valid_startpoint = navigation_plugin.getClosestPoint(bg.collisionMesh.position);  // NB INITIAL PLACEMENT MUST BE NAVMESH-VALID!
      console.log(navmesh_valid_startpoint);
      crowd.addAgent(navmesh_valid_startpoint, agentParms, bg.agentMesh);
    }

    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(function () {
        scene.render();
    });
};

const update = function () {
    
    direction.normalize();

    const deltaTime = scene.getAnimationRatio();

    // Update bad guys
    let dest = player.collisionMesh.position;
    for (let bg of badguyList) {
      crowd.agentGoto(bg.id, navigation_plugin.getClosestPoint(dest));
      bg.collisionMesh.position.x = bg.agentMesh.position.x; 
      bg.collisionMesh.position.z = bg.agentMesh.position.z; 
    }

    let idx = crowd.getAgents()[0];
    let pathPoints = navigation_plugin.computePath(crowd.getAgentPosition(idx), navigation_plugin.getClosestPoint(dest));
    pathLine = BABYLON.MeshBuilder.CreateDashedLines("ribbon", {points: pathPoints, updatable: true, instance: pathLine}, scene);
    
    // Update bullets
    let dead_bullets = [];
    let dead_badguys = [];
    for (let bullet of bulletList) {

        let delta_time_in_seconds = scene.deltaTime / 1000.0;
        bullet.position.addInPlace(bullet.forward.scale(bulletSpeed * delta_time_in_seconds));

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

    const targetPosition = player.collisionMesh.position.add(facing.normalize());
    player.collisionMesh.lookAt(targetPosition);

    // Movement code and gravity using built-in collision detection
    let delta_time_in_seconds = scene.deltaTime / 1000.0;
    let movementVector = direction.scale(playerSpeed * delta_time_in_seconds).add(BABYLON.Vector3.Down().scale(0.1));
    player.collisionMesh.moveWithCollisions(movementVector);
};

const handleInput = function (kbInfo) {
    if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYDOWN) {
        if (kbInfo.event.key == "a") {
            direction = BABYLON.Vector3.Right();
        }
        else if (kbInfo.event.key == "d") {
            direction = BABYLON.Vector3.Left();
        }
        else if (kbInfo.event.key == "w") {
            direction = BABYLON.Vector3.Backward();
        }
        else if (kbInfo.event.key == "s") {
            direction = BABYLON.Vector3.Forward();
        } 
        
        if (!direction.equalsWithEpsilon(BABYLON.Vector3.ZeroReadOnly, 0.001)) {
            setCharacterState(player, "walk");
        }

        if (canSpawnBullet && kbInfo.event.key == " ") {
            spawnBullet(player.collisionMesh);
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
    // DEBUG //////////////////////////////////////////////////////////
    if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYDOWN) {
        if (kbInfo.event.key == "g") {
          if (!is_debugger_showing) {
            scene.debugLayer.show();
            is_debugger_showing = true;
          } else {
            scene.debugLayer.hide();
            is_debugger_showing = false;
          }
        }
    }
    // DEBUG //////////////////////////////////////////////////////////
};

// Watch for browser/canvas resize events
window.addEventListener("resize", function () {
    engine.resize();
});

scene.onKeyboardObservable.add(handleInput);
scene.onBeforeRenderObservable.add(update);

// Do the thing
start();
