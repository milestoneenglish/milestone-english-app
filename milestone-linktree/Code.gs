/**
 * Milestone Linktree: halaman link untuk bio Instagram.
 *
 * - Halaman publik  : alamat Web App
 * - Halaman admin   : alamat Web App + ?admin (masuk dengan PIN 4 angka)
 * - Penyimpanan     : Google Sheet (tab Pengaturan, Link, Klik)
 * - PIN admin       : Project Settings → Script Properties → ADMIN_PIN (diisi sendiri, tidak ditulis di kode)
 *
 * Fungsi berakhiran garis bawah (_) bersifat privat dan tidak bisa dipanggil dari browser.
 */

var TZ = 'Asia/Jakarta';
var SHEET = { settings: 'Pengaturan', links: 'Link', clicks: 'Klik', monthly: 'Ringkasan bulanan' };
var LINK_COLUMNS = ['id', 'judul', 'keterangan', 'url', 'ikon', 'unggulan', 'aktif', 'mulai', 'sampai'];
var ICONS = ['link', 'form', 'star', 'book', 'cap', 'calendar', 'play', 'users', 'tag', 'chat', 'whatsapp', 'pin', 'instagram', 'youtube', 'tiktok', 'globe', 'none'];
var SOCIAL_KEYS = ['instagram', 'tiktok', 'youtube', 'facebook', 'email', 'website'];
var SHAPES = ['bulat', 'lengkung', 'kotak'];
var MAX_LINKS = 50;
var SESSION_HOURS = 8;
var MAX_FAILS = 5;
var LOCK_MINUTES = 15;
var CACHE_KEY = 'halaman_v1';
var CACHE_SECONDS = 300;
var ARCHIVE_DAYS = 90;
var CLICK_COLUMNS = ['waktu', 'id', 'judul'];
var MONTHLY_COLUMNS = ['bulan', 'id', 'judul', 'jumlah'];
var DAY_MS = 86400000;
var WIB_MS = 7 * 3600000;

var DEFAULT_LOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#152949"/>' +
  '<g transform="translate(27.5 53.5)"><path fill="#ffffff" d="M5 0H39.5L88.5 49H56.5L27.5 20H24V73H28.5V93H5Q0 93 0 88V5Q0 0 5 0ZM72 51H96V93H72Z"/>' +
  '<path fill="#F17A16" d="M105.5 0H140Q145 0 145 5V88Q145 93 140 93H121V20H116.5L96 40.5V52C96 64.15 86.15 74 74 74H48.5V93H28.5V53.5H72V33.5Z"/></g></svg>'
);

var DEFAULT_SETTINGS = {
  nama: 'Milestone English',
  bio: 'Belajar bahasa Inggris berbasis hasil.\nIkuti placement test gratis untuk tahu level kamu.',
  logo: DEFAULT_LOGO,
  logo_bentuk: 'bulat',
  wa_tampil: 'ya',
  wa_nomor: '',
  wa_label: 'Chat Admin via WhatsApp',
  wa_pesan: 'Halo Milestone English, saya dari Instagram. Saya mau tanya tentang kelas.',
  instagram: '',
  tiktok: '',
  youtube: '',
  facebook: '',
  email: '',
  website: '',
  warna_latar: '#0b1426',
  warna_teks: '#ffffff',
  warna_tombol: '#ffffff',
  warna_teks_tombol: '#152949',
  warna_unggulan: '#f17a16',
  warna_teks_unggulan: '#152949',
  bentuk: 'bulat',
  footer: '© Milestone English'
};

var SAMPLE_LINKS = [
  ['l-placement', 'Placement Test Gratis', 'Cek level bahasa Inggrismu dalam 30 menit', 'https://contoh.com/ganti-link-ini', 'form', 'ya', 'ya', '', ''],
  ['l-daftar', 'Daftar Kelas', 'Pilih program dan jadwal yang cocok', 'https://contoh.com/ganti-link-ini', 'cap', 'tidak', 'ya', '', ''],
  ['l-program', 'Program & Biaya', '', 'https://contoh.com/ganti-link-ini', 'book', 'tidak', 'ya', '', ''],
  ['l-testimoni', 'Cerita Peserta', '', 'https://contoh.com/ganti-link-ini', 'users', 'tidak', 'ya', '', '']
];

// ------------------------------------------------------------------ Halaman

