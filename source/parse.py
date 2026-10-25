import re,glob,json,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lem import lemmas,OX
def parse(files):
    scen=[]; s=None; lv=None
    for f in files:
        # e*.txt files hold the episode rewrites of levels 2 and 3: a level header there replaces the older level
        fresh=os.path.basename(f).startswith('e')
        for ln in open(f,encoding='utf8'):
            ln=ln.rstrip('\n')
            if not ln.strip(): continue
            if ln.startswith('## '):
                p=[x.strip() for x in ln[3:].split('|')]
                lv=None
                if len(p)==1:
                    s=next(x for x in scen if x['id']==p[0]); continue
                s={'id':p[0],'tag':p[1],'title':p[2],'group':p[3],'levels':{}}; scen.append(s)
            elif ln[:6] in ('title:','brief:') or ln.startswith('role:'):
                k,v=ln.split(':',1)
                (lv if lv is not None else s)[k]=v.strip()   # inside a level: that episode's own title, situation and partner
            elif ln.startswith('### '):
                k=ln[4:].strip()
                if fresh: s['levels'][k]={'chunks':[],'lines':[]}
                lv=s['levels'].setdefault(k,{'chunks':[],'lines':[]})
            elif ln.startswith('ideas:'):
                lv['ideas']=[x.strip() for x in ln[6:].split(' ; ') if x.strip()]
            elif ln.startswith('chunks:'):
                for c in ln[7:].split(' ; '):
                    en,tr=[x.strip() for x in c.split(' = ',1)]; lv['chunks'].append([en,tr])
            elif ln[:2] in ('T:','Y:'):
                body=ln[2:].strip(); en,tr=(body.split(' | ',1)+[''])[:2]
                lv['lines'].append({'s':'t' if ln[0]=='T' else 'y','en':en.strip(),'tr':tr.strip()})
            else: raise SystemExit('bad line in %s: %s'%(f,ln))
    return scen
if __name__=='__main__':
    files=sorted(glob.glob(os.path.dirname(os.path.abspath(__file__))+'/d*.txt'))+sorted(glob.glob(os.path.dirname(os.path.abspath(__file__))+'/i*.txt'))+sorted(glob.glob(os.path.dirname(os.path.abspath(__file__))+'/e*.txt'))
    S=parse(files)
    seen={}
    nlines=0
    for s in S:
        for k,l in s['levels'].items():
            assert len(l['lines'])>=6 and l['chunks'], (s['id'],k)
            for x in l['lines']+[{'en':c[0]} for c in l['chunks']]:
                nlines+=1
                for w in lemmas(x['en']): seen.setdefault(w,set()).add(s['id'])
    cov=[w for w in OX if w in seen]; un=[w for w in OX if w not in seen]
    rec=sum(1 for w in cov if len(seen[w])>=2)
    print(f'{len(S)} scenarios, {nlines} lines; covered {len(cov)}/{len(OX)}; in>=2 scenarios {rec}')
    if '-u' in sys.argv: print(' '.join(un))
