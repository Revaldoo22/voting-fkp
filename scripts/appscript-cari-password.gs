/**
 * Google Apps Script — cari password peserta by nama dari Spreadsheet.
 *
 * Spreadsheet: kolom A = "LOGIN NAMA", kolom B = "PASSWORD" (baris 1 = header).
 *
 * CARA PASANG:
 * 1. Buka spreadsheet → Extensions → Apps Script.
 * 2. Tempel kode ini, ganti SHEET_NAME jika perlu (default sheet aktif pertama).
 * 3. Deploy → New deployment → type: Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 4. Salin URL web app → taruh di .env.local sebagai
 *      NEXT_PUBLIC_PASSWORD_LOOKUP_URL=<url>
 *
 * Endpoint: GET <url>?q=<nama>
 *   Balikan JSON: { ok: true, results: [{ name, password }], count }
 *   atau { ok: false, error }
 */

// Kosongkan untuk pakai sheet pertama, atau isi nama sheet spesifik.
var SHEET_NAME = "";

function doGet(e) {
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);

  try {
    var q = (e && e.parameter && e.parameter.q ? e.parameter.q : "")
      .toString()
      .trim()
      .toLowerCase();

    if (q.length < 2) {
      out.setContent(
        JSON.stringify({ ok: false, error: "Ketik minimal 2 huruf nama." })
      );
      return out;
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = SHEET_NAME
      ? ss.getSheetByName(SHEET_NAME)
      : ss.getSheets()[0];
    if (!sheet) {
      out.setContent(JSON.stringify({ ok: false, error: "Sheet tidak ditemukan." }));
      return out;
    }

    var last = sheet.getLastRow();
    if (last < 2) {
      out.setContent(JSON.stringify({ ok: true, results: [], count: 0 }));
      return out;
    }

    // Ambil kolom A & B mulai baris 2 (lewati header).
    var values = sheet.getRange(2, 1, last - 1, 2).getValues();
    var results = [];
    for (var i = 0; i < values.length; i++) {
      var name = (values[i][0] || "").toString().trim();
      var pass = (values[i][1] || "").toString().trim();
      if (!name) continue;
      if (name.toLowerCase().indexOf(q) !== -1) {
        results.push({ name: name, password: pass });
      }
      if (results.length >= 25) break; // batasi hasil
    }

    out.setContent(JSON.stringify({ ok: true, results: results, count: results.length }));
    return out;
  } catch (err) {
    out.setContent(JSON.stringify({ ok: false, error: String(err) }));
    return out;
  }
}
