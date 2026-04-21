# PaperCraft AI Backend (Blender headless)

這個後端負責把 3D 檔（GLB/GLTF/OBJ/STL）自動展開成紙模型 PDF：切線、翻蓋（tabs）、編號、折線與排版由 Blender + Export Paper Model addon 產生。

## API

- `GET /api/health`
- `POST /api/unfold` (multipart/form-data)
  - field: `file` = 3D file
  - fields (optional):
    - `paperSize`: `A4` | `A3`
    - `scale`: string (e.g. `1.0`)
    - `title`: string

Response: `application/pdf`

## Local run (no Docker)

你需要在主機上先裝好 Blender，並確定有 Export Paper Model addon（Blender 通常內建）。

```bash
export BLENDER_PATH=/path/to/blender
npm install
npx tsx server/index.ts
```

## Docker build/run

> 注意：Dockerfile 會下載 Blender，映像檔會比較大。

```bash
docker build -t papercraft-api -f server/Dockerfile .
docker run --rm -p 8787:8787 papercraft-api
```

測試：
```bash
curl -F "file=@model.glb" -F "paperSize=A4" http://localhost:8787/api/unfold --output out.pdf
```

## Env

- `BLENDER_PATH` (required when not using Dockerfile default)
- `PORT` (default 8787)
- `WORK_DIR` (optional) working temp directory
- `KEEP_WORK=1` keep temp folder for debugging
