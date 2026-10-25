"""Build the installable web app (GitHub Pages PWA) from the artifact page into scratchpad/app/."""
import os, re, shutil, json, hashlib
S='/tmp/claude-0/-home-claude/f0ab6655-4acc-54ae-87fe-327961bfcf77/scratchpad/'
A=S+'app/'
h=open(S+'kompozit-konusma.html').read()
def rep(a,b,src=None):
    global h
    assert h.count(a)==1,(h.count(a),a[:80]); h=h.replace(a,b)

# --- no Claude API in the app: scripted meetings + Claude app voice mode instead ---
rep('''let sample=null;
const aiReady = (async()=>{try{sample=await window.claude?.use?.("sample")}catch{sample=null}
  if(!sample) aiOff(); return sample})();''','''let sample=null;
const aiReady = Promise.resolve(null).then(()=>{aiOff();return null});''')
# --- offline-capable voice engine: all scripts served from the app itself ---
rep('loadScript("https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/ort.min.js")','loadScript("ort/ort.min.js")')
rep('''    try{ph=await import("https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js")}
    catch{ph=await import(new URL("tts/phonemizer.js",location.href).href)}''','''    ph=await import(new URL("tts/phonemizer.js",location.href).href);''')
# --- progress: on this device, plus backup/restore file ---
rep('''  if(!db||!me?.id){ accState("Giriş yapılmadığı için ilerleme sadece bu cihazda tutuluyor"); showResume(); return }''','''  if(!db||!me?.id){ accState("İlerlemen bu cihazda kaydediliyor","ok"); showResume(); return }''')
# --- membership: the claude.ai account block is replaced by Supabase sign-in ---
cfg=json.load(open(S+'build2/supabase.json')) if os.path.exists(S+'build2/supabase.json') else {"url":"","key":""}
auth=open(S+'build2/app_auth.js').read().replace('__SB_URL__',cfg['url']).replace('__SB_KEY__',cfg['key'])
m=re.search(r"\(async\(\)=>\{\n  const use=n=>window\.claude.*?\n\}\)\(\);\n",h,re.S); assert m, 'account block not found'
h=h[:m.start()]+h[m.end():]
h=h.replace('loadAudio(cur.id); renderAll(); resetMeeting();\n</script>','loadAudio(cur.id); renderAll(); resetMeeting();\n'+auth+'</script>')
assert 'sbInit();' in h
rep('''<b id="accName">Laminate Talk</b>''','''<b id="accName">Laminate Talk</b>''')
rep('''    <div class="resume" id="resume" hidden>''','''    <div class="acc-btns"><button id="loginBtn" hidden>Giriş yap / Üye ol</button><button id="logoutBtn" hidden>Çıkış yap</button></div>
    <div class="resume" id="resume" hidden>''')
rep('''<div class="wrap">''','''<div class="auth" id="authGate" hidden>
  <form class="auth-card" id="authForm" novalidate>
    <h2>Laminate Talk</h2>
    <p class="muted">Üye ol ya da giriş yap; ilerlemen hesabına kaydedilir ve telefonla bilgisayar arasında eşitlenir.</p>
    <div class="auth-tabs"><button type="button" id="tabIn" class="on">Giriş yap</button><button type="button" id="tabUp">Üye ol</button></div>
    <label id="nameRow" hidden>Adın<input type="text" id="authName" autocomplete="name"></label>
    <label id="emailRow">E-posta<input type="email" id="authEmail" autocomplete="email" required></label>
    <label>Şifre<input type="password" id="authPw" autocomplete="current-password" minlength="6" required></label>
    <span id="pw2Row" hidden></span>
    <button class="primary" id="authGo" type="submit">Giriş yap</button>
    <p class="auth-msg" id="authMsg" role="status"></p>
    <div class="auth-foot"><button type="button" class="linkish" id="forgot">Şifremi unuttum</button><button type="button" class="linkish" id="guestBtn">Üye olmadan devam et</button></div>
  </form>
</div>
<div class="wrap">''')
rep('.resume{display:flex;','''.auth{position:fixed;inset:0;z-index:50;background:var(--bg);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 16px}
.auth[hidden],.auth [hidden]{display:none!important}
.auth-card{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:22px;display:flex;flex-direction:column;gap:12px}
.auth-card h2{margin:0}
.auth-card label{display:flex;flex-direction:column;gap:4px;font-size:.9rem}
.auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.auth-tabs button{border:1px solid var(--line);border-radius:6px;padding:8px;background:var(--surface)}
.auth-tabs button.on{border-color:var(--accent);background:var(--accent-soft);font-weight:700}
.auth-msg{min-height:1.2em;font-size:.88rem;margin:0}
.auth-msg.bad{color:var(--warn)}
.auth-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
body.gated{overflow:hidden}
.acc-btns{display:flex;gap:8px}
.resume{display:flex;''')
# --- texts: the real microphone works here ---
rep('''Son turda söylediklerini buraya konuşarak yazdır: kutuya tıkla, Windows'ta <b>Win + H</b>, Mac'te <b>Fn</b> tuşuna iki kez bas ve mikrofona konuş. Sonra "Daha doğal nasıl söylenir?"e bas:''','''Tur başlayınca konuştukların mikrofonla bu kutuya canlı yazılır (Chrome ve Edge); her yeni tur kutuyu baştan doldurur. Olmazsa kutuya tıklayıp Windows'ta <b>Win + H</b> ile dikte et. Tur bitince "Daha doğal nasıl söylenir?"e bas:''')
rep('''placeholder="Mikrofonla konuşmak için kutuya tıkla, Windows'ta Win + H (Mac'te Fn iki kez) bas. İngilizce bulamadığın kelimeyi Türkçe söyleyebilirsin."''','''placeholder="Cevabını yaz ya da Konuş tuşuna basıp İngilizce söyle."''')
rep('''    <div class="resume" id="resume" hidden>''','''    <details class="settings">
      <summary>İlerleme yedeği</summary>
      <div class="set-body">
        <div class="ctrls"><button id="bkOut">İlerlemeyi yedekle (dosya)</button><label class="btnlike" for="bkIn">Yedeği yükle</label><input type="file" id="bkIn" accept="application/json,.json" hidden></div>
        <p class="muted" style="font-size:.8rem">Telefondan bilgisayara geçerken: bir cihazda yedekle, dosyayı diğer cihaza gönder ve orada yükle.</p>
      </div>
    </details>
    <div class="resume" id="resume" hidden>''')
