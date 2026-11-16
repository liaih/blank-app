"""Read-only localhost bridge for the Chen Yang SEO editor. Python 3.10+."""
import json
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs, urljoin
from urllib.request import Request, build_opener, HTTPRedirectHandler
from bs4 import BeautifulSoup

ORIGINS = {'https://liaih.github.io', 'http://127.0.0.1:8000'}
HOSTS = {'chen-yang.com.tw', 'www.chen-yang.com.tw'}
LIMIT = 5_000_000

def article_url(raw):
    u = urlsplit(raw)
    ids = parse_qs(u.query).get('id', [])
    if (u.scheme != 'https' or u.hostname not in HOSTS or u.port not in (None, 443)
        or u.username or u.password or u.path not in
        ('/knowledge-content.php', '/news-content.php', '/case-content.php')
        or len(ids) != 1 or not re.fullmatch(r'\d{1,10}', ids[0])):
        raise ValueError('請使用晨陽官網文章網址（knowledge/news/case-content.php?id=數字）')
    return 'https://www.chen-yang.com.tw' + u.path + '?id=' + ids[0]

class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        article_url(newurl)  # Validate every hop; never follow off-site redirects.
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def inspect_html(raw, url):
    soup = BeautifulSoup(raw, 'html.parser')
    root = soup.select_one('.col-row .l-edit')
    if root is None or len(root.get_text(' ', strip=True)) < 100:
        raise ValueError('未辨識到完整文章正文；不匯入導覽列或空白內容，需檢查頁面版型')
    title = soup.title.get_text(' ', strip=True) if soup.title else ''
    h1 = soup.find_all('h1')
    name = h1[0].get_text(' ', strip=True) if h1 else title
    meta = soup.find('meta', attrs={'name': re.compile('^description$', re.I)})
    description = str(meta.get('content', '')) if meta else ''
    canonical = soup.find('link', rel='canonical')
    issues = []
    def check(ok, label, suggestion):
        issues.append({'status': '通過' if ok else '待改善', 'item': label, 'detail': suggestion})
    check(bool(title), 'SEO Title', title or '缺少搜尋標題')
    check(bool(description.strip()), 'Meta Description', description or '補上符合文章內容的摘要')
    check(len(h1) == 1, 'H1', '全頁共 %d 個 H1；建議由 CMS 標題欄輸出一個' % len(h1))
    check(bool(root.find('h2')), '段落標題 H2', '依建案、戶型與設計重點安排段落')
    check(bool(canonical and canonical.get('href')), 'Canonical', str(canonical.get('href')) if canonical else '缺少標準網址宣告')
    images = root.find_all('img')
    missing = sum(not str(i.get('alt', '')).strip() for i in images)
    check(missing == 0, '圖片 ALT', '%d 張原圖，其中 %d 張缺 ALT；內容準確性仍需讀圖核對' % (len(images), missing))
    text = root.get_text(' ', strip=True)
    issues.append({'status': '待人工核對', 'item': '資料時效與 3D 圖',
                   'detail': '交屋、坪數、格局與建材需查證；3D 圖不可稱為完工實景。此檢核不代表搜尋排名。'})
    removed = 0
    for tag in list(root.find_all(['script', 'style', 'form', 'input', 'button', 'object', 'embed', 'base', 'link', 'meta', 'svg'])):
        tag.decompose(); removed += 1
    for tag in root.find_all(True):
        for attr in list(tag.attrs):
            if attr.lower().startswith('on') or attr in ('srcdoc', 'srcset'):
                del tag[attr]
        style = tag.get('style', '')
        if re.search(r'url\s*\(|expression|@import', style, re.I):
            del tag['style']
        for attr in ('href', 'src', 'poster'):
            if attr not in tag.attrs: continue
            value = urljoin(url, str(tag[attr]).strip())
            parsed = urlsplit(value)
            if parsed.scheme not in ('http', 'https') or parsed.username or parsed.password:
                del tag[attr]; removed += 1
            else:
                tag[attr] = value
        if tag.name == 'iframe':
            host = urlsplit(tag.get('src', '')).hostname
            if host not in ('www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'):
                tag.decompose(); removed += 1
            else:
                tag['sandbox'] = 'allow-scripts allow-same-origin allow-presentation'
        if tag.name == 'img':
            lazy = tag.get('data-original') or tag.get('data-src')
            if lazy:
                candidate = urljoin(url, lazy)
                if urlsplit(candidate).scheme in ('http', 'https'):
                    tag['src'] = candidate
    if removed:
        issues.append({'status': '需檢查', 'item': '安全清理', 'detail': '移除 %d 個主動內容或不安全屬性；請比對原頁' % removed})
    return {'url': url, 'id': 'url-' + urlsplit(url).path.strip('/').split('-')[0] + '-' + parse_qs(urlsplit(url).query)['id'][0],
            'title': name, 'metaTitle': title, 'metaDescription': description,
            'html': root.decode_contents(), 'checkedAt': datetime.now(timezone.utc).isoformat(),
            'imageCount': len(root.find_all('img')), 'textCharacters': len(text), 'checks': issues}

def read_article(raw):
    url = article_url(raw)
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 ChenYangSEOArticleReader/1.0'})
    with build_opener(SafeRedirect()).open(req, timeout=25) as response:
        if 'text/html' not in response.headers.get('Content-Type', ''):
            raise ValueError('來源不是 HTML 文章')
        data = response.read(LIMIT + 1)
        if len(data) > LIMIT: raise ValueError('文章超過 5 MB，未匯入')
        return inspect_html(data.decode('utf-8', 'replace'), url)

class Handler(BaseHTTPRequestHandler):
    def allowed(self):
        return self.headers.get('Host') == '127.0.0.1:8765' and self.headers.get('Origin') in ORIGINS

    def reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        if self.allowed(): self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
        self.send_header('Vary', 'Origin')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def do_OPTIONS(self):
        if not self.allowed(): return self.reply(403, {'error': '來源不允許'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()

    def do_GET(self):
        if not self.allowed(): return self.reply(403, {'error': '來源不允許'})
        req = urlsplit(self.path)
        if req.path != '/article': return self.reply(404, {'error': '不存在'})
        try:
            result = read_article(parse_qs(req.query).get('url', [''])[0])
            self.reply(200, result)
        except Exception as e:
            self.reply(422, {'error': str(e)[:250]})

if __name__ == '__main__':
    print('晨陽文章讀取服務：http://127.0.0.1:8765（只讀公開文章，關閉視窗即停止）')
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
