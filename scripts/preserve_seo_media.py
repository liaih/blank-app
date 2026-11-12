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
    # Carry nearby H2/H3 sections into the description, including the preceding
    # L/A unit heading for images underneath a generic '3D' or 'plan' heading.
    headings=[]
    for prev in tag.find_all_previous(["h2","h3","h4"],limit=18):
        if boiler(prev):continue
        txt=" ".join(prev.get_text(" ",strip=True).split())
        if 3<=len(txt)<=100 and txt not in headings:headings.append(txt)
        if len(headings)>=3:break
    if headings:return "｜".join(headings[:3])[:190]
    for prev in tag.find_all_previous(["p","strong"],limit=5):
        if boiler(prev):continue
        txt=" ".join(prev.get_text(" ",strip=True).split())
        if 5<=len(txt)<=100:return txt
    return ""

def irrelevant_media(url,alt,kind,ctx):
    # Site-wide recommendations and corporate promo widgets are rendered by
    # the site's template, not the article. Do not paste them into article body.
    path=urlsplit(url).path
    basename=path.rsplit("/",1)[-1].lower()
    if re.fullmatch(r"[a-f0-9]{32}\.(?:jpe?g|png|webp|avif)",basename,re.I):
        return True
    if re.search(r"(育成中心|第一次找室內設計師|100室內設計推薦|裝修案例合集|推薦文章)",alt):
        return True
    if "正在規劃新家裝潢" in ctx:
        return True
    # These two recurring embeds are corporate promos, not case footage.
    # Preserve other real case videos rather than excluding by broad headings.
    if kind=="video" and ("cm21s8AVwjI" in url or "JofFrtBgHDE" in url):
        return True
    return False

