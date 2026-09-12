const { KEY, AAI, czytajCialo, SLOWNIK } = require('./_aai.js');

const config = { api: { bodyParser: false }, maxDuration: 60 };

async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'тільки POST' }); return; }
  if (!KEY) { res.status(500).json({ error: 'немає ASSEMBLYAI_API_KEY' }); return; }
  try {
    const audio = await czytajCialo(req);
    if (!audio.length) throw new Error('порожнє аудіо');

    const up = await fetch(AAI + '/v2/upload', {
      method: 'POST', headers: { authorization: KEY }, body: audio
    });
    if (!up.ok) throw new Error('upload: ' + up.status);
    const { upload_url } = await up.json();

    const mowa = (req.query && req.query.lang) || 'uk';
    const cialo = {
      audio_url: upload_url, punctuate: true, format_text: true,
      word_boost: SLOWNIK, boost_param: 'high', keyterms_prompt: SLOWNIK
    };
    if (mowa === 'auto') cialo.language_detection = true; else cialo.language_code = mowa;

    const st = await fetch(AAI + '/v2/transcript', {
      method: 'POST',
      headers: { authorization: KEY, 'content-type': 'application/json' },
      body: JSON.stringify(cialo)
    });
    if (!st.ok) throw new Error('transcript: ' + st.status);
    const { id } = await st.json();

    for (let i = 0; i < 50; i++) {
      const r = await fetch(AAI + '/v2/transcript/' + id, { headers: { authorization: KEY } });
      const d = await r.json();
      if (d.status === 'completed') { res.status(200).json({ text: d.text, language: d.language_code }); return; }
      if (d.status === 'error') throw new Error('AssemblyAI: ' + d.error);
      await new Promise(function (r2) { setTimeout(r2, 1000); });
    }
    throw new Error('транскрипція не завершилась');
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

module.exports = handler;
module.exports.config = config;
