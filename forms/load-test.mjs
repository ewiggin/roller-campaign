#!/usr/bin/env node
/**
 * Load test para Apps Script — mide cuántas peticiones concurrentes aguanta.
 *
 * Uso:
 *   node load-test.mjs
 *   TOTAL=200 CODE=ABC123 node load-test.mjs
 *   URL=$URL_VOLUNTEERS TOTAL=50 node load-test.mjs
 *
 * Variables de entorno:
 *   URL         URL del Apps Script (default: form-guests)
 *   CODE        Código a validar — puede no existir, solo prueba la carga (default: LOAD_TEST)
 *   TOTAL       Total de peticiones a lanzar (default: 100)
 *   CONCURRENCY Peticiones en vuelo a la vez; 0 = todas simultáneas (default: 0)
 *   TIMEOUT     Timeout por petición en ms (default: 30000)
 */

const GUESTS_URL =
  "https://script.google.com/macros/s/AKfycby9VOY3U3kswCIDsj73NQAKEb9qRKYhF6EG4ShgGcu65b5bcwxJVsivFx28ZcmB756K/exec";
const VOLUNTEER_URL =
  "https://script.google.com/macros/s/AKfycbyk1VHnFwy0hC1IDm94jsf4SBfmBcocnKPeJgCUMGUoLGy_cawzOlTg6Ndht81dC-X_/exec";

const FORM = process.env.FORM || "guests";
const SCRIPT_URL =
  process.env.URL || (FORM === "volunteer" ? VOLUNTEER_URL : GUESTS_URL);
const CODE = process.env.CODE || "LOAD_TEST";
const TOTAL = parseInt(process.env.TOTAL || "100", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "0", 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT || "30000", 10);

// ─── petición individual ───────────────────────────────────────────────────

async function singleRequest(id) {
  const url = `${SCRIPT_URL}?codigo=${encodeURIComponent(CODE)}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const elapsed = Date.now() - start;
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* respuesta no-JSON */
    }

    return { id, ok: res.ok, status: res.status, elapsed, body };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = err.name === "AbortError";
    return {
      id,
      ok: false,
      status: isTimeout ? "TIMEOUT" : "NET_ERROR",
      elapsed,
      error: err.message,
    };
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────

const pct = (n, t) => ((n / t) * 100).toFixed(0);
const fmt = (ms) => (ms / 1000).toFixed(2) + "s";
const bar = (done, total, w = 30) => {
  const f = Math.round((done / total) * w);
  return "[" + "█".repeat(f) + "░".repeat(w - f) + "]";
};

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── ejecución ────────────────────────────────────────────────────────────

async function runBurst(total) {
  let done = 0;
  const promises = Array.from({ length: total }, (_, i) =>
    singleRequest(i).then((r) => {
      done++;
      process.stdout.write(`\r  ${bar(done, total)} ${done}/${total}`);
      return r;
    }),
  );
  return Promise.all(promises);
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

  const workers = Array.from({ length: Math.min(concurrency, total) }, worker);
  await Promise.all(workers);
  return results;
}

async function run() {
  const mode =
    CONCURRENCY > 0
      ? `pool de ${CONCURRENCY} concurrentes`
      : "todas simultáneas";

  console.log(`\nDisparando ${TOTAL} peticiones (${mode})`);
  console.log(`FORM:     ${FORM}`);
  console.log(`URL:     ${SCRIPT_URL}`);
  console.log(`Código:  ${CODE}`);
  console.log(`Timeout: ${TIMEOUT_MS / 1000}s\n`);

  const t0 = Date.now();
  const results =
    CONCURRENCY > 0 ? await runPool(TOTAL, CONCURRENCY) : await runBurst(TOTAL);
  const wallMs = Date.now() - t0;

  console.log("\n");

  const successes = results.filter((r) => r.ok);
  const timeouts = results.filter((r) => r.status === "TIMEOUT");
  const netErrors = results.filter((r) => r.status === "NET_ERROR");
  const httpErrors = results.filter(
    (r) => !r.ok && r.status !== "TIMEOUT" && r.status !== "NET_ERROR",
  );

  const times = results.map((r) => r.elapsed).sort((a, b) => a - b);

  const statusCounts = {};
  for (const r of httpErrors) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  const SEP = "─".repeat(46);

  console.log("RESULTADOS");
  console.log(SEP);
  console.log(`  Total:            ${TOTAL}`);
  console.log(
    `  Éxitos:           ${successes.length.toString().padStart(4)}  (${pct(successes.length, TOTAL)}%)`,
  );
  console.log(
    `  Errores HTTP:     ${httpErrors.length.toString().padStart(4)}  (${pct(httpErrors.length, TOTAL)}%)`,
  );
  console.log(
    `  Timeouts (>${(TIMEOUT_MS / 1000).toFixed(0)}s): ${timeouts.length.toString().padStart(4)}  (${pct(timeouts.length, TOTAL)}%)`,
  );
  console.log(
    `  Errores de red:   ${netErrors.length.toString().padStart(4)}  (${pct(netErrors.length, TOTAL)}%)`,
  );
  console.log(`  Tiempo total:     ${fmt(wallMs)}`);

  console.log("\nTIEMPOS DE RESPUESTA");
  console.log(SEP);
  console.log(`  Mínimo:   ${fmt(times[0])}`);
  console.log(`  Mediana:  ${fmt(percentile(times, 50))}`);
  console.log(`  p75:      ${fmt(percentile(times, 75))}`);
  console.log(`  p90:      ${fmt(percentile(times, 90))}`);
  console.log(`  p99:      ${fmt(percentile(times, 99))}`);
  console.log(`  Máximo:   ${fmt(times[times.length - 1])}`);

  if (Object.keys(statusCounts).length > 0) {
    console.log("\nERRORES HTTP");
    console.log(SEP);
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  HTTP ${status}: ${count}`);
    }
  }

  if (netErrors.length > 0) {
    const sample = netErrors
      .slice(0, 3)
      .map((r) => r.error)
      .join("\n    ");
    console.log("\nERRORES DE RED (muestra)");
    console.log(SEP);
    console.log(`    ${sample}`);
  }

  console.log();

  // Diagnóstico rápido
  const failRate = (TOTAL - successes.length) / TOTAL;
  if (failRate === 0) {
    console.log("✓ Sin errores. Apps Script aguantó esta carga.\n");
  } else if (failRate < 0.05) {
    console.log(
      `⚠ ${pct(failRate * 100, 100)}% de fallos — Apps Script empieza a saturarse.\n`,
    );
  } else {
    console.log(
      `✗ ${pct(failRate * 100, 100)}% de fallos — Apps Script no aguanta esta carga.\n`,
    );
  }
}

run().catch(console.error);
