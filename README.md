# 💘 Cupido IA — Novaflow

Sube tu foto y la IA te suelta un **piropo que enamora** o **la verdad sin filtros** 😏.
La foto se analiza con un modelo de visión (Llama 4 Scout vía **Groq**) y el texto
se genera con toda la actitud.

## Arquitectura (segura)

- **Frontend** (`index.html`): web estática, bonita y dinámica.
- **Backend** (`api/piropo.js`): función serverless de Vercel que habla con Groq.
- La **llave de Groq** vive como variable de entorno **secreta** (`GROQ_API_KEY`)
  en Vercel — **nunca** se expone en el navegador ni en el código público.

## Desplegar en Vercel

1. Sube este repo a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. En **Settings → Environment Variables**, añade:
   - **Name:** `GROQ_API_KEY`
   - **Value:** tu llave de [console.groq.com/keys](https://console.groq.com/keys)
4. **Deploy**. Vercel te da una URL `https://…vercel.app`.

Cualquier cambio que empujes a GitHub se redespliega solo.

## Local (opcional)

```bash
npm i -g vercel
vercel dev   # usa un archivo .env con GROQ_API_KEY=...
```