function doGet(e) {
  var p = (e && e.parameter) || {};
  if ('api' in p) {
    // Dipakai halaman GitHub Pages: data + tampilan dalam satu JSON, dibaca tanpa cookie Google.
    return ContentService.createTextOutput(JSON.stringify({ page: publicData_(), render: include('Render') }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if ('admin' in p) {
    return HtmlService.createTemplateFromFile('Admin').evaluate()
      .setTitle('Admin · Milestone Linktree')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  var data = publicData_();
  data.execUrl = ScriptApp.getService().getUrl() || '';
  var t = HtmlService.createTemplateFromFile('Index');
  t.json = safeJson_(data);
  var out = t.evaluate()
    .setTitle(data.settings.nama || 'Milestone English')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  if (/^https:\/\//.test(data.settings.logo)) {
    try { out.setFaviconUrl(data.settings.logo); } catch (err) {}
  }
  return out;
}

/** Klik tombol (?klik=id) dan kunjungan dari halaman GitHub Pages (?lihat) dikirim browser ke alamat ini. */
function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.klik) {
    try { logClick(p.klik); } catch (err) {}
  } else if ('lihat' in p) {
    try { logView(); } catch (err) {}
  }
  return ContentService.createTextOutput('ok');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Cadangan pencatat klik bila browser tidak mendukung sendBeacon. */
function logClick(id) {
  id = String(id || '').slice(0, 40);
  var title;
  if (id === 'wa') {
    title = 'WhatsApp';
  } else if (id.indexOf('sosial:') === 0 && SOCIAL_KEYS.indexOf(id.slice(7)) >= 0) {
    title = 'Ikon ' + id.slice(7);
  } else {
    var link = publicData_().links.filter(function (l) { return l.id === id; })[0];
    if (!link) return false;
    title = link.judul;
  }
  book_().getSheetByName(SHEET.clicks).appendRow([new Date(), id, title]);
  return true;
}

function logView() {
  book_().getSheetByName(SHEET.clicks).appendRow([new Date(), '_view', 'Kunjungan halaman']);
  return true;
}

// ------------------------------------------------------------------ Login admin

function login(pin) {
  var props = PropertiesService.getScriptProperties();
  var real = String(props.getProperty('ADMIN_PIN') || '').trim();
  if (!/^\d{4}$/.test(real)) {
    return { ok: false, error: 'PIN admin belum diatur. Isi ADMIN_PIN (4 angka) di Project Settings → Script Properties.' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = Date.now();
    var until = Number(props.getProperty('LOCK_UNTIL') || 0);
    if (until > now) {
      return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam ' + Math.ceil((until - now) / 60000) + ' menit.' };
    }
    if (String(pin) !== real) {
      var fails = Number(props.getProperty('FAILS') || 0) + 1;
      if (fails >= MAX_FAILS) {
        props.setProperties({ LOCK_UNTIL: String(now + LOCK_MINUTES * 60000), FAILS: '0' });
        return { ok: false, error: 'PIN salah ' + MAX_FAILS + ' kali. Login dikunci ' + LOCK_MINUTES + ' menit.' };
      }
      props.setProperty('FAILS', String(fails));
      return { ok: false, error: 'PIN salah. Sisa percobaan: ' + (MAX_FAILS - fails) + '.' };
    }
    props.setProperty('FAILS', '0');
    var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    var sessions = sessions_();
    sessions[hash_(token)] = now + SESSION_HOURS * 3600000;
    saveSessions_(sessions);
    return { ok: true, token: token };
  } finally {
    lock.releaseLock();
  }
}

function logout(token) {
  var sessions = sessions_();
  delete sessions[hash_(token)];
  saveSessions_(sessions);
  return { ok: true };
}

function changePin(token, oldPin, newPin) {
  return guard_(token, function () {
    var props = PropertiesService.getScriptProperties();
    if (String(oldPin) !== String(props.getProperty('ADMIN_PIN') || '').trim()) throw new Error('PIN lama salah.');
    newPin = String(newPin || '');
    if (!/^\d{4}$/.test(newPin)) throw new Error('PIN baru harus 4 angka.');
    if (weakPin_(newPin)) throw new Error('PIN baru terlalu mudah ditebak. Hindari angka kembar atau berurutan.');
    props.setProperty('ADMIN_PIN', newPin);
    // Perangkat lain otomatis keluar; perangkat ini tetap masuk.
    var keep = {};
    keep[hash_(token)] = sessions_()[hash_(token)];
    saveSessions_(keep);
    return true;
  });
}

// ------------------------------------------------------------------ Data admin

function adminLoad(token) {
  return guard_(token, function () {
    var all = readAll_();
    all.execUrl = ScriptApp.getService().getUrl() || '';
    all.sheetUrl = book_().getUrl();
    all.defaults = DEFAULT_SETTINGS;
    return all;
  });
}

function adminSave(token, payload) {
  return guard_(token, function () {
    var clean = sanitize_(payload);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = book_();
      writeTable_(ss.getSheetByName(SHEET.settings), ['kunci', 'nilai'], Object.keys(DEFAULT_SETTINGS).map(function (k) {
        return [k, clean.settings[k]];
      }));
      writeTable_(ss.getSheetByName(SHEET.links), LINK_COLUMNS, clean.links.map(function (l) {
        return [l.id, l.judul, l.keterangan, l.url, l.ikon, yn_(l.unggulan), yn_(l.aktif), l.mulai, l.sampai];
      }));
      CacheService.getScriptCache().remove(CACHE_KEY);
    } finally {
      lock.releaseLock();
    }
    return readAll_();
  });
}

function adminStats(token, days) {
  return guard_(token, function () {
    days = [7, 30, 90].indexOf(Number(days)) >= 0 ? Number(days) : 30;
    var dates = [];
    for (var i = days - 1; i >= 0; i--) dates.push(new Date(Date.now() + WIB_MS - i * DAY_MS).toISOString().slice(0, 10));
    var since = dayStart_(days - 1);

    var daily = {};
    dates.forEach(function (d) { daily[d] = { date: d, views: 0, clicks: 0 }; });
    var per = {};
    var current = readAll_();
    current.links.forEach(function (l) { per[l.id] = { id: l.id, title: l.judul, clicks: 0, exists: true }; });
    if (current.settings.wa_tampil === 'ya' && current.settings.wa_nomor) per.wa = { id: 'wa', title: 'WhatsApp', clicks: 0, exists: true };

    // Ringkasan bulanan = yang sudah diarsip (tab Ringkasan bulanan) + yang masih ada di tab Klik.
    var ss = book_();
    var months = {};
    var addMonth = function (month, id, title, n) {
      var m = months[month] || (months[month] = { month: month, views: 0, clicks: 0, per: {} });
      if (id === '_view') { m.views += n; return; }
      m.clicks += n;
      var x = m.per[id] || (m.per[id] = { title: title, clicks: 0 });
      x.clicks += n;
    };
    var archived = readMonthly_(ss);
    Object.keys(archived).forEach(function (k) { var a = archived[k]; addMonth(a.month, a.id, a.title, a.count); });

    var sh = ss.getSheetByName(SHEET.clicks);
    var last = sh.getLastRow();
    var count = Math.min(Math.max(last - 1, 0), 50000);
    var rows = count ? sh.getRange(last - count + 1, 1, count, 3).getValues() : [];
    var views = 0;
    var clicks = 0;
    rows.forEach(function (r) {
      var t = time_(r[0]);
      if (!(t > 0)) return;
      addMonth(new Date(t + WIB_MS).toISOString().slice(0, 7), String(r[1]), String(r[2]), 1);
      if (!(t >= since)) return;
      var day = daily[new Date(t + WIB_MS).toISOString().slice(0, 10)];
      var id = String(r[1]);
      if (id === '_view') {
        views++;
        if (day) day.views++;
        return;
      }
      clicks++;
      if (day) day.clicks++;
      if (!per[id]) per[id] = { id: id, title: String(r[2]), clicks: 0, exists: false };
      per[id].clicks++;
    });
    var list = Object.keys(per).map(function (k) { return per[k]; });
    list.sort(function (a, b) { return b.clicks - a.clicks; });

    // 12 bulan terakhir, dimulai dari bulan pertama yang punya data.
    var monthly = [];
    var now = new Date(Date.now() + WIB_MS);
    for (var j = 0; j < 12; j++) {
      var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - j, 1));
      var key = d.toISOString().slice(0, 7);
      var m = months[key] || { month: key, views: 0, clicks: 0, per: {} };
      var top = null;
      Object.keys(m.per).forEach(function (id) {
        var x = m.per[id];
        if (!top || x.clicks > top.clicks) top = { title: per[id] && per[id].exists ? per[id].title : x.title, clicks: x.clicks };
      });
      monthly.push({ month: key, views: m.views, clicks: m.clicks, top: top });
    }
    while (monthly.length && !monthly[monthly.length - 1].views && !monthly[monthly.length - 1].clicks) monthly.pop();

    return {
      days: days, views: views, clicks: clicks, perLink: list, daily: dates.map(function (d) { return daily[d]; }),
      monthly: monthly, archive: archiveStatus_()
    };
  });
}

// ------------------------------------------------------------------ Arsip otomatis

/**
 * Jalankan sekali dari editor Apps Script untuk menyalakan arsip otomatis.
 * Pemicu harian mengecek tanggal; setiap 90 hari, baris tab Klik yang lebih tua dari 90 hari
 * dipindah ke file "Milestone Linktree · Arsip <tahun>" dan dijumlahkan di tab Ringkasan bulanan.
 */
function pasangArsip() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'arsipOtomatis') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('arsipOtomatis').timeBased().everyDays(1).atHour(2).inTimezone(TZ).create();
  var info = arsipkan_();
  Logger.log('Arsip otomatis aktif. Baris dipindah sekarang: ' + info.moved + '. Arsip berikutnya: ' +
    Utilities.formatDate(new Date(info.time + ARCHIVE_DAYS * DAY_MS), TZ, 'yyyy-MM-dd') + '.');
}

