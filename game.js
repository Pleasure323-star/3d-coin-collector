/*
 * 3D Coin Collector
 * The game code is split into setup, game-state, and input/rendering sections.
 * Three.js is loaded as a browser global from a CDN in index.html.
 */
'use strict';

(() => {
  const ARENA_SIZE = 16;
  const ARENA_LIMIT = ARENA_SIZE / 2 - 0.65;
  const PLAYER_SPEED = 5;
  const COIN_PICKUP_DISTANCE = 0.85;

  const container = document.getElementById('game-container');
  const loadingMessage = document.getElementById('loading-message');
  const scoreDisplay = document.getElementById('score');
  const remainingDisplay = document.getElementById('coins-remaining');
  const statusDisplay = document.getElementById('game-status');
  const restartButton = document.getElementById('restart-button');
  const identityStatus = document.getElementById('identity-status');
  const identityName = document.getElementById('identity-name');
  const identityAccount = document.getElementById('identity-account');
  const identitySignIn = document.getElementById('identity-sign-in');
  const completionModal = document.getElementById('completion-modal');
  const finalScoreDisplay = document.getElementById('final-score');
  const playAgainButton = document.getElementById('play-again-button');
  const completionCloseButton = document.getElementById('completion-close');
  const START_NG = 'https://start.ng';
  const IS_START_NG_GAME = /\.start\.ng$/i.test(window.location.hostname);

  const threeScript = document.getElementById('threejs-cdn');
  if (!window.THREE) {
    const reason = threeScript?.dataset.loadError === 'true'
      ? 'The Three.js CDN request failed. Check your internet connection or whether cdnjs is blocked, then reload.'
      : 'The Three.js script finished without creating the THREE global. Check the script URL and browser console.';
    showStartupError('Three.js did not load', reason);
    return;
  }

  if (!THREE.WebGLRenderer || !THREE.Scene || !THREE.MathUtils) {
    showStartupError('Three.js loaded, but the expected APIs are missing', `Loaded revision: ${THREE.REVISION || 'unknown'}. Check that index.html and game.js use compatible Three.js versions.`);
    return;
  }

  function showStartupError(title, detail) {
    loadingMessage.hidden = false;
    loadingMessage.textContent = `${title}\n${detail}`;
    statusDisplay.textContent = title;
    statusDisplay.classList.remove('complete');
  }

  let scene;
  let camera;
  let renderer;
  let player;
  let playerBody;
  let playerAppearance;
  let identityFramePromise;
  let identityRefreshInProgress = false;
  let identityRefreshQueued = false;
  let identityRefreshTimer = null;
  let hasStartNgIdentity = false;
  let coins = [];
  let allCoins = [];
  let score = 0;
  let isComplete = false;
  let lastFrameTime = 0;
  const pressedKeys = new Set();
  const coinStartPositions = [
    [-5.7, -5.2], [-1.8, -5.8], [3.1, -5.4], [6.0, -2.3],
    [-5.8, 1.7], [-1.8, 3.1], [2.7, 1.8], [5.1, 5.5],
  ];

  // Scene and camera
  function createScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14243a);
    scene.fog = new THREE.Fog(0x14243a, 20, 38);

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 13, 15);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc5e8ff, 0x243247, 1.55));
    const sunlight = new THREE.DirectionalLight(0xfff1ce, 2.0);
    sunlight.position.set(-5, 12, 7);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.camera.left = -12;
    sunlight.shadow.camera.right = 12;
    sunlight.shadow.camera.top = 12;
    sunlight.shadow.camera.bottom = -12;
    scene.add(sunlight);

    createArena();
    createPlayer();
    createCoins();
    resizeRenderer();
  }

  function createArena() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x28435a, roughness: 0.92 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(ARENA_SIZE, 16, 0x5c8094, 0x416074);
    grid.position.y = 0.012;
    scene.add(grid);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5b70, roughness: 0.75 });
    const wallHeight = 0.55;
    const wallThickness = 0.28;
    const wallY = wallHeight / 2;
    const longWall = new THREE.BoxGeometry(ARENA_SIZE + wallThickness, wallHeight, wallThickness);
    const shortWall = new THREE.BoxGeometry(wallThickness, wallHeight, ARENA_SIZE + wallThickness);
    [
      { geometry: longWall, position: [0, wallY, -ARENA_SIZE / 2] },
      { geometry: longWall, position: [0, wallY, ARENA_SIZE / 2] },
      { geometry: shortWall, position: [-ARENA_SIZE / 2, wallY, 0] },
      { geometry: shortWall, position: [ARENA_SIZE / 2, wallY, 0] },
    ].forEach(({ geometry, position }) => {
      const wall = new THREE.Mesh(geometry, wallMaterial);
      wall.position.set(...position);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
    });
  }

  function createPlayer() {
    player = new THREE.Group();
    player.position.set(0, 0, 0);
    playerAppearance = makeCharacterAppearance(null);
    player.add(playerAppearance);
    playerBody = playerAppearance.getObjectByName('character-body');
    // On the real game domain, wait for start.ng's supplied user or guest look.
    player.visible = !IS_START_NG_GAME;
    scene.add(player);
  }

  function safeColor(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  function normalizeCharacterStyle(style) {
    const valid = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
    const incoming = style && typeof style === 'object' ? style : {};
    return {
      body: valid(incoming.body, ['female', 'male'], 'male'),
      primaryColor: safeColor(incoming.primaryColor, '#5ce1bd'),
      secondaryColor: safeColor(incoming.secondaryColor, '#233b54'),
      skinColor: safeColor(incoming.skinColor, '#f0b88e'),
      hairColor: safeColor(incoming.hairColor, '#183047'),
      hair: valid(incoming.hair, ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'], 'short'),
      hat: valid(incoming.hat, ['none', 'cap', 'beanie', 'tophat', 'crown'], 'none'),
      accessory: valid(incoming.accessory, ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'], 'none'),
    };
  }

  function addCharacterMesh(group, geometry, material, position, scale) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function makeCharacterAppearance(rawStyle) {
    const style = normalizeCharacterStyle(rawStyle);
    const appearance = new THREE.Group();
    const shirtMaterial = new THREE.MeshStandardMaterial({ color: style.primaryColor, roughness: 0.58 });
    const lowerMaterial = new THREE.MeshStandardMaterial({ color: style.secondaryColor, roughness: 0.68 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: style.skinColor, roughness: 0.72 });
    const hairMaterial = new THREE.MeshStandardMaterial({ color: style.hairColor, roughness: 0.8 });
    const accessoryMaterial = new THREE.MeshStandardMaterial({ color: 0xe4bd65, metalness: 0.35, roughness: 0.4 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x17263a, roughness: 0.6 });

    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'character-body';
    bodyGroup.position.y = 0.72;
    // The documented style has body presentation and clothing colors, but no
    // separate skirt/trouser field. Keep trousers for both silhouettes so the
    // supplied secondary clothing color is represented consistently.
    const isFemalePresentation = style.body === 'female';
    const shoulderRadius = isFemalePresentation ? 0.31 : 0.37;
    const waistRadius = isFemalePresentation ? 0.25 : 0.29;
    const hipRadius = isFemalePresentation ? 0.32 : 0.30;
    addCharacterMesh(bodyGroup, new THREE.CylinderGeometry(shoulderRadius, waistRadius, 0.57, 16), shirtMaterial, [0, 0, 0], null);
    addCharacterMesh(bodyGroup, new THREE.SphereGeometry(hipRadius, 14, 10), lowerMaterial, [0, -0.34, 0], [1, 0.55, 0.8]);
    addCharacterMesh(bodyGroup, new THREE.CylinderGeometry(0.105, 0.12, 0.13, 12), skinMaterial, [0, 0.36, 0], null);
    [-1, 1].forEach((side) => {
      const arm = addCharacterMesh(bodyGroup, new THREE.CylinderGeometry(0.09, 0.105, 0.43, 10), shirtMaterial, [side * (shoulderRadius + 0.04), -0.035, 0], null);
      arm.rotation.z = side * -0.18;
      addCharacterMesh(bodyGroup, new THREE.SphereGeometry(0.075, 10, 8), skinMaterial, [side * (shoulderRadius + 0.11), -0.29, 0.015], null);
    });
    appearance.add(bodyGroup);

    const footMaterial = new THREE.MeshStandardMaterial({ color: 0x263247, roughness: 0.82 });
    [-0.15, 0.15].forEach((x) => {
      addCharacterMesh(appearance, new THREE.CylinderGeometry(0.12, 0.105, 0.55, 10), lowerMaterial, [x, 0.34, 0], null);
      addCharacterMesh(appearance, new THREE.BoxGeometry(0.21, 0.14, 0.31), footMaterial, [x, 0.08, 0.04], null);
    });

    addCharacterMesh(appearance, new THREE.CylinderGeometry(0.105, 0.12, 0.18, 12), skinMaterial, [0, 1.1, 0], null);
    const headWidth = isFemalePresentation ? 0.27 : 0.29;
    addCharacterMesh(appearance, new THREE.SphereGeometry(0.29, 20, 16), skinMaterial, [0, 1.45, 0], [headWidth / 0.29, 1, 0.95]);

    const face = new THREE.Group();
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x102238, roughness: 0.5 });
    [-0.105, 0.105].forEach((x) => {
      addCharacterMesh(face, new THREE.SphereGeometry(0.026, 8, 8), eyeMaterial, [x * (headWidth / 0.29), 1.47, 0.265], null);
    });
    appearance.add(face);

    addHair(appearance, style.hair, hairMaterial);
    addHat(appearance, style.hat, accessoryMaterial);
    addAccessory(appearance, style.accessory, accessoryMaterial, darkMaterial, skinMaterial);
    // Increase in-view detail without changing player movement/collision scale.
    appearance.scale.set(1.12, 1.12, 1.12);
    return appearance;
  }

  function addHair(group, hairStyle, material) {
    if (hairStyle === 'bald') return;
    if (hairStyle !== 'afro') {
      addCharacterMesh(group, new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), material, [0, 1.54, 0], null);
    }
    if (hairStyle === 'afro') {
      addCharacterMesh(group, new THREE.SphereGeometry(0.34, 12, 10), material, [0, 1.61, 0], null);
    } else if (hairStyle === 'braids') {
      [-1, 1].forEach((side) => {
        for (let segment = 0; segment < 4; segment += 1) {
          const lock = addCharacterMesh(group, new THREE.SphereGeometry(0.065, 8, 8), material,
            [side * (0.22 + segment * 0.012), 1.36 - segment * 0.13, 0.015], [0.82, 1.35, 0.9]);
          lock.rotation.z = side * -0.12;
        }
      });
    } else if (hairStyle === 'bun') {
      addCharacterMesh(group, new THREE.SphereGeometry(0.17, 12, 10), material, [0, 1.68, -0.19], [1, 0.9, 1]);
    } else if (hairStyle === 'ponytail') {
      addCharacterMesh(group, new THREE.SphereGeometry(0.11, 10, 8), material, [0, 1.48, -0.27], null);
      const tail = addCharacterMesh(group, new THREE.CylinderGeometry(0.075, 0.045, 0.48, 8), material, [0, 1.18, -0.34], null);
      tail.rotation.x = -0.18;
    } else if (hairStyle === 'dreads') {
      for (let index = 0; index < 7; index += 1) {
        const x = -0.25 + index * (0.5 / 6);
        const length = 0.42 + (index % 3) * 0.07;
        const lock = addCharacterMesh(group, new THREE.CylinderGeometry(0.045, 0.055, length, 7), material,
          [x, 1.29 - (length - 0.42) * 0.5, -0.08], null);
        lock.rotation.z = x * 0.28;
      }
    }
  }

  function addHat(group, hatStyle, material) {
    if (hatStyle === 'none') return;
    if (hatStyle === 'cap') {
      addCharacterMesh(group, new THREE.CylinderGeometry(0.24, 0.29, 0.2, 12), material, [0, 1.73, 0], null);
      addCharacterMesh(group, new THREE.BoxGeometry(0.42, 0.045, 0.22), material, [0, 1.67, 0.2], null);
    } else if (hatStyle === 'beanie') {
      addCharacterMesh(group, new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), material, [0, 1.68, 0], null);
      addCharacterMesh(group, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), material, [0, 1.66, 0], null);
    } else if (hatStyle === 'tophat') {
      addCharacterMesh(group, new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12), material, [0, 1.82, 0], null);
      addCharacterMesh(group, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), material, [0, 1.65, 0], null);
    } else if (hatStyle === 'crown') {
      addCharacterMesh(group, new THREE.CylinderGeometry(0.2, 0.29, 0.16, 12), material, [0, 1.69, 0], null);
      for (let index = 0; index < 5; index += 1) {
        const x = -0.2 + index * 0.1;
        addCharacterMesh(group, new THREE.ConeGeometry(0.06, 0.18, 6), material, [x, 1.84, 0], null);
      }
    }
  }

  function addAccessory(group, accessory, goldMaterial, darkMaterial, skinMaterial) {
    if (accessory === 'glasses') {
      [-0.105, 0.105].forEach((x) => {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 12), darkMaterial);
        frame.position.set(x, 1.46, 0.27);
        group.add(frame);
      });
      addCharacterMesh(group, new THREE.BoxGeometry(0.08, 0.018, 0.018), darkMaterial, [0, 1.46, 0.27], null);
    } else if (accessory === 'earrings') {
      [-0.29, 0.29].forEach((x) => addCharacterMesh(group, new THREE.SphereGeometry(0.045, 8, 8), goldMaterial, [x, 1.32, 0.02], null));
    } else if (accessory === 'beard') {
      addCharacterMesh(group, new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), darkMaterial, [0, 1.29, 0.11], [1, 0.65, 0.7]);
    } else if (accessory === 'scarf') {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.07, 8, 16), goldMaterial);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0, 1.08, 0);
      scarf.castShadow = true;
      group.add(scarf);
    } else if (accessory === 'backpack') {
      addCharacterMesh(group, new THREE.BoxGeometry(0.38, 0.44, 0.2), goldMaterial, [0, 0.78, -0.31], null);
    }
  }

  function updatePlayerCharacter(style) {
    if (playerAppearance) player.remove(playerAppearance);
    playerAppearance = makeCharacterAppearance(style);
    player.add(playerAppearance);
    playerBody = playerAppearance.getObjectByName('character-body');
  }

  // This connect page only responds when the game is hosted on a *.start.ng address.
  function connectFrame() {
    if (!identityFramePromise) {
      identityFramePromise = new Promise((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.src = `${START_NG}/connect`;
        frame.hidden = true;
        frame.onload = () => resolve(frame);
        frame.onerror = reject;
        document.body.append(frame);
      }).catch((error) => {
        identityFramePromise = null;
        throw error;
      });
    }
    return identityFramePromise;
  }

  async function askStartNg(message, replyType, timeoutMs = 5000) {
    const frame = await connectFrame();
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      let finished = false;
      const done = (reply) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(reply);
      };
      const timer = window.setTimeout(() => done(null), timeoutMs);
      function onMessage(event) {
        if (event.origin !== START_NG || event.source !== frame.contentWindow) return;
        if (event.data?.type === replyType && event.data.requestId === requestId) done(event.data);
      }
      window.addEventListener('message', onMessage);
      frame.contentWindow.postMessage({ ...message, requestId }, START_NG);
    });
  }

  function setIdentityUnavailable(message) {
    identityStatus.textContent = message;
    identityName.textContent = hasStartNgIdentity ? identityName.textContent : 'Waiting for start.ng';
    identityAccount.textContent = hasStartNgIdentity ? identityAccount.textContent : 'Character not loaded';
    identitySignIn.hidden = true;
    if (!hasStartNgIdentity) player.visible = false;
  }

  async function refreshPlayerIdentity() {
    if (!IS_START_NG_GAME) return;
    if (identityRefreshInProgress) {
      identityRefreshQueued = true;
      return;
    }
    identityRefreshInProgress = true;
    try {
      const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
      if (!reply) {
        setIdentityUnavailable(hasStartNgIdentity
          ? 'Could not refresh start.ng identity; keeping the last character.'
          : 'No reply from start.ng. Reload this game to try again.');
        return;
      }

      const playerData = reply.user ?? reply.guest;
      if (!playerData) {
        setIdentityUnavailable('start.ng did not return a player or guest character.');
        return;
      }

      updatePlayerCharacter(playerData.style);
      player.visible = true;
      hasStartNgIdentity = true;
      identityName.textContent = playerData.name || 'Guest';
      identityAccount.textContent = reply.user?.account ? `@${reply.user.account}` : 'Not signed in';
      identityStatus.textContent = reply.user ? 'Playing as your start.ng character' : 'Playing as the start.ng guest';
      identitySignIn.hidden = !!reply.user;
    } catch (error) {
      console.error('Unable to connect to start.ng:', error);
      setIdentityUnavailable(hasStartNgIdentity
        ? 'start.ng identity refresh failed; keeping the last character.'
        : 'Could not connect to start.ng. Reload this game to try again.');
    } finally {
      identityRefreshInProgress = false;
      if (identityRefreshQueued) {
        identityRefreshQueued = false;
        scheduleIdentityRefresh();
      }
    }
  }

  function scheduleIdentityRefresh() {
    if (!IS_START_NG_GAME || document.visibilityState === 'hidden') return;
    window.clearTimeout(identityRefreshTimer);
    identityRefreshTimer = window.setTimeout(refreshPlayerIdentity, 150);
  }

  function signInWithStartNg() {
    const returnTo = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${START_NG}/?return_to=${returnTo}`;
  }

  function makeCoin() {
    const group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc857, metalness: 0.72, roughness: 0.24 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xe89c28, metalness: 0.65, roughness: 0.3 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 24), gold);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    group.add(coin);

    const center = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 18), edge);
    center.position.z = 0.065;
    group.add(center);
    group.position.y = 0.58;
    return group;
  }

  function createCoins() {
    allCoins = coinStartPositions.map(([x, z]) => {
      const coin = makeCoin();
      coin.position.x = x;
      coin.position.z = z;
      coin.userData.baseY = coin.position.y;
      scene.add(coin);
      return coin;
    });
    coins = allCoins.slice();
  }

  // Game state and interface
  function updateHud() {
    scoreDisplay.textContent = String(score);
    remainingDisplay.textContent = String(coins.length);
  }

  function setComplete() {
    isComplete = true;
    statusDisplay.textContent = 'All coins collected! Great job!';
    statusDisplay.classList.add('complete');
    finalScoreDisplay.textContent = String(score);
    if (!completionModal.open) completionModal.showModal();
    playAgainButton.focus();
  }

  function resetGame() {
    pressedKeys.clear();
    score = 0;
    isComplete = false;
    player.position.set(0, 0, 0);
    player.rotation.y = 0;
    playerBody.position.y = 0.72;
    statusDisplay.textContent = 'Collect every coin to finish!';
    statusDisplay.classList.remove('complete');
    if (completionModal.open) completionModal.close();

    allCoins.forEach((coin, index) => {
      const [x, z] = coinStartPositions[index];
      coin.visible = true;
      coin.position.set(x, coin.userData.baseY, z);
      coin.rotation.set(0, 0, 0);
    });
    coins = allCoins.slice();
    updateHud();
  }

  function collectNearbyCoins() {
    for (let i = coins.length - 1; i >= 0; i -= 1) {
      const coin = coins[i];
      const dx = player.position.x - coin.position.x;
      const dz = player.position.z - coin.position.z;
      if (Math.hypot(dx, dz) < COIN_PICKUP_DISTANCE) {
        coin.visible = false;
        coins.splice(i, 1);
        score += 1;
      }
    }
    updateHud();
    if (coins.length === 0 && !isComplete) setComplete();
  }

  // Input, movement, and drawing
  const keyAliases = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  function onKeyDown(event) {
    const direction = keyAliases[event.code];
    if (!direction) return;
    event.preventDefault();
    pressedKeys.add(direction);
  }

  function onKeyUp(event) {
    const direction = keyAliases[event.code];
    if (direction) {
      event.preventDefault();
      pressedKeys.delete(direction);
    }
  }

  function movePlayer(deltaTime) {
    if (isComplete) return;
    let moveX = 0;
    let moveZ = 0;
    if (pressedKeys.has('left')) moveX -= 1;
    if (pressedKeys.has('right')) moveX += 1;
    if (pressedKeys.has('up')) moveZ -= 1;
    if (pressedKeys.has('down')) moveZ += 1;

    if (moveX === 0 && moveZ === 0) return;
    const length = Math.hypot(moveX, moveZ);
    moveX /= length;
    moveZ /= length;

    player.position.x = THREE.MathUtils.clamp(player.position.x + moveX * PLAYER_SPEED * deltaTime, -ARENA_LIMIT, ARENA_LIMIT);
    player.position.z = THREE.MathUtils.clamp(player.position.z + moveZ * PLAYER_SPEED * deltaTime, -ARENA_LIMIT, ARENA_LIMIT);
    player.rotation.y = Math.atan2(moveX, moveZ);
    playerBody.position.y = 0.72 + Math.sin(performance.now() * 0.012) * 0.025;
    collectNearbyCoins();
  }

  function resizeRenderer() {
    if (!renderer) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate(time) {
    try {
      const deltaTime = Math.min((time - lastFrameTime) / 1000 || 0, 0.05);
      lastFrameTime = time;
      movePlayer(deltaTime);

      const seconds = time / 1000;
      coins.forEach((coin, index) => {
        coin.rotation.y = seconds * 1.5 + index * 0.6;
        coin.position.y = coin.userData.baseY + Math.sin(seconds * 2.5 + index) * 0.08;
      });
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    } catch (error) {
      console.error('Unable to render the 3D game:', error);
      const detail = error && error.message ? error.message : String(error);
      showStartupError('The 3D game stopped while drawing a frame', `${detail}\nReload the page. If the problem continues, check Chrome WebGL and graphics settings.`);
    }
  }

  let startupStage = 'create the Three.js scene';
  try {
    createScene();
    startupStage = 'update the score display';
    updateHud();
    loadingMessage.hidden = true;
    startupStage = 'attach game controls';
    restartButton.addEventListener('click', resetGame);
    playAgainButton.addEventListener('click', resetGame);
    completionCloseButton.addEventListener('click', () => {
      completionModal.close();
      restartButton.focus();
    });
    identitySignIn.addEventListener('click', signInWithStartNg);
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    window.addEventListener('blur', () => pressedKeys.clear());
    window.addEventListener('resize', resizeRenderer);
    if (IS_START_NG_GAME) {
      identityStatus.textContent = 'Connecting to start.ng…';
      identityName.textContent = 'Loading character';
      identityAccount.textContent = 'Checking player identity';
      refreshPlayerIdentity();
      window.addEventListener('focus', scheduleIdentityRefresh);
      document.addEventListener('visibilitychange', scheduleIdentityRefresh);
    } else {
      identityStatus.textContent = 'Local preview';
      identityName.textContent = 'Explorer';
      identityAccount.textContent = 'Your start.ng character loads on *.start.ng';
      identitySignIn.hidden = true;
    }
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      showStartupError('The WebGL graphics context was lost', 'The browser or graphics driver stopped the 3D renderer. Reload the page to try again.');
    });
    startupStage = 'start the render loop';
    requestAnimationFrame(animate);
  } catch (error) {
    console.error('Unable to initialize the 3D game:', error);
    const detail = error && error.message ? error.message : String(error);
    const isWebGLFailure = /webgl|context|gpu|renderer/i.test(detail);
    const advice = isWebGLFailure
      ? 'Check that Chrome hardware acceleration is enabled and that WebGL is available on this device.'
      : `The error occurred while trying to ${startupStage}.`;
    showStartupError('The 3D game could not start', `${detail}\n${advice}`);
  }
})();
