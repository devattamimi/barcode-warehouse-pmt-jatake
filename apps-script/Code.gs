/**
 * MODENA Barcode Scan Out Counter v2.2 - penerima data scan resi (Google Apps Script Web App)
 * Parts Management, Customer Care Department
 *
 * Sheet yang dibuat otomatis:
 *   LOG_SCAN      : setiap aktivitas dari HP (Scan, Revisi, Hapus, Batal hapus). Jangan diedit manual.
 *   REKAP_RESI    : 1 baris per resi (koli total, PIC, kurir, status). Dibangun ulang dari LOG_SCAN tiap ada data masuk.
 *   REKAP_HARIAN  : jumlah resi & koli per tanggal per kurir.
 *
 * Cara pasang (sekali saja):
 * 1. Buat Google Sheet baru, misalnya "MODENA Barcode Scan Out Counter"
 * 2. Extensions > Apps Script > hapus isi Code.gs bawaan > tempel seluruh file ini > Save
 * 3. Deploy > New deployment > type: Web app
 *      Execute as     : Me
 *      Who has access : Anyone
 *    > Deploy > Authorize > copy "Web app URL" (berakhiran /exec)
 * 4. Kirim URL itu ke Claude untuk ditanam di aplikasi (atau isi di Setting > Admin di HP)
 *
 * Kalau script diubah: Deploy > Manage deployments > Edit (pensil) > Version: New version > Deploy (URL tetap sama).
 */

var TOKEN = 'PMT-BSO-2026';   // harus sama dengan token di aplikasi
var VERSION = '2.2';
var APP = 'MODENA Barcode Scan Out Counter';
var LOG = 'LOG_SCAN', REKAP = 'REKAP_RESI', HARIAN = 'REKAP_HARIAN';
var LOG_HEADER = ['ID', 'Waktu', 'Tanggal', 'Jam', 'Aksi', 'Resi ID', 'Nomor Resi', 'Kurir', 'PIC', 'Multi Package', 'Koli', 'Delta', 'Versi App', 'Device', 'Diterima Server'];
var REKAP_HEADER = ['Resi ID', 'Nomor Resi', 'Kurir', 'PIC', 'Multi Package', 'Koli', 'Tanggal', 'Jam Scan', 'Jam Terakhir', 'Device', 'Status'];
var TZ = 'Asia/Jakarta';

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.keys || p.day || p.from || p.all) {
    if (p.token !== TOKEN) return json_({ ok: false, error: 'Token salah' });
    var recs = readRekap_();
    if (p.keys) {
      var days = Math.min(120, Math.max(1, Number(p.days) || 30));
      var cut = Utilities.formatDate(new Date(Date.now() - days * 864e5), TZ, 'yyyy-MM-dd');
      var out = [];
      recs.forEach(function (r) {
        if (r[10] === 'Dihapus' || String(r[6]) < cut) return;
        // [code, rid, tanggal, pic, kurir, koli, device, jam]
        out.push([r[1], r[0], r[6], r[3], r[2], r[5], r[9], String(r[7]).slice(0, 5)]);
      });
      return json_({ ok: true, version: VERSION, keys: out });
    }
    // dashboard: semua tanggal (all=1), satu tanggal (day=), atau periode (from= & to=)
    if (p.all) return json_({ ok: true, version: VERSION, all: true, rows: recs });
    var from = String(p.from || p.day), to = String(p.to || p.day || p.from);
    if (from > to) { var t = from; from = to; to = t; }
    return json_({ ok: true, version: VERSION, from: from, to: to,
      rows: recs.filter(function (r) { var d = String(r[6]); return d >= from && d <= to; }) });
  }
  var sh = sheet_(LOG, LOG_HEADER);
  return json_({ ok: true, app: APP, version: VERSION, rows: Math.max(0, sh.getLastRow() - 1) });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON tidak valid' }); }
  if (!body || body.token !== TOKEN) return json_({ ok: false, error: 'Token salah' });
  var rows = body.rows || [];
  if (!rows.length) return json_({ ok: true, received: 0, added: 0 });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return json_({ ok: false, error: 'Server sibuk, coba lagi' });
  try {
    var sh = sheet_(LOG, LOG_HEADER), last = sh.getLastRow(), seen = {};
    if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (v) { seen[v[0]] = true; });
    var now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'), device = String(body.device || ''), out = [];
    rows.forEach(function (r) {
      // r = [ID, Waktu, Tanggal, Jam, Aksi, Resi ID, Nomor Resi, Kurir, PIC, Multi Package, Koli, Delta, Versi App]
      var id = String(r[0] || '');
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push([id, txt_(r[1]), txt_(r[2]), txt_(r[3]), String(r[4] || ''), String(r[5] || ''), txt_(r[6]), String(r[7] || ''),
        String(r[8] || ''), String(r[9] || 'No'), num_(r[10]), num_(r[11]), String(r[12] || ''), device, now]);
    });
    if (out.length) {
      var start = sh.getLastRow() + 1, need = start + out.length - 1;
      if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 1000);
      sh.getRange(start, 1, out.length, LOG_HEADER.length).setValues(out);
    }
    var dup = out.length ? rebuild_() : [];
    var mine = {};
    out.forEach(function (r) { mine[r[5]] = true; });
    return json_({ ok: true, received: rows.length, added: out.length, dup: dup.filter(function (d) { return mine[d.rid]; }) });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Bangun ulang REKAP_RESI & REKAP_HARIAN dari LOG_SCAN. Return daftar resi dobel antar HP. */
