#!/usr/bin/env node

// sfruttiamo CommonJS qua dentro
const { spawnSync, spawn } = require("child_process");

// 1) calcola l’hash corrente (HEAD) di Git
let hash = "";
try {
  hash = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
} catch (e) {
  console.warn("⚠️ impossibile calcolare git rev-parse, usiamo stringa vuota");
}

// 2) passa l’hash a Parcel
process.env.PARCEL_BUILD_COMMIT_HASH = hash;

// 3) lancia Parcel tramite npx (così lo trova nella tua local node_modules)
const args = ["parcel", "--watch-dir", "..", "index.html"];
const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true, // <— questo permette di risolvere correttamente il comando
});

child.on("exit", (code) => process.exit(code));
