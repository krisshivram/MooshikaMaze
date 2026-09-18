(function () {
  "use strict";

  /* ================= Difficulty configuration ================= */
  var LEVELS = [
    { key: "easy", name: "Temple Courtyard", subtitle: "A small, friendly maze to warm up in.", stars: 1, size: 11, timer: 100, modaks: 12, playerStep: 135, catStep: 240, catMistake: 0.32 },
    { key: "medium", name: "Festival Lanes", subtitle: "A bigger maze, a sharper cat.", stars: 2, size: 15, timer: 110, modaks: 20, playerStep: 125, catStep: 195, catMistake: 0.18 },
    { key: "hard", name: "Grand Procession", subtitle: "Big, winding, and the cat means business.", stars: 3, size: 19, timer: 120, modaks: 30, playerStep: 115, catStep: 160, catMistake: 0.08 }
  ];
  var CELL_PX = 30;
  var CATCH_DIST_FACTOR = 0.55; // fraction of a cell counted as "caught"

  var DIR_VECTORS = {
    N: { dr: -1, dc: 0, opp: "S" },
    S: { dr: 1, dc: 0, opp: "N" },
    E: { dr: 0, dc: 1, opp: "W" },
    W: { dr: 0, dc: -1, opp: "E" }
  };

  /* ================= Maze generation (randomized DFS backtracker) ================= */
  function generateMaze(size) {
    var cells = [];
    for (var r = 0; r < size; r++) {
      var row = [];
      for (var c = 0; c < size; c++) {
        row.push({ r: r, c: c, walls: { N: true, E: true, S: true, W: true }, visited: false });
      }
      cells.push(row);
    }
    var stack = [];
    var start = cells[0][0];
    start.visited = true;
    stack.push(start);
    var dirKeys = ["N", "E", "S", "W"];

    while (stack.length) {
      var cur = stack[stack.length - 1];
      var options = [];
      for (var i = 0; i < dirKeys.length; i++) {
        var dk = dirKeys[i];
        var v = DIR_VECTORS[dk];
        var nr = cur.r + v.dr, nc = cur.c + v.dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !cells[nr][nc].visited) {
          options.push({ cell: cells[nr][nc], dir: dk });
        }
      }
      if (options.length === 0) { stack.pop(); continue; }
      var pick = options[Math.floor(Math.random() * options.length)];
      cur.walls[pick.dir] = false;
      pick.cell.walls[DIR_VECTORS[pick.dir].opp] = false;
      pick.cell.visited = true;
      stack.push(pick.cell);
    }
    return cells;
  }

  // Braiding pass: eliminate 100% of dead ends so there are no blind alleys or cul-de-sacs.
  // This guarantees every corridor has at least two exits, so the player can NEVER be cornered or trapped by the cat.
  function braidMaze(cells, size) {
    var dirKeys = ["N", "E", "S", "W"];

    // Pass 1: Eliminate all dead-ends by knocking down closed walls to adjacent cells
    for (var pass = 0; pass < 8; pass++) {
      var deadEndsRemaining = false;
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          var cell = cells[r][c];
          if (!isDeadEnd(cell)) continue;
          deadEndsRemaining = true;
          var options = [];
          for (var i = 0; i < dirKeys.length; i++) {
            var dk = dirKeys[i];
            if (!cell.walls[dk]) continue;
            var v = DIR_VECTORS[dk];
            var nr = r + v.dr, nc = c + v.dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            options.push({ dir: dk, nr: nr, nc: nc });
          }
          if (options.length > 0) {
            var pick = options[Math.floor(Math.random() * options.length)];
            cell.walls[pick.dir] = false;
            cells[pick.nr][pick.nc].walls[DIR_VECTORS[pick.dir].opp] = false;
          }
        }
      }
      if (!deadEndsRemaining) break;
    }

    // Pass 2: Ensure start cell (0,0) has multiple exits so the player is never cornered at spawn
    if (size > 1) {
      if (cells[0][0].walls.E) {
        cells[0][0].walls.E = false;
        cells[0][1].walls.W = false;
      }
      if (cells[0][0].walls.S) {
        cells[0][0].walls.S = false;
        cells[1][0].walls.N = false;
      }
    }

    // Pass 3: Add additional cross-corridor loops (12% of interior walls)
    // guaranteeing multiple bypass escape routes across all quadrants
    for (r = 1; r < size - 1; r++) {
      for (c = 1; c < size - 1; c++) {
        if (Math.random() < 0.12) {
          var dk = Math.random() < 0.5 ? "E" : "S";
          var v = DIR_VECTORS[dk];
          var nr = r + v.dr, nc = c + v.dc;
          if (cells[r][c].walls[dk]) {
            cells[r][c].walls[dk] = false;
            cells[nr][nc].walls[DIR_VECTORS[dk].opp] = false;
          }
        }
      }
    }
  }

  /* ================= BFS helpers ================= */
  function bfsDistances(cells, size, sr, sc) {
    var dist = [];
    for (var r = 0; r < size; r++) { dist.push(new Array(size).fill(-1)); }
    dist[sr][sc] = 0;
    var q = [[sr, sc]];
    var qi = 0;
    while (qi < q.length) {
      var cur = q[qi++]; var r = cur[0], c = cur[1];
      var dirKeys = ["N", "E", "S", "W"];
      for (var i = 0; i < dirKeys.length; i++) {
        var dk = dirKeys[i];
        if (cells[r][c].walls[dk]) continue;
        var v = DIR_VECTORS[dk];
        var nr = r + v.dr, nc = c + v.dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (dist[nr][nc] !== -1) continue;
        dist[nr][nc] = dist[r][c] + 1;
        q.push([nr, nc]);
      }
    }
    return dist;
  }

  function bfsPath(cells, size, sr, sc, er, ec) {
    var prev = [];
    for (var r = 0; r < size; r++) { prev.push(new Array(size).fill(null)); }
    var visited = [];
    for (r = 0; r < size; r++) { visited.push(new Array(size).fill(false)); }
    visited[sr][sc] = true;
    var q = [[sr, sc]]; var qi = 0;
    while (qi < q.length) {
      var cur = q[qi++]; var cr = cur[0], cc = cur[1];
      if (cr === er && cc === ec) break;
      var dirKeys = ["N", "E", "S", "W"];
      for (var i = 0; i < dirKeys.length; i++) {
        var dk = dirKeys[i];
        if (cells[cr][cc].walls[dk]) continue;
        var v = DIR_VECTORS[dk];
        var nr = cr + v.dr, nc = cc + v.dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (visited[nr][nc]) continue;
        visited[nr][nc] = true;
        prev[nr][nc] = [cr, cc];
        q.push([nr, nc]);
      }
    }
    if (!visited[er][ec]) return null;
    var path = []; var cur = [er, ec];
    while (cur) { path.push(cur); cur = prev[cur[0]][cur[1]]; }
    path.reverse();
    return path;
  }

  function isDeadEnd(cell) {
    var wallCount = (cell.walls.N ? 1 : 0) + (cell.walls.E ? 1 : 0) + (cell.walls.S ? 1 : 0) + (cell.walls.W ? 1 : 0);
    return wallCount === 3;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ================= Game state ================= */
  var state = null; // built fresh in startLevel()
  var bestScores = {};
  var rafId = null;
  var lastFrameTime = 0;

  /* ================= DOM refs ================= */
  var screens = {
    start: document.getElementById("screen-start"),
    game: document.getElementById("screen-game"),
    results: document.getElementById("screen-results")
  };
  function showScreen(name) {
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle("active", k === name); });
  }

  var levelListEl = document.getElementById("level-list");
  var canvas = document.getElementById("mazeCanvas");
  var ctx = canvas.getContext("2d");
  var hudTimer = document.getElementById("hud-timer");
  var hudModaks = document.getElementById("hud-modaks");
  var hudLevelName = document.getElementById("hud-level-name");
  var pauseOverlay = document.getElementById("pause-overlay");

  /* ================= Level list rendering ================= */
  function renderLevelList() {
    levelListEl.innerHTML = "";
    LEVELS.forEach(function (lvl, idx) {
      var card = document.createElement("button");
      card.className = "level-card";
      card.setAttribute("type", "button");
      var stars = "★".repeat(lvl.stars) + "☆".repeat(3 - lvl.stars);
      var best = bestScores[lvl.key];
      card.innerHTML =
        '<div class="num">MAZE ' + (idx + 1) + '</div>' +
        '<h4>' + lvl.name + '</h4>' +
        '<p>' + lvl.subtitle + '</p>' +
        '<div class="stars">' + stars + '</div>' +
        '<div class="meta-row"><span>' + lvl.size + '×' + lvl.size + ' grid</span><span>' + lvl.timer + 's</span><span>' + lvl.modaks + ' modaks</span></div>' +
        (best ? '<div class="best-score">Best score: <b>' + best.score + '</b> · ' + best.grade + '</div>' : '');
      card.addEventListener("click", function () { startLevel(idx); });
      levelListEl.appendChild(card);
    });
  }

  /* ================= Start a level ================= */
  function startLevel(idx) {
    var level = LEVELS[idx];
    var size = level.size;
    var cells = generateMaze(size);
    braidMaze(cells, size);
    var goal = { r: Math.floor(size / 2), c: Math.floor(size / 2) };
    var playerStart = { r: 0, c: 0 };

    var distFromPlayer = bfsDistances(cells, size, playerStart.r, playerStart.c);
    var maxDist = 0;
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (distFromPlayer[r][c] > maxDist) maxDist = distFromPlayer[r][c];

    // All valid interior candidates (excluding start and goal)
    var candidates = [];
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        if (r === playerStart.r && c === playerStart.c) continue;
        if (r === goal.r && c === goal.c) continue;
        candidates.push({ r: r, c: c, dist: distFromPlayer[r][c] });
      }
    }

    // Cat spawn: guarantee the cat spawns far away from the player (at least 60% of maxDist, min 6 steps)
    // so the player always has ample reaction time, alternative corridors, and cannot be trapped at spawn
    var minSafeCatDist = Math.max(6, Math.floor(maxDist * 0.6));
    var catCandidates = candidates.filter(function (p) { return p.dist >= minSafeCatDist; });
    if (catCandidates.length === 0) {
      catCandidates = candidates.slice().sort(function (a, b) { return b.dist - a.dist; }).slice(0, 5);
    }
    var catStart = catCandidates[Math.floor(Math.random() * catCandidates.length)];

    // Modak placement: spread generously across loops and corridors throughout the maze,
    // avoiding the cat spawn and immediate start position
    var modakCandidates = candidates.filter(function (p) {
      return !(p.r === catStart.r && p.c === catStart.c) && p.dist >= 2;
    });
    var shuffled = shuffle(modakCandidates);
    var modakSpots = [];
    // Spaced selection (at least 2 Manhattan distance apart)
    for (var i = 0; i < shuffled.length && modakSpots.length < level.modaks; i++) {
      var cand = shuffled[i];
      var tooClose = modakSpots.some(function (m) {
        return (Math.abs(m.r - cand.r) + Math.abs(m.c - cand.c)) < 2;
      });
      if (!tooClose) modakSpots.push(cand);
    }
    // Fill remaining if needed to match level.modaks count
    for (i = 0; i < shuffled.length && modakSpots.length < level.modaks; i++) {
      if (modakSpots.indexOf(shuffled[i]) === -1) modakSpots.push(shuffled[i]);
    }

    state = {
      level: level,
      cells: cells,
      size: size,
      goal: goal,
      running: true,
      paused: false,
      timeLeft: level.timer,
      modaksTotal: modakSpots.length,
      modaks: modakSpots.map(function (p) { return { r: p.r, c: p.c, collected: false }; }),
      floatingTexts: [],
      player: {
        cell: { r: playerStart.r, c: playerStart.c },
        px: playerStart.c * CELL_PX + CELL_PX / 2,
        py: playerStart.r * CELL_PX + CELL_PX / 2,
        moving: false, from: null, to: null, moveT: 0
      },
      cat: {
        cell: { r: catStart.r, c: catStart.c },
        px: catStart.c * CELL_PX + CELL_PX / 2,
        py: catStart.r * CELL_PX + CELL_PX / 2,
        moving: false, from: null, to: null, moveT: 0
      },
      heldOrder: [],
      dragActive: false,
      dragOrigin: null,
      dragCurrent: null,
      lastMovePt: null,
      bufferedDir: null,
      bufferedTime: 0,
      goalPulse: 0,
      outcome: null
    };

    canvas.width = size * CELL_PX;
    canvas.height = size * CELL_PX;

    hudLevelName.textContent = level.name;
    updateHud();
    pauseOverlay.classList.remove("show");

    showScreen("game");
    updateCanvasRect();
    lastFrameTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  /* ================= HUD ================= */
  function formatTime(t) {
    t = Math.max(0, Math.ceil(t));
    var m = Math.floor(t / 60), s = t % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
  }
  function updateHud() {
    hudTimer.textContent = formatTime(state.timeLeft);
    hudTimer.classList.toggle("timer-warn", state.timeLeft <= 10);
    var collected = state.modaks.filter(function (m) { return m.collected; }).length;
    hudModaks.textContent = collected + "/" + state.modaksTotal;
  }

  /* ================= Input handling ================= */
  var KEY_TO_DIR = {
    arrowup: "N", w: "N",
    arrowdown: "S", s: "S",
    arrowleft: "W", a: "W",
    arrowright: "E", d: "E"
  };

  function pushDir(dir) {
    if (!dir) return;
    var idx = state ? state.heldOrder.indexOf(dir) : -1;
    if (idx === -1 && state) state.heldOrder.push(dir);
  }
  function popDir(dir) {
    if (!state) return;
    var idx = state.heldOrder.indexOf(dir);
    if (idx !== -1) state.heldOrder.splice(idx, 1);
  }

  document.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (k === "escape") { togglePause(); return; }
    var dir = KEY_TO_DIR[k];
    if (dir) {
      e.preventDefault();
      pushDir(dir);
      if (state) {
        state.bufferedDir = dir;
        state.bufferedTime = performance.now();
      }
    }
  });
  document.addEventListener("keyup", function (e) {
    var k = e.key.toLowerCase();
    var dir = KEY_TO_DIR[k];
    if (dir) popDir(dir);
  });

  // Cached canvas rectangle to prevent high-frequency layout reflow on drag
  var cachedRect = null;
  function updateCanvasRect() {
    if (canvas) cachedRect = canvas.getBoundingClientRect();
  }
  window.addEventListener("resize", updateCanvasRect);
  window.addEventListener("scroll", updateCanvasRect, true);

  function canvasPointFromEvent(e) {
    if (!cachedRect) updateCanvasRect();
    var scaleX = canvas.width / (cachedRect.width || 1);
    var scaleY = canvas.height / (cachedRect.height || 1);
    return {
      x: (e.clientX - cachedRect.left) * scaleX,
      y: (e.clientY - cachedRect.top) * scaleY
    };
  }

  // Calculate direction intent from active mouse / touch drag
  function getDragDirection() {
    if (!state || !state.dragActive || !state.dragOrigin || !state.dragCurrent) return null;

    var dx = state.dragCurrent.x - state.dragOrigin.x;
    var dy = state.dragCurrent.y - state.dragOrigin.y;
    var dist = Math.hypot(dx, dy);

    // Ultra-responsive 6px threshold (stationary tap does not move)
    if (dist >= 6) {
      var pDir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
      var sDir = Math.abs(dx) >= Math.abs(dy) ? (dy > 0 ? "S" : "N") : (dx > 0 ? "E" : "W");
      var secDist = Math.abs(Math.abs(dx) >= Math.abs(dy) ? dy : dx);
      return { primary: pDir, secondary: sDir, secDist: secDist };
    }
    return null;
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (!state || !state.running) return;
    e.preventDefault();
    updateCanvasRect();
    state.dragActive = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    var pt = canvasPointFromEvent(e);
    state.dragOrigin = { x: pt.x, y: pt.y };
    state.dragCurrent = { x: pt.x, y: pt.y };
    state.lastMovePt = { x: pt.x, y: pt.y };

    var drag = getDragDirection();
    if (drag) {
      state.bufferedDir = drag.primary;
      state.bufferedTime = performance.now();
    }
  });

  function handlePointerMove(e) {
    if (!state || !state.dragActive) return;
    e.preventDefault();
    var pt = canvasPointFromEvent(e);
    var prev = state.lastMovePt || pt;
    state.dragCurrent = { x: pt.x, y: pt.y };
    state.lastMovePt = { x: pt.x, y: pt.y };

    var moveDx = pt.x - prev.x;
    var moveDy = pt.y - prev.y;

    if (state.dragOrigin) {
      // Instant axis switching without dead-band:
      // When the mouse distinctly moves along a new axis (e.g. was moving horizontal, now moving vertical),
      // reset the perpendicular anchor so there is ZERO drag resistance or dead-band!
      if (Math.abs(moveDy) >= 2 && Math.abs(moveDy) > Math.abs(moveDx)) {
        state.dragOrigin.x = pt.x; // Clear horizontal drag anchor
      } else if (Math.abs(moveDx) >= 2 && Math.abs(moveDx) > Math.abs(moveDy)) {
        state.dragOrigin.y = pt.y; // Clear vertical drag anchor
      }

      // Clamp anchor distance within a tight 16px leash for instantaneous direction changes
      var dx = pt.x - state.dragOrigin.x;
      var dy = pt.y - state.dragOrigin.y;
      var dist = Math.hypot(dx, dy);
      var maxLeash = 16;
      if (dist > maxLeash) {
        state.dragOrigin.x = pt.x - (dx / dist) * maxLeash;
        state.dragOrigin.y = pt.y - (dy / dist) * maxLeash;
      }
    }

    // Continuously buffer the active drag direction so corner transitions happen seamlessly
    var drag = getDragDirection();
    if (drag) {
      state.bufferedDir = drag.primary;
      state.bufferedTime = performance.now();
    }
  }
  canvas.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointermove", handlePointerMove);

  function endDrag() {
    if (!state) return;
    if (state.dragActive) {
      var drag = getDragDirection();
      if (drag) {
        state.bufferedDir = drag.primary;
        state.bufferedTime = performance.now();
      }
    }
    state.dragActive = false;
    state.dragOrigin = null;
    state.dragCurrent = null;
    state.lastMovePt = null;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  /* Direction selection: Manual drag steering + Keyboard controls */
  function chooseBestDir(cell) {
    if (!state) return null;

    // 1. Buffered swipe / drag or keyboard tap (valid within 280ms)
    if (state.bufferedDir && (performance.now() - state.bufferedTime < 280)) {
      if (canMove(cell, state.bufferedDir)) {
        var bDir = state.bufferedDir;
        state.bufferedDir = null;
        return bDir;
      }
    }

    // 2. Held keyboard keys (Arrow keys / WASD)
    for (var i = state.heldOrder.length - 1; i >= 0; i--) {
      var kd = state.heldOrder[i];
      if (canMove(cell, kd)) return kd;
    }

    // 3. Active drag steering
    if (state.dragActive) {
      var drag = getDragDirection();
      if (drag) {
        // Try primary direction
        if (canMove(cell, drag.primary)) {
          return drag.primary;
        }
        // Corner assist: if primary direction hits a wall, but player is pulling towards
        // an open secondary corridor with at least 5px of intent, smoothly take the open corridor!
        if (drag.secDist >= 5 && canMove(cell, drag.secondary)) {
          return drag.secondary;
        }
      }
      // Wall reached in drag direction: stop cleanly, do NOT auto-turn into random halls!
      return null;
    }

    return null;
  }

  /* ================= Pause ================= */
  function togglePause() {
    if (!state || !state.running) return;
    state.paused = !state.paused;
    pauseOverlay.classList.toggle("show", state.paused);
  }
  document.getElementById("btn-pause").addEventListener("click", togglePause);
  document.getElementById("btn-resume").addEventListener("click", togglePause);
  document.getElementById("btn-pause-quit").addEventListener("click", function () {
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    pauseOverlay.classList.remove("show");
    showScreen("start");
    renderLevelList();
  });
  document.getElementById("btn-quit").addEventListener("click", function () {
    if (state) state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    showScreen("start");
    renderLevelList();
  });

  /* ================= Movement helpers ================= */
  function canMove(cell, dir) {
    return !!(cell && cell.walls && !cell.walls[dir]);
  }
  function tryStartMove(entity, size, cells, dir, stepDuration) {
    if (entity.moving || !dir) return false;
    var v = DIR_VECTORS[dir];
    var cell = cells[entity.cell.r][entity.cell.c];
    if (!canMove(cell, dir)) return false;
    var nr = entity.cell.r + v.dr, nc = entity.cell.c + v.dc;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) return false;
    entity.moving = true;
    entity.from = { r: entity.cell.r, c: entity.cell.c };
    entity.to = { r: nr, c: nc };
    entity.moveT = 0;
    entity.moveDuration = stepDuration / 1000;
    return true;
  }
  function updateMovingEntity(entity, dt, onArrive) {
    if (!entity.moving) return;
    entity.moveT += dt;
    var t = Math.min(1, entity.moveT / entity.moveDuration);
    entity.px = lerp(entity.from.c, entity.to.c, t) * CELL_PX + CELL_PX / 2;
    entity.py = lerp(entity.from.r, entity.to.r, t) * CELL_PX + CELL_PX / 2;
    if (t >= 1) {
      entity.moving = false;
      entity.cell = { r: entity.to.r, c: entity.to.c };
      entity.px = entity.cell.c * CELL_PX + CELL_PX / 2;
      entity.py = entity.cell.r * CELL_PX + CELL_PX / 2;
      entity.from = null; entity.to = null;
      if (onArrive) onArrive();
    }
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ================= Cat AI ================= */
  function updateCat(dt) {
    var cat = state.cat;
    if (!cat.moving) {
      var target = state.player.cell;
      var useMistake = Math.random() < state.level.catMistake;
      var nextCell = null;

      if (!useMistake) {
        var path = bfsPath(state.cells, state.size, cat.cell.r, cat.cell.c, target.r, target.c);
        if (path && path.length > 1) {
          nextCell = { r: path[1][0], c: path[1][1] };
        }
      }
      if (!nextCell) {
        // mistake move (or no path needed / already adjacent): pick a random open neighbour
        var dirKeys = shuffle(["N", "E", "S", "W"]);
        for (var i = 0; i < dirKeys.length; i++) {
          var dk = dirKeys[i];
          var cellObj = state.cells[cat.cell.r][cat.cell.c];
          if (!cellObj.walls[dk]) {
            var v = DIR_VECTORS[dk];
            var nr = cat.cell.r + v.dr, nc = cat.cell.c + v.dc;
            if (nr >= 0 && nr < state.size && nc >= 0 && nc < state.size) { nextCell = { r: nr, c: nc }; break; }
          }
        }
      }
      if (nextCell) {
        var dr = nextCell.r - cat.cell.r, dc = nextCell.c - cat.cell.c;
        var dir = dr === -1 ? "N" : dr === 1 ? "S" : dc === 1 ? "E" : "W";
        tryStartMove(cat, state.size, state.cells, dir, state.level.catStep);
      }
    }
    updateMovingEntity(cat, dt, null);
  }

  /* ================= Player update ================= */
  function updatePlayer(dt) {
    var player = state.player;
    if (!player.moving) {
      var cellObj = state.cells[player.cell.r][player.cell.c];
      var dir = chooseBestDir(cellObj);
      if (dir && tryStartMove(player, state.size, state.cells, dir, state.level.playerStep)) {
        // move started
      } else {
        return;
      }
    }

    // Smooth movement
    player.moveT += dt;
    var t = Math.min(1, player.moveT / player.moveDuration);
    player.px = lerp(player.from.c, player.to.c, t) * CELL_PX + CELL_PX / 2;
    player.py = lerp(player.from.r, player.to.r, t) * CELL_PX + CELL_PX / 2;

    if (t >= 1) {
      player.cell = { r: player.to.r, c: player.to.c };
      player.px = player.cell.c * CELL_PX + CELL_PX / 2;
      player.py = player.cell.r * CELL_PX + CELL_PX / 2;
      player.moving = false;
      player.from = null;
      player.to = null;

      onPlayerArrivedCell(player.cell);

      // Smooth step continuation if still steering towards an open corridor
      if (state && state.running && !state.paused) {
        var nextCellObj = state.cells[player.cell.r][player.cell.c];
        var nextDir = chooseBestDir(nextCellObj);
        if (nextDir && tryStartMove(player, state.size, state.cells, nextDir, state.level.playerStep)) {
          var leftover = Math.max(0, player.moveT - player.moveDuration);
          player.moveT = Math.min(leftover, player.moveDuration * 0.5);
        }
      }
    }
  }

  function onPlayerArrivedCell(cell) {
    // modak pickup
    for (var i = 0; i < state.modaks.length; i++) {
      var m = state.modaks[i];
      if (!m.collected && m.r === cell.r && m.c === cell.c) {
        m.collected = true;
        updateHud();
        state.floatingTexts.push({ x: cell.c * CELL_PX + CELL_PX / 2, y: cell.r * CELL_PX + CELL_PX / 2, life: 0.9, text: "+100" });
      }
    }
    // goal check
    if (cell.r === state.goal.r && cell.c === state.goal.c) {
      finishLevel("win");
    }
  }

  /* ================= End of level ================= */
  function finishLevel(outcome) {
    if (!state.running) return;
    state.running = false;
    state.outcome = outcome;
    if (rafId) cancelAnimationFrame(rafId);

    var collected = state.modaks.filter(function (m) { return m.collected; }).length;
    var modakScore = collected * 100;
    var timeBonus = outcome === "win" ? Math.round(state.timeLeft) * 5 : 0;
    var score = modakScore + timeBonus;

    var maxPossible = state.modaksTotal * 100 + state.level.timer * 5;
    var pct = maxPossible > 0 ? (score / maxPossible) * 100 : 0;
    var grade = outcome !== "win" ? (collected > 0 ? "C" : "D") :
      pct >= 90 ? "S" : pct >= 75 ? "A" : pct >= 55 ? "B" : pct >= 30 ? "C" : "D";

    var prev = bestScores[state.level.key];
    if (!prev || score > prev.score) { bestScores[state.level.key] = { score: score, grade: grade }; }

    var iconEl = document.getElementById("res-icon");
    var titleEl = document.getElementById("res-title");
    var subEl = document.getElementById("res-sub");
    if (outcome === "win") {
      iconEl.innerHTML = GANESHA_FACE_SVG;
      titleEl.textContent = "You reached Ganesha!";
      subEl.textContent = state.level.name + " — cleared with " + formatTime(state.timeLeft) + " to spare";
    } else if (outcome === "caught") {
      iconEl.textContent = "🙀";
      titleEl.textContent = "The cat got you!";
      subEl.textContent = state.level.name + " — better luck next time";
    } else {
      iconEl.textContent = "⏰";
      titleEl.textContent = "Time's up!";
      subEl.textContent = state.level.name + " — the maze got the better of you";
    }
    document.getElementById("res-grade").textContent = grade;
    document.getElementById("res-modaks").textContent = collected + "/" + state.modaksTotal;
    document.getElementById("res-timebonus").textContent = timeBonus;
    document.getElementById("res-score").textContent = score;

    showScreen("results");
  }

  document.getElementById("btn-replay").addEventListener("click", function () {
    var idx = LEVELS.indexOf(state.level);
    startLevel(idx);
  });
  document.getElementById("btn-back-levels").addEventListener("click", function () {
    renderLevelList();
    showScreen("start");
  });

  /* ================= Ganesha face icon (hand-drawn, not an emoji) ================= */
  function drawGaneshaFace(ctx, cx, cy, r) {
    ctx.save();

    // ears (drawn first, behind the head)
    ctx.fillStyle = "#d9a86b";
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = Math.max(1, r * 0.06);
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.ellipse(cx + side * r * 1.05, cy - r * 0.05, r * 0.62, r * 0.8, side * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // crown
    ctx.fillStyle = "#ffd75e";
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy - r * 0.85);
    ctx.lineTo(cx - r * 0.32, cy - r * 1.35);
    ctx.lineTo(cx + r * 0.32, cy - r * 1.35);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e0475b";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 1.28, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // head
    var headGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
    headGrad.addColorStop(0, "#f0c584");
    headGrad.addColorStop(1, "#cd9550");
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // trunk, curving down from between the eyes
    ctx.strokeStyle = "#cd9550";
    ctx.lineWidth = r * 0.42;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.02, cy + r * 0.35);
    ctx.quadraticCurveTo(cx + r * 0.55, cy + r * 0.75, cx + r * 0.2, cy + r * 1.25);
    ctx.stroke();
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();

    // tusk
    ctx.fillStyle = "#fff8ec";
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.28, cy + r * 0.32);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.42);
    ctx.lineTo(cx + r * 0.3, cy + r * 0.52);
    ctx.closePath();
    ctx.fill();

    // tilak (forehead mark)
    ctx.fillStyle = "#c23b4f";
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.62, r * 0.07, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // calm, gently closed eyes
    ctx.strokeStyle = "#3a2410";
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.lineCap = "round";
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.arc(cx + side * r * 0.34, cy - r * 0.12, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    });

    ctx.restore();
  }
  var GANESHA_FACE_SVG =
    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="14" cy="46" rx="19" ry="24" transform="rotate(-14 14 46)" fill="#d9a86b" stroke="#8a5a2b" stroke-width="3"/>' +
    '<ellipse cx="86" cy="46" rx="19" ry="24" transform="rotate(14 86 46)" fill="#d9a86b" stroke="#8a5a2b" stroke-width="3"/>' +
    '<polygon points="30,20 40,4 60,4 70,20" fill="#ffd75e" stroke="#b8860b" stroke-width="3"/>' +
    '<circle cx="50" cy="9" r="5.5" fill="#e0475b"/>' +
    '<circle cx="50" cy="48" r="32" fill="#e3b273" stroke="#8a5a2b" stroke-width="3"/>' +
    '<path d="M49 62 Q68 70 58 90" stroke="#8a5a2b" stroke-width="15" fill="none" stroke-linecap="round"/>' +
    '<path d="M49 62 Q68 70 58 90" stroke="#cd9550" stroke-width="11" fill="none" stroke-linecap="round"/>' +
    '<polygon points="60,60 68,64 61,70" fill="#fff8ec"/>' +
    '<ellipse cx="50" cy="30" rx="3.5" ry="7" fill="#c23b4f"/>' +
    '<path d="M32 44 Q38 52 44 44" stroke="#3a2410" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
    '<path d="M56 44 Q62 52 68 44" stroke="#3a2410" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  /* ================= Rendering ================= */
  function draw() {
    var size = state.size;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // floor checker
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        ctx.fillStyle = ((r + c) % 2 === 0) ? "#241108" : "#2a1409";
        ctx.fillRect(c * CELL_PX, r * CELL_PX, CELL_PX, CELL_PX);
      }
    }

    // goal glow
    state.goalPulse += 0.05;
    var glowR = CELL_PX * 1.6 + Math.sin(state.goalPulse) * 4;
    var gx = state.goal.c * CELL_PX + CELL_PX / 2, gy = state.goal.r * CELL_PX + CELL_PX / 2;
    var grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, glowR);
    grad.addColorStop(0, "rgba(255,201,74,0.55)");
    grad.addColorStop(1, "rgba(255,201,74,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(gx, gy, glowR, 0, Math.PI * 2); ctx.fill();

    // walls
    ctx.strokeStyle = "#ffc94a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        var cell = state.cells[r][c];
        var x0 = c * CELL_PX, y0 = r * CELL_PX, x1 = x0 + CELL_PX, y1 = y0 + CELL_PX;
        ctx.beginPath();
        if (cell.walls.N) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
        if (cell.walls.W) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
        if (r === size - 1 && cell.walls.S) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
        if (c === size - 1 && cell.walls.E) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
        ctx.stroke();
      }
    }

    // modaks
    ctx.font = (CELL_PX * 0.62) + "px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    state.modaks.forEach(function (m) {
      if (m.collected) return;
      ctx.fillText("🥟", m.c * CELL_PX + CELL_PX / 2, m.r * CELL_PX + CELL_PX / 2);
    });

    // goal marker
    drawGaneshaFace(ctx, gx, gy, CELL_PX * 0.62);

    // floating pickup texts
    ctx.font = "bold " + (CELL_PX * 0.45) + "px sans-serif";
    ctx.fillStyle = "#ffdd8a";
    for (var i = state.floatingTexts.length - 1; i >= 0; i--) {
      var ft = state.floatingTexts[i];
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.fillText(ft.text, ft.x, ft.y - (0.9 - ft.life) * 26);
    }
    ctx.globalAlpha = 1;

    // cat
    ctx.font = (CELL_PX * 0.78) + "px sans-serif";
    ctx.fillText("🐱", state.cat.px, state.cat.py);

    // player
    ctx.font = (CELL_PX * 0.78) + "px sans-serif";
    ctx.fillText("🐭", state.player.px, state.player.py);
  }

  /* ================= Main loop ================= */
  function loop(now) {
    if (!state || !state.running) { return; }
    var dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (!state.paused) {
      state.timeLeft -= dt;
      updateHud();
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        finishLevel("timeup");
        return;
      }

      updatePlayer(dt);
      updateCat(dt);

      // proximity catch check (robust against cell-swap edge cases)
      var dx = state.player.px - state.cat.px, dy = state.player.py - state.cat.py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CELL_PX * CATCH_DIST_FACTOR) {
        finishLevel("caught");
        return;
      }

      // floating text decay
      for (var i = state.floatingTexts.length - 1; i >= 0; i--) {
        state.floatingTexts[i].life -= dt;
        if (state.floatingTexts[i].life <= 0) state.floatingTexts.splice(i, 1);
      }
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  /* ================= Init ================= */
  renderLevelList();
})();
