"""Validate one episode file: python3 check_e.py e1.txt id1 id2 ..."""
import sys,re
f=sys.argv[1]; want=sys.argv[2:]
cur=None; lv=None; data={}; errs=[]
for n,ln in enumerate(open(f,encoding='utf8'),1):
    ln=ln.rstrip('\n')
    if not ln.strip(): continue
    if ln.startswith('## '):
        cur=ln[3:].strip()
        if '|' in cur: errs.append(f'{n}: header must be only "## <id>"')
        data[cur]={}; lv=None; continue
    if ln.startswith('### '):
        lv=ln[4:].strip(); data[cur][lv]={'lines':[]}; continue
    if lv is None: errs.append(f'{n}: text outside a level: {ln[:50]}'); continue
    L=data[cur][lv]
    m=re.match(r'(title|brief|role|ideas|chunks):\s*(.*)',ln)
    if m: L[m.group(1)]=m.group(2); continue
    if ln[:2] in ('T:','Y:'):
        body=ln[2:].strip()
        if body.count(' | ')!=1: errs.append(f'{n}: line needs exactly one " | ": {ln[:60]}')
        L['lines'].append(ln[0]); continue
    errs.append(f'{n}: bad line: {ln[:60]}')
for i in want:
    if i not in data: errs.append(f'missing topic {i}'); continue
    for k in ('2','3'):
        L=data[i].get(k)
        if not L: errs.append(f'{i}: missing level {k}'); continue
        for fld in ('title','brief','role','ideas','chunks'):
            if not L.get(fld): errs.append(f'{i}/{k}: missing {fld}')
        ch=[c for c in L.get('chunks','').split(' ; ') if c.strip()]
        if len(ch)!=5 or any(c.count(' = ')!=1 for c in ch): errs.append(f'{i}/{k}: chunks must be exactly 5 "en = tr" items')
        ide=[c for c in L.get('ideas','').split(' ; ') if c.strip()]
        if not (5<=len(ide)<=6): errs.append(f'{i}/{k}: ideas must have 5-6 items (has {len(ide)})')
        if L['lines']!=['T','Y']*4: errs.append(f'{i}/{k}: need exactly 8 lines T,Y,T,Y,T,Y,T,Y (has {"".join(L["lines"])})')
extra=[i for i in data if i not in want]
if extra: errs.append(f'unexpected topics: {extra}')
print('\n'.join(errs) if errs else f'OK {len(data)} topics')
sys.exit(1 if errs else 0)
