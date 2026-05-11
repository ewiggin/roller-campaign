/**
 * Carritos se van de vacaciones — Apps Script (Voluntarios)
 *
 * Recibe los datos del formulario Angular via POST y los escribe
 * en la fila correspondiente del voluntario en la hoja "Voluntarios".
 *
 * Columnas existentes en el Sheet (9):
 *  1  Número de identificación
 *  2  Nombre
 *  3  Sexo
 *  4  Estado civil
 *  5  Congregación
 *  6  Sucursal
 *  7  Tiene asignado un turno
 *  8  Grupos
 *  9  Horas asignadas
 *
 * Columnas extra añadidas por el formulario (10-25):
 * 10  Plazas de coche disponibles
 * 11  Dirección
 * 12  Lu M
 * 13  Lu T
 * 14  Ma M
 * 15  Ma T
 * 16  Mi M
 * 17  Mi T
 * 18  Ju M
 * 19  Ju T
 * 20  Vi M
 * 21  Vi T
 * 22  Sa M
 * 23  Sa T
 * 24  Do M
 * 25  Do T
 * 26  Maps
 * 27  Lat
 * 28  Lon
 * 29  Región de participación
 */

var SHEET_NAME = 'Voluntarios';

// Columna donde está el número de identificación (base 1)
var COL_CODIGO_VOLUNTARIO = 1;

// Columna donde está el nombre del voluntario (base 1)
var COL_NOMBRE = 2;

var EXTRA_HEADERS = [
  'Plazas de coche disponibles',
  'Dirección',
  'Lu M',
  'Lu T',
  'Ma M',
  'Ma T',
  'Mi M',
  'Mi T',
  'Ju M',
  'Ju T',
  'Vi M',
  'Vi T',
  'Sa M',
  'Sa T',
  'Do M',
  'Do T',
  'Maps',
  'Lat',
  'Lon',
  'Región de participación',
];

// Índice de la primera columna extra (base 1)
var EXTRA_HEADERS_START_COL = 10;

/**
 * GET ?codigo=XXX
 * Devuelve { valid: true, fila: N, nombre: '...' } si el código existe,
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
      return jsonResponse({ valid: false, error: 'Hoja no encontrada: ' + SHEET_NAME });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ valid: false });
    }

    var datos = sheet
      .getRange(2, COL_CODIGO_VOLUNTARIO, lastRow - 1, COL_NOMBRE)
      .getValues();

    var indice = -1;
    for (var i = 0; i < datos.length; i++) {
      if (datos[i][COL_CODIGO_VOLUNTARIO - 1].toString().trim() === codigo.trim()) {
        indice = i;
        break;
      }
    }

    if (indice === -1) {
      return jsonResponse({ valid: false });
    }

    var fila = indice + 2;
    var nombre = datos[indice][COL_NOMBRE - 1].toString().trim();

    var formData = null;
    var lastCol = sheet.getLastColumn();
    if (lastCol >= EXTRA_HEADERS_START_COL) {
      var numCols = Math.min(lastCol - EXTRA_HEADERS_START_COL + 1, EXTRA_HEADERS.length);
      var extra = sheet.getRange(fila, EXTRA_HEADERS_START_COL, 1, numCols).getValues()[0];
      var hasData = extra[0] !== '' || extra[1] !== '';
      if (hasData) {
        formData = {
          plazasCoche:     parseInt(extra[0]) || 0,
          direccion:       extra[1]  || '',
          lunesManana:     extra[2]  === 'Sí',
          lunesTarde:      extra[3]  === 'Sí',
          martesManana:    extra[4]  === 'Sí',
          martesTarde:     extra[5]  === 'Sí',
          miercolesManana: extra[6]  === 'Sí',
          miercolesTarde:  extra[7]  === 'Sí',
          juevesManana:    extra[8]  === 'Sí',
          juevesTarde:     extra[9]  === 'Sí',
          viernesManana:   extra[10] === 'Sí',
          viernesTarde:    extra[11] === 'Sí',
          sabadoManana:    extra[12] === 'Sí',
          sabadoTarde:     extra[13] === 'Sí',
          domingoManana:   extra[14] === 'Sí',
          domingoTarde:    extra[15] === 'Sí',
          mapsLink:        numCols > 16 ? (extra[16] || '') : '',
          lat:             numCols > 17 ? (parseFloat(extra[17]) || null) : null,
          lon:             numCols > 18 ? (parseFloat(extra[18]) || null) : null,
          region:          numCols > 19 ? (extra[19] || '') : '',
        };
      }
    }

    return jsonResponse({ valid: true, fila: fila, nombre: nombre, formData: formData });

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

    var data = JSON.parse(e.postData.contents);
    var fila = parseInt(data.fila, 10);

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
 * Añade las cabeceras extra en la fila 1 si todavía no existen.
 */
function ensureExtraHeaders(sheet) {
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  EXTRA_HEADERS.forEach(function(header, i) {
    var col = EXTRA_HEADERS_START_COL + i;
    var existing = headerRow[col - 1];
    if (!existing || existing.toString().trim() === '') {
      sheet.getRange(1, col).setValue(header);
    }
  });
}

function boolToSiNo(value) {
  return value === true || value === 'true' ? 'Sí' : 'No';
}

/**
 * Devuelve los valores de las columnas extra (10-25).
 */
function buildExtraColumns(data) {
  return [
    data.plazasCoche      ?? 0,               // 10  Plazas de coche disponibles
    data.direccion        || '',               // 11  Dirección
    boolToSiNo(data.lunesManana),              // 12  Lunes mañana
    boolToSiNo(data.lunesTarde),               // 13  Lunes tarde
    boolToSiNo(data.martesManana),             // 14  Martes mañana
    boolToSiNo(data.martesTarde),              // 15  Martes tarde
    boolToSiNo(data.miercolesManana),          // 16  Miércoles mañana
    boolToSiNo(data.miercolesTarde),           // 17  Miércoles tarde
    boolToSiNo(data.juevesManana),             // 18  Jueves mañana
    boolToSiNo(data.juevesTarde),              // 19  Jueves tarde
    boolToSiNo(data.viernesManana),            // 20  Viernes mañana
    boolToSiNo(data.viernesTarde),             // 21  Viernes tarde
    boolToSiNo(data.sabadoManana),             // 22  Sábado mañana
    boolToSiNo(data.sabadoTarde),              // 23  Sábado tarde
    boolToSiNo(data.domingoManana),            // 24  Do M
    boolToSiNo(data.domingoTarde),             // 25  Do T
    data.mapsLink || '',                       // 26  Maps
    data.lat      ?? '',                       // 27  Lat
    data.lon      ?? '',                       // 28  Lon
    data.region   || '',                       // 29  Región de participación
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
        fila:             2,
        codigoVoluntario: '12345',
        direccion:        'Calle Mayor 1, Madrid',
        plazasCoche:      3,
        lunesManana:      true,
        lunesTarde:       false,
        martesManana:     true,
        martesTarde:      true,
        miercolesManana:  false,
        miercolesTarde:   false,
        juevesManana:     true,
        juevesTarde:      false,
        viernesManana:    false,
        viernesTarde:     true,
        sabadoManana:     true,
        sabadoTarde:      true,
        domingoManana:    false,
        domingoTarde:     false,
        region:           'Mallorca',
      })
    }
  };

  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
