// Menyalin Stockfish WASM (single-thread) dari node_modules ke public/stockfish sebagai stockfish.js + stockfish.wasm
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("node_modules/stockfish");
const out = path.resolve("public/stockfish");
fs.mkdirSync(out, { recursive: true });

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];

const files = walk(root).filter((f) => /single/.test(path.basename(f)) && !/no-simd/.test(f));
const js = files.find((f) => f.endsWith(".js"));
const wasm = files.find((f) => f.endsWith(".wasm"));
if (!js || !wasm) {
  console.warn("[stockfish] file single-thread tidak ditemukan di node_modules/stockfish — cek versi paket.");
  process.exit(0);
}
fs.copyFileSync(js, path.join(out, "stockfish.js"));
fs.copyFileSync(wasm, path.join(out, "stockfish.wasm"));
console.log("[stockfish] OK:", path.basename(js), "+", path.basename(wasm));
