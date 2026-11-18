from scripts.replenish_seo_articles import article_identity, replenish


def source(number):
    text = "以預售屋格局規劃為主，本文介紹空間動線、客變和居住需求。" * 24
    return f"""<main><h1>預售屋「案例{number}」室內設計</h1>
    <div class="col-row"><div class="l-edit"><p>{text}</p>
    <img src="/upload/images/floorplan-{number}.jpg" alt="住宅格局圖">
    <a href="https://www.chen-yang.com.tw/news.php">延伸瀏覽</a>
    </div></div></main>"""


def candidates(*numbers):
    return {"last_gsc_day": "2026-11-11", "pages": [
        {"url": f"https://chen-yang.com.tw/news-content.php?id={n}",
         "current": {"impressions": 100, "clicks": 1}}
        for n in numbers
    ]}


def test_daily_limit_dedup_source_checks_and_retry():
    def fetch(url):
        number = article_identity(url)[1]
        if number == "2":
            return "<html>錯誤來源</html>"
        return source(number)

    baseline = {"items": [{"url": "https://www.chen-yang.com.tw/news-content.php?id=1"}]}
    feed = {"schema": 1, "articles": []}
    report = candidates(1, 2, 3, 3, 4, 5, 6)
    replenish(feed, report, baseline, "2026-11-18", fetch)
    assert feed["added_count"] == 3
    assert [row["plan"]["id"] for row in feed["articles"]] == ["url-news-3", "url-news-4", "url-news-5"]
    assert "找不到官網正文" in feed["skipped"][0]["reason"]
    first = feed["articles"][0]["media"]
    assert '<img alt="案例3｜格局圖與空間配置｜晨陽設計" src="https://www.chen-yang.com.tw/upload/images/floorplan-3.jpg"/>' in first["html_with_media"]
    assert "https://www.chen-yang.com.tw/news.php" in first["html_with_media"]
    assert first["floorplan_count"] == 1
    replenish(feed, report, baseline, "2026-11-18", lambda _: None)
    assert feed["added_count"] == 3
    replenish(feed, report, baseline, "2026-11-19", fetch)
    assert feed["added_count"] == 1 and len(feed["articles"]) == 4
    assert feed["articles"][-1]["plan"]["id"] == "url-news-6"


def test_rejects_unapproved_url_and_active_content():
    assert article_identity("http://chen-yang.com.tw/news-content.php?id=3") is None
    assert article_identity("https://chen-yang.com.tw@elsewhere.test/news-content.php?id=3") is None
    assert article_identity("https://chen-yang.com.tw/news-content.php?id=3&id=4") is None
    feed = {"schema": 1, "articles": []}
    replenish(feed, candidates(3), {"items": []}, "2026-11-18",
              lambda _: source(3).replace("<p>", "<p onclick='run()'>"))
    assert feed["added_count"] == 0
    assert "主動屬性" in feed["skipped"][0]["reason"]