def alt_for(draft,asset,section):
    """Describe known image type/subject with real case context; never invent details."""
    if asset["type"]!="image":return ""
    title=draft["title"].split("｜",1)[0].strip()
    original=" ".join(asset.get("alt","").split())
    ctx=" ".join(asset.get("context","").split())
    basename=urlsplit(asset["url"]).path.rsplit("/",1)[-1].lower()
    generic=(not original or original in ("圖片","Image","晨陽設計")
             or " - 晨陽室內設計" in original
             or ("室內設計裝修｜晨陽設計" in original)
             or len(original)>125
             or re.fullmatch(r"(?:圖片|image|晨陽設計|CHEN YANG)[\s\d]*",original,re.I))
    # Keep original useful ALT, especially descriptive room details in
    # the original old-house and newer image filename/caption assets.
    if not generic and len(original)>=16 and (
        any(term in original for term in ("玄關","客廳","臥室","主臥","書房","展示","櫃","格局","平面","設計"))
        and (not original.startswith("林口A7、A8捷運正核心"))
        and not re.search(r"(建築圖|平面|平配|配置圖|格局圖|^平\d)",basename,re.I)
    ):
        asset["alt_provenance"]="原頁具體 Alt（沿用）"
        return original[:120]
    # Label the asset type first. The filename is the source evidence for
    # floorplans, 3D renders and building illustrations.
    if re.search(r"(建築圖|建案圖|外觀)",basename):
        subject="建案建築外觀示意圖"
        unit=""
    elif re.search(r"(平面|平配|配置圖|格局圖|^平\d)",basename,re.I):
        subject="戶型平面格局示意圖"
        unit=""
    elif re.search(r"(?:3d|模擬|透視)",basename,re.I):
        subject="3D 空間設計示意圖"
        unit=""
    elif "line_album" in basename:
        subject=("現代輕奢空間設計示意圖" if "現代輕奢" in basename else
                 "北歐風空間設計示意圖" if "北歐風" in basename else
                 "現代風空間設計示意圖")
        unit=""
    elif re.search(r"(平面模擬|平面示意|格局平面)",ctx.split("｜",1)[0]):
        subject="平面格局示意圖"
        unit=""
    elif asset["order"]==1 and not re.search(r"(設計案例|平面|格局|空間)",ctx.split("｜",1)[0]):
        subject="建案介紹圖片"
        unit=""
    else:
        subject=""
        for pattern,label in [
            (r"(?:3D|模擬|透視)","3D 空間設計示意圖"),
            (r"(?:平面|格局配置|配置圖)","平面格局示意圖"),
            (r"(?:主臥|臥室|床頭)","臥室空間設計"),
            (r"(?:客廳|電視牆|沙發)","客廳空間設計"),
            (r"(?:玄關|鞋櫃)","玄關空間設計"),
            (r"(?:廚房|餐廳|餐廚)","餐廚空間設計"),
            (r"(?:衛浴|浴室)","衛浴空間設計"),
        ]:
            if re.search(pattern,ctx,re.I):subject=label;break
        if not subject:subject="老屋翻新案例圖片" if "老屋" in title else "室內空間設計圖片"
        unit=""
    if draft["id"]=="seo-yunjiang-331":
        unit=" L 戶" if section<=1 else " A 戶"
    elif "A6" in draft["title"]:unit=" A6 戶"
    elif "D11" in draft["title"]:unit=" D11 戶"
    elif "C3" in draft["title"]:unit=" C3 戶"
    elif "B1" in draft["title"]:unit=" B1 戶"
    elif "A1" in draft["title"]:unit=" A1 戶"
    elif "C 戶" in draft["title"]:unit=" C 戶"
    # Don't append a unit to a project-wide building illustration.
    if "建案建築外觀" in subject:unit=""
    asset["alt_provenance"]="依原檔名及文章段落編寫，需以圖片畫面核對"
    return f"{title}{unit}｜{subject}（圖{asset['order']}）"[:110]

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
        ctx=context(tag)
        original_alt=tag.get("alt","")[:180] if kind=="image" else ""
        if irrelevant_media(u,original_alt,kind,ctx):continue
        seen.add(u)
        found.append({"type":kind,"url":u,"alt":original_alt,
                      "context":ctx,"order":len(found)+1})
    # Keep inline case images, not site-wide promo/decorative asset URLs.
    for tag in soup.find_all(style=True):
        if boiler(tag):continue
        for raw in re.findall(r"""url\(\s*['"]?([^)'" ]+)""",tag.get("style",""),re.I):
            u=allowed(raw,page,"image")
            if u and u not in seen and not irrelevant_media(u,"","image",context(tag)):
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
    """A media block that remains readable on mobile and safe in CMS rich-text."""
    url=escape(media["url"],quote=True)
    if media["type"]=="image":
        alt=escape(media["alt"],quote=True)
        inner=(f'<img src="{url}" alt="{alt}" loading="lazy" decoding="async" '
               f'style="display:block;width:100%;max-width:900px;height:auto;margin:0 auto;border-radius:6px;">')
        caption=media["alt"]
    else:
        host=(urlsplit(media["url"]).hostname or "").lower()
        if host in HOSTS:
            inner=(f'<video src="{url}" controls preload="metadata" playsinline '
                   f'style="display:block;width:100%;max-width:900px;height:auto;margin:0 auto;"></video>')
        elif host in ("www.youtube.com","youtube.com","youtu.be",
                      "www.youtube-nocookie.com","player.vimeo.com"):
            if "youtu" in host:
                parts=urlsplit(media["url"])
                ident=(parts.path.strip("/") if host=="youtu.be" else
                    parse_qs(parts.query).get("v",[""])[0] if parts.path=="/watch"
                    else parts.path.split("/")[-1])
                if re.fullmatch(r"[\w-]{6,30}",ident):
                    url="https://www.youtube-nocookie.com/embed/"+escape(ident,quote=True)
                else:
                    return f'<p><a href="{url}" target="_blank" rel="noopener noreferrer">觀看原影片</a></p><BR>'
            title=escape(media.get("context") or "晨陽設計案例影片",quote=True)[:120]
            inner=(f'<iframe src="{url}" title="{title}" loading="lazy" allowfullscreen '
                   f'style="display:block;width:100%;max-width:900px;aspect-ratio:16/9;'
                   f'border:0;margin:0 auto;border-radius:6px;"></iframe>')
        else:
            return f'<p><a href="{url}" target="_blank" rel="noopener noreferrer">觀看原影片</a></p><BR>'
        caption=media.get("context","")
    caption=caption.strip()
    caption_text=(f'<figcaption style="padding:8px 4px 0;text-align:left;color:#666;'
                  f'font-size:13px;line-height:1.6;">{escape(caption)}</figcaption>'
                  if caption and not re.search(r"室內空間設計圖片（圖\d+）",caption) else "")
    return ('<figure style="max-width:900px;margin:24px auto 30px;clear:both;">'+
            inner+caption_text+'</figure><BR>')


