/* Повний ланцюг: текст із мовлення → структура → FA(3) XML → перевірка */
const FA3 = require('./yadro/fa3.js');
const SL  = require('./yadro/slownie.js');
const RZ  = require('./yadro/rozbir.js');

const MOJA_FIRMA = {
  nip: '5252248481', nazwa: 'CAREER UP Sp. z o.o.',
  kraj: 'PL', adres: 'ul. Testowa 1, 00-001 Warszawa'
};

function zbuduj(tekstZMowy) {
  const r = RZ.rozbierz(tekstZMowy);
  const dzis = new Date().toISOString().slice(0, 10);
  const doc = {
    sprzedawca: MOJA_FIRMA,
    nabywca: { typ: r.nabywca.typ, nip: r.nabywca.nip, nazwa: r.nabywca.nazwa || 'Nabywca' },
    faktura: {
      numer: 'FV/GLOS/' + dzis.replace(/-/g, '') + '/1',
      dataWystawienia: dzis, dataSprzedazy: dzis,
      miejsceWystawienia: 'Warszawa', waluta: r.waluta,
      platnosc: { forma: '6', termin: dzis },
      rodzaj: 'VAT'
    },
    pozycje: r.pozycje
  };
  const sumy = FA3.podsumuj(doc.pozycje);
  const bledy = FA3.sprawdz(doc);
  const xml = FA3.buildFA3(doc, { systemInfo: 'Voice Faktura (AssemblyAI)' });
  return { r, sumy, bledy, xml };
}

const tekst = "виставити фактуру Ковальському за консультацію. Одна година, 1500 злотих, ставка 23%.";
const w = zbuduj(tekst);
console.log('СКАЗАНО:', tekst);
console.log('\nРОЗПІЗНАНО:', JSON.stringify(w.r.pozycje[0]), '| покупець:', w.r.nabywca.nazwa);
console.log('ПІДСУМКИ: netto', w.sumy.netto, '| VAT', w.sumy.vat, '| brutto', w.sumy.brutto);
console.log('СЛОВАМИ :', SL.kwotaSlownie(w.sumy.brutto, 'PLN'));
console.log('БРАКУЄ  :', w.r.brakuje.join('; ') || 'нічого');
console.log('ПЕРЕВІРКА FA(3):', w.bledy.length ? w.bledy : 'помилок немає');
console.log('\n--- XML (перші 30 рядків) ---');
console.log(w.xml.split('\n').slice(0, 30).join('\n'));
require('fs').writeFileSync('/tmp/faktura-glos.xml', w.xml);
console.log('\nповний XML:', '/tmp/faktura-glos.xml', '|', w.xml.length, 'байт');
