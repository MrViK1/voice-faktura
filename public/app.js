/* Voice Faktura — браузерна частина.
   Ключа тут немає: аудіо йде на свій сервер, той говорить із AssemblyAI. */
'use strict';

var SPRZEDAWCA = {
  nip: '1234563218', nazwa: 'Demo Studio Sp. z o.o.',
  kraj: 'PL', adres: 'ul. Przykładowa 7/2, 00-001 Warszawa'
};

var $ = function (s) { return document.querySelector(s); };
var rejestrator = null, kawalki = [], pisze = false, ostatniXml = '';
var STAN = null;      /* памʼять розмови: нова фраза доповнює, не стирає */
var OCZEKUJE = null;  /* про що агент щойно спитав */
var STAWKI = ['23', '8', '5', '0', 'zw'];

function stan(t) { $('#stan').textContent = t; }

/* ── запис ─────────────────────────────────────────────────────── */
$('#btnMic').addEventListener('click', function () { pisze ? zatrzymaj() : zacznij(); });

function zacznij() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (strumien) {
    kawalki = [];
    rejestrator = new MediaRecorder(strumien);
    rejestrator.ondataavailable = function (e) { if (e.data.size) kawalki.push(e.data); };
    rejestrator.onstop = function () {
      strumien.getTracks().forEach(function (t) { t.stop(); });
      wyslij(new Blob(kawalki, { type: rejestrator.mimeType || 'audio/webm' }));
    };
    rejestrator.start();
    pisze = true;
    $('#btnMic').classList.add('pisze');
    stan('Слухаю… натисніть ще раз, коли закінчите');
  }).catch(function (e) { stan('Немає доступу до мікрофона: ' + e.message); });
}

function zatrzymaj() {
  pisze = false;
  $('#btnMic').classList.remove('pisze');
  $('#btnMic').classList.add('czeka');
  stan('Розпізнаю…');
  if (rejestrator && rejestrator.state !== 'inactive') rejestrator.stop();
}

function wyslij(blob) {
  var lang = (document.querySelector('input[name=lang]:checked') || {}).value || 'uk';
  fetch('/api/transcribe?lang=' + lang, { method: 'POST', body: blob })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      $('#btnMic').classList.remove('czeka');
      if (d.error) { stan('Помилка: ' + d.error); return; }
      if (!d.text)  { stan('Нічого не почув — спробуйте ще раз'); return; }
      stan('Готово. Можна сказати ще раз або виправити руками.');
      /* спершу словник — щоб екран заповнився одразу */
      STAN = ROZBIR.scal(STAN, ROZBIR.rozbierz(d.text, OCZEKUJE));
      zapiszHistorie();
      pokazTekst(STAN.historia);
      pokazWszystko();
      /* потім модель — вона розуміє будь-які слова, і уточнює те, що словник не взяв */
      uscislijModelem();
    })
    .catch(function (e) {
      $('#btnMic').classList.remove('czeka');
      stan('Помилка мережі: ' + e.message);
    });
}

function pokazTekst(historia) {
  $('#tekst').innerHTML = historia.map(function (h, i) {
    return '<span class="fraza">' + (i + 1) + '. ' + h + '</span>';
  }).join('');
  $('#blokTekst').hidden = false;
}

