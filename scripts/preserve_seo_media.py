"""Merge verified source-page media URLs into rewritten SEO article HTML.
Does not download or regenerate media. Includes conservative no-media status.
"""
import json,re
from html import escape
from pathlib import Path
from datetime import datetime
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlsplit,parse_qs
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]/"docs"
HOSTS={"chen-yang.com.tw","www.chen-yang.com.tw"}
VIDEOS={"www.youtube.com","youtube.com","www.youtube-nocookie.com","youtu.be","player.vimeo.com","vimeo.com","www.facebook.com"}
MEDIA_EXT=re.compile(r"\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$",re.I)
VIDEO_EXT=re.compile(r"\.(?:mp4|webm|mov)(?:\?.*)?$",re.I)
NON_CONTENT=re.compile(r"(^|[-_ ])(header|footer|logo|nav|search|menu|breadcrumb|sidebar|social)([-_ ]|$)",re.I)

def allowed(raw,base,kind):
    if not raw or str(raw).startswith(("data:","blob:","javascript:")):return ""
    url=urljoin(base,str(raw).strip())
    p=urlsplit(url);host=(p.hostname or "").lower()
    if p.scheme not in ("http","https") or p.username or p.password or len(url)>3000:return ""
    if kind=="image":
        if host not in HOSTS:return ""
        if not (MEDIA_EXT.search(p.path) or "/upload/" in p.path.lower() or "/uploads/" in p.path.lower()):return ""
    else:
        if host not in VIDEOS and not (host in HOSTS and VIDEO_EXT.search(p.path)):return ""
    return url.replace("http://","https://",1) if url.startswith("http://") else url

def boiler(node):
    for parent in [node]+list(node.parents):
        if parent.name in ("header","footer","nav","aside"):return True
        if parent.name in ("html","body"):break
        class_id=" ".join(parent.get("class",[]))+" "+str(parent.get("id",""))
        if NON_CONTENT.search(class_id):return True
    return False

def context(tag):
    for prev in tag.find_all_previous(["h2","h3","h4","strong","p"],limit=10):
        if boiler(prev):continue
        txt=" ".join(prev.get_text(" ",strip=True).split())
        if 3<=len(txt)<=110:return txt[:110]
    return ""

def extract(html,page):
    soup=BeautifulSoup(html,"html.parser")
    found=[];seen=set()
    for tag in soup.find_all(["img","iframe","video","a"]):
        if boiler(tag):continue
        kind="image" if tag.name=="img" else "video"
        if tag.name=="img":
            raw=next((tag.get(k,"") for k in ["data-original","data-src","data-lazy-src","src"]
                     if allowed(tag.get(k,""),page,"image")),"")
        elif tag.name=="a":
            raw=tag.get("href","")
            if not (VIDEO_EXT.search(urlsplit(raw).path) or re.search(r"(watch\?|youtu\.be/|/shorts/|/embed/)",raw)):continue
        elif tag.name=="video":
            raw=tag.get("src","") or (tag.find("source").get("src","") if tag.find("source") else "")
        else:raw=tag.get("src","")
        u=allowed(raw,page,kind)
        if not u or u in seen:continue
        seen.add(u)
        found.append({"type":kind,"url":u,"alt":tag.get("alt","")[:180] if kind=="image" else "",
                      "context":context(tag),"order":len(found)+1})
    # Original inline background-image assets also belong to the article.
    for tag in soup.find_all(style=True):
        if boiler(tag):continue
        for raw in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)",tag.get("style",""),re.I):
            u=allowed(raw,page,"image")
            if u and u not in seen:
                seen.add(u);found.append({"type":"image","url":u,"alt":"",
                                            "context":context(tag),"order":len(found)+1})
    return found

def section_index(aid,asset,previous,n):
    ctx=asset["context"].lower()
    if aid=="seo-yunjiang-331":
        pos=2 if re.search(r"(a\s*戶|現代輕奢)",ctx,re.I) else 1
        if asset["order"]==1:pos=0
    elif re.search(r"(平面|格局|配置圖)",ctx):pos=0
    elif re.search(r"(臥室|主臥|次臥)",ctx):pos=2
    elif re.search(r"(客廳|餐廳|玄關)",ctx):pos=1
    else:pos=0 if asset["order"]==1 else max(previous,1)
    return max(previous,min(pos,n-2))

