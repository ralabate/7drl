/// <reference path="babylon.d.ts" />

let kbarray = [];

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

const playerSpeed = 2 + 1.45; // in meters per second
let player;
let direction = BABYLON.Vector3.Zero();
let facing = BABYLON.Vector3.Zero();
let canSpawnBullet = true;

const bulletSpeed = 5.5; // in meters per second
const bulletMaterial = new BABYLON.StandardMaterial("bullet");

const MAXIMUM_BADDIES = 40;
const badguySpeed = 0.7; // in meters per second
let badMeshContainers;
let bulletList = [];
let badguyList = [];

const SPAWN_RATE = 2.0; // in seconds
let spawnerList = [];

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
    groundMaterial.diffuseColor = new BABYLON.Color3(0.10, 0.10, 0.10);
    ground.material = groundMaterial;

    let mesh_list = [];
    mesh_list.push(ground);
    merged_mesh_for_nav = BABYLON.Mesh.MergeMeshes(mesh_list); // <== overwrites box material with ground material

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

    /*
    let debug = navigation_plugin.createDebugNavMesh(scene);
    debug.position = new BABYLON.Vector3(0.0, 0.1, 0.0);
    let debugMat = new BABYLON.StandardMaterial("debug", scene);
    debugMat.diffuseColor = new BABYLON.Color3(0.1, 0.2, 1.0);
    debugMat.alpha = 0.2;
    debug.material = debugMat;
    */
};

const createCharacter = function (idle, walk, attack, id) {
    const boundingBox = BABYLON.MeshBuilder.CreateBox("characterBoundingBox_" + id, { width: 1, height: 2, depth: 1 });
    boundingBox.position = new BABYLON.Vector3(0, 1, 0);

    const sphere = BABYLON.MeshBuilder.CreateSphere("agentmesh_" + id, {diameter: 0.4});

    let newPlayer = {
        idleMesh: idle.clone(),
        walkMesh: walk.clone(),
        attackMesh: attack.clone(),
        collisionMesh: boundingBox.clone(),
        agentMesh: sphere.clone(),
        id: id,
    };

    newPlayer.idleMesh.setParent(newPlayer.collisionMesh);
    newPlayer.walkMesh.setParent(newPlayer.collisionMesh);
    newPlayer.attackMesh.setParent(newPlayer.collisionMesh);

    newPlayer.agentMesh.isVisible = false;

    newPlayer.collisionMesh.isVisible = false;
    newPlayer.collisionMesh.showBoundingBox = false;
    newPlayer.collisionMesh.checkCollisions = true;

    boundingBox.dispose();
    sphere.dispose();
    
    return newPlayer;
};

const destroyCharacter = function (character) {
    crowd.removeAgent(character.id);
    character.collisionMesh.dispose();
    character.agentMesh.dispose();
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
    let width_jitter = -0.01 + 0.02 * Math.random();
    let height_jitter = -0.01 + 0.02 * Math.random();
    let depth_jitter = -0.03 + 0.06 * Math.random();

    let y_jitter = -0.10 + 0.20 * Math.random();
    let x_jitter = -0.10 + 0.20 * Math.random();

    let r_jitter = 0.10 * Math.random();
    let g_jitter = 0.10 * Math.random();
    let b_jitter = -0.10 + 0.20 * Math.random();

    let lookat_jitter = new BABYLON.Vector3();
    lookat_jitter.x = -0.05 + 0.10 * Math.random();
    lookat_jitter.y = -0.02 + 0.04 * Math.random();
    lookat_jitter.z = -0.05 + 0.10 * Math.random();

    //const bullet = BABYLON.MeshBuilder.CreateBox("bullet", { width: 0.05 + width_jitter, height: 0.05 + height_jitter, depth: 0.15 + depth_jitter });
    const bullet = BABYLON.MeshBuilder.CreateBox("bullet", { width: 0.05, height: 0.05, depth: 0.15 });

    bullet.position = origin.position.clone();
    bullet.position.x += 0.55 + x_jitter;
    bullet.position.y += 0.10 + y_jitter;

    bullet.lookAt(bullet.position.add(origin.forward.add(lookat_jitter)));

    bullet.material = bulletMaterial;
    bullet.material.diffuseColor = new BABYLON.Color3(1.0 + r_jitter, 1.0 + g_jitter, 0.3 + b_jitter);

    bulletList.push(bullet);
}

function spawnBadGuy(spawn_x, spawn_z) {
    if (badguyList.length == MAXIMUM_BADDIES) {
        console.log("REACHED MAXIMUM BADDIES");
        return;
    }

    let badguy = createCharacter(
        badMeshContainers.idle.meshes[0],
        badMeshContainers.walk.meshes[0],
        badMeshContainers.attack.meshes[0],
        -1,
    );

    badguy.collisionMesh.checkCollisions = false;
    setCharacterState(badguy, "idle");

    let agentParms = {
      radius: 0.4,
      height: 0.4,
      maxAcceleration: 4.0,
      maxSpeed: badguySpeed,
      collisionQueryRange: 0.5,
      pathOptimizationRange: 0.0,
      separationWeight: 0.2,
    };

    let spawn_point = new BABYLON.Vector3(spawn_x, 0.0, spawn_z);
    let navmesh_valid_startpoint = navigation_plugin.getClosestPoint(spawn_point);  // NB INITIAL PLACEMENT MUST BE NAVMESH-VALID!
    let crowd_id = crowd.addAgent(navmesh_valid_startpoint, agentParms, badguy.agentMesh);

    badguy.collisionMesh.setEnabled(false); // <== figuring out why badguy flickers at origin before going to proper location

    if (crowd_id != -1) {
        badguy.id = crowd_id;
        badguyList.push(badguy);
    }
}

