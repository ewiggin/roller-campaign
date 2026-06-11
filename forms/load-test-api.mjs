#!/usr/bin/env node
/**
 * Stress test para roller-backend — endpoints públicos de form-guests.
 *
 * Modos:
 *   read  → GET  /api/guest-access/lookup?code=X  (sin auth)
 *   write → PATCH /api/guest-access/submit?code=X  (sin auth, escribe en BD)
 *
 * Uso:
 *   node load-test-api.mjs
 *   MODE=write CODE=ABCD-1234 TOTAL=50 node load-test-api.mjs
 *   CSV=codes.csv TOTAL=200 CONCURRENCY=20 node load-test-api.mjs
 *   BASE_URL=https://roller-api-staging.up.railway.app/api TOTAL=200 CONCURRENCY=20 node load-test-api.mjs
 *   CODES=AAAA-1111,BBBB-2222,CCCC-3333 TOTAL=300 CONCURRENCY=30 node load-test-api.mjs
 *
 * Variables de entorno:
 *   BASE_URL    Raíz de la API             (default: http://localhost:3000/api)
 *   MODE        'read' | 'write'           (default: read)
 *   CSV         Ruta a un CSV con códigos  — una columna llamada 'code' o 'guest_code',
 *               o simplemente una columna por fila sin cabecera
 *   CODE        Un único código            (default: LOAD-TEST — para read, 404 es OK)
 *   CODES       Códigos separados por ","  — se reparten en round-robin entre las peticiones
 *   TOTAL       Nº de peticiones           (default: 100, o nº de filas del CSV si se omite)
 *   CONCURRENCY Pool de workers; 0 = burst simultáneo (default: 20)
 *   TIMEOUT     Timeout por petición en ms (default: 10000)
 *
 * AVISO — modo write: escribe datos de prueba en la BD con los códigos indicados.
 * Usa códigos reales que existan o el 100% de peticiones devolverá 404.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadCodesFromCsv(filePath) {
  const text = readFileSync(resolve(filePath), "utf8");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detecta si la primera línea es cabecera buscando columnas conocidas
  const header = lines[0].toLowerCase();
  const colNames = ["guest_code", "code", "codigo", "código"];
  const headerMatch = colNames.find((c) => header.includes(c));

  if (headerMatch) {
    const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
    const idx = cols.findIndex((c) => colNames.includes(c));
    return lines.slice(1).map((l) => l.split(",")[idx]?.trim()).filter(Boolean);
  }

  // Sin cabecera: primera columna de cada fila
  return lines.map((l) => l.split(",")[0].trim()).filter(Boolean);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000/api";
const MODE = process.env.MODE || "read";

let CODES;
if (process.env.CSV) {
  CODES = loadCodesFromCsv(process.env.CSV);
  if (CODES.length === 0) {
    console.error(`\nError: el CSV '${process.env.CSV}' no contiene códigos válidos.\n`);
    process.exit(1);
  }
} else {
  CODES = process.env.CODES
    ? process.env.CODES.split(",").map((c) => c.trim())
    : [process.env.CODE || "LOAD-TEST"];
}
const TOTAL = process.env.TOTAL
  ? parseInt(process.env.TOTAL, 10)
  : process.env.CSV
    ? CODES.length
    : 100;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "20", 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT || "10000", 10);

if (MODE !== "read" && MODE !== "write") {
  console.error(`\nError: MODE debe ser 'read' o 'write'. Recibido: '${MODE}'\n`);
  process.exit(1);
}

// ─── código por petición (round-robin) ───────────────────────────────────────

function codeFor(i) {
  return CODES[i % CODES.length];
}

// ─── payload de prueba para PATCH /submit ────────────────────────────────────

function submitPayload(i) {
  return {
    full_name: `Test Usuario ${i}`,
    email: `stress${i}@prueba.com`,
    origin_city: "Ciudad de Prueba",
    car_seats: i % 4,
    speaks_english: i % 2 === 0,
    other_languages: null,
    real_arrival: "2026-07-01",
    real_arrival_time: "10:00",
    real_departure: "2026-07-08",
    real_departure_time: "18:00",
    hosting_address: "Calle Test 1, Ciudad de Prueba",
    lat: 40.4168,
    lng: -3.7038,
    transport_mode: "Coche",
    arrival_other_transport: null,
    arrival_flight: null,
    needs_airport_transfer: false,
    terms_accepted: true,
    terms_version: "1.0",
  };
}

// ─── petición individual ──────────────────────────────────────────────────────

async function singleRequest(i) {
  const code = codeFor(i);
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res;
    if (MODE === "read") {
      res = await fetch(
        `${BASE_URL}/guest-access/lookup?code=${encodeURIComponent(code)}`,
        { signal: controller.signal },
      );
    } else {
      res = await fetch(
        `${BASE_URL}/guest-access/submit?code=${encodeURIComponent(code)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitPayload(i)),
          signal: controller.signal,
        },
      );
    }
    clearTimeout(timer);

    const elapsed = Date.now() - start;
    // 204 No Content es éxito en submit; 200 en lookup; 404 = código no existe
    const ok = res.ok;
    return { i, code, ok, status: res.status, elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = err.name === "AbortError";
    return {
      i,
      code,
      ok: false,
      status: isTimeout ? "TIMEOUT" : "NET_ERROR",
      elapsed,
      error: err.message,
    };
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const pct = (n, t) => ((n / t) * 100).toFixed(0);
const fmt = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + "s" : ms + "ms");
const bar = (done, total, w = 30) => {
  const f = Math.round((done / total) * w);
  return "[" + "█".repeat(f) + "░".repeat(w - f) + "]";
};

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── modos de ejecución ───────────────────────────────────────────────────────

async function runBurst(total) {
  let done = 0;
  return Promise.all(
    Array.from({ length: total }, (_, i) =>
      singleRequest(i).then((r) => {
        done++;
        process.stdout.write(`\r  ${bar(done, total)} ${done}/${total}`);
        return r;
      }),
    ),
  );
}

async function runPool(total, concurrency) {
  const results = [];
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < total) {
      const id = next++;
      const r = await singleRequest(id);
      results.push(r);
      done++;
      process.stdout.write(`\r  ${bar(done, total)} ${done}/${total}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return results;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const modeLabel = MODE === "read" ? "GET /lookup" : "PATCH /submit";
  const concLabel =
    CONCURRENCY > 0 ? `pool de ${CONCURRENCY} workers` : "burst (todas simultáneas)";
  const codesLabel = process.env.CSV
    ? `${CODES.length} códigos de ${process.env.CSV}`
    : CODES.length === 1
      ? CODES[0]
      : `${CODES.length} códigos en round-robin`;

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Roller Backend — Stress test`);
  console.log(`${"─".repeat(50)}`);
  console.log(`  Modo:        ${modeLabel}`);
  console.log(`  Base URL:    ${BASE_URL}`);
  console.log(`  Códigos:     ${codesLabel}`);
  console.log(`  Peticiones:  ${TOTAL}`);
  console.log(`  Concurrencia: ${concLabel}`);
  console.log(`  Timeout:     ${TIMEOUT_MS / 1000}s`);

  if (MODE === "write") {
    console.log(`\n  ⚠  MODO ESCRITURA — se guardarán datos de prueba en la BD.`);
    console.log(`     Usa códigos reales o todas las peticiones devolverán 404.`);
  }

  console.log();

  const t0 = Date.now();
  const results =
    CONCURRENCY > 0 ? await runPool(TOTAL, CONCURRENCY) : await runBurst(TOTAL);
  const wallMs = Date.now() - t0;

  console.log("\n");

  // ── clasificación de resultados ──────────────────────────────────────────
  const successes = results.filter((r) => r.ok);
  const notFound = results.filter((r) => r.status === 404);
  const timeouts = results.filter((r) => r.status === "TIMEOUT");
  const netErrors = results.filter((r) => r.status === "NET_ERROR");
  const httpErrors = results.filter(
    (r) =>
      !r.ok &&
      r.status !== 404 &&
      r.status !== "TIMEOUT" &&
      r.status !== "NET_ERROR",
  );

  const times = results.map((r) => r.elapsed).sort((a, b) => a - b);
  const successTimes = results
    .filter((r) => r.ok)
    .map((r) => r.elapsed)
    .sort((a, b) => a - b);

  const statusCounts = {};
  for (const r of httpErrors) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  const SEP = "─".repeat(50);

  console.log("RESULTADOS");
  console.log(SEP);
  console.log(`  Total:              ${TOTAL}`);
  console.log(
    `  Éxitos:             ${successes.length.toString().padStart(4)}  (${pct(successes.length, TOTAL)}%)`,
  );
  if (notFound.length > 0) {
    console.log(
      `  404 Not Found:      ${notFound.length.toString().padStart(4)}  (${pct(notFound.length, TOTAL)}%) — códigos no existen`,
    );
  }
  console.log(
    `  Errores HTTP:       ${httpErrors.length.toString().padStart(4)}  (${pct(httpErrors.length, TOTAL)}%)`,
  );
  console.log(
    `  Timeouts (>${(TIMEOUT_MS / 1000).toFixed(0)}s):   ${timeouts.length.toString().padStart(4)}  (${pct(timeouts.length, TOTAL)}%)`,
  );
  console.log(
    `  Errores de red:     ${netErrors.length.toString().padStart(4)}  (${pct(netErrors.length, TOTAL)}%)`,
  );
  console.log(`  Tiempo total:       ${fmt(wallMs)}`);
  console.log(
    `  Throughput:         ${((TOTAL / wallMs) * 1000).toFixed(1)} req/s`,
  );

  if (times.length > 0) {
    console.log("\nTIEMPOS (todas las peticiones)");
    console.log(SEP);
    console.log(`  Mínimo:   ${fmt(times[0])}`);
    console.log(`  Mediana:  ${fmt(percentile(times, 50))}`);
    console.log(`  p75:      ${fmt(percentile(times, 75))}`);
    console.log(`  p90:      ${fmt(percentile(times, 90))}`);
    console.log(`  p99:      ${fmt(percentile(times, 99))}`);
    console.log(`  Máximo:   ${fmt(times[times.length - 1])}`);
  }

  if (successTimes.length > 0 && successTimes.length < times.length) {
    console.log("\nTIEMPOS (solo éxitos)");
    console.log(SEP);
    console.log(`  Mediana:  ${fmt(percentile(successTimes, 50))}`);
    console.log(`  p90:      ${fmt(percentile(successTimes, 90))}`);
    console.log(`  p99:      ${fmt(percentile(successTimes, 99))}`);
  }

  if (Object.keys(statusCounts).length > 0) {
    console.log("\nERRORES HTTP");
    console.log(SEP);
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  HTTP ${status}: ${count}`);
    }
  }

  if (netErrors.length > 0) {
    const sample = [...new Set(netErrors.slice(0, 3).map((r) => r.error))].join(
      "\n    ",
    );
    console.log("\nERRORES DE RED (muestra)");
    console.log(SEP);
    console.log(`    ${sample}`);
  }

  // ── diagnóstico ───────────────────────────────────────────────────────────
  const realErrors = TOTAL - successes.length - notFound.length;
  const failRate = realErrors / TOTAL;

  console.log(`\n${"─".repeat(50)}`);
  if (failRate === 0 && notFound.length === 0) {
    console.log("✓ Sin errores. La API aguantó esta carga sin problemas.");
  } else if (failRate === 0 && notFound.length > 0) {
    console.log(
      `✓ Sin errores de servidor. ${notFound.length} peticiones con código no existente (404).`,
    );
    console.log(
      `  Usa CODES=<códigos reales> para evitar los 404 en el test de escritura.`,
    );
  } else if (failRate < 0.01) {
    console.log(`⚠ ${pct(failRate * 100, 100)}% de errores reales — casi perfecto.`);
  } else if (failRate < 0.05) {
    console.log(
      `⚠ ${pct(failRate * 100, 100)}% de errores — la API empieza a saturarse.`,
    );
  } else {
    console.log(
      `✗ ${pct(failRate * 100, 100)}% de errores — la API no aguanta esta carga.`,
    );
  }
  console.log();
}

run().catch(console.error);
