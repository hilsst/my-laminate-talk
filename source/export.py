import json,glob,os,sys,re
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from parse import parse
from lem import lemmas,OX
D=os.path.dirname(os.path.abspath(__file__))
S=parse(sorted(glob.glob(D+'/d*.txt'))+sorted(glob.glob(D+'/i*.txt'))+sorted(glob.glob(D+'/e*.txt')))
IDX={w:i for i,w in enumerate(OX)}
CAT={'pm':'budget'}
WORK={'intro','videocall','sick','event','hiring','review','complaint','conference','negotiation','office','tech'}
out=[]
for s in S:
    cat='budget' if s['group']=='pm' else 'tech' if s['group']=='tech' else 'work' if s['group']=='work' or s['id'] in WORK else 'social'
    lv={}
    for k,l in s['levels'].items():
        lines=[{'s':x['s'],'en':x['en'],'tr':x['tr'],'w':sorted(IDX[w] for w in lemmas(x['en']))} for x in l['lines']]
        lv[k]={'chunks':l['chunks'],'lines':lines,'ideas':l.get('ideas',[])}
        for f in ('title','brief','role'):
            if l.get(f): lv[k][f]=l[f]
    out.append({'id':s['id'],'tag':s['tag'],'title':s['title'],'cat':cat,'brief':s['brief'],'role':s['role'],'levels':lv})
json.dump(out,open(D+'/content.json','w'),ensure_ascii=False)
json.dump(OX,open(D+'/oxford.json','w'))
print(len(out), {c:sum(1 for x in out if x['cat']==c) for c in ('budget','tech','work','social')})
