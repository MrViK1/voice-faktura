/* Розбір надиктованого в структуру фактури FA(3).
   Працює правилами: без мережі, без витрат, детерміновано.
   Модель LLM підключається окремо і лише як уточнювач. */
(function (global) {
'use strict';

/* ── послуги й товари: українська → польська ───────────────────── */
var USLUGI_OGOLNE = { 'послуг': 'usługa', 'робот': 'usługa', 'товар': 'towar' };

var USLUGI = {
  'консультац': 'konsultacja', 'консультування': 'konsultacja',
  'переклад': 'tłumaczenie', 'ремонт': 'naprawa', 'монтаж': 'montaż',
  'доставк': 'dostawa', 'перевезенн': 'transport', 'транспорт': 'transport',
  'прибиранн': 'sprzątanie', 'навчанн': 'szkolenie', 'тренінг': 'szkolenie',
  'сайт': 'strona internetowa', 'програм': 'oprogramowanie',
  'реклам': 'reklama', 'дизайн': 'projekt graficzny',
  'бухгалтер': 'usługi księgowe', 'оренд': 'najem', 'найм': 'najem',
  'матеріал': 'materiały',
  'внес': 'składki', 'опла[тч]': 'opłata', 'збір': 'opłata',
  'супров': 'obsługa', 'допомог': 'pomoc', 'оформленн': 'obsługa formalności',
  'підготовк': 'przygotowanie dokumentów', 'юридичн': 'usługi prawne'
};

/* складені назви: перевіряються першими, бо точніші за одне слово */
var USLUGI_ZLOZONE = [
  [/карт[аиіїу]?\s*(?:по\s*)?(?:бит|бут|бет|бят|byt)|karta\s*pobytu|по\s*бету/i,
   'pomoc w sprawie karty pobytu'],
  [/(pesel|песель)/i, 'pomoc w uzyskaniu PESEL'],
  [/(jdg|jednoosobow|єдноосіб|реєстрац\w*\s*ф[іи]рм)/i, 'rejestracja JDG'],
  [/(ksef|ксеф)/i, 'wdrożenie KSeF'],
  [/(деклараці|deklaracj|pit|вит\b)/i, 'przygotowanie deklaracji']
];

/* ── одиниці ───────────────────────────────────────────────────── */
var JEDNOSTKI = {
  'годин': 'godz.', 'год': 'godz.', 'день': 'dzień', 'дні': 'dni', 'днів': 'dni',
  'штук': 'szt.', 'шт': 'szt.', 'кілограм': 'kg', 'кг': 'kg',
  'метр': 'm', 'кілометр': 'km', 'місяц': 'mies.', 'послуг': 'usł.'
};

/* ── числа словами, які не нормалізувались ─────────────────────── */
var SLOVA_CYFRY = {
  'нуль':0,'один':1,'одна':1,'одну':1,'дві':2,'два':2,'три':3,'чотири':4,'пʼять':5,'пять':5,
  'шість':6,'сім':7,'вісім':8,'девʼять':9,'девять':9,'десять':10,
  'одинадцять':11,'дванадцять':12,'тринадцять':13,'чотирнадцять':14,'пʼятнадцять':15,
  'шістнадцять':16,'сімнадцять':17,'вісімнадцять':18,'девʼятнадцять':19,
  'двадцять':20,'тридцять':30,'сорок':40,'пʼятдесят':50,'сто':100,'тисяча':1000,'тисячу':1000
};

/* ── валюти ────────────────────────────────────────────────────── */
function walutaZTekstu(t) {
  if (/євро|euro|eur\b/i.test(t)) return 'EUR';
  if (/долар|dolar|usd\b/i.test(t)) return 'USD';
  return 'PLN';
}

/* ── прізвище в давальному відмінку → польський називний ──────── */
var TRANSLIT = {'а':'a','б':'b','в':'w','г':'h','ґ':'g','д':'d','е':'e','є':'ie','ж':'ż','з':'z',
 'и':'y','і':'i','ї':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s',
 'т':'t','у':'u','ф':'f','х':'ch','ц':'c','ч':'cz','ш':'sz','щ':'szcz','ь':'','ю':'iu','я':'ia'};

/* чоловічі імена на -ій: щоб «Віталія» не стало «Віталія», а «Марію» не стало «Марій» */
var MESKIE_IJ = /^(вітал|андр|серг|юр|валер|анатол|васил|геннад|аркад|олекс|дмитр|євген|арсен|терент|леон)/;

/* Найчастіші імена у відмінках. Правилами їх не взяти:
   Петра → Петро, але Івана → Іван. Тому список. */
var IMENA = {
  'петра':'петро','петру':'петро','петрові':'петро',
  'івана':'іван','івану':'іван','іванові':'іван',
  'олександра':'олександр','олександру':'олександр',
  'дмитра':'дмитро','дмитру':'дмитро',
  'михайла':'михайло','михайлу':'михайло',
  'павла':'павло','павлу':'павло',
  'василя':'василь','василю':'василь',
  'сергія':'сергій','сергію':'сергій',
  'андрія':'андрій','андрію':'андрій',
  'юрія':'юрій','юрію':'юрій',
  'ігоря':'ігор','ігорю':'ігор',
  'романа':'роман','роману':'роман',
  'тараса':'тарас','тарасу':'тарас',
  'богдана':'богдан','богдану':'богдан',
  'віталія':'віталій','віталію':'віталій',
  'миколи':'микола','миколу':'микола',
  'ірини':'ірина','ірину':'ірина',
  'олени':'олена','олену':'олена',
  'оксани':'оксана','оксану':'оксана',
  'тетяни':'тетяна','тетяну':'тетяна',
  'ольги':'ольга','ольгу':'ольга',
  'катерини':'катерина','катерину':'катерина',
  'світлани':'світлана','світлану':'світлана',
  'людмили':'людмила','людмилу':'людмила',
  'наталії':'наталія','наталію':'наталія',
  'юлії':'юлія','юлію':'юлія',
  'анни':'анна','анну':'анна',
  'іни':'іна','іну':'іна','іри':'іра','іру':'іра',
  'галини':'галина','галину':'галина','галині':'галина',
  'марини':'марина','марину':'марина','валентини':'валентина',
  'ганни':'ганна','ганну':'ганна','лесі':'леся','лесю':'леся',
  'зої':'зоя','зою':'зоя','віри':'віра','віру':'віра','надії':'надія','надію':'надія'
};

function imiePl(slowo) {
  var s = String(slowo).toLowerCase();
  if (IMENA[s]) s = IMENA[s];
  else {
  /* знахідний і давальний → називний */
  if (/і[юя]$/.test(s)) {
    var pien = s.slice(0, -2);
    s = pien + (MESKIE_IJ.test(pien) ? 'ій' : 'ія');
  } else {
    s = s.replace(/ії$/, 'ія')                          /* Марії → Марія */
         .replace(/([бвгджзклмнпрстфхцчшщ])и$/, '$1а')   /* Іни → Іна, Оксани → Оксана */
         .replace(/([бвгджзклмнпрстфхцчшщ])у$/, '$1а')   /* Іну → Іна, Анну → Анна */
         .replace(/ря$/, 'р')                            /* Ігоря → Ігор */
         .replace(/ю$/, 'я')                             /* Олю → Оля */
         .replace(/ові$/, '').replace(/еві$/, '');
  }
  }
  /* в імені кінцеве «я» звучить як -a по-польськи: Оля → Ola, Марія → Maria */
  s = s.replace(/я$/, 'а');
  var out = '';
  for (var i = 0; i < s.length; i++) out += (TRANSLIT[s[i]] !== undefined ? TRANSLIT[s[i]] : s[i]);
  out = out.replace(/ii/g, 'i');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function nazwiskoPl(slowo) {
  var s = slowo.toLowerCase();
  /* давальний відмінок: Ковальському → Ковальський */
  s = s.replace(/ському$/, 'ський').replace(/цькому$/, 'цький')
       .replace(/ову$/, 'ов').replace(/еву$/, 'ев').replace(/іну$/, 'ін')
       .replace(/енку$/, 'енко').replace(/уку$/, 'ук').replace(/юку$/, 'юк')
       .replace(/ку$/, 'ко');
  /* родовий: «для Новака» → Новак; «для Шевченка» → Шевченко */
  s = s.replace(/енка$/, 'енко').replace(/ака$/, 'ак').replace(/ука$/, 'ук')
       .replace(/([бвгджзклмнпрстфхцчшщ])а$/, '$1');
  /* польські закінчення */
  s = s.replace(/ський$/, 'ski').replace(/цький$/, 'cki').replace(/ич$/, 'icz');
  var out = '';
  for (var i = 0; i < s.length; i++) out += (TRANSLIT[s[i]] !== undefined ? TRANSLIT[s[i]] : s[i]);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/* ── ознаки приватної особи ────────────────────────────────────── */
function osobaPrywatna(t) {
  return /особ[а-яіїєґ]*\s*приватн|приватн[а-яіїєґ]*\s*особ|osoba\s+prywatn|ф[іи]зичн[а-яіїєґ]*\s*особ|без\s*(?:nip|н[іи]п)|b2c/i.test(t);
}

/* ── імʼя і прізвище з мовлення ────────────────────────────────── */
var STOP_SLOVA = new RegExp('^(' + [
  'це','цей','ця','для','від','за','на','по','плюс','без','ще','там','тут',
  'фактура','фактуру','фактури','фактору','фактор','faktura','faktury',
  'хочу','треба','потрібно','зроби','зробити','напиши','написати','додай',
  'виставити','виставь','виставляю','висказати','сказати','зробім',
  'nip','ніп','нип','особа','особу','приватна','приватну','пан','пані',
  'послуга','послуги','послугу','ціна','ціну','сума','суму','вартість',
  'одна','один','дві','два','три','штука','штуки','година','години',
  'firma','sp','карта','карту','карті','побиту','побуту','бету','pobytu',
  'консультація','консультацію','консультацією','супровід','ремонт','переклад'
].join('|') + ')$', 'i');

function imieNazwisko(tekst) {
  var zdania = String(tekst).split(/[.!?]+/);
  var kandydaci = [];
  zdania.forEach(function (zd) {
    var slowa = zd.split(/[\s,;:]+/).filter(Boolean);
    var ciag = [];
    for (var i = 0; i < slowa.length; i++) {
      var w = slowa[i].replace(/[.,;:!?]+$/, '');
      var duza = /^[А-ЯІЇЄҐA-Z][а-яіїєґʼ'a-zA-ZżźćńółęąśŻŹĆĄŚĘŁÓŃ-]{2,}$/.test(w);
      var zle  = STOP_SLOVA.test(w) || SLOVA_CYFRY[w.toLowerCase()] !== undefined
                 || JEDNOSTKI[w.toLowerCase()] !== undefined;
      if (duza && !zle) { ciag.push(w); }
      else { if (ciag.length) kandydaci.push(ciag.slice()); ciag = []; }
    }
    if (ciag.length) kandydaci.push(ciag.slice());
  });
  if (!kandydaci.length) return null;
  /* беремо найдовший суміжний ланцюжок — це і є імʼя з прізвищем */
  var naj = kandydaci.sort(function (a, b) { return b.length - a.length; })[0];
  var nazwisko = nazwiskoPl(naj[naj.length - 1]);
  if (naj.length === 1) return nazwisko;
  var imie = imiePl(naj[0]);
  return (imie + ' ' + nazwisko).replace(/\s+/g, ' ').trim();
}

/* ── позиції з мовлення ─────────────────────────────────────────
   Кожна сума — якір. Назву беремо з тексту перед нею, а якщо там
   нічого — з тексту після неї, до наступної суми.
   «супровід 2800, плюс 300 консультації, плюс внески 1800»
   → три рядки, а не один.                                        */
function nazwaZOkna(okno, odKonca) {
  var niskie = okno.toLowerCase(), trafienia = [];
  for (var z = 0; z < USLUGI_ZLOZONE.length; z++) {
    var m = okno.match(USLUGI_ZLOZONE[z][0]);
    if (m) trafienia.push({ i: okno.indexOf(m[0]), nazwa: USLUGI_ZLOZONE[z][1], waga: 2 });
  }
  for (var u in USLUGI) {
    var i1 = niskie.lastIndexOf(u), i2 = niskie.indexOf(u);
    if (i2 >= 0) trafienia.push({ i: odKonca ? i1 : i2, nazwa: USLUGI[u], waga: 1 });
  }
  for (var o in USLUGI_OGOLNE) {
    var j = odKonca ? niskie.lastIndexOf(o) : niskie.indexOf(o);
    if (j >= 0) trafienia.push({ i: j, nazwa: USLUGI_OGOLNE[o], waga: 0 });
  }
  if (!trafienia.length) return null;
  /* беремо найближче до самої суми: з вікна перед нею — останнє,
     з вікна після неї — перше. За рівної відстані виграє точніша назва. */
  /* спершу точність назви (складена > конкретна > загальна),
     за рівної точності — близькість до самої суми */
  trafienia.sort(function (a, b) {
    if (b.waga !== a.waga) return b.waga - a.waga;
    return odKonca ? (b.i - a.i) : (a.i - b.i);
  });
  return trafienia[0].nazwa;
}

function jednostkaZOkna(okno) {
  var n = okno.toLowerCase();
  for (var k in JEDNOSTKI) {
    var m = n.match(new RegExp('(\\d+|[а-яіїєґʼ]+)\\s*' + k, 'i'));
    if (m) return { jednostka: JEDNOSTKI[k], ilosc: Number(m[1]) || SLOVA_CYFRY[m[1]] || 1 };
  }
  return null;
}

/* сполучники, що відділяють одну позицію фактури від наступної */
var DZIELNIK = /(?:\bплюс\b|\bplus\b|\bтакож\b|\bта\b|\bі\b|[,;–—]|\s-\s)/gi;

function ostatniDzielnik(s) {
  var m, last = -1, len = 0;
  DZIELNIK.lastIndex = 0;
  while ((m = DZIELNIK.exec(s))) { last = m.index; len = m[0].length; }
  return last < 0 ? null : { i: last, len: len };
}
function poDzielniku(s)      { var d = ostatniDzielnik(s); return d ? s.slice(d.i + d.len) : s; }
function przedDzielnikiem(s) { var d = ostatniDzielnik(s); return d ? s.slice(0, d.i) : s; }

function pozycjeZTekstu(t, niski, stawkaOgolna) {
  /* усі числа, які можуть бути грошима: не NIP (10 цифр) і не відсоток */
  var re = /(\d[\d\s ]{1,9}(?:[.,]\d{1,2})?)/g, m, kotwice = [];
  while ((m = re.exec(t))) {
    var czysta = String(m[1]).replace(/[\s ]/g, '');
    var v = Number(czysta.replace(',', '.'));
    if (!v) continue;
    if (czysta.replace(/[.,].*/, '').length === 10) continue;             /* NIP */
    var po = t.slice(m.index + m[1].length, m.index + m[1].length + 12);
    if (/^\s*(?:%|відсот|procent|proc)/i.test(po)) continue;              /* ставка */
    if (/^\s*(?:годин|год\b|штук|шт\b|кілограм|кг\b|метр|км\b|дн[ія]|день|місяц|осіб|особ)/i.test(po))
      continue;                                                            /* кількість */
    var przed = t.slice(Math.max(0, m.index - 22), m.index);
    if (/(?:^|[\s,;:(])(?:ставк|stawk)[а-яіїєґa-z]*\s*(?:пдв|vat)?\s*$/i.test(przed)) continue;
    kotwice.push({ v: v, od: m.index, do: m.index + m[1].length });
  }
  if (!kotwice.length) return [];

  var poz = [];
  for (var i = 0; i < kotwice.length; i++) {
    var k = kotwice[i];
    /* Проміжок між двома сумами треба розрізати по сполучнику,
       інакше «консультація, плюс 1800 сам внесок» віддає обидві
       назви обом рядкам. Ріжемо по ОСТАННЬОМУ сполучнику. */
    var przedOkno, poOkno;
    if (i === 0) przedOkno = t.slice(0, k.od);
    else przedOkno = poDzielniku(t.slice(kotwice[i - 1].do, k.od));
    if (i === kotwice.length - 1) poOkno = t.slice(k.do);
    else poOkno = przedDzielnikiem(t.slice(k.do, kotwice[i + 1].od));

    var nazwa = nazwaZOkna(przedOkno, true) || nazwaZOkna(poOkno, false);
    var jed   = jednostkaZOkna(przedOkno) || jednostkaZOkna(poOkno) || { jednostka: null, ilosc: null };

    /* власна ставка рядка, якщо названа поруч */
    var st = null;
    var mSt = (przedOkno + ' ' + poOkno).match(/(\d{1,2})\s*(?:%|відсотк[а-яіїєґ]*|procent[a-z]*)/);
    if (mSt) st = String(Number(mSt[1]));
    if (/зві?льнен|zwolnion|без\s*пдв/i.test(przedOkno + ' ' + poOkno)) st = 'zw';

    poz.push({ nazwa: nazwa, ilosc: jed.ilosc, jednostka: jed.jednostka,
               cenaNetto: k.v, stawka: st || stawkaOgolna || null });
  }
  return poz;
}

/* ── розбір однієї фрази: повертає ЛИШЕ те, що почуто ──────────── */
function rozbierz(tekst, oczekuje) {
  var t = String(tekst || '').replace(/\s+/g, ' ').trim();
  var niski = t.toLowerCase();
  var p = { nabywca: {}, pozycja: {}, pozycje: [], waluta: null, prywatna: false, tekst: t };

  /* ставка */
  var mSt = niski.match(/(?:^|[\s,;:(])ставк[а-яіїєґ]*\s*(?:пдв|vat)?\s*(\d{1,2})\s*(?:%|відсот|proc)?/) ||
            niski.match(/(\d{1,2})\s*(?:%|відсотк[а-яіїєґ]*|procent[a-z]*)/);
  if (mSt) p.pozycja.stawka = String(Number(mSt[1]));
  if (/зві?льнен|zwolnion|без\s*пдв/.test(niski)) p.pozycja.stawka = 'zw';
  /* «плюс ВАТ», «z VAT» — базова ставка 23%. Модель часто чує «бат»/«ват». */
  if (!p.pozycja.stawka && /(?:плюс|\+|з|z)\s*(?:пдв|vat|[бв]ат)\b/i.test(niski)) p.pozycja.stawka = '23';

  /* валюта */
  if (/євро|euro|eur\b/i.test(niski)) p.waluta = 'EUR';
  else if (/долар|dolar|usd\b/i.test(niski)) p.waluta = 'USD';
  else if (/злот|золот|zł|zloty|złot/i.test(niski)) p.waluta = 'PLN';

  /* ── позиції: кожна сума в мовленні = окремий рядок фактури ──── */
  p.pozycje = pozycjeZTekstu(t, niski, p.pozycja.stawka);

    /* NIP і приватна особа */
  var mNip = t.match(/(?:nip|н[іи]п)\D{0,5}((?:\d[\s-]?){10})/i) || t.match(/\b(\d{10})\b/);
  if (mNip) { p.nabywca.nip = mNip[1].replace(/[\s-]/g, ''); p.nabywca.typ = 'NIP'; }
  if (osobaPrywatna(t)) { p.prywatna = true; p.nabywca.typ = 'BRAK'; p.nabywca.nip = null; }

  /* покупець */
  var im = imieNazwisko(t);
  if (im) p.nabywca.nazwa = im;

  /* ── відповідь на питання агента ──────────────────────────────
     Коротка фраза без ключових слів — це відповідь саме на те,
     що агент щойно спитав. «2800» після «яка сума?» — це сума. */
  if (oczekuje) {
    var goleLiczby = t.match(/\d[\d\s]*(?:[.,]\d{1,2})?/g) || [];
    var jedna = goleLiczby.length === 1
      ? Number(String(goleLiczby[0]).replace(/[\s ]/g, '').replace(',', '.')) : null;

    if (oczekuje === 'kwota' && p.pozycja.cenaNetto === undefined && jedna) p.pozycja.cenaNetto = jedna;
    if (oczekuje === 'nip' && p.nabywca.nip === undefined && jedna && String(jedna).length === 10) {
      p.nabywca.nip = String(jedna); p.nabywca.typ = 'NIP';
    }
    if (oczekuje === 'usluga' && p.pozycja.nazwa === undefined && t.length < 60 && !jedna) {
      p.pozycja.nazwa = t.replace(/^(за|це|послуга|usługa)\s+/i, '').trim();
    }
    if (oczekuje === 'nabywca' && p.nabywca.nazwa === undefined && t.length < 60) {
      var d = t.split(/[\s,]+/).filter(function (w) { return /^[А-ЯІЇЄҐA-Z]/.test(w); });
      if (d.length) p.nabywca.nazwa = d.length > 1 ? imiePl(d[0]) + ' ' + nazwiskoPl(d[d.length - 1])
                                                   : nazwiskoPl(d[0]);
    }
  }

  return p;
}

/* ── злиття: нове доповнює старе, не стирає його ───────────────── */
function scal(stan, patch) {
  stan = stan || { nabywca: { nazwa: null, nip: null, typ: null }, prywatna: false,
                   pozycje: [], waluta: null, historia: [] };
  ['nazwa', 'nip', 'typ'].forEach(function (f) {
    if (patch.nabywca[f] !== undefined && patch.nabywca[f] !== null) stan.nabywca[f] = patch.nabywca[f];
  });
  if (patch.prywatna) { stan.prywatna = true; stan.nabywca.typ = 'BRAK'; stan.nabywca.nip = null; }
  if (patch.waluta) stan.waluta = patch.waluta;

  var nowe = patch.pozycje || [];
  if (nowe.length > 1 || (nowe.length === 1 && !stan.pozycje.length)) {
    stan.pozycje = nowe;                          /* надиктовано набір — беремо як є */
  } else if (nowe.length === 1) {
    /* одна сума при вже наявних рядках — це поправка останнього */
    var ost = stan.pozycje[stan.pozycje.length - 1];
    ['nazwa', 'ilosc', 'jednostka', 'cenaNetto', 'stawka'].forEach(function (f) {
      if (nowe[0][f] !== null && nowe[0][f] !== undefined) ost[f] = nowe[0][f];
    });
  } else if (patch.pozycja && patch.pozycja.stawka && stan.pozycje.length) {
    stan.pozycje.forEach(function (x) { if (!x.stawka) x.stawka = patch.pozycja.stawka; });
  }
  stan.historia.push(patch.tekst);
  return stan;
}

/* ── чого бракує, у порядку важливості ─────────────────────────── */
function braki(stan) {
  var b = [];
  if (!stan.nabywca.nazwa) b.push('nabywca');
  if (!stan.pozycje.length || !stan.pozycje.some(function (p) { return p.cenaNetto > 0; })) b.push('kwota');
  if (stan.pozycje.length && stan.pozycje.some(function (p) { return !p.nazwa; })) b.push('usluga');
  if (!stan.prywatna && !stan.nabywca.nip) b.push('nip');
  return b;
}

var PYTANIA = {
  nabywca: 'Кому виставляємо фактуру?',
  kwota:   'Яка сума?',
  usluga:  'За що саме фактура?',
  nip:     'Який NIP покупця? Якщо це приватна особа — так і скажіть.'
};

function nastepnePytanie(stan) {
  var b = braki(stan);
  return b.length ? { klucz: b[0], tekst: PYTANIA[b[0]] } : null;
}

/* ── готові позиції для fa3.js (зі стандартами) ────────────────── */
function pozycjeGotowe(stan) {
  return (stan.pozycje.length ? stan.pozycje : [{}]).map(function (p) {
    return {
      nazwa: p.nazwa || 'usługa',
      ilosc: p.ilosc || 1,
      jednostka: p.jednostka || 'usł.',
      cenaNetto: p.cenaNetto || 0,
      stawka: p.stawka || '23'
    };
  });
}
function pozycjaGotowa(stan) { return pozycjeGotowe(stan)[0]; }

var ROZBIR = { rozbierz: rozbierz, scal: scal, braki: braki, nastepnePytanie: nastepnePytanie,
               pozycjeGotowe: pozycjeGotowe, pozycjaGotowa: pozycjaGotowa, pozycjeZTekstu: pozycjeZTekstu, nazwiskoPl: nazwiskoPl, imiePl: imiePl, imieNazwisko: imieNazwisko };
if (typeof module !== 'undefined' && module.exports) module.exports = ROZBIR;
global.ROZBIR = ROZBIR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
