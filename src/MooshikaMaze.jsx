import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MooshikaMaze.css';

/* ================= Difficulty configuration ================= */
const LEVELS = [
  { key: "easy", name: "Temple Courtyard", subtitle: "A small, friendly maze to warm up in.", stars: 1, size: 11, timer: 100, modaks: 12, playerStep: 135, catStep: 240, catMistake: 0.32 },
  { key: "medium", name: "Festival Lanes", subtitle: "A bigger maze, a sharper cat.", stars: 2, size: 15, timer: 110, modaks: 20, playerStep: 125, catStep: 195, catMistake: 0.18 },
  { key: "hard", name: "Grand Procession", subtitle: "Big, winding, and the cat means business.", stars: 3, size: 19, timer: 120, modaks: 30, playerStep: 115, catStep: 160, catMistake: 0.08 }
];

const CELL_PX = 30;
const CATCH_DIST_FACTOR = 0.55;

const DIR_VECTORS = {
  N: { dr: -1, dc: 0, opp: "S" },
  S: { dr: 1, dc: 0, opp: "N" },
  E: { dr: 0, dc: 1, opp: "W" },
  W: { dr: 0, dc: -1, opp: "E" }
};

const KEY_TO_DIR = {
  arrowup: "N", w: "N",
  arrowdown: "S", s: "S",
  arrowleft: "W", a: "W",
  arrowright: "E", d: "E"
};

/* ================= Ganesha SVG Icon ================= */
export function GaneshaIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="46" rx="19" ry="24" transform="rotate(-14 14 46)" fill="#d9a86b" stroke="#8a5a2b" strokeWidth="3" />
      <ellipse cx="86" cy="46" rx="19" ry="24" transform="rotate(14 86 46)" fill="#d9a86b" stroke="#8a5a2b" strokeWidth="3" />
      <polygon points="30,20 40,4 60,4 70,20" fill="#ffd75e" stroke="#b8860b" strokeWidth="3" />
      <circle cx="50" cy="9" r="5.5" fill="#e0475b" />
      <circle cx="50" cy="48" r="32" fill="#e3b273" stroke="#8a5a2b" strokeWidth="3" />
      <path d="M49 62 Q68 70 58 90" stroke="#8a5a2b" strokeWidth="15" fill="none" strokeLinecap="round" />
      <path d="M49 62 Q68 70 58 90" stroke="#cd9550" strokeWidth="11" fill="none" strokeLinecap="round" />
      <polygon points="60,60 68,64 61,70" fill="#fff8ec" />
      <ellipse cx="50" cy="30" rx="3.5" ry="7" fill="#c23b4f" />
      <path d="M32 44 Q38 52 44 44" stroke="#3a2410" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M56 44 Q62 52 68 44" stroke="#3a2410" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ================= Helpers ================= */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatTime(t) {
  t = Math.max(0, Math.ceil(t));
  var m = Math.floor(t / 60), s = t % 60;
  return m + ":" + (s < 10 ? "0" + s : s);
}

/* ================= Procedural Maze Generation ================= */
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

function isDeadEnd(cell) {
  var closed = 0;
  if (cell.walls.N) closed++;
  if (cell.walls.E) closed++;
  if (cell.walls.S) closed++;
  if (cell.walls.W) closed++;
  return closed >= 3;
}

