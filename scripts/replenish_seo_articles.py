"""Add up to three source-verified, editor-reviewable CMS drafts per Taiwan day."""
import json
import re
from datetime import datetime
from math import isfinite
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from scripts.preserve_seo_media import (
    HOSTS, ROOT, allowed, extract, floorplan_images, source_preserving_hybrid,
)

DAILY_LIMIT = 3
SOURCE_LIMIT = 5_000_000
ARTICLE_PATH = re.compile(r"/(news|unboxing)-content\.php")
TOPICS = [
    ("公設", r"公設設計|實品屋|公共空間|公設規劃|接待大廳",
     "看公設與實品屋時，先分清哪一部分會交付",
     "看公設時，先從社區入口走到電梯，觀察推車、搬運和等候是否方便。看實品屋時，請把交付清單和現場展示逐項對照，像是櫃體、燈具和家電各由誰負責，並確認開門、拉抽屜與走道通行會不會互相卡住。",
     "公設照片和實品屋照片可以直接當成交屋標準嗎？",
     "先確認照片的用途，再核對契約、附件與交付清單。想延用展示屋的做法時，把想保留的設備與尺寸標到自家圖面上。"),
    ("預售屋", r"預售|客變|客戶變更|建案",
     "拿到平面圖後，先確認哪些配置要在客變前決定",
     "把現況平面圖和預計的家具位置疊在一起，先標冷氣、插座、餐桌用電與廚房家電，再檢查隔間和櫃門是否互相干涉。涉及管線或固定設備時，先向建商確認可變更範圍與送件截止日，再決定哪些項目留到交屋後做。",
     "還沒交屋，可以先做哪些裝潢準備？",
     "先準備格局圖、家電清單和每日使用需求，釐清是否需要客變。櫃體及家具下單前，再用交屋後的現場尺寸複核。"),
    ("小宅", r"小宅|小坪數|小兩房|收納|兩房",
     "開始做收納前，先畫出每天最常走的三條路",
     "把玄關到客廳、廚房到餐桌、房門到衣櫃三段動線畫在圖上。用家具及櫃門開啟後的實際尺寸來算走道，再把常用物品放在取用路線上。若仍然擠，先調整櫃體的深度或方向，並在現場量過後再下單。",
     "小宅一開始就應該把所有牆面做滿收納嗎？",
     "先按物品體積和取用頻率安排收納，再確認開門、座位和走道是否會打架。預留可移動的收納，日後比較容易隨家庭需求調整。"),
    ("老屋翻新", r"老屋|中古屋|翻新|翻修",
     "老屋翻新報價前，先安排現況勘查",
     "先記下滲漏位置、電箱迴路與用水點，並請設計師標出必須勘查或拆除後才能確認的位置。比價時把基礎工程、表面更新和暫估項目分開，日後更容易判斷追加項目從哪裡來。",
     "看完老屋翻新案例，怎麼知道自己的房子需要做到哪裡？",
     "帶現況照片及平面圖做勘查，搭配實際使用需求確認優先順序。管線或漏水原因仍不清楚時，請在估價中註明待確認範圍。"),
    ("建材與設備", r"地板|建材|磁磚|油漆|玻璃|系統櫃|廚具|燈光",
     "挑建材時，把展示樣品和實際施工條件一起看",
     "把樣品放在接近家中光線的地方看色差，並拿清潔方式、邊角收法和替換成本一起比較。到設計確認時，請把型號、安裝位置和交接界面列入圖說，驗收才有具體依據。",
     "樣品看起來適合，就可以直接指定全屋使用嗎？",
     "先確認不同空間的濕度、清潔方式及接縫細節，再請設計師核對產品規格與施工條件。"),
    ("空間設計", r"室內設計|裝潢|空間規劃|居家設計|實景案例",
     "參考案例時，先把動線和尺寸帶回自家格局",
     "看案例可先圈出每天最常停留的空間，並寫下對應的使用情境，例如回家後放包、餐桌同時當工作桌，或需要照顧幼兒。拿自己的平面圖與家具尺寸核對，確認開門、通行和取物能同時成立，再決定哪些做法適合帶回家。",
     "準備和設計師討論時，帶哪些案例資料比較有效？",
     "帶平面圖、現況照片和幾張有明確參考重點的案例照。可以直接在圖上標註想保留的動線、收納或採光條件。"),
]
PAGE_MODES = {"news": "existing_news", "unboxing": "existing_unboxing"}
CASE_NOTES = {
    ("news", "182"): ("兩房格局", "D6", "比對金城舞兩房圖面時，先看餐桌與走道怎麼共用",
        "原文列出 D6、D2、C10 的平面圖。把三張圖轉到入口朝同一方向，標出玄關開門、冰箱與座位拉出後的位置。若餐桌也要當工作桌，另外確認座位旁的插座和用餐時的通行空間。",
        "有三種兩房圖面時，可以照同一個方案裝潢嗎？",
        "先找出自家戶別及正確方向。用同一套家具尺寸比較各圖的開門、走道與用餐空間，最後依現場尺寸定案。"),
    ("news", "564"): ("現代風設計", "無主燈", "從客廳到臥室，怎麼分配日光和晚上的照明",
        "原文以客廳無主燈和臥室遮光搭配不同生活情境。可以先在白天確認窗邊眩光、電視反光和座位視線，再把夜間看電視、閱讀、起身三種用光情境分開畫在圖面。做燈具配置前，先核對天花板可用高度與迴路。",
        "喜歡案例的無主燈配置，放進自家前要確認什麼？",
        "先依家具位置畫出需要照亮的面，再確認燈具維修和分迴路控制。白天與夜間都試看一次，有助於判斷需不需要額外的閱讀燈。"),
    ("news", "83"): ("採光與配置", "三面採光", "三面採光的住宅，家具和收納怎麼避開窗前",
        "閱讀原文的平面建議時，先圈出窗面與開窗方向，並標示窗簾和必要的操作空間。以實際使用時間判斷餐桌、書桌和沙發的位置，優先把高櫃放到不遮窗的牆面。若房間要兼做書房，可先畫出書桌椅拉開和房門打開的範圍。",
        "原文的平面配置可以直接作為施工圖嗎？",
        "平面配置適合比較動線和家具擺法。施工前仍應核對自家戶別的現場尺寸、窗戶、設備和插座位置。"),
}


