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

const playerSpeed = 1.45; // in meters per second
let player;
let direction = BABYLON.Vector3.Zero();
let facing = BABYLON.Vector3.Zero();
let canSpawnBullet = true;

const bulletSpeed = 6.10; // in meters per second
const bulletMaterial = new BABYLON.StandardMaterial("bullet");

let bulletList = [];
let badguyList = [];

const ncr_import_test = async function () {

    const imported_items = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/bad_lizard_walk.glb", scene);

    asset_container = new BABYLON.AssetContainer(scene);
    asset_container.meshes = imported_items.meshes;
    asset_container.transformNodes = imported_items.transformNodes;
    asset_container.skeletons = imported_items.skeletons;
    asset_container.animationGroups = imported_items.animationGroups;

    const more_imported_items = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/bad_lizard_idle.glb", scene);

    dummy_asset_container_1 = new BABYLON.AssetContainer(scene);
    dummy_asset_container_1.meshes = more_imported_items.meshes;
    dummy_asset_container_1.transformNodes= more_imported_items.transformNodes;
    dummy_asset_container_1.skeletons = more_imported_items.skeletons;
    asset_container.animationGroups.push(more_imported_items.animationGroups[0]);

    const yet_more_imported_items = await BABYLON.ImportMeshAsync("https://ralabate.github.io/7drl/bad_lizard_attack.glb", scene);

    dummy_asset_container_2 = new BABYLON.AssetContainer(scene);
    dummy_asset_container_2.meshes = yet_more_imported_items.meshes;
    dummy_asset_container_2.transformNodes= yet_more_imported_items.transformNodes;
    dummy_asset_container_2.skeletons = yet_more_imported_items.skeletons;
    asset_container.animationGroups.push(yet_more_imported_items.animationGroups[0]);

    for (let i = 0; i < 8; ++i) {
      const instantiated_items = asset_container.instantiateModelsToScene();

      for (let rn of instantiated_items.rootNodes) {
        rn.position.x += i;
      }

      for (let ag of instantiated_items.animationGroups) {
        ag.play(true);
        ag.goToFrame(10 * i);
      }
    }

    // get rid of everything besides our instantiated lizards
    asset_container.removeAllFromScene();
    dummy_asset_container_1.removeAllFromScene();
    dummy_asset_container_2.removeAllFromScene();
}

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

    box = BABYLON.MeshBuilder.CreateBox("box1", { size: 3 });
    box.position = new BABYLON.Vector3(3, 0, -3);
    const boxMaterial = new BABYLON.StandardMaterial("box1");
    boxMaterial.diffuseColor = new BABYLON.Color3(0.20, 0.05, 0.05);
    box.material = boxMaterial;
    box.checkCollisions = true;

    merged_mesh_for_nav = BABYLON.Mesh.MergeMeshes([ground, box]);

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

const createCharacter = function (idle, walk, attack) {
    const boundingBox = BABYLON.MeshBuilder.CreateBox("characterBoundingBox", { width: 1, height: 2, depth: 1 });
    boundingBox.position = new BABYLON.Vector3(0, 1, 0);

    let newPlayer = {
        idleMesh: idle.clone(),
        walkMesh: walk.clone(),
        attackMesh: attack.clone(),
        collisionMesh: boundingBox.clone(),
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
    );

    player.collisionMesh.position = new BABYLON.Vector3(2, 1, -6);
    setCharacterState(player, "idle");

    let badMeshContainers = await loadBadMeshContainers();
    
    for (let i = 0; i < 50; ++i) {
        let badguy = createCharacter(
            badMeshContainers.idle.meshes[0],
            badMeshContainers.walk.meshes[0],
            badMeshContainers.attack.meshes[0],
        );
    
        badguy.collisionMesh.position.x = 12 * Math.sin(i * 6.28/50.0);
        badguy.collisionMesh.position.z = 12 * Math.cos(i * 6.28/50.0);
        setCharacterState(badguy, "idle");
        badguyList.push(badguy);
    }

    setCharacterState(badguyList[0], "walk");

    await Recast();
    navigation_plugin = new BABYLON.RecastJSPlugin();

    loadEnvironment();

    crowd = navigation_plugin.createCrowd(1, 0.1, scene);

    let agentParms = {
      radius: 1.0,
      height: 1.2,
      maxAcceleration: 4.0,
      maxSpeed: 0.5,
      collisionQueryRange: 0.5,
      pathOptimizationRange: 0.0,
      separationWeight: 1.0,
    };

    crowd.addAgent(navigation_plugin.getRandomPointAround(BABYLON.Vector3.Zero()), agentParms, badguyList[0].collisionMesh);

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
    crowd.agentGoto(0, navigation_plugin.getClosestPoint(dest));

    let pathPoints = navigation_plugin.computePath(crowd.getAgentPosition(0), navigation_plugin.getClosestPoint(dest));
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
