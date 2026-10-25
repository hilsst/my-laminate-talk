# Laminate Talk content spec

Learner: Kemal, a Turkish mechanical engineer, expert in composite materials (analysis, calculations, manufacturing: prepreg, autoclave, RTM, NDT/UT, laminate theory, certification). He wants spoken English fluency for work meetings. No grammar teaching.

## Dialogue file format (UTF-8 text, one item per line, blank lines allowed)
```
## <id> | <English tag, 1-2 words> | <Turkish title> | <group>
brief: <Turkish: the situation and what the learner must explain, 1-2 sentences>
role: <English: who the partner is and what they care about, one line, lowercase start "a ...">
### 1
ideas: <Turkish point> ; <Turkish point> ; ...
chunks: <English chunk> = <Turkish gloss> ; ... (exactly 5)
T: <English> | <Turkish>
Y: <English> | <Turkish>
... (exactly 8 lines, alternating T, Y, T, Y..., starting with T)
### 2
... same
### 3
... same
```
- T = the partner (colleague, manager, customer...). Y = the learner (Kemal himself; he may be called Kemal).
- Separators are exact: ` | ` between English and Turkish, ` ; ` between items, ` = ` inside a chunk. Never use `|`, ` ; ` or ` = ` inside the text itself. Use `…` (single char) for an open chunk ending, like "The reason is that…".
- Level 1 (Temel): very short simple sentences, max 10-12 words, present/simple past. Level 2 (Orta): up to ~18 words, linking words (because, so, but, if), numbers. Level 3 (İleri): natural senior-colleague meeting English, idiomatic, precise technical vocabulary, 15-30 words for Y lines.
- The same story across the 3 levels (same facts), told more richly at higher levels.
- Chunks: reusable multi-word phrases (lexical chunks) that appear in that level's Y lines, useful in many meetings.
- Realistic composite-industry details: numbers, dates, materials, parts (brackets, panels, spars, fairings), standards, euros.
- Weave in naturally as many words as fit from the uncovered Oxford 3000 list (file un.txt in the same folder, space-separated). Never force a word that sounds wrong.
- Turkish must be natural, correct Turkish (not word-by-word).

## ideas: line (speaking plan for a 4/3/2 monologue)
The learner retells the topic alone as a short talk (like briefing a meeting). `ideas:` gives 4-6 Turkish prompts, in speaking order, of WHAT to say, not translations of dialogue lines. Each prompt is a short instruction with the concrete facts, e.g. "Durumu söyle: kalıp iki hafta gecikti" ; "Nedenini açıkla: tedarikçi teslim tarihini kaçırdı" ; "Etkisini anlat: ilk parça muayenesi mart sonuna kayıyor" ; "Kurtarma planını anlat: cumartesi mesaisi, paralel hazırlık" ; "Maliyeti ve riski belirt" ; "Sonraki adımı ve ne zaman bilgi vereceğini söyle". Level 1: 4 prompts, simple. Level 2: 5. Level 3: 5-6 including nuance (risk, trade-off, what you need from the listener). Prompts start with a Turkish imperative verb (Söyle, Açıkla, Anlat, Belirt, Öner, Sor...). Do not use ` ; ` inside a prompt; use commas.

## Validate
Run `python3 parse.py` in the folder; it must print without errors. It parses all d*.txt and i*.txt files.

## Episode rewrite of levels 2 and 3 (e*.txt files)
Kemal approved: levels 2 and 3 of every topic become the NEXT EPISODES of the same story instead of a richer retelling of level 1.
- Level 1 stays as it is (read it, it is the starting point of the story).
- Level 2 = what happens next: a new situation in the same storyline, usually with a different counterpart or a role flip (e.g. Kemal now asks instead of answers, talks to a supplier/customer/manager instead of a colleague). New facts, but the same domain so earlier words come back.
- Level 3 = a later, higher-stakes step: persuading, negotiating, handling pushback, presenting to management or a customer, defending a decision, giving an opinion with nuance.
- Social topics: same theme, new angle (e.g. coffee: L1 weekend plans → L2 recommending places in Kemal's city to a foreign visitor → L3 debating work-life balance).
- Each episode has its own Turkish title (short, e.g. "Tedarikçiyle kök neden toplantısı"), its own brief (Turkish, 1-2 sentences, what happens and what Kemal must do) and its own role (English, "a ..." lowercase).
- Language difficulty rules for level 2 (Orta) and level 3 (İleri) stay exactly as above. ideas: 5 prompts for level 2, 5-6 for level 3.
- File format (header holds only the id; title/brief/role go INSIDE each level):
```
## <id>
### 2
title: <Turkish episode title>
brief: <Turkish>
role: <English>
ideas: ... ; ... ; ... ; ... ; ...
chunks: <en> = <tr> ; ... (exactly 5)
T: <English> | <Turkish>
Y: <English> | <Turkish>
... exactly 8 lines T,Y,T,Y,T,Y,T,Y
### 3
title: ...
... same fields
```
- Validate your file with: python3 check_e.py <yourfile> <id> <id> ...   (must print OK), then python3 parse.py (must run without error).