def article_identity(url):
    try:
        parsed = urlsplit(url)
        path = ARTICLE_PATH.fullmatch(parsed.path)
        numbers = parse_qs(parsed.query).get("id", [])
        if (parsed.scheme == "https" and parsed.hostname in HOSTS and parsed.port in (None, 443)
                and not (parsed.username or parsed.password)
                and path and len(numbers) == 1 and re.fullmatch(r"\d{1,10}", numbers[0])):
            return path[1], str(int(numbers[0]))
    except (TypeError, ValueError):
        pass
    return None


class ArticleRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not article_identity(newurl) or article_identity(req.full_url) != article_identity(newurl):
            raise ValueError("官網重新導向到其他文章或站外")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_article(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ChenYangCMSMediaAudit/1.0)"})
    with build_opener(ArticleRedirects()).open(request, timeout=15) as response:
        body = response.read(SOURCE_LIMIT + 1)
    if len(body) > SOURCE_LIMIT:
        raise ValueError("來源 HTML 不完整或超過大小上限")
    return body.decode("utf-8-sig")


def pick_topic(title, body):
    # Prefer title signals and then inspect the opening to avoid matching a site-wide CTA.
    for source in (title, body[:550]):
        for topic in TOPICS:
            match = re.search(topic[1], source)
            if match:
                return topic, match.group()
    raise ValueError("正文缺少可支持裝修建議的主題")


def validate_source(root, url):
    if root.find(["script", "object", "embed", "form", "base"]):
        raise ValueError("正文含主動內容，待核對")
    for tag in root.find_all(True):
        for name in tag.attrs:
            if name.lower().startswith("on") or name == "srcdoc":
                raise ValueError("正文含主動屬性，待核對")
        for name in ("href", "src", "poster"):
            value = tag.get(name)
            if value and urlsplit(urljoin(url, value)).scheme not in ("http", "https", "mailto", "tel"):
                raise ValueError("正文含不支援的媒體或連結位址")
    if any(tag.get("src") and not allowed(tag["src"], url, "video") for tag in root.find_all("iframe")):
        raise ValueError("正文含未辨識的嵌入來源，待核對")


