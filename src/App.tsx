import { ArrowRight, BookOpen, FileDown, Sparkles } from 'lucide-react'
import { History } from './components/History'
import { ModelLibrary } from './components/ModelLibrary'
import { PaperCraftWizard } from './components/PaperCraftWizard'
import { Badge, Button, Card } from './components/ui'

function App() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1000px_700px_at_20%_0%,rgba(56,189,248,0.25),transparent_60%),radial-gradient(900px_600px_at_80%_10%,rgba(167,139,250,0.22),transparent_55%),linear-gradient(#ffffff,#f8fafc)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.8)]">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-black leading-tight tracking-tight text-slate-900">
                  PaperCraft AI（紙模 AI）
                </div>
                <div className="text-sm font-semibold text-slate-600">
                  拍張照片或上傳 3D 檔，30 秒內拿到可直接列印的紙模型模板
                </div>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Badge>親子活動</Badge>
              <Badge>老師/團體領袖</Badge>
              <Badge>簡單到阿嬤也會用</Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-12 md:items-stretch">
            <div className="md:col-span-7">
              <Card className="p-5 md:p-6">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                  做紙模型，不用會 3D。
                </h1>
                <p className="mt-3 text-base font-semibold leading-relaxed text-slate-700">
                  你只要拍照或上傳 3D 檔，選一下大小與顏色，就能下載 PDF：
                  直接列印、裁切、黏起來，立刻變成真正可以拿來玩或活動用的紙模型。
                </p>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button
                    size="lg"
                    onClick={() => {
                      document.getElementById('start')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="w-full"
                  >
                    立即開始製作
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => {
                      document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="w-full"
                  >
                    <BookOpen className="h-5 w-5" />
                    找現成模型
                  </Button>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <ValuePill title="3 步驟" desc="上傳 → 調整 → 下載" />
                  <ValuePill title="可列印 PDF" desc="裁切線/折線/翻蓋" />
                  <ValuePill title="手機也順" desc="大字、少文字、多圖示" />
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  <div className="font-black text-slate-900">專業展開引擎（Blender）</div>
                  <div className="mt-2">
                    我們已經把「展開、切線、翻蓋、編號、排版、輸出 PDF」整合成自動流程。
                    你只要上傳 3D 檔或照片，拿到的就是可以直接列印的成品。
                  </div>
                </div>
              </Card>
            </div>

            <div className="md:col-span-5">
              <Card className="h-full p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black text-slate-900">最常見用途</div>
                  <Badge className="bg-white">今天就能用</Badge>
                </div>
                <div className="mt-4 grid gap-3">
                  <UseCase
                    title="家長"
                    desc="拍小孩喜歡的玩具車、恐龍、公仔 → 印出來一起黏，放房間或拿來玩。"
                  />
                  <UseCase
                    title="老師 / 團體領袖"
                    desc="需要活動道具 → 快速做出多份模板，讓每位參加者都能做一個帶回家。"
                  />
                  <UseCase
                    title="節日 / 生日派對"
                    desc="做場景、裝飾、小禮物盒 → 先試印一份確認大小，再大量列印。"
                  />
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <FileDown className="h-4 w-4" />
                    下載內容
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-700">
                    每份 PDF 都包含：裁切線、折線（山摺/谷摺）、翻蓋、對位記號、編號，以及一頁簡易組裝說明。
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </header>

        <main className="mt-6 grid gap-6">
          <section id="start" className="scroll-mt-6">
            <PaperCraftWizard />
          </section>

          <section id="history" className="scroll-mt-6">
            <History />
          </section>

          <section id="library" className="scroll-mt-6">
            <ModelLibrary />
          </section>

          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">關於這個版本</h2>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">
                  目前是前端 MVP：會先在你的瀏覽器裡產生一份「可列印模板 PDF」。
                  正式版會把「照片→3D→自動展開」放到後端（例如 Image-to-3D API + Blender 無頭展開），
                  讓模板更貼近你拍的物品。
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 md:max-w-sm">
                隱私：此版本不會把你的照片/檔案上傳到伺服器；「我的模型」只保存在這台裝置。
              </div>
            </div>
          </Card>
        </main>

        <footer className="mt-8 pb-6 text-center text-xs font-semibold text-slate-500">
          © {new Date().getFullYear()} PaperCraft AI（紙模 AI）
        </footer>
      </div>
    </div>
  )
}

function ValuePill(props: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-black text-slate-900">{props.title}</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">{props.desc}</div>
    </div>
  )
}

function UseCase(props: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-black text-slate-900">{props.title}</div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{props.desc}</div>
    </div>
  )
}

export default App
