# 🐭 Vahana Rush — Race to Ganesha (React JS)

A fast, responsive maze game built with **React 19** and **Vite 6** for the Vinayaka Chaturthi Game Design Contest.

Guide Ganesha's mount (**Mooshika**) through a procedurally generated braided maze, collect modaks, dodge the pathfinding cat, and reach Lord Ganesha at the center before the clock runs out.

---

## 🎮 Features

- **Pure React 19 + Vite 6**: Completely rewritten into modular React components with zero legacy HTML game scripts.
- **Braided Maze Generation**: 100% dead-end free mazes with looping corridors and bypass paths for fluid escape routes.
- **Calibrated Drag Controls**: Real-time sliding leash with dual-threshold deadband detection for lag-free touch and mouse steering.
- **Desktop Controls**: Full keyboard support (`Arrow keys` / `WASD`) with turn buffering.
- **BFS Cat Pathfinding**: Intelligent cat AI with mistake probabilities calibrated across 3 difficulty tiers.
- **Ganesha Art & Theme**: Hand-crafted vector SVG Ganesha art, glowing golden aura, and warm temple festival color palette.
- **Throttled React HUD**: High-performance 60fps canvas engine with decoupled state updates.

---

## 📁 Project Structure

```
mooshika-maze-project/
├── index.html              # Vite entry page (<div id="root"></div>)
├── package.json            # React 19, Vite 6, and dependencies
├── vite.config.js          # Vite config with --host support
├── .gitignore              # Ignores node_modules, dist, logs
├── README.md               # Project documentation
├── icons/                  # PWA icons and favicons
└── src/
    ├── main.jsx            # React 19 root entry
    ├── App.jsx             # Top-level shell
    ├── MooshikaMaze.jsx    # Standalone, self-contained game component
    └── MooshikaMaze.css    # Responsive layout & temple design tokens
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

To access on mobile via local network:
```bash
npm run dev -- --host
```

### 3. Production Build
```bash
npm run build
```
Build output is generated into the `dist/` directory.

---

## 🕹️ Controls

| Control | Action |
|---|---|
| **Mouse / Touch Drag** | Drag to steer Mooshika smoothly through corridors |
| **Arrow Keys / WASD** | Move Up / Down / Left / Right |
| **Escape / Pause Button** | Pause / Resume the game |
