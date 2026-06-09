const $ = (id) => document.getElementById(id);
let tono = 'love';
let imagen = null;
let ultimo = { texto:'', puntaje:null, tono:'love' };

// ---------- Corazones de fondo ----------
(function(){ const c=$('hearts'); const ems=['💖','💘','💕','💗','✨','💋'];
  for(let i=0;i<14;i++){ const s=document.createElement('span'); s.textContent=ems[i%ems.length];
    s.style.left=Math.random()*100+'%'; s.style.fontSize=(14+Math.random()*22)+'px';
    s.style.animationDuration=(8+Math.random()*10)+'s'; s.style.animationDelay=(-Math.random()*15)+'s'; c.appendChild(s);} })();

// ---------- Subtítulo rotativo ----------
const FRASES = [
  'Sube tu foto y descubre tu nota 🔥',
  '¿Te atreves a saber la verdad? 😏',
  'Tu foto. Mi veredicto. Sin piedad 💋',
  'Te enamoro… o te bajo de la nube ✨',
  'La IA no miente. ¿Lista para tu nota? 👀',
  'Una foto. Un puntaje. Cero filtros 💯',
  'Prepárate: digo lo que nadie se atreve 😈',
  '¿Crees que eres un 10? Demuéstralo 🌶️',
];
let fi = Math.floor(Math.random()*FRASES.length);
const sub = $('sub');
function rotarSub(){ sub.classList.remove('show');
  setTimeout(()=>{ sub.textContent = FRASES[fi % FRASES.length]; fi++; sub.classList.add('show'); }, 300); }
rotarSub(); setInterval(rotarSub, 3800);

// ---------- Tono ----------
$('tono').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
  tono=b.dataset.t; document.querySelectorAll('#tono button').forEach(x=>x.classList.toggle('on',x===b));
  if(imagen) $('go').textContent = tono==='love'?'💘 ¡Enamórame!':'😏 Dame la verdad'; });

// ---------- Cámara / Galería ----------
$('btn-cam').addEventListener('click', ()=> $('file-cam').click());
$('btn-gal').addEventListener('click', ()=> $('file-gal').click());
$('m-otra').addEventListener('click', ()=>{ cerrarModal(); $('file-cam').click(); });
$('file-cam').addEventListener('change', e=>{ if(e.target.files[0]) cargar(e.target.files[0]); e.target.value=''; });
$('file-gal').addEventListener('change', e=>{ if(e.target.files[0]) cargar(e.target.files[0]); e.target.value=''; });

async function cargar(file){
  const url=URL.createObjectURL(file); const img=new Image(); img.src=url; await img.decode();
  const maxL=768; let w=img.naturalWidth,h=img.naturalHeight; const s=Math.min(1,maxL/Math.max(w,h));
  w=Math.round(w*s); h=Math.round(h*s); const c=document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').drawImage(img,0,0,w,h); imagen=c.toDataURL('image/jpeg',0.85); URL.revokeObjectURL(url);
  $('foto').src=imagen; $('foto').style.display='block'; $('ph').style.display='none'; $('zona').classList.add('tiene');
  $('go').disabled=false; $('go').textContent = tono==='love'?'💘 ¡Enamórame!':'😏 Dame la verdad';
}

// ---------- Analizar ----------
$('go').addEventListener('click', analizar);
async function analizar(){
  if(!imagen) return;
  $('go').disabled=true;
  $('estado').innerHTML = (tono==='love'?'Cupido te está admirando ':'Cupido te está midiendo ')+'<span class="heart-load">💓</span>';
  try{
    const r = await fetch('/api/piropo',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ image:imagen, tono }) });
    const data = await r.json();
    if(!r.ok || data.error) throw new Error(data.error || ('HTTP '+r.status));
    ultimo = { texto:data.texto, puntaje:data.puntaje, tono };
    $('estado').textContent='';
    abrirModal();
  }catch(e){ $('estado').textContent='😅 '+e.message; }
  $('go').disabled=false;
}

// ---------- Modal ----------
function colorScore(p){ if(p==null) return '#a78bfa'; if(p>=8) return '#34d399'; if(p>=6) return '#38bdf8'; if(p>=4) return '#fb923c'; return '#f43f5e'; }
function abrirModal(){
  $('m-foto').src = imagen;
  const tag = $('m-tag'); tag.className = ultimo.tono; tag.textContent = ultimo.tono==='love'?'💘 MODO ENAMORAR':'😏 SIN FILTROS';
  const col = colorScore(ultimo.puntaje);
  $('m-score').style.borderColor = col; $('m-score-n').style.color = col;
  $('modal').classList.add('show');
  const fin = ultimo.puntaje;
  if(fin==null){ $('m-score-n').textContent='—'; }
  else { let v=0; (function step(){ v+=fin/22; if(v>=fin){ $('m-score-n').textContent=fin.toFixed(1);} else { $('m-score-n').textContent=v.toFixed(1); requestAnimationFrame(step);} })(); }
  const cont=$('m-texto'); cont.innerHTML='<span id="tt"></span><span class="cursor"></span>';
  const tt=$('tt'); const txt=ultimo.texto; let i=0;
  (function paso(){ if(i<=txt.length){ tt.textContent=txt.slice(0,i); i++; setTimeout(paso,20);} else { const cu=cont.querySelector('.cursor'); if(cu) cu.style.display='none'; } })();
}
function cerrarModal(){ $('modal').classList.remove('show'); }
$('cerrar').addEventListener('click', cerrarModal);
$('modal').addEventListener('click', e=>{ if(e.target.id==='modal') cerrarModal(); });

