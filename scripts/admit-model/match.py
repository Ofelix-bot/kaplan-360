import json, re, openpyxl, collections, statistics as st, sys
B="/mnt/user-data/uploads/kaplan_360++v201/"
ac=json.load(open(B+"data/raw/admit-cases.json"))["programmes"]
pm=json.load(open(B+"data/pipeline/compass/programme-matches.json"))
sch=json.load(open(B+"data/pipeline/compass/schools.json"))
wb=openpyxl.load_workbook(B+"exports/pei-cases-2026-10-26.xlsx",read_only=True)
rows=list(wb['全部案例'].iter_rows(values_only=True)); h=rows[0]; R=[dict(zip(h,r)) for r in rows[1:]]
uslugs=collections.defaultdict(set)
for k in pm: u,p=k.split("|",1); uslugs[p].add(u)
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
out=[]
for r in R:
  if r['结果']!='录取' or not isinstance(r['4 分制 GPA'],(int,float)): continue
  prog=r['目标项目']; uni=r['目标大学']
  en=sch.get(uni,{}).get('english') or ''
  cands=[u for u in uslugs.get(prog,[])]
  s=slug(en.replace('The ','')) if en else ''
  pick=[u for u in cands if s and (u.startswith(s[:15]) or s.startswith(u[:15]))] or (cands if len(cands)==1 else [])
  ids=[]
  for u in pick:
    m=pm[u+"|"+prog]
    if m['sure']: ids+=m['ids']
  ids=[i for i in ids if i in ac]
  if len(ids)!=1: continue
  out.append((r,ids[0]))
print("matched",len(out), file=sys.stderr)
json.dump([{**{k:(v if not hasattr(v,'isoformat') else str(v)) for k,v in r.items()},'pid':pid} for r,pid in out],open('matched.json','w'),ensure_ascii=False)