/** Dipanggil pemicu setiap hari; baru bekerja bila arsip terakhir sudah 90 hari lalu. */
function arsipOtomatis() {
  var last = archiveStatus_().last;
  // Jam pemicu bisa bergeser sampai 1 jam, jadi beri kelonggaran setengah hari.
  if (last && Date.now() - last.time < ARCHIVE_DAYS * DAY_MS - DAY_MS / 2) return;
  arsipkan_();
}

function arsipkan_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = book_();
    var sh = ss.getSheetByName(SHEET.clicks);
    var last = sh.getLastRow();
    var rows = last > 1 ? sh.getRange(2, 1, last - 1, 3).getValues() : [];
    // Baris Klik selalu ditambah di bawah, jadi baris lama berkumpul di atas.
    var cutoff = dayStart_(ARCHIVE_DAYS - 1);
    var n = 0;
    while (n < rows.length && time_(rows[n][0]) < cutoff) n++;

    var summary = readMonthly_(ss);
    if (n) {
      var byYear = {};
      rows.slice(0, n).forEach(function (r) {
        var w = new Date(time_(r[0]) + WIB_MS).toISOString();
        (byYear[w.slice(0, 4)] = byYear[w.slice(0, 4)] || []).push(r);
        var id = String(r[1]);
        var k = w.slice(0, 7) + '|' + id;
        if (!summary[k]) summary[k] = { month: w.slice(0, 7), id: id, title: '', count: 0 };
        summary[k].title = String(r[2]);
        summary[k].count++;
      });
      Object.keys(byYear).forEach(function (year) {
        var a = archiveBook_(year).getSheetByName(SHEET.clicks);
        a.getRange(a.getLastRow() + 1, 1, byYear[year].length, 3).setValues(byYear[year]);
      });
    }
    saveMonthly_(ss, summary);
    if (n) {
      // Sheet menolak menghapus semua baris di bawah judul, jadi kosongkan saja bila semuanya lama.
      if (n === rows.length) sh.getRange(2, 1, n, 3).clearContent();
      else sh.deleteRows(2, n);
    }
    var info = { time: Date.now(), moved: n };
    PropertiesService.getScriptProperties().setProperty('ARSIP_TERAKHIR', JSON.stringify(info));
    return info;
  } finally {
    lock.releaseLock();
  }
}

