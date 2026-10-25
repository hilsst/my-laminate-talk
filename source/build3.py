import re
S='/tmp/claude-0/-home-claude/f0ab6655-4acc-54ae-87fe-327961bfcf77/scratchpad/'
h=open(S+'kompozit-konusma.html').read()
G=re.search(r'const GLOSS = (\[.*?\]);\n',h,re.S).group(1)
js=open(S+'build2/script.js').read().replace('__CONTENT__',open(S+'build2/content.json').read()).replace('__OXFORD__',open(S+'build2/oxford.json').read()).replace('__GLOSS__',G).replace('__OXTR__',open(S+'build2/oxtr.json').read() if __import__('os').path.exists(S+'build2/oxtr.json') else '[]')
h=re.sub(r'<script>.*</script>',lambda m:'<script>\n'+js+'</script>',h,flags=re.S)
a='<p class="muted" id="ttsNote" hidden>'
assert h.count(a)==1
if 'id="neuNote"' not in h: h=h.replace(a,'<p class="muted" id="neuNote" hidden></p>\n    '+a)
h=h.replace('Bu tarayıcıda anlık sesli okuma çalışmıyor. Hazır kayıtlı cümleler yine çalışır; toplantı partnerinin cevaplarını ise okuyarak takip edebilirsin.','Bu tarayıcıda anlık seslendirme başlatılamadı. Hazır kayıtlı cümleler yine çalışır; toplantı partnerinin cevaplarını ise okuyarak takip edebilirsin.')
open(S+'pub/index.html','w').write(h)
print(len(h))
