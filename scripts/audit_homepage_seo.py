"""Read-only technical and content SEO audit of the *published* 晨陽 homepage.

Does not log in, submit forms, change CMS content, or use paid ranking services.
All values are observed in live HTML and HTTP responses; an absent value means
'not detected', not necessarily that Google failed to index the page.
"""
from __future__ import annotations
from datetime import datetime
import json
from pathlib import Path
import re
import urllib.error
import urllib.request
from urllib.parse import urljoin,urlsplit
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

OUTPUT=Path(__file__).resolve().parents[1]/"docs"/"seo-homepage-audit.json"
ORIGINS=["https://chen-yang.com.tw/","https://www.chen-yang.com.tw/","https://chen-yang.com.tw/index.php","https://www.chen-yang.com.tw/index.php"]
SERVICE_PAGES=["locations.php","change-design.php","new-house.php","renovation.php","faq.php",
               "survey-verification.php","manager-system.php"]
REQUEST_HEADERS={"User-Agent":"Mozilla/5.0 (compatible; ChenYangHomepageReadOnlyAudit/1.0; +https://chen-yang.com.tw/)"}
ACCEPTED={"chen-yang.com.tw","www.chen-yang.com.tw"}

def fetch(url,limit=3_000_000):
    req=urllib.request.Request(url,headers=REQUEST_HEADERS)
    try:
        with urllib.request.urlopen(req,timeout=22) as resp:
            blob=resp.read(limit+1)
            if len(blob)>limit:raise ValueError("response larger than limit")
            return {"status":resp.status,"final_url":resp.url,
                "content_type":resp.headers.get("Content-Type",""),
                "x_robots_tag":resp.headers.get("X-Robots-Tag",""),
                "body":blob.decode("utf-8","replace")}
    except urllib.error.HTTPError as e:
        return {"status":e.code,"final_url":url,
            "content_type":e.headers.get("Content-Type",""),
            "x_robots_tag":e.headers.get("X-Robots-Tag",""),"body":""}

def safe_url(url):
    part=urlsplit(url)
    return part.scheme in ("http","https") and (part.hostname or "").lower() in ACCEPTED

def inspect_homepage(url):
    page=fetch(url)
    result={k:v for k,v in page.items() if k!="body"}
    if not safe_url(result["final_url"]):
        raise ValueError("Unexpected redirect domain; refuse audit")
    soup=BeautifulSoup(page["body"],"html.parser")
    def meta(name,attribute="name"):
        tag=soup.find("meta",attrs={attribute:re.compile("^"+re.escape(name)+"$",re.I)})
        return (tag.get("content") or "").strip() if tag else None
    canon=soup.find("link",attrs={"rel":lambda val:val and "canonical" in val})
    result["title"]=(soup.title.get_text(" ",strip=True) if soup.title else None)
    result["description"]=meta("description")
    result["robots_meta"]=meta("robots")
    result["googlebot_meta"]=meta("googlebot")
    result["canonical"]=urljoin(result["final_url"],canon.get("href","")) if canon else None
    result["og_title"]=meta("og:title","property")
    result["og_description"]=meta("og:description","property")
    result["language"]=soup.html.get("lang") if soup.html else None
    heads={}
    for heading in ("h1","h2","h3"):
        heads[heading]=[" ".join(el.get_text(" ",strip=True).split())[:180]
                        for el in soup.find_all(heading)][:30]
    result["headings"]=heads
    result["h1_count"]=len(soup.find_all("h1"))
    imgs=soup.find_all("img")
    result["image_count"]=len(imgs)
    result["image_missing_alt_count"]=sum(not (im.get("alt") or "").strip() for im in imgs)
    result["image_example_alts"]=[im.get("alt","")[:100] for im in imgs[:8]]
    links=[]
    for a in soup.find_all("a",href=True):
        href=urljoin(result["final_url"],a.get("href",""))
        if safe_url(href) and href not in links:links.append(href)
    result["internal_link_count_unique"]=len(links)
    result["internal_link_samples"]=links[:28]
    jsonld=soup.find_all("script",attrs={"type":"application/ld+json"})
    result["jsonld_count"]=len(jsonld)
    types=[]
    for script in jsonld:
        try:
            data=json.loads(script.get_text())
            nodes=data if isinstance(data,list) else data.get("@graph",[]) if isinstance(data,dict) and "@graph" in data else [data]
            for node in nodes:
                if isinstance(node,dict):
                    raw=node.get("@type")
                    if isinstance(raw,str):types.append(raw)
                    elif isinstance(raw,list):types.extend(x for x in raw if isinstance(x,str))
        except (ValueError,TypeError):types.append("invalid_or_unreadable")
    result["jsonld_types"]=types
    result["viewport"]=meta("viewport")
    body=soup.body.get_text(" ",strip=True) if soup.body else ""
    body=" ".join(body.split())
    result["body_characters"]=len(body)
    result["body_excerpt"]=body[:900]
    result["structural_warnings"]=[]
    if result["h1_count"]!=1:
        result["structural_warnings"].append("H1 count is not one; audit visual template before changing")
    if not result["canonical"]:
        result["structural_warnings"].append("Canonical link not found in retrieved HTML")
    if not result["description"]:
        result["structural_warnings"].append("Description meta tag not found")
    if not result["viewport"]:
        result["structural_warnings"].append("Viewport meta tag not found")
    return result

