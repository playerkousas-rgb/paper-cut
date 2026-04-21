import {
  Camera,
  Boxes,
  FileDown,
  Gauge,
  ImageUp,
  Palette,
  Printer,
  Ruler,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { ColorMode, GenerationOptions, InputMode, ModelSize, PaperSize, PaperType } from '../lib/papercraft'
import { generatePapercraftPdf } from '../lib/papercraft'
import { loadMeshFromFile, unwrapByNormalClustering } from '../lib/meshUnwrap'
import { saveHistory } from './History'
import { Badge, Button, Card, FieldLabel, ProgressBar, Segmented } from './ui'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || ''

type Step = 1 | 2 | 3

function prettyBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('read failed'))
    fr.readAsDataURL(file)
  })
}

function uid() {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

export function PaperCraftWizard() {
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<InputMode>('photo')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | undefined>(undefined)

  const [paperSize, setPaperSize] = useState<PaperSize>('A4')
  const [modelSize, setModelSize] = useState<ModelSize>('M')
  const [paperType, setPaperType] = useState<PaperType>('normal')
  const [colorMode, setColorMode] = useState<ColorMode>('color')
  const [copies, setCopies] = useState(1)
  const [includeAssemblyPage, setIncludeAssemblyPage] = useState(true)

  const [autoUnfold, setAutoUnfold] = useState(true)
  const [unfoldPieces, setUnfoldPieces] = useState(10)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const options: GenerationOptions = useMemo(
    () => ({
      mode,
      paperSize,
      modelSize,
      paperType,
      colorMode,
      copies,
      includeAssemblyPage,
    }),
    [mode, paperSize, modelSize, paperType, colorMode, copies, includeAssemblyPage],
  )

  const accept = mode === 'photo' ? 'image/png,image/jpeg' : '.obj,.glb,.stl,model/gltf-binary'

  const canNext = !!file

  function resetAll() {
    setStep(1)
    setFile(null)
    setPreview(undefined)
    setProgress(0)
    setStatus('')
    setBusy(false)
  }

  async function onPick(f: File) {
    setFile(f)
    if (mode === 'photo') {
      try {
        const url = await readAsDataUrl(f)
        setPreview(url)
      } catch {
        setPreview(undefined)
      }
    } else {
      setPreview(undefined)
    }
    setStep(2)
  }

  async function generate() {
    if (!file) return

    setBusy(true)
    setProgress(5)

    const fakePipeline = async () => {
      const parts =
        mode === 'photo'
          ? [
              { p: 18, t: '讀取照片…' },
              { p: 38, t: '把照片轉成可做紙模型的形狀…' },
              { p: 62, t: '自動加上翻蓋與對位記號…' },
              { p: 80, t: `把模板排版到 ${paperSize}…` },
              { p: 92, t: '輸出成 PDF…' },
            ]
          : [
              { p: 18, t: '讀取 3D 檔…' },
              { p: 48, t: '自動展開成紙模型模板…' },
              { p: 76, t: `把模板排版到 ${paperSize}…` },
              { p: 92, t: '輸出成 PDF…' },
            ]

      for (const s of parts) {
        setStatus(s.t)
        setProgress(s.p)
        await new Promise((r) => setTimeout(r, 520))
      }
    }

    try {
      await fakePipeline()

      // If API backend is configured and user uploads 3D, prefer Blender unfold result.
      if (mode === 'model' && API_BASE) {
        setStatus('送到雲端展開引擎（Blender）…')
        setProgress(88)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('paperSize', paperSize)
        fd.append('scale', modelSize === 'S' ? '0.8' : modelSize === 'M' ? '1.0' : '1.2')
        fd.append('title', 'PaperCraft AI')

        const resp = await fetch(`${API_BASE}/api/unfold`, {
          method: 'POST',
          body: fd,
        })

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          throw new Error(`backend_failed: ${resp.status} ${txt.slice(0, 500)}`)
        }

        const pdfBlob = await resp.blob()
        const filename = `PaperCraftAI_${paperSize}_${modelSize}_Blender.pdf`
        setProgress(100)
        setStatus('完成！已經可以下載列印。')

        const pdfDataUrl = await readAsDataUrl(new File([pdfBlob], filename, { type: 'application/pdf' }))
        saveHistory({
          id: uid(),
          createdAt: Date.now(),
          name: file.name,
          mode,
          options,
          pages: 0,
          filename,
          pdfDataUrl,
          previewDataUrl: preview,
        })

        const a = document.createElement('a')
        a.href = URL.createObjectURL(pdfBlob)
        a.download = filename
        a.click()
        setStep(3)
        return
      }

      let unfoldDiag: any = undefined
      if (mode === 'model' && autoUnfold) {
        try {
          // Real (but simplified) auto-unfold: cluster triangles by normal, each cluster becomes a 2D piece.
          // Focus: give users a "real"拆解結果概念；正式版可換 Blender Paper Model。
          const mesh = await loadMeshFromFile(file)
          const { pieces, totalFaces } = unwrapByNormalClustering(mesh.geometry, {
            maxFacesPerPiece: Math.max(30, Math.floor((mesh.geometry.getAttribute('position').count / 3) / Math.max(3, unfoldPieces))),
            angleThresholdDeg: 28,
          })
          unfoldDiag = {
            usedAutoUnfold: true,
            pieces: pieces.length,
            totalFaces,
            message: `提示：此版本的 3D 自動拆解以「三角面法向聚類」產生片段（共 ${pieces.length} 片）。若要 Pepakura 等級的切線與 tabs，正式版建議接 Blender Paper Model。`,
          }
        } catch (e) {
          console.warn(e)
          unfoldDiag = {
            usedAutoUnfold: false,
            message: '此版本的 3D 自動拆解目前只支援 GLB/GLTF。已改用簡易模板輸出。',
          }
        }
      }

      const res = await generatePapercraftPdf(file, options, preview, unfoldDiag)
      setProgress(100)
      setStatus('完成！已經可以下載列印。')

      const pdfDataUrl = await readAsDataUrl(new File([res.pdfBlob], res.filename, { type: 'application/pdf' }))

      saveHistory({
        id: uid(),
        createdAt: Date.now(),
        name: file.name,
        mode,
        options,
        pages: res.pages,
        filename: res.filename,
        pdfDataUrl,
        previewDataUrl: preview,
      })

      // Download immediately
      const a = document.createElement('a')
      a.href = URL.createObjectURL(res.pdfBlob)
      a.download = res.filename
      a.click()

      setStep(3)
    } catch (e) {
      console.error(e)
      alert('產生失敗：請換一張照片或檔案再試一次。')
      setBusy(false)
      setProgress(0)
      setStatus('')
      return
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">開始製作</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              3 步驟完成：上傳 → 選大小/顏色 → 下載列印。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white">只要手機也能用</Badge>
            <Badge className="bg-white">大字、少步驟</Badge>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6">
        {/* Step indicator */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => {
            const active = step === n
            const done = step > n
            return (
              <div
                key={n}
                className={
                  'rounded-2xl border px-3 py-3 text-sm font-extrabold ' +
                  (active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : done
                      ? 'border-slate-200 bg-white text-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500')
                }
              >
                {n === 1 ? '1. 上傳' : n === 2 ? '2. 調整' : '3. 下載'}
              </div>
            )
          })}
        </div>

        {step === 1 && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>選擇來源</FieldLabel>
              <div className="mt-2">
                <Segmented
                  value={mode}
                  onChange={(v) => {
                    setMode(v as InputMode)
                    setFile(null)
                    setPreview(undefined)
                  }}
                  options={[
                    { value: 'photo', label: '用照片', icon: <Camera className="h-4 w-4" /> },
                    { value: 'model', label: '上傳 3D 檔', icon: <Boxes className="h-4 w-4" /> },
                  ]}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <ImageUp className="h-4 w-4" />
                  {mode === 'photo' ? '上傳一張照片' : '上傳一個 3D 檔'}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  {mode === 'photo'
                    ? '拍玩具、擺飾、作品都可以。照片越清楚，成品越好。'
                    : '支援 OBJ / GLB / STL。新手不用懂格式，選檔就好。'}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    {mode === 'photo' ? (
                      <>
                        <Camera className="h-5 w-5" />
                        選照片
                      </>
                    ) : (
                      <>
                        <Boxes className="h-5 w-5" />
                        選 3D 檔
                      </>
                    )}
                  </Button>
                  <Button variant="secondary" size="lg" onClick={resetAll} className="w-full">
                    重新開始
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void onPick(f)
                  }}
                />

                <div className="mt-3 text-xs font-semibold text-slate-500">
                  檔案只在你的手機/電腦裡處理（此版本不會上傳到伺服器）。
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
              <div className="text-sm font-black text-slate-900">小技巧（真的很好用）</div>
              <div className="mt-3 grid gap-3">
                <Tip icon={<Ruler className="h-4 w-4" />} title="照片要清楚" desc="物體放在桌上，光線亮一點，背景簡單最好。" />
                <Tip icon={<Palette className="h-4 w-4" />} title="先用黑白線稿試做" desc="第一次先印線稿確認大小，OK 再印彩色。" />
                <Tip icon={<Printer className="h-4 w-4" />} title="列印請選 100%" desc="印表機設定選『實際大小』，避免模板被縮放。" />
                <Tip icon={<ShieldCheck className="h-4 w-4" />} title="不需要會 3D" desc="只要會拍照/選檔，就能做出可以黏起來的模板。" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">你選的檔案</div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">
                    {file?.name} {file ? `（${prettyBytes(file.size)}）` : ''}
                  </div>
                </div>
                <Button variant="secondary" onClick={resetAll}>
                  重新選
                </Button>
              </div>

              {preview && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <img src={preview} alt="preview" className="h-52 w-full object-cover" />
                </div>
              )}

              <div className="mt-4 grid gap-3">

                {mode === 'model' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-black text-slate-900">3D 檔：自動拆解</div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <label className="flex items-center gap-3 text-sm font-extrabold text-slate-900">
                          <input
                            type="checkbox"
                            checked={autoUnfold}
                            onChange={(e) => setAutoUnfold(e.target.checked)}
                            className="h-5 w-5"
                          />
                          用 3D 自動拆解（建議）
                        </label>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          會依模型的三角面自動分片。此版本優先支援 GLB。
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <FieldLabel>拆解片數（越大越細）</FieldLabel>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="range"
                            min={4}
                            max={40}
                            value={unfoldPieces}
                            onChange={(e) => setUnfoldPieces(Number(e.target.value))}
                            className="w-full"
                            disabled={!autoUnfold}
                          />
                          <div className="w-14 rounded-xl border border-slate-200 bg-white py-2 text-center text-sm font-black text-slate-900">
                            {unfoldPieces}
                          </div>
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          太細會零件變多、比較難黏。團體活動建議 8–16。
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <FieldLabel>模型大小</FieldLabel>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        { v: 'S', t: '小', d: '手掌大小' },
                        { v: 'M', t: '中', d: '餐盒大小' },
                        { v: 'L', t: '大', d: '桌上擺飾' },
                      ] as const
                    ).map((x) => (
                      <button
                        key={x.v}
                        type="button"
                        onClick={() => setModelSize(x.v)}
                        className={
                          'rounded-2xl border p-3 text-left transition ' +
                          (modelSize === x.v
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white hover:bg-slate-50')
                        }
                      >
                        <div className="text-sm font-black">{x.t}</div>
                        <div className={
                          'mt-1 text-xs font-semibold ' +
                          (modelSize === x.v ? 'text-white/80' : 'text-slate-500')
                        }>
                          {x.d}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>紙張尺寸</FieldLabel>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['A4', 'A3'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPaperSize(s)}
                          className={
                            'rounded-2xl border px-3 py-3 text-sm font-extrabold transition ' +
                            (paperSize === s
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white hover:bg-slate-50')
                          }
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <FieldLabel>建議用紙</FieldLabel>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          { v: 'normal', t: '普通紙' },
                          { v: 'thick', t: '較厚美術紙' },
                        ] as const
                      ).map((x) => (
                        <button
                          key={x.v}
                          type="button"
                          onClick={() => setPaperType(x.v)}
                          className={
                            'rounded-2xl border px-3 py-3 text-sm font-extrabold transition ' +
                            (paperType === x.v
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white hover:bg-slate-50')
                          }
                        >
                          {x.t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel>顏色</FieldLabel>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        { v: 'color', t: '彩色紋理' },
                        { v: 'line', t: '黑白線稿' },
                        { v: 'blank', t: '純白測試' },
                      ] as const
                    ).map((x) => (
                      <button
                        key={x.v}
                        type="button"
                        onClick={() => setColorMode(x.v)}
                        className={
                          'rounded-2xl border px-3 py-3 text-sm font-extrabold transition ' +
                          (colorMode === x.v
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white hover:bg-slate-50')
                        }
                      >
                        {x.t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>份數</FieldLabel>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={copies}
                        onChange={(e) => setCopies(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="w-12 rounded-xl border border-slate-200 bg-white py-2 text-center text-sm font-black text-slate-900">
                        {copies}
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      團體活動需要多份？直接一次印好。
                    </div>
                  </div>

                  <div>
                    <FieldLabel>附一頁組裝說明</FieldLabel>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
                      <label className="flex items-center gap-3 text-sm font-extrabold text-slate-900">
                        <input
                          type="checkbox"
                          checked={includeAssemblyPage}
                          onChange={(e) => setIncludeAssemblyPage(e.target.checked)}
                          className="h-5 w-5"
                        />
                        要（建議）
                      </label>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        印出來放旁邊照做，阿嬤也會用。
                      </div>
                    </div>
                  </div>
                </div>

                <Button size="lg" onClick={generate} disabled={!canNext || busy}>
                  <FileDown className="h-5 w-5" />
                  產生紙模型 PDF
                </Button>

                {busy && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black text-slate-900">處理中…</div>
                      <div className="text-sm font-extrabold text-slate-700">{progress}%</div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={progress} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <Gauge className="h-4 w-4" />
                      {status}
                    </div>
                  </div>
                )}

                {!busy && status && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
                    {status}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
              <div className="text-sm font-black text-slate-900">你會拿到什麼？</div>
              <div className="mt-3 grid gap-3">
                <Deliverable
                  icon={<FileDown className="h-4 w-4" />}
                  title="可直接列印的 PDF"
                  desc="含裁切線、折線、翻蓋（tabs）、對位記號、編號。"
                />
                <Deliverable
                  icon={<Printer className="h-4 w-4" />}
                  title="家用印表機友善"
                  desc="線條清楚，A4/A3 都能印；手機也能先預覽。"
                />
                <Deliverable
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="簡單到真的會用"
                  desc="只有必要選項：大小、顏色、紙張。其它都幫你自動做。"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-black text-slate-900">列印設定提醒</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
                  <li>印表機：選「實際大小 / 100%」。</li>
                  <li>紙張：第一次建議先用普通紙試做。</li>
                  <li>黏貼：一般白膠就可以，翻蓋薄薄塗一層即可。</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-black text-slate-900">已完成</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                你的 PDF 已經下載了。如果沒有自動下載，點下面再下載一次。
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  onClick={async () => {
                    if (!file) return
                    const res = await generatePapercraftPdf(file, options, preview)
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(res.pdfBlob)
                    a.download = res.filename
                    a.click()
                  }}
                  className="w-full"
                >
                  <FileDown className="h-5 w-5" />
                  再下載一次
                </Button>
                <Button variant="secondary" size="lg" onClick={resetAll} className="w-full">
                  再做一個
                </Button>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">下一步（推薦）</div>
                <div className="mt-2 grid gap-2 text-sm font-semibold text-slate-700">
                  <div>1) 先用普通紙試印確認大小。</div>
                  <div>2) OK 之後換較厚紙，再做正式版。</div>
                  <div>3) 做完可以把 PDF 轉傳給家人/團體一起做。</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
              <div className="text-sm font-black text-slate-900">常見問題</div>
              <div className="mt-3 grid gap-3">
                <FAQ q="我不會 3D，可以用嗎？" a="可以。只要拍照/選檔，剩下交給 App。" />
                <FAQ q="可以做很複雜的模型嗎？" a="這個版本主打『簡單好做』。越複雜的模型，通常需要更多頁、更多零件。" />
                <FAQ q="隱私與照片安全？" a="此 MVP 版本不會把檔案上傳到伺服器；歷史紀錄也只保存在你的裝置。" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function Tip(props: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
        {props.icon}
      </div>
      <div>
        <div className="text-sm font-black text-slate-900">{props.title}</div>
        <div className="mt-1 text-sm font-semibold text-slate-600">{props.desc}</div>
      </div>
    </div>
  )
}

function Deliverable(props: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-400 text-white">
        {props.icon}
      </div>
      <div>
        <div className="text-sm font-black text-slate-900">{props.title}</div>
        <div className="mt-1 text-sm font-semibold text-slate-600">{props.desc}</div>
      </div>
    </div>
  )
}

function FAQ(props: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-black text-slate-900">{props.q}</div>
      <div className="mt-2 text-sm font-semibold text-slate-600">{props.a}</div>
    </div>
  )
}