/* ── малюємо рядки позицій ─────────────────────────────────────── */
function rysujWiersze() {
  var poz = STAN.pozycje.length ? STAN.pozycje : [{}];
  $('#wiersze').innerHTML = poz.map(function (p, i) {
    return '<div class="wiersz" data-i="' + i + '">' +
      '<input class="w-nazwa" value="' + esc(p.nazwa || '') + '" placeholder="usługa">' +
      '<input class="w-ilosc liczba" type="number" step="0.001" value="' + (p.ilosc || 1) + '">' +
      '<input class="w-jedn" value="' + esc(p.jednostka || 'usł.') + '">' +
      '<input class="w-cena liczba" type="number" step="0.01" value="' + (p.cenaNetto || 0) + '">' +
      '<select class="w-stawka">' + STAWKI.map(function (s) {
        return '<option value="' + s + '"' + ((p.stawka || '23') === s ? ' selected' : '') + '>' +
               (s === 'zw' ? 'zw.' : s + '%') + '</option>';
      }).join('') + '</select>' +
      '<button class="usun" title="видалити">×</button>' +
    '</div>';
  }).join('');

  $('#wiersze').querySelectorAll('.wiersz').forEach(function (w) {
    w.querySelectorAll('input,select').forEach(function (el) {
      el.addEventListener('input', czytajWiersze);
      el.addEventListener('change', czytajWiersze);
    });
    w.querySelector('.usun').addEventListener('click', function () {
      var i = Number(w.dataset.i);
      STAN.pozycje.splice(i, 1);
      if (!STAN.pozycje.length) STAN.pozycje = [{ cenaNetto: 0 }];
      pokazWszystko();
    });
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function czytajWiersze() {
  STAN.pozycje = Array.prototype.map.call($('#wiersze').querySelectorAll('.wiersz'), function (w) {
    return {
      nazwa: w.querySelector('.w-nazwa').value || null,
      ilosc: Number(w.querySelector('.w-ilosc').value) || null,
      jednostka: w.querySelector('.w-jedn').value || null,
      cenaNetto: Number(w.querySelector('.w-cena').value) || 0,
      stawka: w.querySelector('.w-stawka').value
    };
  });
  STAN.nabywca.nazwa = $('#fNabywca').value || null;
  var nip = $('#fNip').value.replace(/[\s-]/g, '');
  STAN.nabywca.nip = nip || null;
  STAN.nabywca.typ = nip ? 'NIP' : (STAN.prywatna ? 'BRAK' : null);
  STAN.waluta = $('#fWaluta').value || 'PLN';
  var pz = $('#fZw').value.trim();
  STAN.zwolnienie = pz ? { rodzaj: /dyrektyw/i.test(pz) ? 'dyrektywa' : 'ustawa', podstawa: pz } : null;
  przelicz();
  pytanie();
}

$('#btnDodaj').addEventListener('click', function () {
  STAN.pozycje.push({ nazwa: null, ilosc: 1, jednostka: 'usł.', cenaNetto: 0, stawka: '23' });
  pokazWszystko();
});

['#fNabywca', '#fNip', '#fWaluta', '#fZw'].forEach(function (s) {
  $(s).addEventListener('input', czytajWiersze);
});

/* ── повне перемалювання ───────────────────────────────────────── */
function pokazWszystko() {
  $('#fNabywca').value = STAN.nabywca.nazwa || '';
  $('#fNip').value     = STAN.nabywca.nip || '';
  $('#fWaluta').value  = STAN.waluta || 'PLN';
  if (STAN.prywatna) $('#fNip').placeholder = 'osoba prywatna — BrakID';
  var maZw = STAN.pozycje.some(function (p) { return p.stawka === 'zw'; });
  $('#blokZw').hidden = !maZw;
  $('#fZw').value = (STAN.zwolnienie && STAN.zwolnienie.podstawa) || '';
  $('#blokPola').hidden = false;
  rysujWiersze();
  przelicz();
  pytanie();
}

function pytanie() {
  var q = ROZBIR.nastepnePytanie(STAN);
  OCZEKUJE = q ? q.klucz : null;
  var el = $('#brakuje');
  el.hidden = false;
  if (q) {
    el.className = 'brakuje';
    el.innerHTML = '<b>Агент питає:</b> ' + q.tekst +
      '<br><span class="cicho">Натисніть мікрофон і відповідайте — решта збережеться.</span>';
    zapytajGlosem(q.tekst);
  } else {
    el.className = 'brakuje gotowe';
    el.innerHTML = '<b>Усе є.</b> Можна будувати XML.';
  }
}

var ostatniePytanie = '';
function zapytajGlosem(tekst) {
  if (!window.speechSynthesis || tekst === ostatniePytanie) return;
  ostatniePytanie = tekst;
  try {
    window.speechSynthesis.cancel();
    var m = new SpeechSynthesisUtterance(tekst);
    m.lang = 'uk-UA';
    var g = window.speechSynthesis.getVoices().filter(function (v) { return /uk|pl/i.test(v.lang); });
    if (g.length) m.voice = g[0];
    window.speechSynthesis.speak(m);
  } catch (e) { /* голос не критичний */ }
}

function przelicz() {
  var s = FA3.podsumuj(ROZBIR.pozycjeGotowe(STAN));
  $('#sNetto').textContent  = SLOWNIE.pl(s.netto.toFixed(2));
  $('#sVat').textContent    = SLOWNIE.pl(s.vat.toFixed(2));
  $('#sBrutto').textContent = SLOWNIE.pl(s.brutto.toFixed(2));
  $('#slownie').textContent = SLOWNIE.kwotaSlownie(s.brutto, STAN.waluta || 'PLN');
}

/* ── XML ───────────────────────────────────────────────────────── */
$('#btnXml').addEventListener('click', function () {
  var dzis = new Date().toISOString().slice(0, 10);
  var nip = (STAN.nabywca.nip || '');
  var doc = {
    sprzedawca: SPRZEDAWCA,
    nabywca: { typ: nip ? 'NIP' : 'BRAK', nip: nip, nazwa: STAN.nabywca.nazwa || 'Nabywca' },
    faktura: {
      numer: 'FV/GLOS/' + dzis.replace(/-/g, '') + '/1',
      dataWystawienia: dzis, dataSprzedazy: dzis,
      miejsceWystawienia: 'Warszawa', waluta: STAN.waluta || 'PLN',
      platnosc: { forma: '6', termin: dzis }, rodzaj: 'VAT',
      zwolnienie: STAN.zwolnienie || null
    },
    pozycje: ROZBIR.pozycjeGotowe(STAN)
  };

  var bledy = FA3.sprawdz(doc), w = $('#walidacja');
  w.hidden = false;
  if (bledy.length) {
    w.className = 'walidacja';
    w.innerHTML = '<b>Схема FA(3) не прийме:</b><br>' + bledy.join('<br>');
    $('#blokXml').hidden = true; $('#btnPobierz').hidden = true;
    return;
  }
  w.className = 'walidacja dobra';
  w.textContent = 'Перевірку схеми FA(3) пройдено — помилок немає. Позицій: ' + doc.pozycje.length + '.';
  ostatniXml = FA3.buildFA3(doc, { systemInfo: 'Voice Faktura (AssemblyAI)' });
  $('#xml').textContent = ostatniXml;
  $('#blokXml').hidden = false; $('#btnPobierz').hidden = false;
});

$('#btnPobierz').addEventListener('click', function () {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ostatniXml], { type: 'application/xml' }));
  a.download = 'faktura-glos.xml';
  a.click();
});