def main():
    report={
        "generated_at":datetime.now(ZoneInfo("Asia/Taipei")).isoformat(timespec="seconds"),
        "scope":"Read-only public homepage HTTP/HTML observation; not a live rank or GSC index-coverage test",
        "checks":[]
    }
    for url in ORIGINS:
        try:report["checks"].append({"requested_url":url,**inspect_homepage(url)})
        except (OSError,ValueError) as e:
            report["checks"].append({"requested_url":url,"error_type":type(e).__name__,
                "status":"unable to inspect","note":"Do not infer site failure from this audit fetch"})
    for resource in ("robots.txt","sitemap.xml"):
        url="https://chen-yang.com.tw/"+resource
        try:
            data=fetch(url,1_000_000)
            report[resource.split(".")[0]]={"url":url,"status":data["status"],
               "final_url":data["final_url"],
               "text_excerpt":data["body"][:4500] if resource=="robots.txt" else "",
               "sitemap_urls":re.findall(r"<loc>(.*?)</loc>",data["body"],flags=re.I)[:40] if resource=="sitemap.xml" else [],
               "bytes":len(data["body"])}
        except (OSError,ValueError) as e:
            report[resource.split(".")[0]]={"status":"unverified","error_type":type(e).__name__}
    report["service_pages"]=[]
    main_links=set(report["checks"][0].get("internal_link_samples",[]))
    for path in SERVICE_PAGES:
        address="https://chen-yang.com.tw/"+path
        try:
            sub=inspect_homepage(address)
            report["service_pages"].append({
                "url":address,"status":sub.get("status"),"title":sub.get("title"),
                "h1_count":sub.get("h1_count"),"h1":sub.get("headings",{}).get("h1",[]),
                "description":sub.get("description"),
                "canonical":sub.get("canonical"),"body_characters":sub.get("body_characters"),
                "homepage_links_directly":address in main_links,
                "page_sections":sub.get("headings",{}).get("h2",[])[:12]
            })
        except (OSError,ValueError) as e:
            report["service_pages"].append({
                "url":address,"status":"unverified","error_type":type(e).__name__
            })
    report["canonical_consistency"]={
        "all_homepage_versions_redirect_to_one":len({x.get("final_url") for x in report["checks"] if x.get("status")==200})==1,
        "canonical_targets":sorted({x.get("canonical") for x in report["checks"] if x.get("canonical")}),
        "warning":"URL prefixes with independent 200 responses and self-canonical tags should be consolidated after GSC preferred canonical is confirmed."
    }
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"generated":report["generated_at"],
       "homepages":[{k:p.get(k) for k in ("requested_url","status","final_url",
             "title","description","canonical","h1_count","jsonld_count",
             "internal_link_count_unique","structural_warnings","error_type")}
             for p in report["checks"]],
       "robots":report.get("robots",{}).get("status"),
       "sitemap":report.get("sitemap",{}).get("status")},ensure_ascii=False))

if __name__=="__main__":
    main()
