import { Download, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { GenerationOptions } from '../lib/papercraft'
import { Badge, Button, Card } from './ui'

type HistoryItem = {
  id: string
  createdAt: number
  name: string
  mode: 'photo' | 'model'
  options: GenerationOptions
  pages: number
  filename: string
  pdfDataUrl: string
  previewDataUrl?: string
}

const KEY = 'papercraftai.history.v1'

function fmtTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleString()
}

export function History() {
  const [items, setItems] = useState<HistoryItem[]>([])

  useEffect(() => {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as HistoryItem[]
      setItems(parsed)
    } catch {
      // ignore
    }
  }, [])

  const total = useMemo(() => items.length, [items])

  function clearAll() {
    if (!confirm('確定要清空所有紀錄嗎？')) return
    localStorage.removeItem(KEY)
    setItems([])
  }

  function remove(id: string) {
    const next = items.filter((x) => x.id !== id)
    localStorage.setItem(KEY, JSON.stringify(next))
    setItems(next)
  }

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">我的模型</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            這裡會保存你做過的模板（在這台裝置上）。下次直接下載，不用重做。
          </p>
        </div>
        <Button variant="secondary" onClick={clearAll} disabled={items.length === 0}>
          <Trash2 className="h-4 w-4" />
          清空
        </Button>
      </div>

      <div className="mt-5 grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-600">
            還沒有紀錄。先在上面做一份模板，這裡就會出現。
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {it.previewDataUrl ? (
                    <img
                      src={it.previewDataUrl}
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-400">
                      PDF
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">{it.name}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{fmtTime(it.createdAt)}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{it.mode === 'photo' ? '照片' : '3D 檔'}</Badge>
                    <Badge>{it.options.paperSize}</Badge>
                    <Badge>
                      {it.options.modelSize === 'S'
                        ? '小'
                        : it.options.modelSize === 'M'
                          ? '中'
                          : '大'}
                    </Badge>
                    <Badge>{it.options.colorMode === 'color' ? '彩色' : it.options.colorMode === 'line' ? '線稿' : '純白'}</Badge>
                    <Badge>{it.pages} 頁</Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = it.pdfDataUrl
                    a.download = it.filename
                    a.click()
                  }}
                >
                  <Download className="h-4 w-4" />
                  下載
                </Button>
                <Button variant="secondary" onClick={() => remove(it.id)}>
                  <Trash2 className="h-4 w-4" />
                  移除
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 text-xs font-semibold text-slate-500">
        隱私：上傳的檔案只在你的瀏覽器內處理與保存（此 MVP 版本不會上傳到伺服器）。
      </div>
    </Card>
  )
}

export function saveHistory(item: HistoryItem) {
  const raw = localStorage.getItem(KEY)
  const existing = raw ? (JSON.parse(raw) as HistoryItem[]) : []
  const next = [item, ...existing].slice(0, 24)
  localStorage.setItem(KEY, JSON.stringify(next))
}
