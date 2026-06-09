// Backend serverless (Vercel). Recibe una foto y devuelve un piropo de la IA.
// La llave de Groq vive como variable de entorno SECRETA (GROQ_API_KEY),
// nunca se expone al navegador.

const MODELOS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

const PROMPTS = {
  love: `Eres "Cupido", el ligón más encantador del universo. Miras la foto de una persona y le sueltas un PIROPO galante, ingenioso y atrevido en español, como si quisieras enamorarla a primera vista. Fíjate en detalles reales (mirada, sonrisa, estilo, actitud, energía) y conviértelos en halagos con chispa, metáforas bonitas y un toque pícaro pero respetuoso. Habla directo a la persona ("tú"). 2 o 3 frases con mucho flow. Usa 1 o 2 emojis. Nada de descripciones técnicas: reacciona como quien quedó flechado. Si en la foto no hay una persona, coquetea con humor sobre lo que veas.`,
  real: `Eres "Cupido" en modo SIN FILTROS y pícaro. Miras la foto y das tu veredicto honesto con mucha actitud y humor travieso, en español. Si la persona se ve bien, suéltale un halago caliente y sincero que la haga sonrojar. Si algo no te convence (la pose, la luz, el outfit, la actitud), lánzale una PULLA divertida y con sarcasmo simpático, sin pelos en la lengua, PERO sin crueldad real ni insultos al físico: es humor coqueto y juguetón, no bullying. Habla directo a la persona ("tú"). 2 o 3 frases con punch. Usa 1 o 2 emojis. Si no hay persona, búrlate con cariño de lo que veas.`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Falta configurar GROQ_API_KEY en Vercel.' });
    return;
  }

  try {
    const { image, tono } = req.body || {};
    if (!image) { res.status(400).json({ error: 'No llegó la imagen.' }); return; }
    const sys = PROMPTS[tono] || PROMPTS.love;
    const userText = tono === 'real'
      ? 'Mírame y dime la verdad sin filtros (pero con gracia) 😏'
      : 'Mírame y enamórame con un buen piropo 😏';

    let ultimoError = '';
    for (const model of MODELOS) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: image } },
            ] },
          ],
          max_tokens: 220,
          temperature: 1.0,
        }),
      });

      if (!r.ok) {
        ultimoError = `${r.status} ${(await r.text()).slice(0, 200)}`;
        continue; // prueba el siguiente modelo
      }
      const data = await r.json();
      const texto = data.choices?.[0]?.message?.content?.trim();
      if (texto) { res.status(200).json({ texto, modelo: model }); return; }
      ultimoError = 'respuesta vacía';
    }
    res.status(502).json({ error: 'La IA no respondió. ' + ultimoError });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor: ' + (e?.message || e) });
  }
}
