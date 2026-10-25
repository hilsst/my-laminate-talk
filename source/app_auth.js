/* ---------- membership (Supabase): sign up / sign in, progress kept in the member's account ---------- */
const SB_URL="__SB_URL__", SB_KEY="__SB_KEY__";
let sb=null, sbUser=null;
const PROG_KEYS=SYNC_KEYS;
// file backup is only for guests; a member's progress already lives in their account
function backupBox(show){ const d=document.querySelector(".settings"); if(d) d.hidden=!show }
function gate(show,tab){ $("#authGate").hidden=!show; document.body.classList.toggle("gated",!!show); if(show) authTab(tab||"in") }
function authTab(t){ $("#authGate").dataset.tab=t; $("#tabIn").classList.toggle("on",t==="in"); $("#tabUp").classList.toggle("on",t==="up");
  $("#nameRow").hidden=t!=="up"; $("#authGo").textContent=t==="up"?"Üye ol":"Giriş yap"; $("#authMsg").textContent=""; $("#forgot").hidden=t!=="in"; $("#pw2Row").hidden=t!=="new";
  if(t==="new"){$("#authGo").textContent="Yeni şifreyi kaydet";$("#emailRow").hidden=true}else $("#emailRow").hidden=false }
function authMsg(t,bad){const m=$("#authMsg"); m.textContent=t; m.className="auth-msg"+(bad?" bad":"")}
function wipeLocal(){ PROG_KEYS.forEach(k=>{delete MEM[k]; try{localStorage.removeItem(k)}catch{}}); store.put("lt.updatedAt",0) }
function trErr(e){const m=String(e?.message||e||"");
  if(/invalid login/i.test(m)) return "E-posta ya da şifre hatalı.";
  if(/not confirmed/i.test(m)) return "E-posta adresin henüz onaylanmadı. Gelen kutundaki onay bağlantısına tıkla.";
  if(/already registered|already exists/i.test(m)) return "Bu e-posta ile zaten üyelik var. Giriş yap sekmesini kullan.";
  if(/password/i.test(m)&&/6|short|least/i.test(m)) return "Şifre en az 6 karakter olmalı.";
  if(/rate|too many/i.test(m)) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
  if(/fetch|network/i.test(m)) return "İnternet bağlantısı yok. Bağlanınca tekrar dene.";
  return "Bir sorun oldu: "+m }
async function signedIn(u){
  sbUser=u; gate(false); try{localStorage.removeItem("lt.guest")}catch{}
  $("#accName").textContent=u.user_metadata?.name||u.email; personalize(u.user_metadata?.name); $("#logoutBtn").hidden=false; $("#loginBtn").hidden=true; backupBox(false);
  const owner=store.get("lt.owner",null);
  if(owner&&owner!==u.id) wipeLocal();
  store.put("lt.owner",u.id);
  ACC.ref={
    get:async()=>{const {data,error}=await sb.from("progress").select("data").eq("user_id",u.id).maybeSingle(); if(error) throw error; return {exists:!!data,data:()=>data?.data||{}}},
    set:async d=>{const {error}=await sb.from("progress").upsert({user_id:u.id,data:d,updated_at:new Date().toISOString()}); if(error) throw error}
  };
  await pullSync(true);
  maybeHowto();
}
async function pullSync(first){
  if(!ACC.ref) return;
  if(first) accState("Hesabın yükleniyor…");
  try{
    const snap=await ACC.ref.get(), localAt=+store.get("lt.updatedAt",0), remoteAt=snap.exists?(snap.data().updatedAt||0):0;
    if(snap.exists&&remoteAt>localAt) applyRemote(snap.data());
    else if(localAt>remoteAt) await pushSync();
    accState("İlerlemen hesabına kaydediliyor","ok");
  }catch(e){ accState("Hesaba ulaşılamadı; ilerleme bu cihazda tutuluyor, bağlantı gelince eşitlenecek","warn") }
  showResume();
}
async function sbInit(){
  if(!SB_URL||SB_URL.startsWith("__")){ accState("İlerlemen bu cihazda kaydediliyor","ok"); $("#loginBtn").hidden=true; showResume(); maybeHowto(); return }
  try{ const {createClient}=await import(new URL("vendor/supabase.mjs",location.href).href);
    sb=createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) }
  catch{ accState("Üyelik sistemine ulaşılamadı; ilerleme bu cihazda tutuluyor","warn"); showResume(); return }
  sb.auth.onAuthStateChange((ev,s)=>{
    if(ev==="PASSWORD_RECOVERY"){gate(true,"new");authMsg("Yeni şifreni yaz.")}
    else if(ev==="SIGNED_IN"&&s?.user&&(!sbUser||sbUser.id!==s.user.id)) signedIn(s.user);
  });
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user) await signedIn(session.user);
  else { let guest=false; try{guest=localStorage.getItem("lt.guest")==="1"}catch{}
    $("#loginBtn").hidden=false; accState(guest?"Misafir olarak çalışıyorsun; ilerleme sadece bu cihazda":"Giriş yapılmadı");
    if(!guest) gate(true,"in"); else maybeHowto(); showResume() }
}
$("#tabIn").onclick=()=>authTab("in"); $("#tabUp").onclick=()=>authTab("up");
$("#loginBtn").onclick=()=>gate(true,"in");
$("#guestBtn").onclick=()=>{try{localStorage.setItem("lt.guest","1")}catch{} gate(false); accState("Misafir olarak çalışıyorsun; ilerleme sadece bu cihazda"); maybeHowto()};
$("#authForm").onsubmit=async e=>{
  e.preventDefault(); if(!sb) return;
  const t=$("#authGate").dataset.tab, email=$("#authEmail").value.trim(), pw=$("#authPw").value;
  $("#authGo").disabled=true; authMsg("Bekle…");
  try{
    if(t==="in"){ const {data,error}=await sb.auth.signInWithPassword({email,password:pw}); if(error) throw error; await signedIn(data.user) }
    else if(t==="up"){ const name=$("#authName").value.trim();
      const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{name},emailRedirectTo:location.origin+location.pathname}}); if(error) throw error;
      if(data.session) await signedIn(data.user); else authMsg("Üyeliğin oluşturuldu. E-postana gelen onay bağlantısına tıkla, sonra burada giriş yap.") }
    else if(t==="new"){ const {error}=await sb.auth.updateUser({password:$("#authPw").value}); if(error) throw error; authMsg("Şifren değişti."); const {data}=await sb.auth.getUser(); if(data?.user) await signedIn(data.user) }
  }catch(err){ authMsg(trErr(err),true) }
  $("#authGo").disabled=false;
};
$("#forgot").onclick=async()=>{ const email=$("#authEmail").value.trim(); if(!email){authMsg("Önce e-posta adresini yaz.",true);return}
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  authMsg(error?trErr(error):"Şifre yenileme bağlantısı e-postana gönderildi.",!!error) };
$("#logoutBtn").onclick=async()=>{ if(ACC.ref){clearTimeout(ACC.timer);ACC.timer=null;await pushSync()}
  await sb?.auth.signOut(); ACC.ref=null; sbUser=null; wipeLocal(); store.put("lt.owner",null); location.reload() };
addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&ACC.ref) pullSync(false) });
sbInit();
