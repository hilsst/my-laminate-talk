import json,wave,subprocess,base64,os,re
from piper import PiperVoice
S='/tmp/claude-0/-home-claude/f0ab6655-4acc-54ae-87fe-327961bfcf77/scratchpad/'
D=S+'build2/'
def key(t):
    h=5381
    for ch in t: h=((h*33)^ord(ch))&0xffffffff
    return format(h,'x')
def clean(t): return t.replace('…','').strip()
V={'t':PiperVoice.load(S+'voice/en-us-lessac-medium.onnx'),'y':PiperVoice.load(S+'voice/en-us-ryan-medium.onnx')}
os.makedirs(D+'tmp',exist_ok=True); os.makedirs(S+'pub/audio',exist_ok=True)
cache={}
def clip(s,t):
    k=key(s+'|'+t)
    if k in cache: return k
    w=D+'tmp/'+k+'.wav'; m=D+'tmp/'+k+'.mp3'
    if not os.path.exists(m):
        with wave.open(w,'wb') as f: V[s].synthesize_wav(t,f)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',w,'-ac','1','-ar','22050','-b:a','32k',m],check=True)
        os.remove(w)
    d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',m],capture_output=True,text=True).stdout.strip())
    cache[k]=('data:audio/mpeg;base64,'+base64.b64encode(open(m,'rb').read()).decode(),round(d,2))
    return k
C=json.load(open(D+'content.json'))
for i,s in enumerate(C):
    out={'clips':{},'dur':{}}
    for L in s['levels'].values():
        items=[(x['s'],x['en']) for x in L['lines']]+[('y',clean(c[0])) for c in L['chunks']]
        for sp,t in items:
            k=clip(sp,t); out['clips'][k],out['dur'][k]=cache[k]
    json.dump(out,open(S+'pub/audio/'+s['id']+'.json','w'))
    print(i+1,s['id'],flush=True)
html=open(S+'kompozit-konusma.html').read()
G=json.loads(re.search(r'const GLOSS = (\[.*?\]);\n',html,re.S).group(1))
out={'clips':{},'dur':{}}
for g in G:
    for t in (g[1],g[2]):
        k=clip('y',t); out['clips'][k],out['dur'][k]=cache[k]
json.dump(out,open(S+'pub/audio/common.json','w'))
print('done')