def prepare_article(candidate, url, source, checked_on, gsc_day):
    section, number = article_identity(url)
    article_id = f"url-{section}-{number}"
    document = BeautifulSoup(source, "html.parser")
    root = document.select_one(".col-row .l-edit")
    if root is None:
        raise ValueError("找不到官網正文")
    title_node = document.select_one(".col-row h1, main h1, h1") or document.title
    title = " ".join(title_node.stripped_strings) if title_node else ""
    title = re.split(r"\s*[|｜]\s*(?:晨陽動態|晨陽開箱)\s*(?:-|$)", title, maxsplit=1)[0].strip()
    if not title or len(title) > 180:
        raise ValueError("原文標題缺失或異常")
    body = root.get_text(" ", strip=True)
    topic, cue = pick_topic(title, body)
    label, _, heading, guidance, question, answer = topic
    case_note = CASE_NOTES.get((section, number))
    if case_note and case_note[1] in body:
        label, cue, heading, guidance, question, answer = case_note
    training_title = title.split("｜", 1)[0].split(" | ", 1)[0].strip()
    project = re.search(r"「([^」]{2,32})」", title)
    project_name = project[1] if project else training_title[:45]
    for h in root.find_all(["h2", "h3"]):
        if heading in h.get_text(" ", strip=True):
            raise ValueError("官網已包含這段改稿")
    validate_source(root, url)
    draft = {
        "id": article_id, "title": title, "project_name": project_name,
        "metaTitle": f"{project_name}｜{label}規劃與裝修重點｜晨陽設計",
        "metaDescription": f"看{project_name}的官網原文與圖文，並用這篇的{label}延伸閱讀整理裝修前可確認的項目。",
        "sections": [[title, ""], [heading, guidance], ["常見問題 FAQ", question + "<BR>" + answer]],
    }
    assets = extract(source, url)
    rendered, audit = source_preserving_hybrid(draft, assets, source, url)
    if not rendered or not audit.get("original_main_content_preserved") or not audit.get("floorplan_protection_passed"):
        raise ValueError(audit.get("failure") or "原文、圖片或格局圖保留檢查未通過")
    output = BeautifulSoup(rendered, "html.parser")
    images = output.find_all("img")
    original_images = root.find_all("img")
    if output.find("h1") or not output.find("h2") or len(images) != len(original_images):
        raise ValueError("輸出 HTML 標題或圖文結構未通過")
    for original, image in zip(original_images, images, strict=True):
        source_url = next((value for attribute in ("data-original", "data-src", "src")
                           if (value := allowed(original.get(attribute), url, "image"))), "")
        if not source_url or not str(image.get("alt", "")).strip():
            raise ValueError("有圖片缺少可用的官網網址或 ALT")
        image["src"] = source_url
    floorplans = floorplan_images(root, url)
    for row in floorplans:
        image = images[row["index"]]
        if image["src"] != row["url"]:
            raise ValueError("原格局圖網址未能完整保留")
        image["alt"] = f"{project_name}｜格局圖與空間配置｜晨陽設計"
    audit.update(floorplan_count=len(floorplans), floorplan_images=floorplans,
                 floorplan_urls=[row["url"] for row in floorplans])
    plan = {
        "id": article_id, "title": f"{project_name}｜{label}規劃",
        "url": url, "priority": "P2", "channels": ["SEO", "每日補稿"], "keyword": project_name,
        "added_on": checked_on, "topic": label, "source_cue": cue,
        "gsc": {"last_day": gsc_day, "current": candidate["current"], "reason": candidate.get("reason", "")},
    }
    media = {
        "id": article_id, "source_url": url, "article_mode": PAGE_MODES[section],
        "html_with_media": str(output),
        "preservation_audit": audit, "floorplan_protection_passed": True, "media_integrated": True,
        "floorplan_count": audit["floorplan_count"], "review_required": True,
    }
    return {"plan": plan, "draft": draft, "media": media}


def replenish(feed, discovery, baseline, day, fetch=fetch_article):
    entries = feed["articles"]
    used = {article_identity(row["url"]) for row in baseline["items"]}
    used.update(article_identity(row["plan"]["url"]) for row in entries)
    already_today = sum(row["plan"]["added_on"] == day for row in entries)
    if already_today >= DAILY_LIMIT:
        return feed
    used.add(None)
    attempts = []
    for candidate in discovery.get("pages", []):
        if already_today >= DAILY_LIMIT:
            break
        identity = article_identity(candidate.get("url"))
        impressions = (candidate.get("current") or {}).get("impressions", 0)
        if (identity in used or candidate.get("existing_improvement_task")
                or not isinstance(impressions, (int, float)) or not isfinite(impressions) or impressions <= 0):
            continue
        used.add(identity)
        section, number = identity
        url = f"https://www.chen-yang.com.tw/{section}-content.php?{urlencode({'id': number})}"
        try:
            entry = prepare_article(candidate, url, fetch(url), day, discovery.get("last_gsc_day"))
        except (OSError, ValueError) as error:
            attempts.append({"url": url, "reason": str(error)})
            continue
        entries.append(entry)
        already_today += 1
        print(f"ADD {entry['plan']['id']} {entry['plan']['title']}")
    feed.update(checked_on=day, added_count=already_today, skipped=attempts)
    print(f"{day}: {already_today}/{DAILY_LIMIT} drafts ready; {len(attempts)} sources skipped")
    return feed


def main():
    feed_path = ROOT / "seo-daily-articles.json"
    feed = json.loads(feed_path.read_text(encoding="utf-8")) if feed_path.exists() else {"schema": 1, "articles": []}
    discovery = json.loads((ROOT / "gsc-site-discovery.json").read_text(encoding="utf-8"))
    baseline = json.loads((ROOT / "seo-improvement-plan.json").read_text(encoding="utf-8"))
    day = datetime.now(ZoneInfo("Asia/Taipei")).date().isoformat()
    replenish(feed, discovery, baseline, day)
    tmp = feed_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(feed_path)


if __name__ == "__main__":
    main()
