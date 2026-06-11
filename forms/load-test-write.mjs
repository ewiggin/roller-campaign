#!/usr/bin/env node
/**
 * Load test de ESCRITURA para Apps Script — mide cuántas peticiones POST aguanta.
 *
 * Uso:
 *   FILA=5 node load-test-write.mjs
 *   FILA_START=5 FILA_END=10 TOTAL=100 node load-test-write.mjs
 *   FORM=volunteer FILA=5 TOTAL=50 node load-test-write.mjs
 *
 * Variables de entorno:
 *   FORM        'guests' (default) | 'volunteer'
 *   URL         URL del Apps Script (sobreescribe FORM)
 *   FILA        Fila concreta donde escribir (todas las peticiones van a la misma fila)
 *   FILA_START  Inicio del rango de filas (las peticiones se reparten entre FILA_START..FILA_END)
 *   FILA_END    Fin del rango de filas
 *   TOTAL       Total de peticiones (default: 50)
 *   CONCURRENCY Peticiones en vuelo a la vez; 0 = todas simultáneas (default: 0)
 *   TIMEOUT     Timeout por petición en ms (default: 30000)
 *
 * IMPORTANTE: este script escribe datos de prueba en las filas indicadas del Sheet.
 * Borra manualmente esas filas (columnas extra) cuando termines.
 */

const GUESTS_URL =
  "https://script.google.com/macros/s/AKfycby9VOY3U3kswCIDsj73NQAKEb9qRKYhF6EG4ShgGcu65b5bcwxJVsivFx28ZcmB756K/exec";
const VOLUNTEER_URL =
  "https://script.google.com/macros/s/AKfycbyk1VHnFwy0hC1IDm94jsf4SBfmBcocnKPeJgCUMGy_cawzOlTg6Ndht81dC-X_/exec";

const FORM = process.env.FORM || "guests";
const SCRIPT_URL =
  process.env.URL || (FORM === "volunteer" ? VOLUNTEER_URL : GUESTS_URL);
const TOTAL = parseInt(process.env.TOTAL || "50", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "0", 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT || "30000", 10);

// Resolución de filas
const FILA_FIXED = process.env.FILA ? parseInt(process.env.FILA, 10) : null;
const FILA_START = process.env.FILA_START
  ? parseInt(process.env.FILA_START, 10)
  : null;
const FILA_END = process.env.FILA_END
  ? parseInt(process.env.FILA_END, 10)
  : null;

if (!FILA_FIXED && !(FILA_START && FILA_END)) {
  console.error("\nError: debes indicar FILA o FILA_START + FILA_END.");
  console.error("Ejemplo: FILA=5 node load-test-write.mjs\n");
  process.exit(1);
}

function resolveFilaForRequest(i) {
  if (FILA_FIXED) return FILA_FIXED;
  const range = FILA_END - FILA_START + 1;
  return FILA_START + (i % range);
}

// ─── payloads de prueba ───────────────────────────────────────────────────

function guestPayload(fila, i) {
  return {
    fila,
    nombreCompleto: `Test Usuario ${i}`,
    ciudadOrigen: "Ciudad de Prueba",
    plazasCoche: 2,
    hablaIngles: "No",
    fechaLlegada: "2026-07-01",
    horaLlegada: "10:00",
    fechaSalida: "2026-07-08",
    horaSalida: "12:00",
    direccionHospedaje: "Calle Test 1, Ciudad",
    latitud: 40.4168,
    longitud: -3.7038,
    medioTransporte: "Coche",
    medioTransporteOtro: "",
    region: "Test",
    email: `test${i}@prueba.com`,
    numeroVuelo: "",
    necesitaTransporteAeropuerto: false,
  };
}

function volunteerPayload(fila, i) {
  return {
    fila,
    plazasCoche: 3,
    direccion: "Calle Test 1, Ciudad",
    lunesManana: true,
    lunesTarde: false,
    martesManana: true,
    martesTarde: false,
    miercolesManana: false,
    miercolesTarde: true,
    juevesManana: false,
    juevesTarde: false,
    viernesManana: true,
    viernesTarde: true,
    sabadoManana: false,
    sabadoTarde: false,
    domingoManana: false,
    domingoTarde: false,
    mapsLink: "https://maps.google.com/?q=40.4168,-3.7038",
    lat: 40.4168,
    lon: -3.7038,
    region: "Test",
    email: `test${i}@prueba.com`,
  };
}

// ─── POST siguiendo redirects manualmente ────────────────────────────────
// Apps Script devuelve un 302 y fetch por defecto lo convierte en GET,
// perdiendo el body. Hay que seguir el redirect preservando POST + body.

// Apps Script ejecuta doPost y LUEGO devuelve 302.
// No hay que seguir el redirect — la escritura ya ocurrió.
async function postToAppsScript(url, payload, signal) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "manual",
    signal,
  });
}

// ─── petición individual ──────────────────────────────────────────────────

async function singleRequest(id) {
  const fila = resolveFilaForRequest(id);
  const payload =
    FORM === "volunteer" ? volunteerPayload(fila, id) : guestPayload(fila, id);
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await postToAppsScript(SCRIPT_URL, payload, controller.signal);
    clearTimeout(timer);

    const elapsed = Date.now() - start;

    // 302 = Apps Script procesó el POST y redirige a la respuesta (comportamiento normal)
    const ok = res.status === 302 || res.ok;
    return { id, fila, ok, status: res.status, elapsed, body: null };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = err.name === "AbortError";
    return {
      id,
      fila,
      ok: false,
      status: isTimeout ? "TIMEOUT" : "NET_ERROR",
      elapsed,
      error: err.message,
    };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────

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

// ─── ejecución ───────────────────────────────────────────────────────────

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
  let next = 0,
    done = 0;

  async function worker() {
    while (next < total) {
      const id = next++;
      const r = await singleRequest(id);
      results.push(r);
      done++;
      process.stdout.write(`\r  ${bar(done, total)} ${done}/${total}`);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, worker),
  );
  return results;
}

async function run() {
  const mode =
    CONCURRENCY > 0
      ? `pool de ${CONCURRENCY} concurrentes`
      : "todas simultáneas";
  const filaDesc = FILA_FIXED
    ? `fila ${FILA_FIXED} (misma fila para todas → máximo lock contention)`
    : `filas ${FILA_START}–${FILA_END}`;

  console.log(
    `\n⚠  Este script ESCRIBE en el Sheet. Borra las filas de prueba cuando termines.`,
  );
  console.log(`\nDisparando ${TOTAL} POSTs (${mode})`);
  console.log(`Formulario: ${FORM}`);
  console.log(`URL:        ${SCRIPT_URL}`);
  console.log(`Filas:      ${filaDesc}`);
  console.log(`Timeout:    ${TIMEOUT_MS / 1000}s\n`);

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

  // Filas afectadas
  console.log(`\nFILAS ESCRITAS ${results.length}`);
  console.log(SEP);

  console.log();

  const failRate = (TOTAL - successes.length) / TOTAL;
  if (failRate === 0) {
    console.log(
      "✓ Sin errores. Apps Script aguantó esta carga de escritura.\n",
    );
  } else if (failRate < 0.05) {
    console.log(
      `⚠ ${pct(failRate * 100, 100)}% de fallos — Apps Script empieza a saturarse en escrituras.\n`,
    );
  } else {
    console.log(
      `✗ ${pct(failRate * 100, 100)}% de fallos — Apps Script no aguanta esta carga de escritura.\n`,
    );
  }
}

run().catch(console.error);
