"""Floorplan image protection regression tests; no site or vendor network calls."""
from bs4 import BeautifulSoup

from scripts.preserve_seo_media import floorplan_images,floorplan_integrity,source_preserving_hybrid


URL="https://chen-yang.com.tw/news-content.php?id=331"
PLAN="https://chen-yang.com.tw/uploads/允將大聚L戶格局圖.jpg"
PHOTO="https://chen-yang.com.tw/uploads/living-room.jpg"

def html_source():
    project = "允將大聚位於林口 A7 重劃區，包含格局、坪數、交通與生活機能。"*25
    return (f'<html><body><div class="col-row"><div class="l-edit">'
       f'<h2>建案介紹</h2><p>{project}</p>'
       f'<p>原平面圖</p><img src="{PLAN}" alt="允將大聚 L 戶平面配置圖">'
       f'<h2>客廳</h2><img src="{PHOTO}" alt="客廳空間照片">'
       f'<p><a href="https://chen-yang.com.tw/news-content.php?id=1">延伸閱讀</a></p>'
       f'</div></div></body></html>')


def test_floorplan_manifest_and_original_order_preserved():
    soup=BeautifulSoup(html_source(),"html.parser")
    root=soup.select_one(".l-edit")
    assert floorplan_images(root,URL)==[
        {"index":0,"url":PLAN,"source_alt":"允將大聚 L 戶平面配置圖"}]
    passed=floorplan_integrity(root,BeautifulSoup(str(root),"html.parser"),URL)
    assert passed["floorplan_count"]==1
    assert passed["floorplan_protection_passed"] is True


def test_missing_or_reordered_floorplan_must_fail():
    source=BeautifulSoup(html_source(),"html.parser")
    original=source.select_one(".l-edit")
    removed=BeautifulSoup(str(original),"html.parser")
    removed.find("img").decompose()
    result=floorplan_integrity(original,removed,URL)
    assert result["floorplan_protection_passed"] is False
    reordered=BeautifulSoup(str(original),"html.parser")
    images=reordered.find_all("img")
    images[0]["src"],images[1]["src"]=images[1]["src"],images[0]["src"]
    assert floorplan_integrity(original,reordered,URL)["floorplan_protection_passed"] is False


def test_only_safe_preserved_cms_html_is_exported():
    draft={
      "id":"seo-yunjiang-331","title":"允將大聚｜A7 案例",
      "sections":[
       ["建案介紹","原文補強"],
       ["居家規劃要注意什麼","確認丈量與走道。"],
       ["常見問題 FAQ","Q：如何比較？<BR>建議核對圖說。"]
      ],
      "cta":"詢問晨陽設計"
    }
    merged,audit=source_preserving_hybrid(draft,[],html_source(),URL)
    assert merged
    assert audit["original_main_content_preserved"] is True
    assert audit["floorplan_protection_passed"] is True
    assert audit["floorplan_count"]==1
    assert audit["original_image_urls_count"]==2
    assert audit["original_link_count"]==1
    assert "生活機能" in merged
    assert merged.index(PLAN)<merged.index(PHOTO)
    assert "延伸閱讀｜居家規劃要注意什麼" in merged
