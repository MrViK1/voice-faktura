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
var OCZEKUJE = null;  /* про що агент щойно спитав — щоб зрозуміти коротку відповідь */

function stan(t) { $('#stan').textContent = t; }

/* ── запис ─────────────────────────────────────────────────────── */
$('#btnMic').addEventListener('click', function () {
  if (pisze) { zatrzymaj(); } else { zacznij(); }
});

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
  }).catch(function (e) {
    stan('Немає доступу до мікрофона: ' + e.message);
  });
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
      if (!d.text) { stan('Нічого не почув — спробуйте ще раз'); return; }
      stan('Готово. Можна сказати ще раз або виправити поля руками.');
      STAN = ROZBIR.scal(STAN, ROZBIR.rozbierz(d.text, OCZEKUJE));
      pokazTekst(STAN.historia);
      wypelnij(STAN);
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

/* ── заповнення полів ──────────────────────────────────────────── */
function wypelnij(st) {
  var poz = ROZBIR.pozycjaGotowa(st);
  $('#fNabywca').value = st.nabywca.nazwa || '';
  $('#fNip').value     = st.nabywca.nip || '';
  $('#fNazwa').value   = poz.nazwa;
  $('#fIlosc').value   = poz.ilosc;
  $('#fJedn').value    = poz.jednostka;
  $('#fCena').value    = poz.cenaNetto;
  $('#fStawka').value  = poz.stawka;
  $('#fWaluta').value  = st.waluta || 'PLN';
  $('#blokPola').hidden = false;

  var q = ROZBIR.nastepnePytanie(st);
  OCZEKUJE = q ? q.klucz : null;
  if (q) {
    $('#brakuje').innerHTML = '<b>Агент питає:</b> ' + q.tekst +
      '<br><span class="cicho">Натисніть мікрофон і відповідайте — решта збережеться.</span>';
    $('#brakuje').hidden = false;
    zapytajGlosem(q.tekst);
  } else {
    $('#brakuje').className = 'brakuje gotowe';
    $('#brakuje').innerHTML = '<b>Усе є.</b> Можна будувати XML.';
    $('#brakuje').hidden = false;
    if (st.prywatna) $('#fNip').placeholder = 'osoba prywatna — BrakID';
  }
  przelicz();
}

function zapytajGlosem(tekst) {
  if (!window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    var m = new SpeechSynthesisUtterance(tekst);
    m.lang = 'uk-UA';
    var g = window.speechSynthesis.getVoices().filter(function (v) { return /uk|ru|pl/i.test(v.lang); });
    if (g.length) m.voice = g[0];
    window.speechSynthesis.speak(m);
  } catch (e) { /* мовчки: голос не критичний */ }
}

/* правки руками теж ідуть у памʼять, щоб наступна фраза їх не стерла */
function zapamietajPola() {
  if (!STAN) STAN = ROZBIR.scal(null, ROZBIR.rozbierz(''));
  STAN.nabywca.nazwa = $('#fNabywca').value || null;
  var nip = $('#fNip').value.replace(/[\s-]/g, '');
  STAN.nabywca.nip = nip || null;
  STAN.nabywca.typ = nip ? 'NIP' : (STAN.prywatna ? 'BRAK' : null);
  STAN.pozycja.nazwa = $('#fNazwa').value || null;
  STAN.pozycja.ilosc = Number($('#fIlosc').value) || null;
  STAN.pozycja.jednostka = $('#fJedn').value || null;
  STAN.pozycja.cenaNetto = Number($('#fCena').value) || null;
  STAN.pozycja.stawka = $('#fStawka').value || null;
  STAN.waluta = $('#fWaluta').value || null;
}

/* ── перерахунок ───────────────────────────────────────────────── */
['#fNabywca','#fNip','#fNazwa','#fIlosc','#fJedn','#fCena','#fStawka','#fWaluta'].forEach(function (s) {
  $(s).addEventListener('input', function () { zapamietajPola(); przelicz(); });
  $(s).addEventListener('change', function () { zapamietajPola(); przelicz(); });
});

function pozycjaZPol() {
  return {
    nazwa: $('#fNazwa').value || 'usługa',
    ilosc: Number($('#fIlosc').value) || 0,
    jednostka: $('#fJedn').value || 'usł.',
    cenaNetto: Number($('#fCena').value) || 0,
    stawka: $('#fStawka').value
  };
}

function przelicz() {
  var s = FA3.podsumuj([pozycjaZPol()]);
  $('#sNetto').textContent  = SLOWNIE.pl(s.netto.toFixed(2));
  $('#sVat').textContent    = SLOWNIE.pl(s.vat.toFixed(2));
  $('#sBrutto').textContent = SLOWNIE.pl(s.brutto.toFixed(2));
  $('#slownie').textContent = SLOWNIE.kwotaSlownie(s.brutto, $('#fWaluta').value);
}

/* ── XML ───────────────────────────────────────────────────────── */
$('#btnXml').addEventListener('click', function () {
  var dzis = new Date().toISOString().slice(0, 10);
  zapamietajPola();
  var nip = $('#fNip').value.replace(/[\s-]/g, '');
  var doc = {
    sprzedawca: SPRZEDAWCA,
    nabywca: { typ: nip ? 'NIP' : 'BRAK', nip: nip,
               nazwa: $('#fNabywca').value || 'Nabywca' },
    faktura: {
      numer: 'FV/GLOS/' + dzis.replace(/-/g, '') + '/1',
      dataWystawienia: dzis, dataSprzedazy: dzis,
      miejsceWystawienia: 'Warszawa', waluta: $('#fWaluta').value || 'PLN',
      platnosc: { forma: '6', termin: dzis }, rodzaj: 'VAT'
    },
    pozycje: [pozycjaZPol()]
  };

  var bledy = FA3.sprawdz(doc);
  var w = $('#walidacja');
  w.hidden = false;
  if (bledy.length) {
    w.className = 'walidacja';
    w.innerHTML = '<b>Схема FA(3) не прийме:</b><br>' + bledy.join('<br>');
    $('#blokXml').hidden = true;
    $('#btnPobierz').hidden = true;
    return;
  }
  w.className = 'walidacja dobra';
  w.textContent = 'Перевірку схеми FA(3) пройдено — помилок немає.';

  ostatniXml = FA3.buildFA3(doc, { systemInfo: 'Voice Faktura (AssemblyAI)' });
  $('#xml').textContent = ostatniXml;
  $('#blokXml').hidden = false;
  $('#btnPobierz').hidden = false;
});

$('#btnPobierz').addEventListener('click', function () {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ostatniXml], { type: 'application/xml' }));
  a.download = 'faktura-glos.xml';
  a.click();
});


/* ── почати заново ─────────────────────────────────────────────── */
var btnNowa = document.getElementById('btnNowa');
if (btnNowa) btnNowa.addEventListener('click', function () {
  STAN = null; OCZEKUJE = null; ostatniXml = '';
  ['#blokTekst','#blokPola','#blokXml'].forEach(function (s) { $(s).hidden = true; });
  $('#walidacja').hidden = true;
  stan('Натисніть і скажіть, кому і за що виставити фактуру');
});
