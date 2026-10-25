import re
OX=[w.strip().lower() for w in open(__file__.rsplit('/',1)[0]+'/oxford3000.txt') if w.strip()]
SINGLE=set(w for w in OX if ' ' not in w); MULTI=[w for w in OX if ' ' in w]
IRR={'was':'be','were':'be','is':'be','are':'be','am':'be','been':'be','being':'be',"isn't":'be',"aren't":'be',"wasn't":'be',"weren't":'be',"i'm":'be',"it's":'it',"that's":'that',"there's":'there',"what's":'what',"let's":'let',"he's":'he',"she's":'she',
'has':'have','had':'have','having':'have',"hasn't":'have',"haven't":'have',"didn't":'do',"don't":'do',"doesn't":'do','did':'do','does':'do','done':'do','doing':'do',
"can't":'can','could':'could',"couldn't":'could',"won't":'will',"wouldn't":'would',"shouldn't":'should',
'went':'go','gone':'go','goes':'go','made':'make','took':'take','taken':'take','gave':'give','given':'give','got':'get','gotten':'get','came':'come','saw':'see','seen':'see','knew':'know','known':'know','thought':'think','told':'tell','said':'say','found':'find','felt':'feel','left':'leave','kept':'keep','brought':'bring','bought':'buy','built':'build','sent':'send','spent':'spend','paid':'pay','met':'meet','ran':'run','began':'begin','begun':'begin','broke':'break','broken':'break','chose':'choose','chosen':'choose','drove':'drive','driven':'drive','ate':'eat','eaten':'eat','fell':'fall','fallen':'fall','flew':'fly','flown':'fly','forgot':'forget','forgotten':'forget','grew':'grow','grown':'grow','heard':'hear','held':'hold','led':'lead','lost':'lose','meant':'mean','rose':'rise','risen':'rise','sat':'sit','slept':'sleep','sold':'sell','spoke':'speak','spoken':'speak','stood':'stand','taught':'teach','understood':'understand','won':'win','wrote':'write','written':'write','woke':'wake','wore':'wear','worn':'wear','drank':'drink','drunk':'drink','sang':'sing','swam':'swim','threw':'throw','thrown':'throw','caught':'catch','fought':'fight','hung':'hang','hid':'hide','hidden':'hide','lent':'lend','lay':'lie','laid':'lay','rode':'ride','shook':'shake','shot':'shoot','shut':'shut','stole':'steal','stuck':'stick','struck':'strike','swung':'swing','tore':'tear','torn':'tear','bent':'bend','bit':'bite','blew':'blow','bound':'bind','bred':'breed','fed':'feed','fled':'flee','froze':'freeze','frozen':'freeze','dug':'dig','drew':'draw','drawn':'draw','dealt':'deal','ground':'ground','sought':'seek','sank':'sink','sunk':'sink','spun':'spin','spread':'spread','stung':'sting','wound':'wound','children':'child','men':'man','women':'woman','people':'people','feet':'foot','teeth':'tooth','mice':'mouse','lives':'life','knives':'knife','wives':'wife','leaves':'leaf','halves':'half','shelves':'shelf','better':'good','best':'good','worse':'bad','worst':'bad','further':'further','less':'less','least':'least','more':'more','most':'most','an':'a','me':'i','my':'my','us':'we','him':'he','them':'they','her':'her',"we're":'we',"we've":'we',"we'll":'we',"we'd":'we',"i've":'i',"i'll":'i',"i'd":'i',"you're":'you',"you've":'you',"you'll":'you',"they're":'they',"they've":'they',"they'll":'they',"it'll":'it',"that'll":'that'}
def cands(t):
    yield t
    for suf,rep in (('ies','y'),('ied','y'),('ier','y'),('iest','y'),('ves','f'),('es',''),('s',''),('ed',''),('ed','e'),('d',''),('ing',''),('ing','e'),('er',''),('er','e'),('est',''),('est','e'),('ly',''),('ily','y'),("'s",''),("s'",'')):
        if t.endswith(suf) and len(t)-len(suf)>=2:
            b=t[:-len(suf)]+rep; yield b
            if suf in('ed','ing','er','est') and len(b)>=3 and b[-1]==b[-2]: yield b[:-1]
def lemmas(text):
    low=text.lower().replace('’',"'")
    out=set()
    for m in MULTI:
        if re.search(r'\b'+re.escape(m)+r'\b',low): out.add(m)
    for t in re.findall(r"[a-z]+(?:'[a-z]+)?",low):
        hit=False
        if t in SINGLE: out.add(t); hit=True
        if t in IRR and IRR[t] in SINGLE: out.add(IRR[t]); hit=True
        if t in IRR: continue
        for c in cands(t):
            if c!=t and c in SINGLE: out.add(c); break
    return out
