const { GROQ, czytajCialo } = require('./_aai.js');

const config = { api: { bodyParser: false }, maxDuration: 30 };

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

async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'тільки POST' }); return; }
  try {
    if (!GROQ) throw new Error('немає ключа моделі');
    const body = JSON.parse((await czytajCialo(req)).toString('utf8') || '{}');
    const historia = body.historia || [];
    const tresc = (body.stan ? 'Поточний стан фактури:\n' + JSON.stringify(body.stan) + '\n\n' : '')
      + 'Сказано:\n' + historia.map(function (h, i) { return (i + 1) + '. ' + h; }).join('\n');

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + GROQ, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', temperature: 0, max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: INSTRUKCJA }, { role: 'user', content: tresc }]
      })
    });
    if (!r.ok) throw new Error('модель: ' + r.status);
    const d = await r.json();
    res.status(200).json({ ok: true, dane: JSON.parse(d.choices[0].message.content) });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}

module.exports = handler;
module.exports.config = config;
