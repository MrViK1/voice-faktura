/* fa3.js — ядро: підрахунки, перевірки та генератор XML FA(3) для KSeF.
   Єдине джерело правди. Той самий файл використовує браузер і тести.
   Схема: http://crd.gov.pl/wzor/2025/06/25/13775/ (FA(3), wersja 1-0E, чинна з 01.02.2026) */
(function (global) {
'use strict';

var NS = 'http://crd.gov.pl/wzor/2025/06/25/13775/';

/* ── ставка VAT → поле підсумку у Fa ─────────────────────────────────
   Взято дослівно з описів у XSD, не з переказу. */
var STAWKI = {
  '23':    { netto: 'P_13_1', vat: 'P_14_1', mnoznik: 0.23, opis: '23%' },
  '22':    { netto: 'P_13_1', vat: 'P_14_1', mnoznik: 0.22, opis: '22%' },
  '8':     { netto: 'P_13_2', vat: 'P_14_2', mnoznik: 0.08, opis: '8%'  },
  '7':     { netto: 'P_13_2', vat: 'P_14_2', mnoznik: 0.07, opis: '7%'  },
  '5':     { netto: 'P_13_3', vat: 'P_14_3', mnoznik: 0.05, opis: '5%'  },
  '4':     { netto: 'P_13_4', vat: 'P_14_4', mnoznik: 0.04, opis: '4% ryczałt (taksówki)' },
  '3':     { netto: 'P_13_4', vat: 'P_14_4', mnoznik: 0.03, opis: '3% ryczałt (taksówki)' },
  '0 KR':  { netto: 'P_13_6_1', vat: null, mnoznik: 0, opis: '0% krajowa' },
  '0 WDT': { netto: 'P_13_6_2', vat: null, mnoznik: 0, opis: '0% WDT' },
  '0 EX':  { netto: 'P_13_6_3', vat: null, mnoznik: 0, opis: '0% eksport' },
  'zw':    { netto: 'P_13_7',  vat: null, mnoznik: 0, opis: 'zw — zwolniony z VAT' },
  'np I':  { netto: 'P_13_8',  vat: null, mnoznik: 0, opis: 'np — poza terytorium kraju' },
  'np II': { netto: 'P_13_9',  vat: null, mnoznik: 0, opis: 'np — art. 100 ust. 1 pkt 4' },
  'oo':    { netto: 'P_13_10', vat: null, mnoznik: 0, opis: 'oo — odwrotne obciążenie' }
};

/* порядок полів у <Fa> — схема вимагає строгої послідовності (xsd:sequence) */
var KOLEJNOSC_PODSUMOWANIA = [
  'P_13_1','P_14_1','P_13_2','P_14_2','P_13_3','P_14_3','P_13_4','P_14_4',
  'P_13_5','P_14_5','P_13_6_1','P_13_6_2','P_13_6_3','P_13_7','P_13_8',
  'P_13_9','P_13_10','P_13_11'
];

var FORMY_PLATNOSCI = {
  '1': 'Gotówka', '2': 'Karta', '3': 'Bon', '4': 'Czek',
  '5': 'Kredyt', '6': 'Przelew', '7': 'Mobilna'
};

var RODZAJE_FAKTURY = {
  VAT: 'Faktura podstawowa',
  ZAL: 'Faktura zaliczkowa',
  ROZ: 'Faktura rozliczeniowa',
  UPR: 'Faktura uproszczona',
  KOR: 'Faktura korygująca'
};

/* ── дрібні помічники ───────────────────────────────────────────── */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/* Схема: TKwotowy — decimal, рівно до 2 знаків, без ведучих нулів. */
function kwota(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  return (Math.round(v * 100) / 100).toFixed(2);
}

/* TIlosci — до 6 знаків після коми, зайві нулі прибираємо. */
function ilosc(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  var s = v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return s === '' || s === '-' ? '0' : s;
}

function tag(name, value, attrs) {
  var a = '';
  if (attrs) for (var k in attrs) a += ' ' + k + '="' + esc(attrs[k]) + '"';
  return '<' + name + a + '>' + esc(value) + '</' + name + '>';
}

/* Контрольна сума NIP. Помилка тут = KSeF відхилить фактуру. */
function nipPoprawny(nip) {
  var s = String(nip || '').replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(s)) return false;
  var w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  var sum = 0;
  for (var i = 0; i < 9; i++) sum += w[i] * Number(s[i]);
  var k = sum % 11;
  return k !== 10 && k === Number(s[9]);
}

/* Контрольна сума рахунку — один алгоритм IBAN (mod 97) для всіх:
   польські 26 цифр це IBAN без префікса, тож дописуємо PL і рахуємо так само.
   Без цього хибний закордонний рахунок пройшов би непоміченим. */
function nrbPoprawny(nrb) {
  var s = String(nrb || '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{26}$/.test(s)) s = 'PL' + s;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{6,30}$/.test(s)) return false;
  var przestawione = s.slice(4) + s.slice(0, 4);
  var reszta = 0;
  for (var i = 0; i < przestawione.length; i++) {
    var z = przestawione[i];
    var v = (z >= '0' && z <= '9') ? z : String(z.charCodeAt(0) - 55);
    for (var j = 0; j < v.length; j++) reszta = (reszta * 10 + Number(v[j])) % 97;
  }
  return reszta === 1;
}

/* ── підрахунки ─────────────────────────────────────────────────── */

function pozycjaKwoty(poz) {
  var st = STAWKI[poz.stawka] || STAWKI['23'];
  var ilo = Number(poz.ilosc) || 0;
  var cena = Number(poz.cenaNetto) || 0;
  var brutto0 = ilo * cena;
  /* Знижка або у злотих, або у відсотках — відсоток має першість,
     бо на фактурі показуємо «Rabat %», як у звичних польських програмах. */
  var rabat = Number(poz.rabatProcent) > 0
    ? Math.round(brutto0 * Number(poz.rabatProcent)) / 100
    : (Number(poz.rabat) || 0);
  var netto = Math.round((brutto0 - rabat) * 100) / 100;
  var vat = Math.round(netto * st.mnoznik * 100) / 100;
  return { netto: netto, vat: vat, brutto: Math.round((netto + vat) * 100) / 100,
           rabat: rabat, stawka: st,
           cenaPoRabacie: ilo ? Math.round((netto / ilo) * 100) / 100 : 0 };
}

function podsumuj(pozycje) {
  var pola = {}, netto = 0, vat = 0;
  (pozycje || []).forEach(function (p) {
    var k = pozycjaKwoty(p);
    var st = k.stawka;
    pola[st.netto] = Math.round(((pola[st.netto] || 0) + k.netto) * 100) / 100;
    if (st.vat) pola[st.vat] = Math.round(((pola[st.vat] || 0) + k.vat) * 100) / 100;
    netto += k.netto;
    vat += k.vat;
  });
  netto = Math.round(netto * 100) / 100;
  vat = Math.round(vat * 100) / 100;
  return { pola: pola, netto: netto, vat: vat, brutto: Math.round((netto + vat) * 100) / 100 };
}

/* ── сторож: що не так із фактурою ДО експорту ──────────────────── */

function sprawdz(doc) {
  var bledy = [];
  var s = doc.sprzedawca || {}, n = doc.nabywca || {}, f = doc.faktura || {};

  if (!nipPoprawny(s.nip)) bledy.push('NIP sprzedawcy niepoprawny (suma kontrolna): ' + (s.nip || '—'));
  if (!s.nazwa) bledy.push('Brak nazwy sprzedawcy');
  if (!s.adres) bledy.push('Brak adresu sprzedawcy');

  if (!n.nazwa) bledy.push('Brak nazwy nabywcy');
  var typ = n.typ || 'NIP';
  if (typ === 'NIP' && !nipPoprawny(n.nip)) bledy.push('NIP nabywcy niepoprawny (suma kontrolna): ' + (n.nip || '—'));
  if (typ === 'UE' && (!n.kodUE || !n.nrVatUE)) bledy.push('Brak kodu kraju UE lub numeru VAT UE nabywcy');
  if (typ === 'INNY' && !n.nrID) bledy.push('Brak identyfikatora podatkowego nabywcy');

  if (!f.numer) bledy.push('Brak numeru faktury');
  if (!f.dataWystawienia) bledy.push('Brak daty wystawienia');
  if (!f.dataSprzedazy) bledy.push('Brak daty sprzedaży (P_6)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dataWystawienia || '')) bledy.push('Data wystawienia w złym formacie (RRRR-MM-DD)');

  var poz = doc.pozycje || [];
  if (!poz.length) bledy.push('Faktura nie ma żadnej pozycji');
  poz.forEach(function (p, i) {
    if (!p.nazwa) bledy.push('Pozycja ' + (i + 1) + ': brak nazwy');
    if (!STAWKI[p.stawka]) bledy.push('Pozycja ' + (i + 1) + ': nieznana stawka VAT „' + p.stawka + '”');
    if (!(Number(p.ilosc) > 0)) bledy.push('Pozycja ' + (i + 1) + ': ilość musi być większa od zera');
  });

  /* Звільнення з VAT: якщо є позиція „zw”, схема wymaga podstawy prawnej. */
  var maZw = poz.some(function (p) { return p.stawka === 'zw'; });
  if (maZw && !(f.zwolnienie && f.zwolnienie.podstawa)) {
    bledy.push('Jest pozycja ze stawką „zw”, ale nie podano podstawy prawnej zwolnienia (P_19A/B/C)');
  }
  if (!maZw && f.zwolnienie && f.zwolnienie.podstawa) {
    bledy.push('Podano podstawę zwolnienia, ale żadna pozycja nie ma stawki „zw”');
  }

  /* Mechanizm podzielonej płatności — obowiązkowy powyżej 15 000 zł przy zał. 15. */
  var sumy = podsumuj(poz);
  if (f.mpp && sumy.brutto < 15000) {
    bledy.push('Zaznaczono mechanizm podzielonej płatności, a kwota brutto to ' + kwota(sumy.brutto) + ' zł (poniżej 15 000 zł)');
  }

  var plat = f.platnosc || {};
  var doSprawdzenia = (plat.rachunki && plat.rachunki.length)
    ? plat.rachunki.map(function (r) { return r && r.nr; })
    : [plat.rachunek];
  doSprawdzenia.forEach(function (nr, i) {
    if (nr && !nrbPoprawny(nr)) {
      bledy.push('Numer rachunku' + (doSprawdzenia.length > 1 ? ' nr ' + (i + 1) : '') +
        ' niepoprawny (suma kontrolna NRB / format IBAN)');
    }
  });
  if (f.rodzaj && !RODZAJE_FAKTURY[f.rodzaj]) bledy.push('Nieznany rodzaj faktury: ' + f.rodzaj);
  if (f.rodzaj === 'KOR' && !(f.korekta && f.korekta.numerKorygowanej)) {
    bledy.push('Faktura korygująca bez numeru faktury korygowanej');
  }
  return bledy;
}

/* ── генератор XML ──────────────────────────────────────────────── */

function adresXml(a, wciecie) {
  var w = wciecie;
  var out = w + '<Adres>\n';
  out += w + '  ' + tag('KodKraju', a.kraj || 'PL') + '\n';
  out += w + '  ' + tag('AdresL1', a.adres) + '\n';
  if (a.adres2) out += w + '  ' + tag('AdresL2', a.adres2) + '\n';
  out += w + '</Adres>\n';
  return out;
}

function buildFA3(doc, opcje) {
  opcje = opcje || {};
  var s = doc.sprzedawca, n = doc.nabywca, f = doc.faktura;
  var poz = doc.pozycje || [];
  var sumy = podsumuj(poz);
  var teraz = opcje.dataWytworzenia || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  var x = '';

  x += '<?xml version="1.0" encoding="UTF-8"?>\n';
  x += '<Faktura xmlns="' + NS + '">\n';

  x += '  <Naglowek>\n';
  x += '    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>\n';
  x += '    <WariantFormularza>3</WariantFormularza>\n';
  x += '    ' + tag('DataWytworzeniaFa', teraz) + '\n';
  x += '    ' + tag('SystemInfo', opcje.systemInfo || 'Faktura Lokalna') + '\n';
  x += '  </Naglowek>\n';

  x += '  <Podmiot1>\n';
  if (s.vatUE) x += '    <PrefiksPodatnika>PL</PrefiksPodatnika>\n';
  x += '    <DaneIdentyfikacyjne>\n';
  x += '      ' + tag('NIP', String(s.nip).replace(/[\s-]/g, '')) + '\n';
  x += '      ' + tag('Nazwa', s.nazwa) + '\n';
  x += '    </DaneIdentyfikacyjne>\n';
  x += adresXml({ kraj: s.kraj, adres: s.adres, adres2: s.adres2 }, '    ');
  x += '  </Podmiot1>\n';

  x += '  <Podmiot2>\n';
  x += '    <DaneIdentyfikacyjne>\n';
  var typ = n.typ || 'NIP';
  if (typ === 'NIP') {
    x += '      ' + tag('NIP', String(n.nip).replace(/[\s-]/g, '')) + '\n';
  } else if (typ === 'UE') {
    x += '      ' + tag('KodUE', n.kodUE) + '\n';
    x += '      ' + tag('NrVatUE', String(n.nrVatUE).replace(/[\s-]/g, '')) + '\n';
  } else if (typ === 'INNY') {
    if (n.kodKraju) x += '      ' + tag('KodKraju', n.kodKraju) + '\n';
    x += '      ' + tag('NrID', n.nrID) + '\n';
  } else { /* BRAK — osoba prywatna (B2C) */
    x += '      <BrakID>1</BrakID>\n';
  }
  x += '      ' + tag('Nazwa', n.nazwa) + '\n';
  x += '    </DaneIdentyfikacyjne>\n';
  if (n.adres) x += adresXml({ kraj: n.kraj, adres: n.adres, adres2: n.adres2 }, '    ');
  if (n.nrKlienta) x += '    ' + tag('NrKlienta', n.nrKlienta) + '\n';
  x += '    <JST>2</JST>\n';
  x += '    <GV>2</GV>\n';
  x += '  </Podmiot2>\n';

  x += '  <Fa>\n';
  x += '    ' + tag('KodWaluty', f.waluta || 'PLN') + '\n';
  x += '    ' + tag('P_1', f.dataWystawienia) + '\n';
  if (f.miejsceWystawienia) x += '    ' + tag('P_1M', f.miejsceWystawienia) + '\n';
  x += '    ' + tag('P_2', f.numer) + '\n';
  x += '    ' + tag('P_6', f.dataSprzedazy) + '\n';

  KOLEJNOSC_PODSUMOWANIA.forEach(function (pole) {
    if (sumy.pola[pole] !== undefined) x += '    ' + tag(pole, kwota(sumy.pola[pole])) + '\n';
  });
  x += '    ' + tag('P_15', kwota(sumy.brutto)) + '\n';

  /* Adnotacje — блок обов'язковий, кожне поле мусить бути. 1 = так, 2 = ні. */
  x += '    <Adnotacje>\n';
  x += '      ' + tag('P_16', f.metodaKasowa ? '1' : '2') + '\n';
  x += '      ' + tag('P_17', f.samofakturowanie ? '1' : '2') + '\n';
  x += '      ' + tag('P_18', f.odwrotneObciazenie ? '1' : '2') + '\n';
  x += '      ' + tag('P_18A', f.mpp ? '1' : '2') + '\n';
  if (f.zwolnienie && f.zwolnienie.podstawa) {
    var poleP = f.zwolnienie.rodzaj === 'dyrektywa' ? 'P_19B'
              : f.zwolnienie.rodzaj === 'inna' ? 'P_19C' : 'P_19A';
    x += '      <Zwolnienie>\n';
    x += '        <P_19>1</P_19>\n';
    x += '        ' + tag(poleP, f.zwolnienie.podstawa) + '\n';
    x += '      </Zwolnienie>\n';
  } else {
    x += '      <Zwolnienie><P_19N>1</P_19N></Zwolnienie>\n';
  }
  x += '      <NoweSrodkiTransportu><P_22N>1</P_22N></NoweSrodkiTransportu>\n';
  x += '      ' + tag('P_23', f.proceduraUproszczona ? '1' : '2') + '\n';
  x += '      <PMarzy><P_PMarzyN>1</P_PMarzyN></PMarzy>\n';
  x += '    </Adnotacje>\n';

  x += '    ' + tag('RodzajFaktury', f.rodzaj || 'VAT') + '\n';

  if ((f.rodzaj || 'VAT') === 'KOR' && f.korekta) {
    if (f.korekta.przyczyna) x += '    ' + tag('PrzyczynaKorekty', f.korekta.przyczyna) + '\n';
    if (f.korekta.typ) x += '    ' + tag('TypKorekty', String(f.korekta.typ)) + '\n';
    x += '    <DaneFaKorygowanej>\n';
    x += '      ' + tag('DataWystFaKorygowanej', f.korekta.dataKorygowanej) + '\n';
    x += '      ' + tag('NrFaKorygowanej', f.korekta.numerKorygowanej) + '\n';
    if (f.korekta.nrKSeF) {
      x += '      ' + tag('NrKSeF', f.korekta.nrKSeF) + '\n';
    } else {
      x += '      <NrKSeFN>1</NrKSeFN>\n';
    }
    x += '    </DaneFaKorygowanej>\n';
  }

  var opisy = [];
  if (f.uwagi) opisy.push({ klucz: 'Uwagi', wartosc: f.uwagi });
  if (f.sporzadzil) opisy.push({ klucz: 'Sporządził', wartosc: f.sporzadzil });
  (f.dodatkoweOpisy || []).forEach(function (o) {
    if (o && o.klucz && o.wartosc) opisy.push(o);
  });
  opisy.forEach(function (o) {
    x += '    <DodatkowyOpis>\n';
    x += '      ' + tag('Klucz', o.klucz) + '\n';
    x += '      ' + tag('Wartosc', o.wartosc) + '\n';
    x += '    </DodatkowyOpis>\n';
  });

  poz.forEach(function (p, i) {
    var k = pozycjaKwoty(p);
    x += '    <FaWiersz>\n';
    x += '      ' + tag('NrWierszaFa', String(i + 1)) + '\n';
    x += '      ' + tag('P_7', p.nazwa) + '\n';
    if (p.indeks) x += '      ' + tag('Indeks', p.indeks) + '\n';
    if (p.pkwiu) x += '      ' + tag('PKWiU', p.pkwiu) + '\n';
    if (p.cn) x += '      ' + tag('CN', p.cn) + '\n';
    x += '      ' + tag('P_8A', p.jednostka || 'szt.') + '\n';
    x += '      ' + tag('P_8B', ilosc(p.ilosc)) + '\n';
    x += '      ' + tag('P_9A', kwota(p.cenaNetto)) + '\n';
    if (k.rabat > 0) x += '      ' + tag('P_10', kwota(k.rabat)) + '\n';
    x += '      ' + tag('P_11', kwota(k.netto)) + '\n';
    x += '      ' + tag('P_12', p.stawka) + '\n';
    if (p.gtu) x += '      ' + tag('GTU', p.gtu) + '\n';
    x += '    </FaWiersz>\n';
  });

  var pl = f.platnosc || {};
  if (pl.zaplacono || pl.termin || pl.forma || pl.rachunek) {
    x += '    <Platnosc>\n';
    if (pl.zaplacono && pl.dataZaplaty) {
      x += '      <Zaplacono>1</Zaplacono>\n';
      x += '      ' + tag('DataZaplaty', pl.dataZaplaty) + '\n';
    }
    if (pl.termin) {
      x += '      <TerminPlatnosci>\n';
      x += '        ' + tag('Termin', pl.termin) + '\n';
      x += '      </TerminPlatnosci>\n';
    }
    if (pl.forma) x += '      ' + tag('FormaPlatnosci', String(pl.forma)) + '\n';
    var rachunki = (pl.rachunki && pl.rachunki.length) ? pl.rachunki
      : (pl.rachunek ? [{ nr: pl.rachunek, nazwaBanku: pl.nazwaBanku }] : []);
    rachunki.forEach(function (r) {
      if (!r || !r.nr) return;
      x += '      <RachunekBankowy>\n';
      x += '        ' + tag('NrRB', String(r.nr).replace(/[\s-]/g, '').replace(/^PL(?=\d)/i, '')) + '\n';
      if (r.swift) x += '        ' + tag('SWIFT', String(r.swift).toUpperCase()) + '\n';
      if (r.nazwaBanku) x += '        ' + tag('NazwaBanku', r.nazwaBanku) + '\n';
      if (r.opis) x += '        ' + tag('OpisRachunku', r.opis) + '\n';
      x += '      </RachunekBankowy>\n';
    });
    x += '    </Platnosc>\n';
  }

  x += '  </Fa>\n';
  if (f.stopka) {
    x += '  <Stopka>\n    <Informacje>\n';
    x += '      ' + tag('StopkaFaktury', f.stopka) + '\n';
    x += '    </Informacje>\n  </Stopka>\n';
  }
  x += '</Faktura>\n';
  return x;
}

/* Рядок QR-przelew за стандартом ЗБП 2D (Rekomendacja ZBP, 2013).
   Поля через '|': NIP|PL|rachunek26|kwotaWGroszach|nazwa(20)|tytul(32)|rez|rez|rez.
   Тільки польський 26-значний NRB і тільки PLN — інакше банки не розпізнають. */
function zbpQrString(o) {
  var acc = String(o.rachunek || '').replace(/[\s-]/g, '').replace(/^PL/i, '');
  if (!/^\d{26}$/.test(acc)) return null;
  if ((o.waluta || 'PLN') !== 'PLN') return null;
  var grosze = Math.round(Number(o.kwota || 0) * 100);
  if (!(grosze > 0)) return null;
  var suma = String(grosze); while (suma.length < 6) suma = '0' + suma;
  var nip = String(o.nip || '').replace(/[\s-]/g, '');
  nip = /^\d{10}$/.test(nip) ? nip : '';
  function tnij(v, n) { return String(v == null ? '' : v).slice(0, n); }
  var pola = [nip, 'PL', acc, suma, tnij(o.nazwa, 20), tnij(o.tytul, 32), '', '', ''];
  var wynik = pola.join('|');
  return wynik.length <= 160 ? wynik : null;
}

var FA3 = {
  NS: NS,
  STAWKI: STAWKI,
  FORMY_PLATNOSCI: FORMY_PLATNOSCI,
  RODZAJE_FAKTURY: RODZAJE_FAKTURY,
  kwota: kwota,
  ilosc: ilosc,
  nipPoprawny: nipPoprawny,
  nrbPoprawny: nrbPoprawny,
  pozycjaKwoty: pozycjaKwoty,
  podsumuj: podsumuj,
  sprawdz: sprawdz,
  buildFA3: buildFA3,
  zbpQrString: zbpQrString
};

if (typeof module !== 'undefined' && module.exports) module.exports = FA3;
global.FA3 = FA3;

})(typeof globalThis !== 'undefined' ? globalThis : this);
