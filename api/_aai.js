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
  'приватна особа', 'штука', 'година', 'місяць', 'євро', 'долар',
  'грош', 'грошів', 'ксерокопія', 'завірення в нотаріуса', 'нотаріус', 'виїзд',
  /* польські імена й прізвища — інакше модель чує «Гош» замість Grzegorz */
  'Grzegorz','Krzysztof','Andrzej','Piotr','Tomasz','Marek','Paweł','Michał','Łukasz',
  'Wojciech','Jan','Adam','Jakub','Mateusz','Rafał','Dariusz','Zbigniew','Ryszard',
  'Katarzyna','Małgorzata','Agnieszka','Anna','Magdalena','Ewa','Aleksandra','Barbara',
  'Joanna','Monika','Zofia','Natalia','Beata','Danuta','Halina',
  'Kowalski','Nowak','Wiśniewski','Wójcik','Kowalczyk','Kamiński','Lewandowski',
  'Zieliński','Szymański','Woźniak','Dąbrowski','Kozłowski','Jankowski','Mazur',
  'Wojciechowski','Kwiatkowski','Krawczyk','Kaczmarek','Piotrowski','Grabowski',
  'Pawłowski','Michalski','Nowicki','Adamczyk','Dudek','Zając','Król','Majewski',
  'Olszewski','Wróbel','Malinowski','Pawlak','Walczak','Stępień','Rutkowski','Sikora',
  'Baran','Duda','Szewczyk','Tomaszewski','Marciniak','Zalewski','Jasiński','Sadowski'
];

module.exports = { KEY: KEY, GROQ: GROQ, AAI: AAI, czytajCialo: czytajCialo, SLOWNIK: SLOWNIK };