function archiveBook_(year) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ARSIP_' + year);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (err) {}
  }
  var ss = SpreadsheetApp.create('Milestone Linktree · Arsip ' + year);
  var sh = ss.getSheets()[0];
  sh.setName(SHEET.clicks);
  writeTable_(sh, CLICK_COLUMNS, [], true);
  props.setProperty('ARSIP_' + year, ss.getId());
  return ss;
}

function archiveStatus_() {
  var props = PropertiesService.getScriptProperties();
  var last = null;
  try { last = JSON.parse(props.getProperty('ARSIP_TERAKHIR') || 'null'); } catch (err) {}
  var all = props.getProperties();
  var files = Object.keys(all).filter(function (k) { return /^ARSIP_\d{4}$/.test(k); }).sort().reverse().map(function (k) {
    return { year: k.slice(6), url: 'https://docs.google.com/spreadsheets/d/' + all[k] };
  });
  return { last: last, next: last ? last.time + ARCHIVE_DAYS * DAY_MS : null, files: files };
}

/** Isi tab Ringkasan bulanan sebagai { 'bulan|id': { month, id, title, count } }. */
function readMonthly_(ss) {
  var out = {};
  var sh = ss.getSheetByName(SHEET.monthly);
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    var month = cell_(r[0]).slice(0, 7);
    var id = cell_(r[1]);
    if (!/^\d{4}-\d{2}$/.test(month) || !id) return;
    var k = month + '|' + id;
    if (!out[k]) out[k] = { month: month, id: id, title: cell_(r[2]), count: 0 };
    out[k].count += Number(r[3]) || 0;
  });
  return out;
}

