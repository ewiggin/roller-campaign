/**
 * Carritos se van de vacaciones — Apps Script
 *
 * Recibe los datos del formulario Angular via POST y los añade
 * como nueva fila al final de la hoja "Invitados".
 *
 * Columnas existentes en el Sheet (30):
 *  1  Código de grupo
 *  2  Código de invitado
 *  3  ¿Es menor de edad?
 *  4  Estado
 *  5  Sucursal
 *  6  ¿Es el contacto del grupo?
 *  7  Lengua materna
 *  8  Otros idiomas
 *  9  Siervo especial del tiempo completo
 * 10  Fecha de inicio de disponibilidad
 * 11  Fecha de fin de disponibilidad
 * 12  Medio de transporte de llegada
 * 13  Fecha de llegada
 * 14  Hora de llegada
 * 15  Lugar de llegada
 * 16  Aeropuerto de llegada
 * 17  Aerolínea de llegada
 * 18  Número de vuelo de llegada
 * 19  Medio de transporte de salida
 * 20  Fecha de partida
 * 21  Hora de partida
 * 22  Lugar de partida
 * 23  Aeropuerto de salida
 * 24  Aerolínea de salida
 * 25  Número de vuelo de salida
 * 26  Alojamientos
 * 27  Entrada
 * 28  Salida
 * 29  Necesita alojamiento especial
 * 30  ¿Itinerario completo?
 *
 * Columnas extra añadidas por el formulario (31-43):
 * 31  Nombre completo
 * 32  Ciudad de origen
 * 33  Plazas de coche disponibles
 * 34  Habla inglés
 * 35  Llegada real
 * 36  Hora de llegada
 * 37  Salida real
 * 38  Hora de salida
 * 39  Dirección del hospedaje
 * 40  Enlace de Google Maps
 * 41  Latitud
 * 42  Longitud
 * 43  Medio de transporte (formulario)
 * 44  Región de participación
 */

var SHEET_NAME = 'Invitados';

// Columna donde está el código de invitado (base 1)
var COL_CODIGO_INVITADO = 2;

var EXTRA_HEADERS = [
  'Nombre completo',
  'Ciudad de origen',
  'Plazas de coche disponibles',
  'Habla inglés',
  'Llegada real',
  'Hora de llegada',
  'Salida real',
  'Hora de salida',
  'Dirección del hospedaje',
  'Enlace de Google Maps',
  'Latitud',
  'Longitud',
  'Medio de transporte (formulario)',
  'Región de participación',
];

// Índice de la primera columna extra (base 1)
var EXTRA_HEADERS_START_COL = 31;

/**
 * GET ?codigo=XXX
 * Devuelve { valid: true } si el código existe en la columna 2,
 * { valid: false } si no existe.
 */
function doGet(e) {
  try {
    var codigo = e.parameter.codigo;
    if (!codigo) {
      return jsonResponse({ valid: false, error: 'Falta el parámetro codigo' });
    }

    var sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ valid: false, error: 'Hoja no encontrada' });
    }

    var lastRow  = sheet.getLastRow();
    var codigos  = sheet
      .getRange(2, COL_CODIGO_INVITADO, lastRow - 1, 1)
      .getValues()
      .map(function(r) { return r[0].toString().trim(); });

    var indice = codigos.indexOf(codigo.trim());
    if (indice === -1) {
      return jsonResponse({ valid: false });
    }
    // +2 porque el array empieza en la fila 2 (fila 1 son cabeceras)
    var fila = indice + 2;
    return jsonResponse({ valid: true, fila: fila });

  } catch (err) {
    return jsonResponse({ valid: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEET_NAME);

    if (!sheet) {
      return errorResponse('No se encontró la hoja "' + SHEET_NAME + '"');
    }

    ensureExtraHeaders(sheet);

    var data  = JSON.parse(e.postData.contents);
    var fila  = parseInt(data.fila, 10);

    if (!fila || isNaN(fila) || fila < 2) {
      return errorResponse('Número de fila inválido: ' + data.fila);
    }

    var valores = buildExtraColumns(data);
    sheet
      .getRange(fila, EXTRA_HEADERS_START_COL, 1, valores.length)
      .setValues([valores]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return errorResponse(err.toString());
  }
}

/**
 * Añade las cabeceras extra (columnas 31-34) en la fila 1
 * si todavía no existen.
 */
function ensureExtraHeaders(sheet) {
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  EXTRA_HEADERS.forEach(function(header, i) {
    var col = EXTRA_HEADERS_START_COL + i;
    var existing = headerRow[col - 1]; // base 0
    if (!existing || existing.toString().trim() === '') {
      sheet.getRange(1, col).setValue(header);
    }
  });
}

/**
 * Devuelve solo los valores de las columnas extra (31-39).
 * Se escriben directamente en la fila del invitado, sin tocar las 30 columnas existentes.
 */
function buildExtraColumns(data) {
  var mapsLink = (data.latitud && data.longitud)
    ? 'https://www.google.com/maps?q=' + data.latitud + ',' + data.longitud
    : '';

  var transporte = (data.medioTransporte === 'Otra')
    ? (data.medioTransporteOtro || 'Otra')
    : (data.medioTransporte || '');

  return [
    data.nombreCompleto      || '',  // 31  Nombre completo
    data.ciudadOrigen        || '',  // 32  Ciudad de origen
    data.plazasCoche         ?? '',  // 33  Plazas de coche disponibles
    data.hablaIngles         || '',  // 34  Habla inglés
    data.fechaLlegada        || '',  // 35  Llegada real
    data.horaLlegada         || '',  // 36  Hora de llegada
    data.fechaSalida         || '',  // 37  Salida real
    data.horaSalida          || '',  // 38  Hora de salida
    data.direccionHospedaje  || '',  // 39  Dirección del hospedaje
    mapsLink,                        // 40  Enlace de Google Maps
    data.latitud  ?? '',             // 41  Latitud
    data.longitud ?? '',             // 42  Longitud
    transporte,                      // 43  Medio de transporte (formulario)
    data.region             || '',  // 44  Región de participación
  ];
}

function errorResponse(message) {
  return jsonResponse({ status: 'error', message: message });
}

/**
 * Prueba local: ejecuta desde el editor de Apps Script
 * para verificar antes de redesplegar (Ejecutar → doPostTest).
 */
function doPostTest() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        fila:                 2,
        nombreCompleto:       'Ana García López',
        ciudadOrigen:         'Madrid',
        plazasCoche:          2,
        hablaIngles:          'Sí',
        fechaLlegada:         '2026-07-01',
        horaLlegada:          '14:30',
        fechaSalida:          '2026-07-08',
        horaSalida:           '10:00',
        direccionHospedaje:   'Calle Mayor 1, Alicante',
        latitud:              38.3452,
        longitud:             -0.4810,
        medioTransporte:      'Tren',
        medioTransporteOtro:  '',
      })
    }
  };

  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
