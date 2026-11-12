"""Inspect public CMS article containers; no paid APIs or site mutations."""
from bs4 import BeautifulSoup
from urllib.request import Request,urlopen
import json
from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime,timezone

BASE=Path(__file__).resolve().parents[1]/"docs"
plan=json.loads((BASE/"seo-improvement-plan.json").read_text(encoding="utf-8"))
result=[]
for it in plan["items"]:
    url=it["url"]
    row={"id":it["id"],"url":url,"candidates":[]}
    try:
        req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SEOAudit/1.0)"})
        html=urlopen(req,timeout=20).read(5_000_000).decode("utf-8","replace")
        soup=BeautifulSoup(html,"html.parser")
        seed=None
        for h in soup.find_all(["h1","h2","h3","h4"]):
            if it["title"].split("｜")[0][:4] in h.get_text(" ",strip=True):
                seed=h
                break
        if not seed:seed=soup.find("h1") or soup.find("article") or soup.body
        cur=seed
        for n in range(8):
            if not cur or not getattr(cur,"name",None):break
            txt=" ".join(cur.get_text(" ",strip=True).split())
            row["candidates"].append({
                "level":n,"tag":cur.name,"id":cur.get("id",""),"class":cur.get("class",[]),
                "chars":len(txt),"images":len(cur.find_all("img")),
                "links":len(cur.find_all("a")),"headings":len(cur.find_all(["h1","h2","h3"])),
                "sample":txt[:230],"tail":txt[-120:]
            })
            cur=cur.parent
        row["root_image_count"]=len(soup.find_all("img"))
    except Exception as e:row["error"]=str(e)[:200]
    result.append(row)
output={"generated_at":datetime.now(timezone.utc).isoformat(),"articles":result}
(BASE/"seo-source-audit.json").write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps([{"id":x["id"],"candidates":[(y["tag"],y["id"],y["class"],y["chars"],y["images"]) for y in x["candidates"]],"error":x.get("error")} for x in result],ensure_ascii=False))