function saveMonthly_(ss, summary) {
  var sh = ss.getSheetByName(SHEET.monthly) || ss.insertSheet(SHEET.monthly);
  var list = Object.keys(summary).map(function (k) { return summary[k]; });
  list.sort(function (a, b) {
    if (a.month !== b.month) return a.month < b.month ? 1 : -1;
    if ((a.id === '_view') !== (b.id === '_view')) return a.id === '_view' ? -1 : 1;
    return b.count - a.count;
  });
  sh.clearContents();
  // Kolom bulan disimpan sebagai teks supaya "2026-07" tidak diubah Sheet menjadi tanggal.
  sh.getRange(1, 1, list.length + 1, 3).setNumberFormat('@');
  writeTable_(sh, MONTHLY_COLUMNS, list.map(function (x) { return [x.month, x.id, x.title, x.count]; }), true);
}

// ------------------------------------------------------------------ Pemasangan

/** Jalankan sekali dari editor Apps Script. Aman dijalankan ulang: data yang sudah ada tidak diubah. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SHEET_ID')) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    var ss0 = active || SpreadsheetApp.create('Milestone Linktree · Data');
    props.setProperty('SHEET_ID', ss0.getId());
  }
  var ss = book_();
  ensureSheet_(ss, SHEET.settings, ['kunci', 'nilai'], Object.keys(DEFAULT_SETTINGS).map(function (k) {
    return [k, DEFAULT_SETTINGS[k]];
  }));
  ensureSheet_(ss, SHEET.links, LINK_COLUMNS, SAMPLE_LINKS);
  ensureSheet_(ss, SHEET.clicks, CLICK_COLUMNS, []);
  if (!ss.getSheetByName(SHEET.monthly)) saveMonthly_(ss, {});
  ss.getSheetByName(SHEET.settings).getRange('B:B').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  ['Sheet1', 'Lembar1', 'Sheet 1'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  CacheService.getScriptCache().remove(CACHE_KEY);
  var pin = String(props.getProperty('ADMIN_PIN') || '').trim();
  Logger.log('Data tersimpan di: ' + ss.getUrl());
  Logger.log(/^\d{4}$/.test(pin) ? 'PIN admin sudah diatur.' : 'PIN admin BELUM diatur: tambahkan ADMIN_PIN (4 angka) di Project Settings → Script Properties.');
}

/** Menu di Google Sheet untuk membuka halaman publik dan admin. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Milestone Linktree')
    .addItem('Alamat halaman & admin', 'menuShowUrls')
    .addToUi();
}

function menuShowUrls() {
  var url = ScriptApp.getService().getUrl();
  var html = url
    ? '<p style="font-family:Arial">Halaman publik:<br><a href="' + url + '" target="_blank">' + url + '</a></p>' +
      '<p style="font-family:Arial">Admin:<br><a href="' + url + '?admin" target="_blank">' + url + '?admin</a></p>'
    : '<p style="font-family:Arial">Web App belum di-deploy. Ikuti langkah 5 di README.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(200), 'Milestone Linktree');
}

// ------------------------------------------------------------------ Privat

function guard_(token, fn) {
  try {
    if (!validSession_(token)) return { ok: false, auth: true, error: 'Sesi berakhir. Masuk lagi dengan PIN.' };
    return { ok: true, data: fn() };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
}

function book_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Jalankan fungsi setup() sekali dari editor Apps Script.');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function publicData_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CACHE_KEY);
  var all = hit ? JSON.parse(hit) : null;
  if (!all) {
    all = readAll_();
    try { cache.put(CACHE_KEY, JSON.stringify(all), CACHE_SECONDS); } catch (err) {}
  }
  var today = today_();
  return { settings: all.settings, links: all.links.filter(function (l) { return isLive_(l, today); }) };
}

function readAll_() {
  var ss = book_();
  var settings = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { settings[k] = DEFAULT_SETTINGS[k]; });
  ss.getSheetByName(SHEET.settings).getDataRange().getValues().slice(1).forEach(function (r) {
    var key = String(r[0]).trim();
    if (key in DEFAULT_SETTINGS) settings[key] = cell_(r[1]);
  });
  var rows = ss.getSheetByName(SHEET.links).getDataRange().getValues();
  var head = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = function (r, name) { var i = head.indexOf(name); return i < 0 ? '' : cell_(r[i]); };
  var links = rows.slice(1).filter(function (r) { return col(r, 'judul') || col(r, 'url'); }).map(function (r, i) {
    return {
      id: col(r, 'id') || 'l-baris' + (i + 2),
      judul: col(r, 'judul'),
      keterangan: col(r, 'keterangan'),
      url: col(r, 'url'),
      ikon: ICONS.indexOf(col(r, 'ikon')) >= 0 ? col(r, 'ikon') : 'link',
      unggulan: bool_(col(r, 'unggulan')),
      aktif: bool_(col(r, 'aktif')),
      mulai: col(r, 'mulai'),
      sampai: col(r, 'sampai')
    };
  });
  return { settings: settings, links: links, today: today_() };
}

function sanitize_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Data tidak valid.');
  var s = payload.settings || {};
  var str = function (k, max) { return String(s[k] == null ? '' : s[k]).trim().slice(0, max); };
  var out = {};

  out.nama = str('nama', 60);
  if (!out.nama) throw new Error('Nama di Profil wajib diisi.');
  out.bio = str('bio', 300);
  out.footer = str('footer', 80);
  out.logo = String(s.logo || '').trim();
  if (out.logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(out.logo) && !/^data:image\/svg\+xml,/.test(out.logo) && !/^https:\/\/\S+$/.test(out.logo)) {
    throw new Error('Logo tidak valid. Unggah ulang gambarnya.');
  }
  if (out.logo.length > 49000) throw new Error('Logo terlalu besar. Pakai gambar yang lebih kecil.');
  out.logo_bentuk = s.logo_bentuk === 'asli' ? 'asli' : 'bulat';

  out.wa_tampil = s.wa_tampil === 'ya' ? 'ya' : 'tidak';
  out.wa_nomor = normWa_(s.wa_nomor);
  if (out.wa_nomor === null) throw new Error('Nomor WhatsApp tidak valid. Contoh: 081234567890.');
  out.wa_label = str('wa_label', 60) || DEFAULT_SETTINGS.wa_label;
  out.wa_pesan = str('wa_pesan', 300);

  SOCIAL_KEYS.forEach(function (k) {
    var v = socialHref_(k, str(k, 200));
    if (v === null) throw new Error('Isian ' + k + ' tidak valid.');
    out[k] = k === 'email' ? v.replace(/^mailto:/, '') : v;
  });

  ['warna_latar', 'warna_teks', 'warna_tombol', 'warna_teks_tombol', 'warna_unggulan', 'warna_teks_unggulan'].forEach(function (k) {
    out[k] = /^#[0-9a-fA-F]{6}$/.test(String(s[k])) ? String(s[k]).toLowerCase() : DEFAULT_SETTINGS[k];
  });
  out.bentuk = SHAPES.indexOf(s.bentuk) >= 0 ? s.bentuk : 'bulat';

  var raw = Array.isArray(payload.links) ? payload.links : [];
  if (raw.length > MAX_LINKS) throw new Error('Maksimal ' + MAX_LINKS + ' link.');
  var seen = {};
  var links = raw.map(function (l, i) {
    var title = String(l.judul || '').trim().slice(0, 80);
    var label = title ? '"' + title + '"' : 'nomor ' + (i + 1);
    if (!title) throw new Error('Judul link ' + label + ' wajib diisi.');
    var url = normUrl_(l.url);
    if (!url) throw new Error('Alamat link ' + label + ' tidak valid. Contoh: https://milestoneenglish.id');
    var mulai = /^\d{4}-\d{2}-\d{2}$/.test(l.mulai) ? l.mulai : '';
    var sampai = /^\d{4}-\d{2}-\d{2}$/.test(l.sampai) ? l.sampai : '';
    if (mulai && sampai && mulai > sampai) throw new Error('Jadwal link ' + label + ': tanggal mulai melewati tanggal selesai.');
    var id = /^[\w-]{1,40}$/.test(l.id) && !seen[l.id] ? l.id : 'l-' + Utilities.getUuid().slice(0, 8);
    seen[id] = true;
    return {
      id: id,
      judul: title,
      keterangan: String(l.keterangan || '').trim().slice(0, 120),
      url: url,
      ikon: ICONS.indexOf(l.ikon) >= 0 ? l.ikon : 'link',
      unggulan: l.unggulan === true,
      aktif: l.aktif === true,
      mulai: mulai,
      sampai: sampai
    };
  });
  return { settings: out, links: links };
}

function normUrl_(v) {
  v = String(v || '').trim();
  if (!v || /\s/.test(v)) return '';
  if (/^(mailto:\S+@\S+|tel:\+?[\d-]{6,})$/i.test(v)) return v;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  return /^https?:\/\/[^/?#]+\.[^/?#]+/i.test(v) ? v : '';
}

function normWa_(v) {
  var d = String(v || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.charAt(0) === '0') d = '62' + d.slice(1);
  else if (d.charAt(0) === '8') d = '62' + d;
  return d.length >= 9 && d.length <= 15 ? d : null;
}

/** Ubah nama pengguna atau alamat menjadi link lengkap. Kosong → '', tidak valid → null. */
function socialHref_(key, v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (key === 'email') return /^(mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'mailto:' + v.replace(/^mailto:/, '') : null;
  if (/^https?:\/\//i.test(v)) return normUrl_(v) || null;
  var handle = v.replace(/^@/, '');
  var base = { instagram: 'https://instagram.com/', tiktok: 'https://www.tiktok.com/@', youtube: 'https://www.youtube.com/@', facebook: 'https://facebook.com/' }[key];
  if (base && /^[\w.-]+$/.test(handle)) return base + handle;
  return normUrl_(v) || null;
}

function isLive_(l, today) {
  return l.aktif && (!l.mulai || l.mulai <= today) && (!l.sampai || l.sampai >= today);
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/** Awal hari (00.00 WIB) beberapa hari lalu, dalam milidetik. */
function dayStart_(daysAgo) {
  return new Date(new Date(Date.now() + WIB_MS - daysAgo * DAY_MS).toISOString().slice(0, 10) + 'T00:00:00+07:00').getTime();
}

function time_(v) {
  return v instanceof Date ? v.getTime() : new Date(v).getTime();
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}

function bool_(v) {
  return /^(ya|true|1|on|yes)$/i.test(String(v).trim());
}

function yn_(b) {
  return b ? 'ya' : 'tidak';
}

function weakPin_(pin) {
  if (/^(\d)\1{3}$/.test(pin)) return true;
  return '0123456789'.indexOf(pin) >= 0 || '9876543210'.indexOf(pin) >= 0;
}

function ensureSheet_(ss, name, header, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) writeTable_(sh, header, rows, name === SHEET.clicks);
  return sh;
}

function writeTable_(sh, header, rows, keepFormat) {
  var all = [header].concat(rows);
  sh.clearContents();
  var range = sh.getRange(1, 1, all.length, header.length);
  if (!keepFormat) range.setNumberFormat('@');
  range.setValues(all);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
}

function safeJson_(data) {
  var lineBreaks = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(lineBreaks, ' ');
}

function sessions_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('SESSIONS') || '{}');
  } catch (err) {
    return {};
  }
}

function saveSessions_(all) {
  var now = Date.now();
  var keys = Object.keys(all).filter(function (k) { return all[k] > now; });
  keys.sort(function (a, b) { return all[b] - all[a]; });
  var out = {};
  keys.slice(0, 20).forEach(function (k) { out[k] = all[k]; });
  PropertiesService.getScriptProperties().setProperty('SESSIONS', JSON.stringify(out));
}

function validSession_(token) {
  if (!token) return false;
  var exp = sessions_()[hash_(token)];
  return !!exp && exp > Date.now();
}

function hash_(token) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token)));
}
