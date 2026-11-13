# 晨陽 SEO 改稿中心：連接自己的本機 AI 讀圖

最後更新：2026-11-13
狀態：已新增可選的 LM Studio 本機讀圖連接介面；GitHub CI 測試通過。**尚未在使用者的 Windows / RTX 3060 實機連線驗證。**

## 為什麼要接本機 AI
之前的瀏覽器 vit-gpt2 英文圖片摘要＋翻譯容易把衣架、床頭、櫃體誤判成其他物件。新的介面改為允許把**新圖片逐張送到同一台 Windows 電腦的 LM Studio 視覺模型**，直接取得台灣繁中圖片敘述。

這不是把 ChatGPT Plus、Claude Max 登入帳號直接借給網站使用，也不會在 GitHub 上儲存 API Key。

## 操作方式

1. 在 Windows 上開啟 **LM Studio**，載入支援圖片輸入的模型（已安裝的 **Qwen3-VL 8B** 可優先試用；不要誤選純文字模型）。
2. 在 LM Studio 的 **Developer／Server** 啟動伺服器，確認網址為 **`http://127.0.0.1:1234`**。需允許 **CORS**，建議開啟 **Require Authentication** 並取得本機 Token；**不要**開啟 Serve on Local Network（不使用 `0.0.0.0`）。
   - 也可以使用 PowerShell：`lms server start --port 1234 --bind 127.0.0.1 --cors`。若採此方式仍應確認身份驗證設定。CORS 可讓其他網頁嘗試存取你的模型，不能把這台服務暴露在公共網路上。
3. 開啟 `https://liaih.github.io/blank-app/monitor.html#actions`。
4. 在「同建案新增案件」中展開 **「連接我的本機 AI｜LM Studio 圖像辨識」**；如有啟用驗證，將 Token 填入**僅此瀏覽器使用**的欄位（不要傳入 GitHub）。按「測試本機 AI 連線／讀取模型」。
5. 若 Chrome／Edge 顯示「存取本機網路」權限提示，確認網域是自己使用的 Pages 網站後，才允許。跨來源呼叫若遭到 CORS／本機網路權限阻擋，必須先修正伺服器與瀏覽器設定，**不要關閉瀏覽器的安全防護**。
6. 選擇 Qwen3-VL 視覺模型、上傳新圖片（包含**真正新增的格局圖**），按「用本機 AI 重新讀取全部新圖片」。已存在但品質不佳的自動辨識結果也會重新產生。
7. 每張圖檢視中文介紹、是否 3D 建模示意而非實景、空間分類及 ALT。不得假設房型、坪數、戶別。按人工確認。
8. 圖片實際上傳晨陽官網媒體庫後，在「正式圖片網址」貼入對應網址（支援依圖片順序批次貼上），核對圖片實際可讀取。確認**新格局圖＋舊原文與舊格局圖**均完整，系統才會允許複製完整 HTML。

## 網路與安全限制
- 本網站只會在你按下連線／讀圖按鈕後連接 **`127.0.0.1:1234`**。不能直接連線到公司其他電腦、手機或任意外部主機。
- API Token 僅保留在暫時的密碼輸入欄中，不寫入 localStorage、不輸出至草稿 JSON、不提交 GitHub。
- **成功列出模型 ≠ 成功讀圖**。模型還必須支援 multimodal image input。
- 一張圖片對一個本機模型請求；一次處理多張仍可能消耗幾分鐘，並占用 GPU／RAM。
- 目前只有 Web 前端及模擬回應的測試；實際 Windows 模型速度、中文品質與 Chrome 權限尚未確認。
- 提供的人工作品描述為草稿，不代表自動驗證。AI 誤判不得直接當成 SEO 文案發布。

## 雲端 AI 替代方案
- **ChatGPT** 訂閱與 OpenAI API 是不同計費產品；如要串接須使用伺服器端 API，不能把雲端 API Key 直接放在公開 GitHub Pages HTML。
- **Claude Max** 的 API 額度政策在 2026 年已更新：符合資格的 Max 可透過連結 Claude Console 領取月度 API 額度；仍需建立 Console 金鑰，正式串接也必須使用具驗證、用量控制的後端，不直接寫在前端。

參考：
- LM Studio Server: https://lmstudio.ai/docs/cli/serve/server-start
- LM Studio OpenAI 相容 Chat Completions: https://lmstudio.ai/docs/developer/openai-compat
- Claude API credits: https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers
