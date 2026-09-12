/* Локальний сервер. Тримає ключ AssemblyAI у себе — у браузер він не потрапляє.
   Без жодних залежностей: тільно вбудований у Node модуль http. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');

const KEY = (fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
  .match(/ASSEMBLYAI_API_KEY=(.+)/) || [])[1];
if (!KEY) { console.error('Немає ключа AssemblyAI в .env'); process.exit(1); }

/* Ключ моделі. Якщо його немає — розбір падає на словник у браузері. */
const GROQ = (fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
  .match(/GROQ_API_KEY=(.+)/) || [])[1];

const INSTRUKCJA = [
  'Ти перетворюєш надиктований українською або польською текст у структуру польської фактури FA(3).',
  'Відповідай ТІЛЬКИ JSON, без пояснень.',
  '',
  'Схема:',
  '{"nabywca":{"nazwa":string|null,"nip":string|null,"prywatna":boolean},',
  ' "waluta":"PLN"|"EUR"|"USD","zwolnienie":{"podstawa":string}|null,',
  ' "pozycje":[{"nazwa":string,"ilosc":number,"jednostka":string,"cenaNetto":number,',
  '             "stawka":"23"|"8"|"5"|"0"|"zw"}]}',
  '',
  'Правила:',
  '1. nazwa позиції — ПОЛЬСЬКОЮ, як пишуть у фактурах: konsultacja, tłumaczenie,',
  '   pomoc w sprawie karty pobytu, składki, usługi fotograficzne, dodatkowe koszty.',
  '2. Імена людей — польська транслітерація в НАЗИВНОМУ відмінку:',
  '   Ковальському→Kowalski, Петра Івановича→Petro Iwanowicz, Іни→Ina, Ірина Іванівна→Iryna Iwaniwna.',
  '3. Кожна названа сума — окрема позиція. Не зливай позиції і не вигадуй нових.',
  '4. jednostka польськими скороченнями: godz., szt., usł., mies., dzień, kg, m.',
  '5. «без ПДВ», «звільнено» → stawka "zw". Ставку не назвали → "23".',
  '6. «сто тринадцять», «ліміт», «200 тисяч» → zwolnienie.podstawa = "art. 113 ust. 1 ustawy o VAT".',
  '7. «приватна особа», «фізична особа» → prywatna: true, nip: null.',
  '8. Чого не сказали — null. Не домислюй.',
  '9. Якщо дано попередній стан — ОНОВИ його новими фразами, не скидай те, що вже є.'
].join('\n');

async function rozbierzModelem(historia, stanTeraz) {
  if (!GROQ) throw new Error('немає ключа моделі');
  const tresc = (stanTeraz ? 'Поточний стан фактури:\n' + JSON.stringify(stanTeraz) + '\n\n' : '')
    + 'Сказано:\n' + historia.map((h, i) => (i + 1) + '. ' + h).join('\n');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + GROQ, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b', temperature: 0, max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: INSTRUKCJA }, { role: 'user', content: tresc }]
    })
  });
  if (!r.ok) throw new Error('модель: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  return JSON.parse(d.choices[0].message.content);
}

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
  'приватна особа', 'штука', 'година', 'місяць', 'євро', 'долар'
];

async function transkrybuj(audio, mowa) {
  const up = await fetch(AAI + '/v2/upload', {
    method: 'POST', headers: { authorization: KEY }, body: audio
  });
  if (!up.ok) throw new Error('upload: ' + up.status + ' ' + await up.text());
  const { upload_url } = await up.json();

  const ciało = {
    audio_url: upload_url, punctuate: true, format_text: true,
    word_boost: SLOWNIK, boost_param: 'high', keyterms_prompt: SLOWNIK
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