rep('''.resume{display:flex;''','''.settings{flex:1 1 100%;order:3}
.settings summary{cursor:pointer;font-size:.88rem;color:var(--muted)}
.set-body{display:flex;flex-direction:column;gap:8px;padding-top:8px}
.btnlike{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:6px;padding:8px 14px;cursor:pointer;background:var(--surface)}
.resume{display:flex;''')
APPJS='''
/* ---------- app shell: settings, backup, offline ---------- */
$("#bkOut").onclick=()=>{const kv={}; SYNC_KEYS.forEach(k=>{const v=store.get(k,undefined); if(v!==undefined) kv[k]=v});
  const blob=new Blob([JSON.stringify({app:"laminate-talk",v:1,updatedAt:+store.get("lt.updatedAt",Date.now()),kv})],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="laminate-talk-yedek-"+dayKey()+".json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000)};
$("#bkIn").onchange=async e=>{const f=e.target.files[0]; if(!f) return;
  try{const d=JSON.parse(await f.text()); if(d.app!=="laminate-talk"||!d.kv) throw 0; applyRemote({...d,updatedAt:Date.now()}); store.put("lt.updatedAt",Date.now()); showResume(); accState("Yedek yüklendi","ok")}
  catch{accState("Bu dosya bir Laminate Talk yedeği değil","warn")} e.target.value=""};
if("serviceWorker" in navigator) addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
'''
h=re.sub(r'</script>\s*$', lambda m: APPJS+'</script>\n', h.rstrip(), count=1) if h.rstrip().endswith('</script>') else h
assert 'bkOut").onclick' in h, 'app js not appended'
# head
h=h.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
h=('<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n'
   '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
   '<meta name="theme-color" content="#0d7a69">\n<meta name="description" content="Kompozit mühendisleri için İngilizce konuşma pratiği">\n'
   '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icons/icon-192.png">\n<link rel="apple-touch-icon" href="icons/icon-192.png">\n'
   '<meta name="apple-mobile-web-app-capable" content="yes">\n</head>\n<body>\n'+h+'\n</body>\n</html>\n')
# --- write app ---
os.makedirs(A,exist_ok=True)
open(A+'index.html','w').write(h)
for d in ['audio','tts','ort','vendor']:
    os.makedirs(A+d,exist_ok=True)
for f in os.listdir(S+'pub/audio'): shutil.copy(S+'pub/audio/'+f,A+'audio/'+f)
for f in ['phonemizer.js','voice.json','voice0.wasm','voice1.wasm']: shutil.copy(S+'pub/tts/'+f,A+'tts/'+f)
shutil.copy(S+'pub/ort/ort-wasm-simd.wasm',A+'ort/'); shutil.copy(S+'sdkt/supabase.mjs',A+'vendor/'); shutil.copy(S+'npm/p3/package/dist/ort.min.js',A+'ort/')
json.dump({"name":"Laminate Talk","short_name":"Laminate Talk","description":"Kompozit mühendisleri için İngilizce konuşma pratiği",
  "lang":"tr","start_url":"./","scope":"./","display":"standalone","background_color":"#f2f4f3","theme_color":"#0d7a69",
  "icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"},
           {"src":"icons/icon-512-maskable.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]},open(A+'manifest.webmanifest','w'),ensure_ascii=False,indent=1)
ver=hashlib.sha1(h.encode()).hexdigest()[:10]
open(A+'sw.js','w').write(open(S+'build2/sw.template.js').read().replace('__VER__',ver))
print('app built',len(h),ver)