def embed(media):
    u=escape(media["url"],quote=True)
    if media["type"]=="image":
        inner='<img src="'+u+'" alt="'+escape(media["alt"],quote=True)+'" loading="lazy" decoding="async" style="max-width:100%;height:auto;">'
    else:
        host=(urlsplit(media["url"]).hostname or "").lower()
        if host in HOSTS:
            inner='<video src="'+u+'" controls preload="metadata" style="max-width:100%;width:100%;"></video>'
        elif host in ("www.youtube.com","youtube.com","youtu.be","www.youtube-nocookie.com","player.vimeo.com"):
            if "youtu" in host:
                p=urlsplit(media["url"])
                ident=p.path.strip("/") if host=="youtu.be" else (parse_qs(p.query).get("v",[""])[0] if p.path=="/watch" else p.path.split("/")[-1])
                if re.fullmatch(r"[\w-]{6,30}",ident):u="https://www.youtube-nocookie.com/embed/"+escape(ident,quote=True)
                else:return '<p><a href="'+u+'" target="_blank" rel="noopener noreferrer">觀看原影片</a></p><BR>'
            inner='<iframe src="'+u+'" title="原文章影片" loading="lazy" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;"></iframe>'
        else:return '<p><a href="'+u+'" target="_blank" rel="noopener noreferrer">觀看原影片</a></p><BR>'
    caption=escape(media["alt"] or media["context"])
    return '<figure style="margin:18px auto;text-align:center;">'+inner+('<figcaption style="font-size:13px;color:#555;">'+caption+'</figcaption>' if caption else "")+'</figure><BR>'

def merge(d,items):
    if not items:return ""
    n=len(d["sections"]);groups=[[] for _ in range(n)];last=0
    for item in items:
        last=section_index(d["id"],item,last,n);groups[last].append(item)
    parts=[]
    for idx,(h,body) in enumerate(d["sections"]):
        parts.append("<h2>"+escape(h)+"</h2><BR>")
        parts.append("<BR>".join(escape(x) for x in body.split("<BR>"))+"<BR><BR>")
        parts.extend(embed(item) for item in groups[idx])
    parts.append("<strong>晨陽設計｜進一步了解</strong><BR>"+escape(d["cta"])+"<BR>")
    return "\n".join(parts)

def main():
    plan=json.loads((ROOT/"seo-improvement-plan.json").read_text(encoding="utf-8"))
    rewrites=json.loads((ROOT/"seo-rewrites.json").read_text(encoding="utf-8"))
    urls={row["id"]:row["url"] for row in plan["items"]}
    output=[]
    for draft in rewrites["articles"]:
        url=urls[draft["id"]]
        if (urlsplit(url).hostname or "").lower() not in HOSTS:raise ValueError("unapproved source host")
        try:
            req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ChenYangCMSMediaAudit/1.0)"})
            with urlopen(req,timeout=25) as resp:raw=resp.read(5000000)
            assets=extract(raw.decode("utf-8",errors="replace"),url)
            html=merge(draft,assets)
            error=None
        except Exception as exc:
            assets=[];html="";error=type(exc).__name__
        output.append({"id":draft["id"],"source_url":url,"media_count":len(assets),
                      "image_count":sum(x["type"]=="image" for x in assets),
                      "video_count":sum(x["type"]=="video" for x in assets),
                      "media":assets,"html_with_media":html,
                      "media_integrated":bool(assets and html),"review_required":True,
                      "status":"原頁媒體已提取，仍須比對是否完整" if assets else "未取到原頁媒體，禁止覆寫原文",
                      "error_type":error})
    result={"generated_at":datetime.now(ZoneInfo("Asia/Taipei")).isoformat(timespec="seconds"),
            "no_media_files_copied":True,"not_published_to_cms":True,
            "note":"依官網原文擷取媒體網址並與新版文字整合。來源若有 JS 延遲載入的圖片或影片，可能漏抓；上稿前須逐張對照原文。",
            "articles":output}
    (ROOT/"seo-media-rewrites.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps([{"id":x["id"],"images":x["image_count"],"videos":x["video_count"],"status":x["status"]} for x in output],ensure_ascii=False))
    if not any(row["media_integrated"] for row in output):
        raise SystemExit("No images recovered: keep original CMS content untouched")

if __name__=="__main__":main()