function rebuild_() {
  var sh = sheet_(LOG, LOG_HEADER), last = sh.getLastRow();
  var v = last > 1 ? sh.getRange(2, 1, last - 1, LOG_HEADER.length).getValues() : [];
  v.sort(function (a, b) { var x = txt_(a[1]), y = txt_(b[1]); return x < y ? -1 : x > y ? 1 : (a[0] < b[0] ? -1 : 1); });
  var map = {}, order = [];
  v.forEach(function (r) {
    var aksi = String(r[4]), rid = String(r[5]), rec = map[rid];
    if (!rid) return;
    if (!rec) {
      rec = map[rid] = { rid: rid, code: txt_(r[6]), kurir: r[7], pic: r[8], multi: r[9] || 'No', koli: 0, date: txt_(r[2]), first: txt_(r[3]), lastT: txt_(r[3]), dev: r[13], status: '' };
      order.push(rid);
    }
    if (aksi === 'Scan') {
      rec.date = txt_(r[2]); // multi package: tanggal ikut scan terakhir (sama dengan aplikasi v1.2)
      rec.koli += num_(r[11]);
      if (String(r[9]) === 'Yes') rec.multi = 'Yes';
      rec.lastT = txt_(r[3]);
    } else if (aksi === 'Revisi') {
      rec.code = txt_(r[6]); rec.kurir = r[7]; rec.pic = r[8]; rec.multi = r[9] || 'No'; rec.koli = num_(r[10]);
    } else if (aksi === 'Hapus') {
      rec.status = 'Dihapus';
    } else if (aksi === 'Batal hapus') {
      rec.status = '';
    }
  });
  // resi dobel: nomor resi sama dengan Resi ID berbeda (2 HP offline scan resi yang sama)
  var byCode = {}, dup = [];
  order.forEach(function (rid) {
    var r = map[rid];
    if (r.status === 'Dihapus') return;
    var k = String(r.code); // nomor resi dibandingkan persis (sama dengan aplikasi)
    if (byCode[k]) { r.status = 'Dobel (pertama: ' + byCode[k].pic + ' ' + byCode[k].date + ')'; dup.push({ rid: rid, code: r.code }); }
    else byCode[k] = r;
  });
  var rows = order.map(function (rid) {
    var r = map[rid];
    return [r.rid, r.code, r.kurir, r.pic, r.multi, r.koli, r.date, r.first, r.lastT, r.dev, r.status];
  });
  write_(REKAP, REKAP_HEADER, rows);
  // rekap harian per kurir
  var h = {}, keys = [];
  rows.forEach(function (r) {
    if (r[10]) return; // dihapus / dobel tidak dihitung
    var k = r[6] + '|' + r[2];
    if (!h[k]) { h[k] = [r[6], r[2], 0, 0]; keys.push(k); }
    h[k][2]++; h[k][3] += num_(r[5]);
  });
  keys.sort();
  write_(HARIAN, ['Tanggal', 'Kurir', 'Resi', 'Koli'], keys.map(function (k) { return h[k]; }));
  return dup;
}

function readRekap_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REKAP);
  if (!sh || sh.getLastRow() < 2) { rebuild_(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REKAP); }
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, REKAP_HEADER.length).getValues().map(function (r) {
    return [String(r[0]), txt_(r[1]), String(r[2]), String(r[3]), String(r[4]), num_(r[5]), txt_(r[6]), txt_(r[7]), txt_(r[8]), String(r[9]), String(r[10])];
  });
}

function write_(name, header, rows) {
  var sh = sheet_(name, header);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (rows.length) {
    if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows() + 500);
    var rg = sh.getRange(2, 1, rows.length, header.length);
    rg.setNumberFormat('@');
    rg.setValues(rows.map(function (r) { return r.map(function (x) { return x == null ? '' : x; }); }));
    if (name === REKAP) sh.getRange(2, 6, rows.length, 1).setNumberFormat('0');
    if (name === HARIAN) sh.getRange(2, 3, rows.length, 2).setNumberFormat('0');
  }
}

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (name === LOG) sh.getRange('A:M').setNumberFormat('@');
  }
  return sh;
}

/* tanggal/jam dari Sheet bisa terbaca sebagai Date: kembalikan ke teks */
function txt_(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1900) return Utilities.formatDate(v, TZ, 'HH:mm:ss');
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd' + (v.getHours() || v.getMinutes() || v.getSeconds() ? ' HH:mm:ss' : ''));
  }
  return String(v == null ? '' : v);
}
function num_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
