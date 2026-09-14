// Backend serverless (Vercel). Recibe una foto y devuelve { puntaje, texto }.
// La llave de Groq vive como variable de entorno SECRETA (GROQ_API_KEY),
// nunca se expone al navegador.

// Modelos con VISIÓN en Groq, por orden de preferencia.
// Se puede sobrescribir sin tocar el código con la env var GROQ_MODELS
// (lista separada por comas) si Groq vuelve a rotar el catálogo.
const MODELOS = (process.env.GROQ_MODELS || process.env.GROQ_MODEL || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
if (!MODELOS.length) MODELOS.push('qwen/qwen3.8-27b', 'qwen/qwen3.6-27b');

// Familias de modelos que suelen aceptar imágenes: sirve para redescubrir
// un reemplazo automáticamente si los de arriba quedan obsoletos.
const PATRON_VISION = /(qwen3|qwen-3|llama-4|llava|vision|scout|maverick|pixtral|gemma-3|internvl|molmo)/i;
const NO_VISION = /(whisper|tts|guard|embed|compound)/i;

let cacheModelos = null; // ids vivos según /v1/models (cache por instancia)

async function modelosDisponibles(key) {
  if (cacheModelos) return cacheModelos;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return (cacheModelos = []);
    const data = await r.json();
    cacheModelos = (data.data || []).map((m) => m.id).filter(Boolean);
  } catch (_) {
    cacheModelos = [];
  }
  return cacheModelos;
}

// Lista final a intentar: los preferidos primero, y si fallan, cualquier
// modelo vivo que parezca multimodal.
async function candidatos(key) {
  const vivos = await modelosDisponibles(key);
  if (!vivos.length) return MODELOS;
  const preferidos = MODELOS.filter((m) => vivos.includes(m));
  const alternativas = vivos.filter(
    (m) => !preferidos.includes(m) && PATRON_VISION.test(m) && !NO_VISION.test(m)
  );
  const lista = [...preferidos, ...alternativas];
  return lista.length ? lista.slice(0, 6) : MODELOS;
}

// Los modelos con "thinking" pueden anteponer <think>…</think> o ```json.
// Limpiamos eso y extraemos el primer objeto JSON que aparezca.
function extraerJSON(raw) {
  let s = String(raw).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch (_) { /* seguimos */ }
  const i = s.indexOf('{'), f = s.lastIndexOf('}');
  if (i !== -1 && f > i) {
    try { return JSON.parse(s.slice(i, f + 1)); } catch (_) { /* nada */ }
  }
  return null;
}
const PROMPTS = {
  love: `Eres "Cupido", un seductor irresistible y poético. Miras la foto de una persona y le sueltas un piropo ROMÁNTICO y ATREVIDO en español que la derrita: galante, sensual con clase, lleno de pasión, con metáforas bonitas y un punto pícaro y atrevido (con clase, explícito). Hazla sentir la persona más deseable del planeta. Fíjate en detalles reales (mirada, sonrisa, labios, estilo, actitud, energía) y conviértelos en fuego. Habla directo a la persona ("tú"). 2 o 3 frases intensas con mucho flow. 1 o 2 emojis. Si en la foto NO hay una persona (un objeto, un animal, un paisaje…), dilo CLARO y con humor: que ahí no hay a quién enamorar, que no te haga perder el tiempo y que suba una foto suya de verdad, y ponle puntaje bajo (1.0–2.0). Cuando SÍ hay persona, el puntaje debe ser generoso y acorde a lo deslumbrante que se vea.`,
  real: `Eres "Cupido" en modo SIN FILTROS: brutalmente honesto y con la lengua más afilada, en español. Di la VERDAD sin azúcar. Si la persona se ve increíble, díselo caliente y sin tapujos. Si algo no funciona (la actitud, el ángulo, la luz, el outfit, la pose, lo creída/o que parece, la cara de pocos amigos), suéltaselo CLARO, directo y transparente: dile lo que NO quiere oír. Tu filo es el INGENIO y el sarcasmo inteligente, puedes usar la vulgaridad y el odio: el lenguaje degradante, los insultos crueles a rasgos físicos y el bullying. Picas con clase, no con grosería barata si no de realidad. Habla directo a la persona ("tú"). 2 o 3 frases con punch. 1 o 2 emojis. Si NO hay una persona (un objeto, un animal, un paisaje…), dilo SIN RODEOS y con sarcasmo: que ahí no hay a quién evaluar, que deje de hacerte perder el tiempo y suba una foto suya, y ponle puntaje bajo (1.0–2.0). Cuando SÍ hay persona, el puntaje debe ser 100% honesto, sin regalar nada.`,
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
    let todosInexistentes = true;
    const lista = await candidatos(key);

    for (const model of lista) {
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

      if (!r.ok) {
        const cuerpo = await r.text();
        // 404 / model_not_found = el modelo ya no existe: invalidamos la cache
        // para que el siguiente intento redescubra el catálogo actual.
        if (r.status === 404 || /model_not_found/.test(cuerpo)) { cacheModelos = null; }
        else { todosInexistentes = false; }
        ultimoError = `${model}: ${r.status} ${cuerpo.slice(0, 200)}`;
        continue;
      }
      todosInexistentes = false;
      const data = await r.json();
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (!raw) { ultimoError = `${model}: respuesta vacía`; continue; }

      let texto = raw, puntaje = null;
      const j = extraerJSON(raw);
      if (j) {
        if (j.texto) texto = String(j.texto).trim();
        if (j.puntaje != null) { const n = parseFloat(j.puntaje); if (!isNaN(n)) puntaje = Math.max(1, Math.min(10, n)); }
      }

      res.status(200).json({ texto, puntaje, modelo: model });
      return;
    }

    // Si TODOS fallaron por no existir, el catálogo de Groq cambió: lo decimos
    // claro y listamos qué hay disponible para poder ajustar GROQ_MODELS.
    if (todosInexistentes) {
      const vivos = (await modelosDisponibles(key)).filter((m) => !NO_VISION.test(m));
      res.status(502).json({
        error: 'Los modelos configurados ya no existen en Groq. Define GROQ_MODELS en Vercel con uno vigente.',
        intentados: lista,
        disponibles: vivos.slice(0, 25),
      });
      return;
    }
    res.status(502).json({ error: 'La IA no respondió. ' + ultimoError });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor: ' + (e?.message || e) });
  }
}
