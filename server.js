/* Локальний сервер. Тримає ключ AssemblyAI у себе — у браузер він не потрапляє.
   Без жодних залежностей: тільно вбудований у Node модуль http. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');

/* Ключі: спершу з оточення (Vercel), потім із файла .env (локально).
   На Vercel файла .env немає — без цього сервер падав на старті. */
function zOtoczenia(nazwa) {
  if (process.env[nazwa]) return process.env[nazwa];
  try {
    const plik = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const m = plik.match(new RegExp('^' + nazwa + '=(.+)$', 'm'));
    return m ? m[1].trim() : null;
  } catch (e) { return null; }
}

const KEY  = zOtoczenia('ASSEMBLYAI_API_KEY');
const GROQ = zOtoczenia('GROQ_API_KEY');
if (!KEY) console.error('УВАГА: немає ASSEMBLYAI_API_KEY — розпізнавання не працюватиме');
const AAI = 'https://api.assemblyai.com';
const TYPY = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };

function czytajCiało(req) {
  return new Promise((res, rej) => {
    const kawałki = [];
    req.on('data', c => kawałki.push(c));
    req.on('end', () => res(Buffer.concat(kawałki)));
    req.on('error', rej);
  });
}

/* Підказка моделі: терміни, які вона інакше чує неправильно.
   «злотих» вона чула як «золотих», «фактуру» як «фактору». */
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

async function transkrybuj(audio, mowa) {
  const up = await fetch(AAI + '/v2/upload', {
    method: 'POST', headers: { authorization: KEY }, body: audio
  });
  if (!up.ok) throw new Error('upload: ' + up.status + ' ' + await up.text());
  const { upload_url } = await up.json();

  const ciało = {
    audio_url: upload_url, punctuate: true, format_text: true,
    speech_models: ['universal-3-5-pro'],
    keyterms_prompt: SLOWNIK
  };
  if (mowa === 'auto') ciało.language_detection = true; else ciało.language_code = mowa || 'uk';

  const st = await fetch(AAI + '/v2/transcript', {
    method: 'POST',
    headers: { authorization: KEY, 'content-type': 'application/json' },
    body: JSON.stringify(ciało)
  });
  if (!st.ok) throw new Error('transcript: ' + st.status + ' ' + await st.text());
  const { id } = await st.json();

  for (let i = 0; i < 90; i++) {
    const r = await fetch(AAI + '/v2/transcript/' + id, { headers: { authorization: KEY } });
    const d = await r.json();
    if (d.status === 'completed') return { text: d.text, language: d.language_code, id: id };
    if (d.status === 'error') throw new Error('AssemblyAI: ' + d.error);
    await new Promise(r2 => setTimeout(r2, 1000));
  }
  throw new Error('транскрипція не завершилась за 90 с');
}

const serwer = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/api/transcribe' && req.method === 'POST') {
    try {
      const audio = await czytajCiało(req);
      if (!audio.length) throw new Error('порожнє аудіо');
      const wynik = await transkrybuj(audio, u.searchParams.get('lang') || 'uk');
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(wynik));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  if (u.pathname === '/api/extract' && req.method === 'POST') {
    try {
      const body = JSON.parse((await czytajCiało(req)).toString('utf8') || '{}');
      const wynik = await rozbierzModelem(body.historia || [], body.stan || null);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, dane: wynik }));
    } catch (e) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }

  if (u.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mowa: KEY.slice(0, 4) + '…', model: GROQ ? 'є' : 'немає' }));
    return;
  }

  /* статика: public/ і yadro/ */
  let p = u.pathname === '/' ? '/index.html' : u.pathname;
  const korzenie = [path.join(__dirname, 'public')];
  for (const k of korzenie) {
    const plik = path.join(k, p);
    if (plik.startsWith(k) && fs.existsSync(plik) && fs.statSync(plik).isFile()) {
      res.writeHead(200, {
        'content-type': TYPY[path.extname(plik)] || 'application/octet-stream',
        'cache-control': 'no-store, no-cache, must-revalidate',
        'pragma': 'no-cache'
      });
      fs.createReadStream(plik).pipe(res);
      return;
    }
  }
  res.writeHead(404); res.end('нема');
});

const PORT = process.env.PORT || 5173;
serwer.listen(PORT, () => console.log('Voice Faktura: http://localhost:' + PORT));