function braidMaze(cells, size) {
  var dirKeys = ["N", "E", "S", "W"];

  // Pass 1: Eliminate 100% of dead-ends
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

  // Pass 2: Ensure start cell has at least 2 exits
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

  // Pass 3: Cross-corridor bypass loops (12% of interior walls)
  for (let r = 1; r < size - 1; r++) {
    for (let c = 1; c < size - 1; c++) {
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

/* ================= BFS Pathfinding ================= */
function bfsDistances(cells, size, sr, sc) {
  var dist = [];
  for (var r = 0; r < size; r++) { dist.push(new Array(size).fill(-1)); }
  dist[sr][sc] = 0;
  var q = [[sr, sc]];
  var qi = 0;
  while (qi < q.length) {
    var cur = q[qi++]; var cr = cur[0], cc = cur[1];
    var dirKeys = ["N", "E", "S", "W"];
    for (var i = 0; i < dirKeys.length; i++) {
      var dk = dirKeys[i];
      if (cells[cr][cc].walls[dk]) continue;
      var v = DIR_VECTORS[dk];
      var nr = cr + v.dr, nc = cc + v.dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (dist[nr][nc] !== -1) continue;
      dist[nr][nc] = dist[cr][cc] + 1;
      q.push([nr, nc]);
    }
  }
  return dist;
}

function bfsPath(cells, size, sr, sc, er, ec) {
  var prev = [];
  for (var r = 0; r < size; r++) { prev.push(new Array(size).fill(null)); }
  var visited = [];
  for (let r = 0; r < size; r++) { visited.push(new Array(size).fill(false)); }
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
  var path = [];
  var step = [er, ec];
  while (step) {
    path.push(step);
    step = prev[step[0]][step[1]];
  }
  path.reverse();
  return path;
}

/* ================= Ganesha Face on Canvas ================= */
function drawGaneshaFace(ctx, cx, cy, r) {
  ctx.save();

  // ears
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

  // trunk
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

  // tilak
  ctx.fillStyle = "#c23b4f";
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.62, r * 0.07, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // closed eyes
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

/* ================= Main React Component ================= */
export default function MooshikaMaze() {
  const [screen, setScreen] = useState('start'); // 'start' | 'game' | 'results'
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [hud, setHud] = useState({ timeLeft: 100, modaks: 0, totalModaks: 12, levelName: "Maze", warn: false });
  const [isPaused, setIsPaused] = useState(false);
  const [results, setResults] = useState({ outcome: 'win', title: '', sub: '', icon: '🐭', grade: 'S', modaks: '0/0', timeBonus: 0, score: 0 });
  const [bestScores, setBestScores] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mooshika_best_scores') || '{}');
    } catch (e) {
      return {};
    }
  });
  const [activeDpadDir, setActiveDpadDir] = useState(null);

  const canvasRef = useRef(null);
  const gameStateRef = useRef(null);
  const rafRef = useRef(null);

  const canMove = (cell, dir) => {
    return !!(cell && cell.walls && !cell.walls[dir]);
  };

  const tryStartMove = (entity, size, cells, dir, stepDuration) => {
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
  };

  const handleDpadDown = useCallback((e, dir) => {
    e.preventDefault();
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    }
    setActiveDpadDir(dir);
    const state = gameStateRef.current;
    if (!state || !state.running || state.paused) return;

    if (state.heldOrder.indexOf(dir) === -1) {
      state.heldOrder.push(dir);
    }
    state.bufferedDir = dir;
    state.bufferedTime = performance.now();

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (_) {}

    const player = state.player;
    if (player && !player.moving) {
      const cellObj = state.cells[player.cell.r][player.cell.c];
      if (canMove(cellObj, dir)) {
        tryStartMove(player, state.size, state.cells, dir, state.level.playerStep);
      }
    }
  }, []);

  const handleDpadUp = useCallback((e, dir) => {
    e.preventDefault();
    setActiveDpadDir(prev => (prev === dir ? null : prev));
    const state = gameStateRef.current;
    if (!state) return;
    const idx = state.heldOrder.indexOf(dir);
    if (idx !== -1) {
      state.heldOrder.splice(idx, 1);
    }
  }, []);

  const chooseBestDir = useCallback((cell) => {
    var state = gameStateRef.current;
    if (!state) return null;

    // 1. Buffered swipe or keyboard tap (valid within 280ms)
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
    if (state.dragActive && state.dragOrigin && state.dragCurrent) {
      var dx = state.dragCurrent.x - state.dragOrigin.x;
      var dy = state.dragCurrent.y - state.dragOrigin.y;
      var dist = Math.hypot(dx, dy);

      if (dist >= 6) {
        var pDir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
        var sDir = Math.abs(dx) >= Math.abs(dy) ? (dy > 0 ? "S" : "N") : (dx > 0 ? "E" : "W");
        var secDist = Math.abs(Math.abs(dx) >= Math.abs(dy) ? dy : dx);

        if (canMove(cell, pDir)) {
          return pDir;
        }
        if (secDist >= 5 && canMove(cell, sDir)) {
          return sDir;
        }
      }
      return null;
    }

    return null;
  }, []);

  const finishLevel = useCallback((outcome) => {
    var state = gameStateRef.current;
    if (!state || !state.running) return;
    state.running = false;
    state.outcome = outcome;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    var collected = state.modaks.filter(function (m) { return m.collected; }).length;
    var modakScore = collected * 100;
    var timeBonus = outcome === "win" ? Math.round(state.timeLeft) * 5 : 0;
    var score = modakScore + timeBonus;

    var maxPossible = state.modaksTotal * 100 + state.level.timer * 5;
    var pct = maxPossible > 0 ? (score / maxPossible) * 100 : 0;
    var grade = outcome !== "win" ? (collected > 0 ? "C" : "D") :
      pct >= 90 ? "S" : pct >= 75 ? "A" : pct >= 55 ? "B" : pct >= 30 ? "C" : "D";

    setBestScores(prev => {
      var curBest = prev[state.level.key];
      if (!curBest || score > curBest.score) {
        var updated = { ...prev, [state.level.key]: { score: score, grade: grade } };
        try { localStorage.setItem('mooshika_best_scores', JSON.stringify(updated)); } catch (e) { }
        return updated;
      }
      return prev;
    });

    var res = {
      outcome: outcome,
      score: score,
      grade: grade,
      timeBonus: timeBonus,
      modaks: collected + "/" + state.modaksTotal,
      title: outcome === "win" ? "You reached Ganesha!" : outcome === "caught" ? "The cat got you!" : "Time's up!",
      sub: outcome === "win" ? state.level.name + " — cleared with " + formatTime(state.timeLeft) + " to spare" :
        outcome === "caught" ? state.level.name + " — better luck next time" : state.level.name + " — the maze got the better of you",
      icon: outcome === "win" ? "ganesha" : outcome === "caught" ? "🙀" : "⏰"
    };

    setResults(res);
    setScreen('results');
  }, []);

  const startLevel = (idx) => {
    setCurrentLevelIdx(idx);
    var level = LEVELS[idx];
    var size = level.size;
    var cells = generateMaze(size);
    braidMaze(cells, size);

    var goal = { r: Math.floor(size / 2), c: Math.floor(size / 2) };
    var playerStart = { r: 0, c: 0 };

    var distFromPlayer = bfsDistances(cells, size, playerStart.r, playerStart.c);
    var maxDist = 0;
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (distFromPlayer[r][c] > maxDist) maxDist = distFromPlayer[r][c];

    var candidates = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r === playerStart.r && c === playerStart.c) continue;
        if (r === goal.r && c === goal.c) continue;
        candidates.push({ r: r, c: c, dist: distFromPlayer[r][c] });
      }
    }

    var minSafeCatDist = Math.max(6, Math.floor(maxDist * 0.6));
    var catCandidates = candidates.filter(function (p) { return p.dist >= minSafeCatDist; });
    if (catCandidates.length === 0) {
      catCandidates = candidates.slice().sort(function (a, b) { return b.dist - a.dist; }).slice(0, 5);
    }
    var catStart = catCandidates[Math.floor(Math.random() * catCandidates.length)];

    var modakCandidates = candidates.filter(function (p) {
      return !(p.r === catStart.r && p.c === catStart.c) && p.dist >= 2;
    });
    var shuffled = shuffle(modakCandidates);
    var modakSpots = [];
    for (var i = 0; i < shuffled.length && modakSpots.length < level.modaks; i++) {
      var cand = shuffled[i];
      var tooClose = modakSpots.some(function (m) {
        return (Math.abs(m.r - cand.r) + Math.abs(m.c - cand.c)) < 2;
      });
      if (!tooClose) modakSpots.push(cand);
    }
    for (let i = 0; i < shuffled.length && modakSpots.length < level.modaks; i++) {
      if (modakSpots.indexOf(shuffled[i]) === -1) modakSpots.push(shuffled[i]);
    }

    gameStateRef.current = {
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
      catGraceTimer: 1.5,
      lastHudSec: Math.ceil(level.timer),
      lastHudModaks: 0,
      outcome: null
    };

    setIsPaused(false);
    setHud({
      timeLeft: level.timer,
      modaks: 0,
      totalModaks: modakSpots.length,
      levelName: level.name,
      warn: false
    });

    setScreen('game');
  };

  const togglePause = useCallback(() => {
    var state = gameStateRef.current;
    if (!state || !state.running) return;
    state.paused = !state.paused;
    setIsPaused(state.paused);
  }, []);

  // Game Loop Effect
  useEffect(() => {
    if (screen !== 'game') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const state = gameStateRef.current;
    if (!state) return;

    canvas.width = state.size * CELL_PX;
    canvas.height = state.size * CELL_PX;

    let lastFrameTime = performance.now();
    let cachedRect = canvas.getBoundingClientRect();

    const updateCanvasRect = () => {
      if (canvas) cachedRect = canvas.getBoundingClientRect();
    };
    window.addEventListener('resize', updateCanvasRect);
    window.addEventListener('scroll', updateCanvasRect, true);

    const canvasPointFromEvent = (e) => {
      var scaleX = canvas.width / (cachedRect.width || 1);
      var scaleY = canvas.height / (cachedRect.height || 1);
      return {
        x: (e.clientX - cachedRect.left) * scaleX,
        y: (e.clientY - cachedRect.top) * scaleY
      };
    };

    // Pointer Events
    const handlePointerDown = (e) => {
      if (!state || !state.running) return;
      e.preventDefault();
      updateCanvasRect();
      state.dragActive = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      const pt = canvasPointFromEvent(e);
      state.dragOrigin = { x: pt.x, y: pt.y };
      state.dragCurrent = { x: pt.x, y: pt.y };
      state.lastMovePt = { x: pt.x, y: pt.y };
    };

    const handlePointerMove = (e) => {
      if (!state || !state.dragActive) return;
      e.preventDefault();
      const pt = canvasPointFromEvent(e);
      const prev = state.lastMovePt || pt;
      state.dragCurrent = { x: pt.x, y: pt.y };
      state.lastMovePt = { x: pt.x, y: pt.y };

      const moveDx = pt.x - prev.x;
      const moveDy = pt.y - prev.y;

      if (state.dragOrigin) {
        if (Math.abs(moveDy) >= 2 && Math.abs(moveDy) > Math.abs(moveDx)) {
          state.dragOrigin.x = pt.x; // Clear horizontal deadband
        } else if (Math.abs(moveDx) >= 2 && Math.abs(moveDx) > Math.abs(moveDy)) {
          state.dragOrigin.y = pt.y; // Clear vertical deadband
        }

        const dx = pt.x - state.dragOrigin.x;
        const dy = pt.y - state.dragOrigin.y;
        const dist = Math.hypot(dx, dy);
        const maxLeash = 16;
        if (dist > maxLeash) {
          state.dragOrigin.x = pt.x - (dx / dist) * maxLeash;
          state.dragOrigin.y = pt.y - (dy / dist) * maxLeash;
        }
      }

      if (state.dragOrigin && state.dragCurrent) {
        const dx = state.dragCurrent.x - state.dragOrigin.x;
        const dy = state.dragCurrent.y - state.dragOrigin.y;
        if (Math.hypot(dx, dy) >= 6) {
          state.bufferedDir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
          state.bufferedTime = performance.now();
        }
      }
    };

    const handlePointerUp = () => {
      if (!state) return;
      if (state.dragActive && state.dragOrigin && state.dragCurrent) {
        const dx = state.dragCurrent.x - state.dragOrigin.x;
        const dy = state.dragCurrent.y - state.dragOrigin.y;
        if (Math.hypot(dx, dy) >= 6) {
          state.bufferedDir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
          state.bufferedTime = performance.now();
        }
      }
      state.dragActive = false;
      state.dragOrigin = null;
      state.dragCurrent = null;
      state.lastMovePt = null;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    // Keyboard Events
    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === "escape") { togglePause(); return; }
      const dir = KEY_TO_DIR[k];
      if (dir) {
        e.preventDefault();
        if (state.heldOrder.indexOf(dir) === -1) state.heldOrder.push(dir);
        state.bufferedDir = dir;
        state.bufferedTime = performance.now();
      }
    };

    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase();
      const dir = KEY_TO_DIR[k];
      if (dir) {
        const idx = state.heldOrder.indexOf(dir);
        if (idx !== -1) state.heldOrder.splice(idx, 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation Loop
    const loop = (now) => {
      if (!state || !state.running) return;
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (!state.paused) {
        state.timeLeft -= dt;

        // Throttled HUD update (only updates state when second or modaks change)
        const curSec = Math.ceil(state.timeLeft);
        const curModaks = state.modaks.filter(m => m.collected).length;
        if (curSec !== state.lastHudSec || curModaks !== state.lastHudModaks) {
          state.lastHudSec = curSec;
          state.lastHudModaks = curModaks;
          setHud({
            timeLeft: Math.max(0, curSec),
            modaks: curModaks,
            totalModaks: state.modaksTotal,
            levelName: state.level.name,
            warn: curSec <= 10
          });
        }

        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          finishLevel("timeup");
          return;
        }

        // Update Player
        const player = state.player;
        if (!player.moving) {
          const cellObj = state.cells[player.cell.r][player.cell.c];
          const dir = chooseBestDir(cellObj);
          if (dir) {
            tryStartMove(player, state.size, state.cells, dir, state.level.playerStep);
          }
        }

        if (player.moving) {
          player.moveT += dt;
          const t = Math.min(1, player.moveT / player.moveDuration);
          player.px = lerp(player.from.c, player.to.c, t) * CELL_PX + CELL_PX / 2;
          player.py = lerp(player.from.r, player.to.r, t) * CELL_PX + CELL_PX / 2;

          if (t >= 1) {
            player.cell = { r: player.to.r, c: player.to.c };
            player.px = player.cell.c * CELL_PX + CELL_PX / 2;
            player.py = player.cell.r * CELL_PX + CELL_PX / 2;
            player.moving = false;
            player.from = null;
            player.to = null;

            // Modak pickup
            for (let i = 0; i < state.modaks.length; i++) {
              let m = state.modaks[i];
              if (!m.collected && m.r === player.cell.r && m.c === player.cell.c) {
                m.collected = true;
                state.floatingTexts.push({ x: player.px, y: player.py, life: 0.9, text: "+100" });
              }
            }

            // Goal reached check
            if (player.cell.r === state.goal.r && player.cell.c === state.goal.c) {
              finishLevel("win");
              return;
            }

            // Smooth step continuation
            const nextCellObj = state.cells[player.cell.r][player.cell.c];
            const nextDir = chooseBestDir(nextCellObj);
            if (nextDir && tryStartMove(player, state.size, state.cells, nextDir, state.level.playerStep)) {
              const leftover = Math.max(0, player.moveT - player.moveDuration);
              player.moveT = Math.min(leftover, player.moveDuration * 0.5);
            }
          }
        }

        // Update Cat (with 1.5s grace period at start of level)
        if (state.catGraceTimer > 0) {
          state.catGraceTimer -= dt;
        } else {
          const cat = state.cat;
          if (!cat.moving) {
            const target = state.player.cell;
            const useMistake = Math.random() < state.level.catMistake;
            let nextCell = null;

            if (!useMistake) {
              const path = bfsPath(state.cells, state.size, cat.cell.r, cat.cell.c, target.r, target.c);
              if (path && path.length > 1) {
                nextCell = { r: path[1][0], c: path[1][1] };
              }
            }
            if (!nextCell) {
              const dirKeys = shuffle(["N", "E", "S", "W"]);
              for (let i = 0; i < dirKeys.length; i++) {
                const dk = dirKeys[i];
                const cellObj = state.cells[cat.cell.r][cat.cell.c];
                if (!cellObj.walls[dk]) {
                  const v = DIR_VECTORS[dk];
                  const nr = cat.cell.r + v.dr, nc = cat.cell.c + v.dc;
                  if (nr >= 0 && nr < state.size && nc >= 0 && nc < state.size) {
                    nextCell = { r: nr, c: nc };
                    break;
                  }
                }
              }
            }
            if (nextCell) {
              const dr = nextCell.r - cat.cell.r, dc = nextCell.c - cat.cell.c;
              const dir = dr === -1 ? "N" : dr === 1 ? "S" : dc === 1 ? "E" : "W";
              tryStartMove(cat, state.size, state.cells, dir, state.level.catStep);
            }
          }

          if (cat.moving) {
            cat.moveT += dt;
            const t = Math.min(1, cat.moveT / cat.moveDuration);
            cat.px = lerp(cat.from.c, cat.to.c, t) * CELL_PX + CELL_PX / 2;
            cat.py = lerp(cat.from.r, cat.to.r, t) * CELL_PX + CELL_PX / 2;
            if (t >= 1) {
              cat.moving = false;
              cat.cell = { r: cat.to.r, c: cat.to.c };
              cat.px = cat.cell.c * CELL_PX + CELL_PX / 2;
              cat.py = cat.cell.r * CELL_PX + CELL_PX / 2;
              cat.from = null;
              cat.to = null;
            }
          }
        }

        // Catch proximity check (active only after grace period)
        if (state.catGraceTimer <= 0) {
          const dx = state.player.px - state.cat.px;
          const dy = state.player.py - state.cat.py;
          if (Math.hypot(dx, dy) < CELL_PX * CATCH_DIST_FACTOR) {
            finishLevel("caught");
            return;
          }
        }

        // Floating texts
        for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
          state.floatingTexts[i].life -= dt;
          if (state.floatingTexts[i].life <= 0) state.floatingTexts.splice(i, 1);
        }
      }

      // Render
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Floor checkerboard
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          ctx.fillStyle = ((r + c) % 2 === 0) ? "#241108" : "#2a1409";
          ctx.fillRect(c * CELL_PX, r * CELL_PX, CELL_PX, CELL_PX);
        }
      }

      // Goal glow
      state.goalPulse += 0.05;
      const glowR = CELL_PX * 1.6 + Math.sin(state.goalPulse) * 4;
      const gx = state.goal.c * CELL_PX + CELL_PX / 2;
      const gy = state.goal.r * CELL_PX + CELL_PX / 2;
      const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, glowR);
      grad.addColorStop(0, "rgba(255,201,74,0.55)");
      grad.addColorStop(1, "rgba(255,201,74,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Walls
      ctx.strokeStyle = "#ffc94a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          const cell = state.cells[r][c];
          const x0 = c * CELL_PX, y0 = r * CELL_PX, x1 = x0 + CELL_PX, y1 = y0 + CELL_PX;
          ctx.beginPath();
          if (cell.walls.N) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
          if (cell.walls.W) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
          if (r === state.size - 1 && cell.walls.S) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
          if (c === state.size - 1 && cell.walls.E) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
          ctx.stroke();
        }
      }

      // Modaks
      ctx.font = (CELL_PX * 0.62) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      state.modaks.forEach(m => {
        if (!m.collected) {
          ctx.fillText("🥟", m.c * CELL_PX + CELL_PX / 2, m.r * CELL_PX + CELL_PX / 2);
        }
      });

      // Goal face
      drawGaneshaFace(ctx, gx, gy, CELL_PX * 0.62);

      // Floating texts
      ctx.font = "bold " + (CELL_PX * 0.45) + "px sans-serif";
      ctx.fillStyle = "#ffdd8a";
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillText(ft.text, ft.x, ft.y - (0.9 - ft.life) * 26);
      }
      ctx.globalAlpha = 1;

      // Cat & Rat
      ctx.font = (CELL_PX * 0.78) + "px sans-serif";
      ctx.fillText("🐱", state.cat.px, state.cat.py);
      ctx.fillText("🐭", state.player.px, state.player.py);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', updateCanvasRect);
      window.removeEventListener('scroll', updateCanvasRect, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [screen, chooseBestDir, finishLevel, togglePause]);

  return (
    <div className="mooshika-app">
      {/* ============ START / LEVEL SELECT SCREEN ============ */}
      {screen === 'start' && (
        <section className="screen active" id="screen-start">
          <div className="hero">
            <div className="eyebrow"><span className="dot"></span> GANESH CHATURTHI GAME DESIGN CONTEST</div>
            <h1>🐭 Vahana Rush</h1>
            <p className="tagline">Guide Ganesha's vahana through the maze, gather modaks, dodge the cat, and reach Ganesha at the centre before the clock runs out.</p>
          </div>

          <div className="howto">
            <h3>How to play</h3>
            <div className="howto-grid">
              <div className="key-chip"><span className="icon">👆</span>Move<span className="key">Drag / Arrows</span></div>
              <div className="key-chip"><span className="icon">🥟</span>Modak<span className="key">+100 pts</span></div>
              <div className="key-chip"><span className="icon">🐱</span>Cat<span className="key">Avoid!</span></div>
              <div className="key-chip"><span className="icon ganesha-chip-icon"><GaneshaIcon /></span>Ganesha<span className="key">Goal</span></div>
            </div>
            <small>Touch and drag to steer the mouse through the corridors. On desktop, you can also use the arrow keys or WASD. Collect modaks along the way for bonus points, but don't let the cat catch you and don't let the timer hit zero. Reach the glowing Ganesha at the centre to win.</small>
          </div>

          <h3 style={{ margin: "22px 4px 4px", color: "var(--cream)" }}>Choose your maze</h3>
          <div className="levels">
            {LEVELS.map((lvl, idx) => {
              const stars = "★".repeat(lvl.stars) + "☆".repeat(3 - lvl.stars);
              const best = bestScores[lvl.key];
              return (
                <button
                  key={lvl.key}
                  className="level-card"
                  type="button"
                  onClick={() => startLevel(idx)}
                >
                  <div className="num">MAZE {idx + 1}</div>
                  <h4>{lvl.name}</h4>
                  <p>{lvl.subtitle}</p>
                  <div className="stars">{stars}</div>
                  <div className="meta-row">
                    <span>{lvl.size}×{lvl.size} grid</span>
                    <span>{lvl.timer}s</span>
                    <span>{lvl.modaks} modaks</span>
                  </div>
                  {best && (
                    <div className="best-score">
                      Best score: <b>{best.score}</b> · {best.grade}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <footer className="note">
            Built with React JS • Zero external HTML dependencies • 100% Client-Side
          </footer>
        </section>
      )}

      {/* ============ GAMEPLAY SCREEN ============ */}
      {screen === 'game' && (
        <section className="screen active" id="screen-game">
          <div className="hud">
            <div className="lvl-name">{hud.levelName}</div>
            <div className="stat">
              <span className="label">TIME</span>
              <span className={`value ${hud.warn ? 'timer-warn' : ''}`}>{formatTime(hud.timeLeft)}</span>
            </div>
            <div className="stat">
              <span className="label">MODAKS</span>
              <span className="value">{hud.modaks}/{hud.totalModaks}</span>
            </div>
            <button className="pause-btn" onClick={togglePause}>⏸ Pause</button>
          </div>

          <div className="stage-wrap">
            <canvas ref={canvasRef} id="mazeCanvas" />

            {isPaused && (
              <div className="overlay">
                <h2>⏸ Paused</h2>
                <p>Take a breath. Ganesha (and the cat) will wait.</p>
                <div className="results-actions">
                  <button className="btn btn-primary" onClick={togglePause}>Resume</button>
                  <button className="btn btn-ghost" onClick={() => setScreen('start')}>Quit to menu</button>
                </div>
              </div>
            )}
          </div>

          {/* Bigger Lower-Center Mobile D-Pad Controls */}
          <div className="dpad-container" aria-label="On-Screen Arrow Controls">
            <div className="dpad-grid">
              <div className="dpad-cell" />
              <button
                type="button"
                className={`dpad-btn dpad-up ${activeDpadDir === 'N' ? 'active' : ''}`}
                aria-label="Move Up"
                onPointerDown={(e) => handleDpadDown(e, 'N')}
                onPointerUp={(e) => handleDpadUp(e, 'N')}
                onPointerCancel={(e) => handleDpadUp(e, 'N')}
                onPointerLeave={(e) => handleDpadUp(e, 'N')}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4l-8 8h5v8h6v-8h5z" />
                </svg>
              </button>
              <div className="dpad-cell" />

              <button
                type="button"
                className={`dpad-btn dpad-left ${activeDpadDir === 'W' ? 'active' : ''}`}
                aria-label="Move Left"
                onPointerDown={(e) => handleDpadDown(e, 'W')}
                onPointerUp={(e) => handleDpadUp(e, 'W')}
                onPointerCancel={(e) => handleDpadUp(e, 'W')}
                onPointerLeave={(e) => handleDpadUp(e, 'W')}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 12l8-8v5h8v6h-8v5z" />
                </svg>
              </button>

              <div className="dpad-center-hub" aria-hidden="true">
                <span>🐭</span>
              </div>

              <button
                type="button"
                className={`dpad-btn dpad-right ${activeDpadDir === 'E' ? 'active' : ''}`}
                aria-label="Move Right"
                onPointerDown={(e) => handleDpadDown(e, 'E')}
                onPointerUp={(e) => handleDpadUp(e, 'E')}
                onPointerCancel={(e) => handleDpadUp(e, 'E')}
                onPointerLeave={(e) => handleDpadUp(e, 'E')}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 12l-8-8v5h-8v6h8v5z" />
                </svg>
              </button>

              <div className="dpad-cell" />
              <button
                type="button"
                className={`dpad-btn dpad-down ${activeDpadDir === 'S' ? 'active' : ''}`}
                aria-label="Move Down"
                onPointerDown={(e) => handleDpadDown(e, 'S')}
                onPointerUp={(e) => handleDpadUp(e, 'S')}
                onPointerCancel={(e) => handleDpadUp(e, 'S')}
                onPointerLeave={(e) => handleDpadUp(e, 'S')}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 20l8-8h-5v-8h-6v8h-5z" />
                </svg>
              </button>
              <div className="dpad-cell" />
            </div>
          </div>

          <div className="drag-hint">
            👆 Use the big arrow buttons &nbsp;·&nbsp; touch & drag &nbsp;·&nbsp; or <span className="kbd">WASD</span>
          </div>

          <div className="game-actions">
            <button className="link-btn" onClick={() => setScreen('start')}>Quit to maze select</button>
          </div>
        </section>
      )}

      {/* ============ RESULTS SCREEN ============ */}
      {screen === 'results' && (
        <section className="screen active" id="screen-results">
          <div className="results-card">
            <div className="results-icon">
              {results.icon === 'ganesha' ? <GaneshaIcon /> : results.icon}
            </div>
            <h2>{results.title}</h2>
            <p className="sub">{results.sub}</p>
            <div className="grade">{results.grade}</div>
            <div className="stat-row">
              <div className="s"><div className="v">{results.modaks}</div><div className="l">MODAKS</div></div>
              <div className="s"><div className="v">{results.timeBonus}</div><div className="l">TIME BONUS</div></div>
              <div className="s"><div className="v">{results.score}</div><div className="l">SCORE</div></div>
            </div>
            <div className="results-actions">
              <button className="btn btn-primary" onClick={() => startLevel(currentLevelIdx)}>Play again</button>
              <button className="btn btn-ghost" onClick={() => setScreen('start')}>Choose another maze</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
