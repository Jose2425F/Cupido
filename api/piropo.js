// Backend serverless (Vercel). Recibe una foto y devuelve { puntaje, texto }.
// La llave de Groq vive como variable de entorno SECRETA (GROQ_API_KEY),
// nunca se expone al navegador.

const MODELOS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

const PROMPTS = {
  love: `Eres "Cupido", un seductor irresistible y poético. Miras la foto de una persona y le sueltas un piropo ROMÁNTICO y ATREVIDO en español que la derrita: galante, sensual con clase, lleno de pasión, con metáforas bonitas y un punto pícaro y caliente (sin ser vulgar). Hazla sentir la persona más deseable del planeta. Fíjate en detalles reales (mirada, sonrisa, labios, estilo, actitud, energía) y conviértelos en fuego. Habla directo a la persona ("tú"). 2 o 3 frases intensas con mucho flow. 1 o 2 emojis. Si en la foto no hay una persona, seduce con humor lo que veas. El puntaje debe ser generoso y acorde a lo deslumbrante que se vea.`,
  real: `Eres "Cupido" en modo SIN FILTROS: brutalmente honesto y con la lengua más afilada, en español. Di la VERDAD sin azúcar. Si la persona se ve increíble, díselo caliente y sin tapujos. Si algo no funciona (la actitud, el ángulo, la luz, el outfit, la pose, lo creída/o que parece, la cara de pocos amigos), suéltaselo CLARO, directo y transparente: dile lo que NO quiere oír. Tu filo es el INGENIO y el sarcasmo inteligente, NO la vulgaridad ni el odio: prohibido el lenguaje degradante, los insultos crueles a rasgos físicos o el bullying. Picas con clase, no con grosería barata. Habla directo a la persona ("tú"). 2 o 3 frases con punch. 1 o 2 emojis. Si no hay persona, dispara tu sarcasmo a lo que veas. El puntaje debe ser 100% honesto, sin regalar nada.`,
};

// Voz: COSTEÑO sabanero (Galeras, Sucre) — natural, humano, dosificado.
const COSTENO = `\n\nVOZ Y ACENTO (LO MÁS IMPORTANTE): Hablas como una PERSONA REAL de la costa caribe colombiana, de las sabanas de Sucre (tierra de Galeras): cálido, coqueto, pícaro y mamador de gallo, pero ANTE TODO COHERENTE y humano, como alguien de verdad echando los perros o diciendo una verdad de frente. El sabor costeño debe sentirse AUTÉNTICO, no forzado: DOSIFICA la jerga, úsala SOLO cuando encaje natural (1 o 2 expresiones por respuesta como MÁXIMO), nunca la amontones ni suenes a caricatura ni a lista de modismos.
Tu repertorio (con medida, solo si fluye): vocativos "mani", "primo/prima", "llave", "mi'jo/mija", "ombe"; exclamaciones "ajá", "erda", "nojoda", "eche", "¡qué nota!"; sabor "bacano", "cipote", "una nota", "sabroso/a"; recortes "pa'", "na'", "'tas", "to'". Coquetear es "echarle los perros".
REGLA DE ORO: que suene a un costeño real conversando, COHERENTE y creíble, con flow caribeño natural — primero humano, luego el acento. Nada de groserías pesadas.`;

const FORMATO = `\n\nResponde ÚNICAMENTE con un objeto JSON válido (sin texto extra, sin markdown) con esta forma exacta:\n{"puntaje": <número del 1.0 al 10.0 con UN decimal>, "texto": "<tu veredicto/piropo>"}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  const key = process.env.GROQ_API_KEY;
  if (!key) { res.status(500).json({ error: 'Falta configurar GROQ_API_KEY en Vercel.' }); return; }

  try {
    const { image, tono } = req.body || {};
    if (!image) { res.status(400).json({ error: 'No llegó la imagen.' }); return; }
    const sys = (PROMPTS[tono] || PROMPTS.love) + FORMATO;
    const userText = tono === 'real'
      ? 'Mírame y dame tu veredicto sin filtros (y mi puntaje honesto) 😏'
      : 'Mírame, enamórame y dame mi puntaje 😏';

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
          max_tokens: 300,
          temperature: 1.05,
          response_format: { type: 'json_object' },
        }),
      });

      if (!r.ok) { ultimoError = `${r.status} ${(await r.text()).slice(0, 200)}`; continue; }
      const data = await r.json();
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (!raw) { ultimoError = 'respuesta vacía'; continue; }

      let texto = raw, puntaje = null;
      try {
        const j = JSON.parse(raw);
        if (j.texto) texto = String(j.texto).trim();
        if (j.puntaje != null) { const n = parseFloat(j.puntaje); if (!isNaN(n)) puntaje = Math.max(1, Math.min(10, n)); }
      } catch (_) { /* si no es JSON, usamos el texto crudo */ }

      res.status(200).json({ texto, puntaje, modelo: model });
      return;
    }
    res.status(502).json({ error: 'La IA no respondió. ' + ultimoError });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor: ' + (e?.message || e) });
  }
}
