# 晨陽｜搜尋能見度與人工智慧搜尋分析

這是**全繁體中文**的公開展示網頁。網站原始碼位於 `docs/index.html`，數據快照位於 `docs/data.json`。

## 線上進入方式

- [完整 SEO 與 AI SEO 監測中心](https://liaih.github.io/blank-app/monitor.html)。
- [SEO 搜尋商機分析](https://liaih.github.io/blank-app/monitor.html#opps)。
- 原始私人監測程式及 GSC 歷史仍在 `liaih/Repository`，此公開網站只顯示可公開的歷史摘要。

## AI SEO 品牌推薦與競品分析（新增）

直接開啟 [AI SEO｜推薦與引用](https://liaih.github.io/blank-app/monitor.html#ai)。

正式 AI SEO 面板現已具備以下 **分析能力**：
- 手機或電腦可保存 ChatGPT、Gemini、Perplexity、Google AI Mode、Copilot 的**真實回答原文**、完整問題、平台、日期、是否使用搜尋、是否有個人化、來源分享網址。
- 擷取回答中可識別的公司候選名稱與引用網址。**候選品牌需要人工確認是否被 AI 推薦，不能把文字提及誤算成推薦**。
- 依平台分開計算：晨陽是否被提及、是否列入推薦名單、回答是否出現晨陽官網直接引用，以及其他被推薦設計公司的頻率。
- 使用者個人化、有不聯網回答、缺少證據網址的樣本不納入受控聯網比較。分享網址目前只驗證格式，**不會自動開啟核實其內容**，所有比率都只代表目前保存的抽樣回答。
- 紀錄只存在當前裝置的瀏覽器，可匯出／匯入 JSON 備份（包含原始回答，需妥善保存）。不會把完整回答推送到 GitHub Pages 或公開資料庫。
- 由 GitHub Actions 的 `AI SEO recommendation evidence validation` 驗證瀏覽器程式、品牌判定、推薦／提及區分與不合格樣本排除。

### AI SEO 尚未完成、不可宣稱已完成的環節

1. **真正的聯網 AI 回答自動蒐集：未接通。** 現有 ChatGPT/Gemini 訂閱不等於官方 API 呼叫權限；網站不會自動登入、爬取消費者帳號或繞過平台限制。
2. **官方 Google AI 搜尋、Bing AI 引用及 ChatGPT/Perplexity 真實市場曝光資料：未自動接通。** 沒有來源時，推薦率、競品名次顯示「資料不足」。
3. **跨裝置集中儲存與定期報告：尚未接通。** 目前本機保存為最低成本的可稽核資料整理入口。
4. **代表全台屋主的搜尋推薦率：無法從少量測試推論。** 只能統計特定題目、平台、時間、地區和設定下的受控觀測。

原先 1 筆 **Gemini 不連網品牌認知**保留在下方輔助區，但**不算入聯網 AI SEO 指標**。此新增功能不是付費 API 的替代資料來源，也不會創造不存在的推薦證據。

## SEO 搜尋商機分析（第三個分頁）

此功能明確分成不同來源，**不把晨陽官網曝光量當作市場搜尋量**：

1. **市場需求**：Google Ads Keyword Planner 每月估計搜尋量。尚未接入 API；可在網頁上匯入使用者提供的 CSV，僅於瀏覽器中解析與比較，不會上傳或永久保存。市場量缺少時顯示「待取得」。
2. **晨陽 SEO 成效**：32 組屋主常搜尋字詞的 Google Search Console 近 30 天平均排名、曝光與比較期間，沒有資料不能解讀成排名第 0 名。
3. **搜尋意圖／服務地區**：依字面規則初步分類，僅用於發現潛在內容題材，並不代表經過問卷或 CRM 證實的客戶意圖。
4. **獲客價值**：尚未串接表單、LINE、洽談與成交資料。**不計算虛構成交率、商機分數或預期營收**。
5. **Google Trends**：相對搜尋熱度 0–100，並非絕對搜尋量；公開網站提供前往 Google Trends 的查詢連結，目前沒有自動取得趨勢資料。

### Google Ads CSV 匯入

公開網站「搜尋字詞／頁面機會」→「SEO 搜尋商機分析」→「匯入 Google Ads 市場搜尋量」：

- 在 Google Ads 的「關鍵字規劃工具」選擇實際地區，取得平均每月搜尋量。Google 可能要求先提供帳單資訊才能使用此工具，不等於已啟用付費廣告。若無資料，不需要為了啟用網站而設定付款。
- 選擇對應地區、填入報表匯出月份，再選 CSV 檔。支援英文 `Keyword`、`Avg. monthly searches`，或中文「關鍵字」「平均每月搜尋量」欄位。
- 支援明確數值及區間（例：`100 – 1K`），但範圍不會轉為單一精確數字。輸入不完整、重複或不合法會拒絕匯入。
- 外部檔案只在目前使用者的瀏覽器記憶體保留，刷新網頁會清除。此為**本機試算功能**，尚未建立正式市場資料庫或每日同步。

資料來源：
- [Google Ads Keyword Planner 歷史資料欄位](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics)
- [Google Ads 關鍵字規劃工具使用說明](https://support.google.com/google-ads/answer/3022575?hl=zh-Hant)
- [Google Trends 指數與樣本限制](https://support.google.com/trends/answer/4365533?hl=zh-Hant)

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
