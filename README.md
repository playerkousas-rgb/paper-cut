PaperCraft AI（紙模 AI）— Paper-Cut

拍張照片或上傳 3D 檔，產出可直接列印的紙模型 PDF（裁切線 / 折線 / 翻蓋 tabs / 編號）。

本專案分成兩部分：

Frontend（Vite + React + TS + Tailwind）：負責上傳、選項、下載、歷史紀錄

Backend（Blender headless + Export Paper Model addon）：負責把 3D 模型自動展開成紙模型 PDF（真正的 unfold 結果）

重要：Blender 無法跑在一般純 Serverless（例如 Vercel Functions）。

正式輸出 PDF（Pepakura 類結果）請部署 backend 到可跑 Docker/VM 的雲端。

功能總覽

前端

照片 / 3D 檔上傳

選 A4/A3、模型大小、顏色模式、份數、附組裝說明頁

一鍵下載 PDF

「我的模型」：本機瀏覽器儲存歷史紀錄，可重下載/刪除

後端（你要的「只看結果」）

上傳 GLB/GLTF/OBJ/STL

Blender 自動：拆解 / 展開 / tabs / 編號 / 輸出 PDF

API 回傳 application/pdf

專案結構

src/：前端程式

server/：後端程式（Express + Blender headless）server/index.ts：API 入口

server/scripts/export_papermodel.py：Blender 自動展開腳本

server/Dockerfile：後端 Docker 映像

server/README.md：後端補充說明

.env.example：環境變數範本

需求

前端

Node.js 18+（建議 20）

後端（若不走 Docker）

Linux 主機（建議 Ubuntu）

Blender（建議 4.x）

Blender 內建的 Export Paper Model addon（通常內建）

Node.js 18+（建議 20）

前端：本機開發與部署

1) 安裝

npm install

2)（可選）設定後端 API

在專案根目錄建立 .env（可參考 .env.example）：

VITE_API_BASE=https://你的後端網址

本機後端測試通常是：VITE_API_BASE=http://localhost:8787

3) 啟動前端（開發）

npm run dev

4) 打包前端（部署用）

npm run build

後端：API 說明（Blender unfold）

Health Check

GET /api/health

Unfold 產 PDF

POST /api/unfold

Content-Type: multipart/form-data

欄位：file：3D 檔（GLB/GLTF/OBJ/STL）

paperSize（可選）：A4 或 A3

scale（可選）：字串數字，例如 1.0

title（可選）：PDF 標題字串

回應：

200 OK：application/pdf

後端部署方式 1：Docker（最推薦）

Build

在專案根目錄：

docker build -t papercraft-api -f server/Dockerfile .

Run

docker run --rm -p 8787:8787 papercraft-api

用 curl 測試（非常重要）

curl -F "file=@model.glb" -F "paperSize=A4" http://localhost:8787/api/unfold --output out.pdf

如果你能拿到 out.pdf，就代表後端 OK。

後端部署方式 2：Render（Docker 部署）

Render 用 Docker 最簡單（因為 Blender 依賴多）。

到 Render 建立新服務（Web Service）

連接你的 GitHub repo

選 Docker 部署（讓 Render 讀取 server/Dockerfile）

設定：Port：8787

Env（可選）：KEEP_WORK=1（除錯用；正式建議不要開）

部署完成後你會得到一個 backend URL，例如：https://xxxx.onrender.com

前端環境變數設定：

VITE_API_BASE=https://xxxx.onrender.com

後端部署方式 3：Fly.io（Docker 部署）

Fly.io 同樣建議 Docker。

基本流程（概念）：

安裝 flyctl 並登入

在 repo 根目錄初始化（或指定 dockerfile）

讓 Fly build & deploy server/Dockerfile

開放內部 port 8787

部署好後拿到一個 Fly 的 URL，前端設：

VITE_API_BASE=https://你的fly後端網址

Fly.io 具體指令會依你帳號/APP 名稱而不同；如果你需要，我可以再補一份 Fly 的 fly.toml 範本。

後端部署方式 4：雲端 VM（AWS/GCP/Azure/DO 最穩）

1) 安裝 Blender（例：Ubuntu）

建議用官方 Blender release 或 apt（版本可能較舊）。

你需要知道 blender 執行檔路徑，例如：

/usr/bin/blender 或

/opt/blender-4.x/blender

2) 在 VM 上跑後端

npm install

export BLENDER_PATH=/path/to/blender

npx tsx server/index.ts

預設會聽：

http://0.0.0.0:8787

3) 記得開防火牆/安全組

開放 TCP 8787（或你自己改 PORT）。

4) 建議加反向代理（Nginx）與 HTTPS

正式上線建議用 Nginx + LetsEncrypt，並把後端掛在：

https://api.yourdomain.com

前端接後端（最重要的設定）

前端靠環境變數：

VITE_API_BASE

例如：

本機：VITE_API_BASE=http://localhost:8787

雲端：VITE_API_BASE=https://api.yourdomain.com

設定後：使用者上傳 3D 檔 時會優先走 Blender 後端輸出 PDF。

常見問題（必看）

1) 為什麼 Vercel 不能直接跑後端 Blender？

Blender 是大型二進位 + 需要較長運算時間與檔案系統操作；一般 Serverless 平台限制多、冷啟動慢、可能直接超時。

2) 哪種 3D 檔最建議？

最建議：GLB（通常匯入最穩、材質也較完整）。

3) 後端失敗怎麼 debug？

先用 curl 測 POST /api/unfold

若你需要保留 Blender 暫存輸出，設環境變數：KEEP_WORK=1 這樣後端不會刪暫存資料夾，方便查 log（正式環境請關掉）。

License / 版權提醒

本專案提供工具鏈與流程；模型素材請自行確保授權。

內建模型庫只提供公開資源連結引導，下載與使用請遵守來源站點條款。

如果你要我再加一份：

fly.toml（Fly.io 一鍵部署）

render.yaml（Render Blueprint 部署）

或把前端也改成「無需手動設 env，直接在 UI 填後端網址並記住」 我也可以繼續補齊。