const start = async function () {
    let meshContainers = await loadMeshContainers();

    player = createCharacter(
        meshContainers.idle.meshes[0],
        meshContainers.walk.meshes[0],
        meshContainers.attack.meshes[0],
        0,
    );

    player.agentMesh.dispose();

    player.collisionMesh.position = new BABYLON.Vector3(2, 1, -6);
    setCharacterState(player, "idle");

    badMeshContainers = await loadBadMeshContainers(); // used later by spawner

    //spawnerList.push({timer:SPAWN_RATE, x:+12.0, z:+12.0});
    //spawnerList.push({timer:SPAWN_RATE, x:+12.0, z:-12.0});
    //spawnerList.push({timer:SPAWN_RATE, x:-12.0, z:+12.0});
    //spawnerList.push({timer:SPAWN_RATE, x:-12.0, z:-12.0});
    spawnerList.push({timer:SPAWN_RATE, x:2.0, z:+2.0});

    await Recast();
    navigation_plugin = new BABYLON.RecastJSPlugin();

    loadEnvironment();

    crowd = navigation_plugin.createCrowd(MAXIMUM_BADDIES, 0.1, scene);

    spawnBadGuy(0, 0);

    engine.runRenderLoop(function () {
        scene.render();
    });
};

const update = function () {
    direction.normalize();

    const deltaTime = scene.getAnimationRatio();

    // Update spawners
    for (let s of spawnerList) {
      let delta_time_in_seconds = scene.deltaTime / 1000.0;
      s.timer -= delta_time_in_seconds;
      if (s.timer < 0) {
        s.timer = SPAWN_RATE;
        spawnBadGuy(s.x, s.z);
      }   
    }

    // Update bad guys
    let dest = player.collisionMesh.position;
    for (let bg of badguyList) {
      crowd.agentGoto(bg.id, navigation_plugin.getClosestPoint(dest));
      bg.collisionMesh.position.x = bg.agentMesh.position.x; 
      bg.collisionMesh.position.z = bg.agentMesh.position.z; 
      bg.collisionMesh.setEnabled(true); // <== figuring out why badguy flickers at origin before going to proper location
    }

    /*
    let idx = crowd.getAgents()[0]; // <== seems to not always work
    let pathPoints = navigation_plugin.computePath(crowd.getAgentPosition(idx), navigation_plugin.getClosestPoint(dest));
    pathLine = BABYLON.MeshBuilder.CreateDashedLines("ribbon", {points: pathPoints, updatable: true, instance: pathLine}, scene);
    */
    
    // Update bullets
    let dead_bullets = [];
    let dead_badguys = [];
    for (let bullet of bulletList) {

        let delta_time_in_seconds = scene.deltaTime / 1000.0;
        bullet.position.addInPlace(bullet.forward.scale(bulletSpeed * delta_time_in_seconds));
      
        bullet.computeWorldMatrix();
        for (let badguy of badguyList) {
            badguy.collisionMesh.computeWorldMatrix();
            if (bullet.intersectsMesh(badguy.collisionMesh, true)) {
                dead_badguys.push(badguy);
                dead_bullets.push(bullet);
                destroyCharacter(badguy);
                bullet.dispose();
                break;
            }
        }

    }

    let furthest = 15;
    for (let bullet of bulletList) {
        if (bullet.position.x > furthest || bullet.position.x < -furthest || bullet.position.z > furthest || bullet.position.z < -furthest) {
          dead_bullets.push(bullet);          
          bullet.dispose();
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
        switch (kbInfo.event.key) {
                case " ":
                case "w":
                case "d":
                case "a":
                case "s":
                    kbarray.unshift(kbInfo.event.key);
                    let set = new Set(kbarray);
                    kbarray = [...set];
                    break;
        }
    } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP) {
            let index = kbarray.indexOf(kbInfo.event.key);
            if (index != -1) {
                kbarray.splice(index, 1);
            }
    }

    direction = BABYLON.Vector3.Zero();
    if (kbarray.length > 0) {
        switch(kbarray[0]) {
            case " ":
                spawnBullet(player.collisionMesh);
                break;
            case "w":
                direction = BABYLON.Vector3.Backward();
                break;
            case "d":
                direction = BABYLON.Vector3.Left();
                break;
            case "a":
                direction = BABYLON.Vector3.Right();
                break;
            case "s":
                direction = BABYLON.Vector3.Forward();
                break;
        }
    }
}

window.addEventListener("resize", function () {
    engine.resize();
});

scene.onKeyboardObservable.add(handleInput);
scene.onBeforeRenderObservable.add(update);

start();
