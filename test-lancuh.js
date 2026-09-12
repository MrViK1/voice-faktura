/* Повний ланцюг: текст із мовлення → структура → FA(3) XML → перевірка.
   Запуск: node test-lancuh.js */
const FA3 = require('./public/yadro/fa3.js');
const SL  = require('./public/yadro/slownie.js');
const RZ  = require('./public/yadro/rozbir.js');

const SPRZEDAWCA = {
  nip: '1234563218', nazwa: 'Demo Studio Sp. z o.o.',
  kraj: 'PL', adres: 'ul. Przykładowa 7/2, 00-001 Warszawa'
};

const ROZMOWY = [
  ['виставити фактуру Ковальському за консультацію. Одна година, 1500 злотих, ставка 23%.',
   'NIP 1234563218'],
  ['Катерина Сергійовна. Консультація 450. Супровід по карті побиту 4350. Фотографії 100. Додаткові розходи 750 і внески 1185. Це приватна особа без ПДБ.',
   'сто тринадцять'],
  ['Фактура для Мельника: переклад 3 години по 200 злотих, плюс доставка 50 злотих, ставка 23',
   'NIP 5252248481']
];

let bledy = 0;
ROZMOWY.forEach(function (rozmowa, nr) {
  let stan = null;
  rozmowa.forEach(function (fraza) {
    const q = stan ? RZ.nastepnePytanie(stan) : null;
    stan = RZ.scal(stan, RZ.rozbierz(fraza, q ? q.klucz : null));
  });

  const poz = RZ.pozycjeGotowe(stan);
  const sumy = FA3.podsumuj(poz);
  const dzis = new Date().toISOString().slice(0, 10);
  const doc = {
    sprzedawca: SPRZEDAWCA,
    nabywca: { typ: stan.nabywca.nip ? 'NIP' : 'BRAK', nip: stan.nabywca.nip || '',
               nazwa: stan.nabywca.nazwa || 'Nabywca' },
    faktura: {
      numer: 'FV/GLOS/' + dzis.replace(/-/g, '') + '/' + (nr + 1),
      dataWystawienia: dzis, dataSprzedazy: dzis, miejsceWystawienia: 'Warszawa',
      waluta: stan.waluta || 'PLN', platnosc: { forma: '6', termin: dzis },
      rodzaj: 'VAT', zwolnienie: stan.zwolnienie || null
    },
    pozycje: poz
  };

  const b = FA3.sprawdz(doc);
  const pyt = RZ.nastepnePytanie(stan);
  console.log('── розмова ' + (nr + 1) + ' ──');
  console.log('покупець:', doc.nabywca.nazwa, '|', doc.nabywca.typ);
  poz.forEach(function (p, i) {
    console.log('  ' + (i + 1) + '.', p.nazwa, '|', p.ilosc, p.jednostka, '×', p.cenaNetto, '|', p.stawka);
  });
  console.log('netto', sumy.netto, 'VAT', sumy.vat, 'brutto', sumy.brutto);
  console.log('словами:', SL.kwotaSlownie(sumy.brutto, doc.faktura.waluta));
  console.log('питання:', pyt ? pyt.tekst : 'немає');
  console.log('FA(3):', b.length ? ('ПОМИЛКИ → ' + b.join('; ')) : 'перевірку пройдено');
  if (b.length) bledy++;
  if (!b.length) {
    const xml = FA3.buildFA3(doc, { systemInfo: 'Voice Faktura (AssemblyAI)' });
    console.log('XML:', xml.length, 'байт,', (xml.match(/<FaWiersz/g) || []).length, 'рядків');
  }
  console.log();
});

console.log(bledy ? ('НЕ ПРОЙШЛО: ' + bledy) : 'Усі розмови пройшли перевірку FA(3).');
process.exit(bledy ? 1 : 0);