/* ── уточнення моделлю ─────────────────────────────────────────
   Словник дає швидкий результат із відомих слів. Модель бере
   будь-які слова й будь-які відмінки. Немає моделі — лишається словник. */
function uscislijModelem() {
  znak('модель думає…');
  fetch('/api/extract', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ historia: STAN.historia, stan: doModelu(STAN) })
  })
    .then(function (r) { return r.json(); })
    .then(function (o) {
      if (!o.ok || !o.dane) { znak('словник'); return; }
      zModelu(o.dane);
      pokazWszystko();
      znak('модель');
    })
    .catch(function () { znak('словник'); });
}

function doModelu(st) {
  return {
    nabywca: { nazwa: st.nabywca.nazwa, nip: st.nabywca.nip, prywatna: !!st.prywatna },
    waluta: st.waluta || 'PLN',
    zwolnienie: st.zwolnienie || null,
    pozycje: st.pozycje
  };
}

function zModelu(d) {
  if (d.nabywca) {
    if (d.nabywca.nazwa) STAN.nabywca.nazwa = d.nabywca.nazwa;
    STAN.nabywca.nip = d.nabywca.nip || null;
    if (d.nabywca.prywatna) STAN.prywatna = true;
    STAN.nabywca.typ = STAN.nabywca.nip ? 'NIP' : (STAN.prywatna ? 'BRAK' : null);
  }
  if (d.waluta) STAN.waluta = d.waluta;
  if (d.zwolnienie && d.zwolnienie.podstawa)
    STAN.zwolnienie = { rodzaj: 'ustawa', podstawa: d.zwolnienie.podstawa };
  else if (STAN.zwolnienie && STAN.zwolnienie.podstawa &&
           !/(?:art|ustaw|dyrektyw|§)/i.test(STAN.zwolnienie.podstawa))
    STAN.zwolnienie = null;   /* у полі було сміття — модель його не підтвердила */
  if (d.pozycje && d.pozycje.length) {
    STAN.pozycje = d.pozycje.map(function (p) {
      return { nazwa: p.nazwa || null, ilosc: Number(p.ilosc) || 1,
               jednostka: p.jednostka || 'usł.', cenaNetto: Number(p.cenaNetto) || 0,
               stawka: String(p.stawka || '23') };
    });
  }
}

function znak(t) {
  var el = document.getElementById('znak');
  if (el) el.textContent = t;
}

/* ── памʼять між перезавантаженнями ────────────────────────────
   Фрази зберігаються, і після перезавантаження розбираються
   ЗАНОВО — новим кодом. Наговорювати вдруге не треба. */
var KLUCZ = 'voice-faktura-historia';

function zapiszHistorie() {
  try { localStorage.setItem(KLUCZ, JSON.stringify(STAN.historia)); } catch (e) {}
}

function wczytajHistorie() {
  var h;
  try { h = JSON.parse(localStorage.getItem(KLUCZ) || '[]'); } catch (e) { return; }
  if (!h || !h.length) return;
  STAN = null;
  h.forEach(function (f) {
    var q = STAN ? ROZBIR.nastepnePytanie(STAN) : null;
    STAN = ROZBIR.scal(STAN, ROZBIR.rozbierz(f, q ? q.klucz : null));
  });
  pokazTekst(STAN.historia);
  pokazWszystko();
  stan('Попередні фрази розібрано заново. Можна говорити далі.');
  uscislijModelem();
}

$('#btnNowa').addEventListener('click', function () {
  try { localStorage.removeItem(KLUCZ); } catch (e) {}
  STAN = null; OCZEKUJE = null; ostatniXml = ''; ostatniePytanie = '';
  ['#blokTekst', '#blokPola', '#blokXml'].forEach(function (s) { $(s).hidden = true; });
  $('#walidacja').hidden = true;
  stan('Натисніть і скажіть, кому і за що виставити фактуру');
});

wczytajHistorie();
