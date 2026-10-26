"""Personal build: turn the published Laminate Talk app into My Laminate Talk.

The only difference from the main app is the free meeting with Claude ("Claude ile serbest"),
plus the 4/3/2 rewrite and word rescue that use the same partner. Claude is reached through the
Supabase Edge Function "claude-meeting"; the Anthropic API key lives there as a secret and never
reaches the browser or this repository.

Usage (from this repo's root, with a checkout of hilsst/laminate-talk next to it):
    python3 tools/personal_build.py ../laminate-talk
It copies index.html, sw.js and manifest.webmanifest from the main app and patches them.
Audio, voice engine and icons are plain copies: copy them over when the main app changes them.
"""
import sys, os, json, re

SRC = sys.argv[1] if len(sys.argv) > 1 else '../laminate-talk'
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
h = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()

def rep(a, b):
    global h
    assert h.count(a) == 1, (h.count(a), a[:80])
    h = h.replace(a, b)

# --- Claude partner through the Edge Function (replaces the main app's "no Claude" stub) ---
rep('''let sample=null;
const aiReady = Promise.resolve(null).then(()=>{aiOff();return null});''', '''let sample=null;
/* personal build: Claude runs through the Supabase Edge Function "claude-meeting".
   The API key is a secret on the server; the page only sends the signed-in member's session token. */
const AI_FN="claude-meeting";
function aiErr(code,msg){const e=new Error(msg||code); e.code=code; return e}
function aiJSON(t){
  t=String(t||"").trim().replace(/^```(?:json)?\\s*/,"").replace(/\\s*```$/,"");
  try{return JSON.parse(t)}catch{}
  const a=t.indexOf("{"), b=t.lastIndexOf("}");
  if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch{}}
  throw aiErr("invalid_json");
}
sample={async json(input,opts={}){
  if(!sb) throw aiErr("not_signed_in");
  const {data:{session}}=await sb.auth.getSession(); if(!session) throw aiErr("not_signed_in");
  const messages=typeof input==="string"?[{role:"user",content:input}]:input;
  let r;
  try{ r=await fetch(SB_URL+"/functions/v1/"+AI_FN,{method:"POST",signal:opts.signal,
    headers:{"Content-Type":"application/json",apikey:SB_KEY,Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({messages,tier:opts.modelTier==="quick"?"quick":"default"})}) }
  catch(e){ throw aiErr(e?.name==="AbortError"?"cancelled":"network") }
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw aiErr(d.error||("http_"+r.status),d.message);
  if(!d.text) throw aiErr("empty_completion");
  return aiJSON(d.text);
}};
const aiReady=Promise.resolve(sample);''')

rep('''  if(c==="session_expired") return "Oturum süresi dolmuş. claude.ai'ye yeniden giriş yapıp tekrar dene.";''',
'''  if(c==="session_expired") return "Oturum süresi dolmuş. Çıkış yapıp yeniden giriş yap.";
  if(c==="not_signed_in") return "Claude ile toplantı için önce giriş yap (sayfanın üstündeki Giriş yap).";
  if(c==="forbidden") return "Bu hesap Claude toplantısı için yetkili değil. Supabase'de ALLOWED_EMAILS ayarına bu hesabın e-postasını ekle.";
  if(c==="not_configured") return "Sunucuda Claude API anahtarı tanımlı değil. Supabase'de ANTHROPIC_API_KEY secret'ını ekle.";
  if(c==="bad_api_key") return "Claude API anahtarı geçersiz. Supabase'deki ANTHROPIC_API_KEY secret'ını kontrol et.";
  if(c==="http_404") return "Supabase'de claude-meeting fonksiyonu bulunamadı. Kurulum tarifindeki fonksiyon adımını yap.";
  if(c==="refusal") return "Claude bu mesaja cevap vermedi. Farklı bir şekilde yazıp tekrar gönder.";
  if(c==="upstream") return "Claude şu an yoğun. Birkaç saniye sonra tekrar gönder.";
  if(c==="too_large") return "Mesaj çok uzun. Kısaltıp tekrar gönder.";''')

# --- meeting: no phrase chips under either message (Kemal 2026-10-26: the natural version already shows it);
#     the phrases are still saved to "İfadelerim" ---
rep('''    if(mine&&sug&&out?.understood!==true){mine.append(suggestBox(sug));if(chunks.length)mine.append(chunkRow(chunks,true))}
    else if(mine&&out?.recast){mine.append(recastBox(String(out.recast)));if(chunks.length)mine.append(chunkRow(chunks,true))}''',
'''    if(mine&&sug&&out?.understood!==true) mine.append(suggestBox(sug));
    else if(mine&&out?.recast) mine.append(recastBox(String(out.recast)));''')

# --- name and badge, so the personal copy is never mistaken for the shared app ---
rep('<b id="accName">Laminate Talk</b>', '<b id="accName">Laminate Talk</b> <span style="background:#5b3cc4;color:#fff;border-radius:6px;padding:1px 6px;font-size:.75em">KİŞİSEL</span>')
h = h.replace('<meta name="theme-color" content="#0d7a69">', '<meta name="theme-color" content="#5b3cc4">', 1)

if os.environ.get('LT_TEST') == '1':
    # test copy at test/index.html: uses the live copy's files one folder up, no offline worker,
    # every topic open so changes can be checked anywhere. Delete test/ after going live.
    rep('<head>\n', '<head>\n<base href="../">\n')
    assert h.count('location.href).href') == 3, 'asset URL pattern changed'
    h = h.replace('location.href).href', 'document.baseURI).href')
    rep('if("serviceWorker" in navigator) addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));', '')
    rep('</body>', '<script>addEventListener("load",()=>{try{isOpen=()=>true;renderScenList()}catch(e){}})</script></body>')
    rep('font-size:.75em">KİŞİSEL</span>', 'font-size:.75em">KİŞİSEL</span> <span style="background:#c0392b;color:#fff;border-radius:6px;padding:1px 6px;font-size:.75em">TEST</span>')
    os.makedirs(os.path.join(OUT, 'test'), exist_ok=True)
    open(os.path.join(OUT, 'test', 'index.html'), 'w', encoding='utf-8').write(h)
    print('test copy written to test/index.html')
    sys.exit()
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(h)

# --- service worker: own cache prefix (both apps share the hilsst.github.io origin, and the main
#     app's worker deletes every "lt-" cache that is not its own) ---
sw = open(os.path.join(SRC, 'sw.js'), encoding='utf-8').read()
assert sw.count('"lt-') == 2, 'sw.js cache prefix changed'
sw = sw.replace('"lt-', '"mlt-').replace('// Laminate Talk offline cache.', '// My Laminate Talk offline cache.')
open(os.path.join(OUT, 'sw.js'), 'w', encoding='utf-8').write(sw)

m = json.load(open(os.path.join(SRC, 'manifest.webmanifest'), encoding='utf-8'))
m.update(name='My Laminate Talk', short_name='My Laminate', theme_color='#5b3cc4')
json.dump(m, open(os.path.join(OUT, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('personal build written', len(h))
