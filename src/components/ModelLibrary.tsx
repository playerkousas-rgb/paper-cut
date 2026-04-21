import { ExternalLink, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, FieldLabel } from './ui'

type LibraryItem = {
  name: string
  subtitle: string
  url: string
  tags: string[]
}

const LIB: LibraryItem[] = [
  {
    name: 'Canon Creative Park',
    subtitle: '題材豐富，親子/學校活動非常好用',
    url: 'https://creativepark.canon/',
    tags: ['親子', '節日', '動物', '紙模型'],
  },
  {
    name: 'Papermau',
    subtitle: '全球設計師免費模型，更新快',
    url: 'https://papermau.blogspot.com/',
    tags: ['免費', '多樣', '設計師'],
  },
  {
    name: 'Yamaha Paper Craft',
    subtitle: '交通工具特別強（車、船、飛機）',
    url: 'https://global.yamaha-motor.com/design_technology/papercraft/',
    tags: ['交通工具', '細節', '模型'],
  },
  {
    name: 'Cubeecraft',
    subtitle: '卡通風、零件少、容易黏',
    url: 'https://www.cubeecraft.com/',
    tags: ['卡通', '簡單', '新手'],
  },
]

export function ModelLibrary() {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return LIB
    return LIB.filter((it) =>
      [it.name, it.subtitle, it.tags.join(' ')].join(' ').toLowerCase().includes(s),
    )
  }, [q])

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">內建模型庫</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            想快速找到現成模型？這裡是免費資源的下載引導（點開後依各站規則使用）。
          </p>
        </div>
        <div className="w-full md:w-80">
          <FieldLabel htmlFor="q">搜尋</FieldLabel>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="例如：節日、交通工具、簡單..."
              className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {filtered.map((it) => (
          <div
            key={it.url}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-900">{it.name}</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">{it.subtitle}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {it.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </div>
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => window.open(it.url, '_blank', 'noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />
                開啟
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs font-semibold text-slate-500">
        版權提醒：此 App 只提供公開資源連結與引導；實際下載/使用請遵守各站授權條款。
      </div>
    </Card>
  )
}
