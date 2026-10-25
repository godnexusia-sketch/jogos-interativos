# Junta os arquivos de perguntas (testes/perguntas/*.txt) nos bancos do jogo, sem repetir.
import json, glob, unicodedata, re, sys
def norm(s): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode())
base = 'public/data/'
# Quiz (trivia): cat|d|pergunta|certa|errada|errada|errada
t = json.load(open(base + 'trivia.json'))
vistos = {norm(q['q']) for q in t['q']}; novos = 0
for f in sorted(glob.glob('testes/perguntas/trivia-*.txt')):
    for ln in open(f, encoding='utf-8'):
        p = [x.strip() for x in ln.strip().split('|')]
        if len(p) != 7: continue
        cat, d, q, *a = p
        if len(set(x.lower() for x in a)) != 4: sys.exit(f'alternativas repetidas: {q}')
        if norm(q) in vistos: continue
        vistos.add(norm(q)); t['q'].append({'cat': cat, 'd': int(d), 'q': q, 'a': a}); novos += 1
        if cat not in t['cats']: t['cats'].append(cat)
json.dump(t, open(base + 'trivia.json', 'w'), ensure_ascii=False, indent=0)
print('quiz: +', novos, 'total', len(t['q']), 'categorias', len(t['cats']))

# Verdadeiro ou Falso: cat|d|V/F|afirmação|explicação
t = json.load(open(base + 'truefalse.json'))
for q in t['q']: q.setdefault('d', 2)
vistos = {norm(q['s']) for q in t['q']}; novos = 0
for f in sorted(glob.glob('testes/perguntas/vf-*.txt')):
    for ln in open(f, encoding='utf-8'):
        p = [x.strip() for x in ln.strip().split('|')]
        if len(p) != 5 or p[2] not in ('V', 'F'): continue
        cat, d, vf, frase, exp = p
        if norm(frase) in vistos: continue
        vistos.add(norm(frase)); t['q'].append({'cat': cat, 'd': int(d), 't': vf == 'V', 's': frase, 'e': exp}); novos += 1
        if cat not in t['cats']: t['cats'].append(cat)
json.dump(t, open(base + 'truefalse.json', 'w'), ensure_ascii=False, indent=0)
print('verdadeiro ou falso: +', novos, 'total', len(t['q']), 'V:', sum(1 for q in t['q'] if q['t']), 'F:', sum(1 for q in t['q'] if not q['t']))

# O Povo Diz: pergunta|resposta:pontos:sinonimo,sinonimo|...
s = json.load(open(base + 'survey.json'))
vistos = {norm(x['q']) for x in s}; novos = 0
for f in sorted(glob.glob('testes/perguntas/povo-*.txt')):
    for ln in open(f, encoding='utf-8'):
        p = [x.strip() for x in ln.strip().split('|')]
        if len(p) < 5: continue
        q, resps = p[0], []
        for r in p[1:]:
            parts = r.split(':')
            resp, pts = parts[0].strip(), int(parts[1])
            alt = [a.strip() for a in parts[2].split(',')] if len(parts) > 2 and parts[2].strip() else []
            resps.append({'a': resp, 'p': pts, 'alt': alt})
        if norm(q) in vistos or len({norm(r['a']) for r in resps}) != len(resps): continue
        vistos.add(norm(q)); s.append({'q': q, 'a': sorted(resps, key=lambda r: -r['p'])}); novos += 1
json.dump(s, open(base + 'survey.json', 'w'), ensure_ascii=False, indent=0)
print('o povo diz: +', novos, 'total', len(s))
