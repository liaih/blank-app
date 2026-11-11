# 晨陽｜搜尋能見度與人工智慧搜尋分析

這是**全繁體中文**的公開展示網頁。網站原始碼位於 `docs/index.html`，數據快照位於 `docs/data.json`。

## 網頁內容

- Google 全站自然搜尋：30 天與 90 天點擊、曝光、點擊率。
- 人工智慧品牌能見度：區分 Gemini 不連網模型品牌認知、尚未取得的 Google AI 搜尋曝光，以及尚未接通的 ChatGPT／Perplexity 回答監測。
- 搜尋爬蟲可讀性：呈現官網網站規則檢查，**不宣稱已被收錄或推薦**。
- 顯示快照日期、數據口徑與仍待完成的功能，避免誤解。

這是**公開且唯讀的靜態網頁**，不含私人 SQLite 資料庫、API 金鑰、完整 AI 回答或管理功能。資料目前為固定日期的人工核對彙總快照，**尚未自動同步**。原始監控系統在私人儲存庫運作，兩者獨立。

## 免費 GitHub Pages 發布方式

在本儲存庫的 `Settings → Pages` 設定：

- `Build and deployment → Source` 選擇 `Deploy from a branch`。
- `Branch` 選 `main`，資料夾選 `/docs`，儲存。
- 網站預期網址：`https://liaih.github.io/blank-app/`。實際能否開啟，以 GitHub Pages 顯示「網站已發布」為準。

注意：這是 **Public 公開網站**，任何取得網址的人都能閱讀彙總數據，請先確認公司允許公開這些指標。

## 資料來源與限制

- Google Search Console：原始官方查詢數據的全站彙總，統計截止 2026-11-07。
- Gemini：僅一筆不連網文字模型的品牌認知樣本，不等於即時 AI 搜尋推薦。
- 官網稽核：robots.txt 規則檢查，不等於 AI 服務一定會收錄、推薦或引用。

**尚未完成：** AI 即時搜尋回答自動採樣、競爭品牌比較、Google AI 成效報表自動同步與公開網站自動更新。

本儲存庫原本是公開的空白應用範本，原有根目錄 Streamlit 程式不屬於本靜態網站，也不參與 GitHub Pages 的 `/docs` 發布。
