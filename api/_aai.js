/* Спільне для обох функцій: ключі з оточення Vercel, ніколи з коду. */
const KEY  = process.env.ASSEMBLYAI_API_KEY;
const GROQ = process.env.GROQ_API_KEY;
const AAI  = 'https://api.assemblyai.com';

function czytajCialo(req) {
  return new Promise(function (res, rej) {
    const k = [];
    req.on('data', function (c) { k.push(c); });
    req.on('end', function () { res(Buffer.concat(k)); });
    req.on('error', rej);
  });
}

const SLOWNIK = [
  'фактура', 'фактуру', 'виставити фактуру', 'злотих', 'злотий', 'złoty',
  'ПДВ', 'ставка ПДВ', 'без ПДВ', 'звільнено', 'NIP', 'netto', 'brutto',
  'karta pobytu', 'карта побиту', 'супровід', 'консультація', 'послуга',
  'переклад', 'ремонт', 'монтаж', 'доставка', 'оренда', 'бухгалтерія',
  'приватна особа', 'штука', 'година', 'місяць', 'євро', 'долар'
];

module.exports = { KEY: KEY, GROQ: GROQ, AAI: AAI, czytajCialo: czytajCialo, SLOWNIK: SLOWNIK };