def format_body(body,is_faq=False,lead=False):
    chunks=[x.strip() for x in body.split("<BR>") if x.strip()]
    if is_faq:
        output=[]
        for i in range(0,len(chunks),2):
            question=escape(chunks[i])
            answer=escape(chunks[i+1]) if i+1<len(chunks) else ""
            output.append(
              '<p style="margin:0 0 18px;padding:12px 16px;line-height:1.9;'
              'font-size:16px;color:#333;background:#f8fafc;border-left:3px solid #d0ae55;">'
              '<strong>'+question+'</strong><BR>'+answer+'</p><BR>')
        return "\n".join(output)
    result=[]
    for chunk in chunks:
        emphasis="font-weight:500;" if lead else ""
        result.append(
          '<p style="margin:0 0 22px;color:#333;font-size:16px;'
          'line-height:1.95;letter-spacing:.01em;'+emphasis+'">'+escape(chunk)+'</p><BR>')
    return "\n".join(result)


def merge(d,items):
    if not items:return ""
    n=len(d["sections"])
    groups=[[] for _ in range(n)]
    last=0
    for item in items:
        last=section_index(d["id"],item,last,n)
        if item["type"]=="image":
            item["original_alt"]=item.get("alt","")
            item["alt"]=alt_for(d,item,last)
            item["alt_review_required"]=item["alt_provenance"]!="原頁具體 Alt（沿用）"
        groups[last].append(item)
    parts=['<div class="chenyang-seo-content" style="max-width:900px;'
           'width:100%;margin:0 auto;color:#333;line-height:1.9;'
           'font-family:inherit;overflow-wrap:anywhere;">']
    for index,(heading,body) in enumerate(d["sections"]):
        parts.append(
          '<h2 style="font-size:clamp(20px,2.4vw,25px);line-height:1.45;'
          'font-weight:700;color:#263a50;margin:32px 0 14px;'
          'padding:0 0 10px;border-bottom:2px solid #d6b05c;">'+
          escape(heading)+'</h2><BR>')
        parts.append(format_body(body,is_faq=("FAQ" in heading or "常見問題" in heading),
                                 lead=index==0))
        # Images and their captions stay between logical topics, not within text.
        if groups[index]:
            parts.extend(embed(item) for item in groups[index])
    parts.append(
        '<p style="margin:32px 0 12px;padding:18px 20px;background:#f5f7fa;'
        'border-left:4px solid #d6b05c;font-size:16px;line-height:1.9;">'
        '<strong>晨陽設計｜進一步了解</strong><BR>'+
        escape(d["cta"])+'</p><BR>')
    parts.append('</div>')
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
                      "alt_count":sum(bool(x.get("alt")) for x in assets if x["type"]=="image"),
                      "alt_review_count":sum(bool(x.get("alt_review_required")) for x in assets if x["type"]=="image"),
                      "media_integrated":bool(assets and html),"review_required":True,
                      "status":"原頁媒體已提取，仍須比對是否完整" if assets else "未取到原頁媒體，禁止覆寫原文",
                      "error_type":error})
    result={"generated_at":datetime.now(ZoneInfo("Asia/Taipei")).isoformat(timespec="seconds"),
            "no_media_files_copied":True,"not_published_to_cms":True,
            "note":"依官網原文擷取媒體網址並與新版文字整合。ALT 取原有描述或由相鄰段落推定；未確認畫面內容的 ALT 會標記待核對。JS 延遲載入的圖片或影片可能漏抓，不能宣稱所有媒體完整。",
            "articles":output}
    (ROOT/"seo-media-rewrites.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps([{"id":x["id"],"images":x["image_count"],"videos":x["video_count"],"status":x["status"]} for x in output],ensure_ascii=False))
    if not any(row["media_integrated"] for row in output):
        raise SystemExit("No images recovered: keep original CMS content untouched")

if __name__=="__main__":main()