// ---------- Tarjeta compartible (altura dinámica) ----------
function dibujarCover(ctx,img,x,y,w,h){ const ir=img.width/img.height, rr=w/h; let sw,sh,sx,sy;
  if(ir>rr){ sh=img.height; sw=sh*rr; sx=(img.width-sw)/2; sy=0; } else { sw=img.width; sh=sw/rr; sx=0; sy=(img.height-sh)/2; }
  ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h); }
function wrap(ctx,txt,maxW){ const words=txt.split(' '); const lines=[]; let line='';
  for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW && line){ lines.push(line); line=w;} else line=t; }
  if(line) lines.push(line); return lines; }
function rr(ctx,x,y,w,h,r){ if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); } else { ctx.beginPath(); ctx.rect(x,y,w,h); } }

async function generarTarjeta(){
  const W=1080, pad=60;
  const img=new Image(); img.src=imagen; await img.decode();
  // medir texto
  const cv=$('lienzo'); const ctx=cv.getContext('2d');
  ctx.font='500 38px system-ui,sans-serif';
  const lines = wrap(ctx, '“'+ultimo.texto+'”', W-pad*2);
  // geometría
  const headerH=150, fotoH=860, gapTag=58, tagH=34, gapText=40, lineH=52, gapFirma=46, footerH=120;
  const textBlock = lines.length*lineH;
  const H = headerH + fotoH + gapTag + tagH + gapText + textBlock + gapFirma + footerH;
  cv.width=W; cv.height=H;
  // fondo
  const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#2a0f3d'); g.addColorStop(.5,'#1b0f2e'); g.addColorStop(1,'#0a0612');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // header
  ctx.textAlign='left'; ctx.fillStyle='#f3e8ff'; ctx.font='800 36px system-ui,sans-serif'; ctx.fillText('💘 Cupido IA', pad, 74);
  ctx.fillStyle='rgba(243,232,255,.55)'; ctx.font='600 20px system-ui,sans-serif'; ctx.fillText('NOVAFLOW', pad, 106);
  // foto
  const fx=pad, fy=headerH, fw=W-pad*2;
  ctx.save(); rr(ctx,fx,fy,fw,fotoH,28); ctx.clip(); dibujarCover(ctx,img,fx,fy,fw,fotoH); ctx.restore();
  // badge puntaje
  const p=ultimo.puntaje, col=colorScore(p); const cx=W-pad-70, cy=fy+fotoH-50, r=78;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle='#0a0612'; ctx.fill(); ctx.lineWidth=8; ctx.strokeStyle=col; ctx.stroke();
  ctx.textAlign='center'; ctx.fillStyle=col; ctx.font='900 48px system-ui,sans-serif'; ctx.fillText(p==null?'—':p.toFixed(1), cx, cy+6);
  ctx.fillStyle='rgba(243,232,255,.6)'; ctx.font='700 18px system-ui,sans-serif'; ctx.fillText('/ 10', cx, cy+36);
  // tag tono
  let y = fy+fotoH+gapTag;
  ctx.textAlign='left'; const tg=ultimo.tono==='love'?'💘 MODO ENAMORAR':'😏 SIN FILTROS';
  ctx.fillStyle=ultimo.tono==='love'?'#fda4c0':'#a5e8ff'; ctx.font='800 24px system-ui,sans-serif'; ctx.fillText(tg, pad, y);
  // texto
  y += gapText; ctx.fillStyle='#f3e8ff'; ctx.font='500 38px system-ui,sans-serif';
  for(const ln of lines){ ctx.fillText(ln, pad, y); y+=lineH; }
  // footer / créditos
  y += gapFirma;
  ctx.fillStyle='rgba(243,232,255,.75)'; ctx.font='700 22px system-ui,sans-serif';
  ctx.fillText('Creado por Jose F. · Automatizado con IA 🤖', pad, y);
  ctx.fillStyle='rgba(243,232,255,.45)'; ctx.font='600 22px system-ui,sans-serif';
  ctx.fillText('cupido-seven.vercel.app', pad, y+38);
  return new Promise(res=> cv.toBlob(res,'image/png',0.95));
}

$('m-share').addEventListener('click', async ()=>{
  $('m-share').textContent='⏳...';
  try{
    const blob = await generarTarjeta();
    const file = new File([blob], 'cupido-ia.png', { type:'image/png' });
    const texto = `Cupido IA me dio ${ultimo.puntaje!=null?ultimo.puntaje.toFixed(1)+'/10':''}: "${ultimo.texto}"`;
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      await navigator.share({ files:[file], text:texto, title:'Cupido IA 💘' });
    } else {
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cupido-ia.png'; a.click();
      try{ await navigator.clipboard.writeText(texto+' · '+location.href); }catch(_){}
    }
  }catch(e){ alert('No se pudo compartir: '+e.message); }
  $('m-share').textContent='📤 Compartir';
});
