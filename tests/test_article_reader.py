import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('reader',Path(__file__).resolve().parents[1]/'docs/downloads/article_reader.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
URL='https://www.chen-yang.com.tw/news-content.php?id=331'

class ReaderTests(unittest.TestCase):
    def test_url_whitelist(self):
        for url in ['http://127.0.0.1/x','https://chen-yang.com.tw.evil.com/news-content.php?id=1',
                    'https://user@chen-yang.com.tw/news-content.php?id=1','https://chen-yang.com.tw:123/news-content.php?id=1',
                    'https://chen-yang.com.tw/news-content.php?id=1&id=2','https://chen-yang.com.tw/admin.php?id=1']:
            with self.subTest(url=url),self.assertRaises(ValueError): r.article_url(url)
        self.assertEqual(r.article_url(URL+'&utm_source=test'),URL)
    def test_reject_offsite_redirect(self):
        with self.assertRaises(ValueError):
            r.SafeRedirect().redirect_request(None,None,302,'',{},'https://example.com/news-content.php?id=1')
    def test_missing_body_fails_closed(self):
        with self.assertRaises(ValueError):r.inspect_html('<html><nav>menu</nav></html>',URL)
    def test_preserves_text_image_order_links_and_flags_missing_alt(self):
        text='建案介紹及既有戶型資訊。'*30
        html='<title>建案標題</title><h1>丹佛花都</h1><div class="col-row"><div class="l-edit"><p>'+text+'</p><img src="/old.png" alt="原格局圖"><img data-src="/new.png" src="/loading.png"><h2>延伸閱讀</h2><a href="/news-content.php?id=9">舊連結</a><script>alert(1)</script><p onclick="bad()">保留文字</p><iframe src="https://evil.com"></iframe></div></div>'
        out=r.inspect_html(html,URL)
        self.assertIn(text,out['html']);self.assertIn('保留文字',out['html'])
        self.assertNotIn('<script',out['html']);self.assertNotIn('onclick',out['html']);self.assertNotIn('evil.com',out['html'])
        self.assertLess(out['html'].index('old.png'),out['html'].index('new.png'))
        self.assertIn('https://www.chen-yang.com.tw/news-content.php?id=9',out['html'])
        self.assertEqual(out['imageCount'],2)
        self.assertIn('1 張缺 ALT',next(x['detail'] for x in out['checks'] if x['item']=='圖片 ALT'))

if __name__=='__main__':unittest.main()
