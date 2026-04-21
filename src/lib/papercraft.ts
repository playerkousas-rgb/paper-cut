export type InputMode = 'photo' | 'model'

export type PaperSize = 'A4' | 'A3'
export type ModelSize = 'S' | 'M' | 'L'
export type ColorMode = 'color' | 'line' | 'blank'
export type PaperType = 'normal' | 'thick'

export type GenerationOptions = {
  mode: InputMode
  paperSize: PaperSize
  modelSize: ModelSize
  paperType: PaperType
  colorMode: ColorMode
  copies: number
  includeAssemblyPage: boolean
}

export type GenerationResult = {
  pdfBlob: Blob
  filename: string
  pages: number
  notes: string[]
}

export type UnfoldDiagnostics = {
  usedAutoUnfold: boolean
  pieces?: number
  totalFaces?: number
  message?: string
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function mmToPt(mm: number) {
  return (mm * 72) / 25.4
}

function aSizePt(size: PaperSize) {
  // Portrait
  if (size === 'A3') return { w: mmToPt(297), h: mmToPt(420) }
  return { w: mmToPt(210), h: mmToPt(297) }
}

function foldStyle(colorMode: ColorMode) {
  // return [mountainColor, valleyColor]
  if (colorMode === 'blank') return ['#111827', '#111827']
  if (colorMode === 'line') return ['#111827', '#374151']
  return ['#111827', '#4B5563']
}

function safeText(ctx: CanvasRenderingContext2D, t: string, x: number, y: number) {
  ctx.fillText(t, x, y)
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, dash: number[]) {
  ctx.save()
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

function drawTab(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, outward: number) {
  // Creates a simple trapezoid tab on the edge A->B.
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * outward
  const ny = (dx / len) * outward

  const inset = clamp(len * 0.18, 10, 26)
  const cx1 = ax + (dx / len) * inset
  const cy1 = ay + (dy / len) * inset
  const cx2 = bx - (dx / len) * inset
  const cy2 = by - (dy / len) * inset

  ctx.beginPath()
  ctx.moveTo(cx1, cy1)
  ctx.lineTo(cx1 + nx, cy1 + ny)
  ctx.lineTo(cx2 + nx, cy2 + ny)
  ctx.lineTo(cx2, cy2)
  ctx.closePath()
  ctx.stroke()
}

function makeSheetCanvas(size: PaperSize, dpr = 2) {
  const pt = aSizePt(size)
  // Canvas in CSS pixels, then scaled with DPR. Keep 96dpi-ish.
  // We use pt as logical units and map to px with a factor.
  const scale = 1.35 // tuning for quality/size
  const w = Math.round(pt.w * scale)
  const h = Math.round(pt.h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  return { canvas, ctx, w, h }
}

function drawHeader(ctx: CanvasRenderingContext2D, w: number, title: string, subtitle: string) {
  ctx.save()
  ctx.fillStyle = '#0F172A'
  ctx.font = '700 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
  safeText(ctx, title, 24, 34)
  ctx.fillStyle = '#475569'
  ctx.font = '500 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
  safeText(ctx, subtitle, 24, 54)
  ctx.restore()
}

function drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, total: number) {
  ctx.save()
  ctx.fillStyle = '#64748B'
  ctx.font = '500 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
  safeText(ctx, `第 ${page}/${total} 頁`, 24, h - 18)
  ctx.textAlign = 'right'
  safeText(ctx, 'PaperCraft AI（紙模 AI）', w - 24, h - 18)
  ctx.restore()
}

function drawSimpleNet(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colorMode: ColorMode) {
  // A cube-like net with numbering, cut lines, fold lines, and tabs.
  const face = size
  const cut = '#111827'
  const [mountain, valley] = foldStyle(colorMode)

  ctx.save()
  ctx.translate(x, y)

  // Faces coordinates (cross net)
  const faces = [
    { id: 1, x: face, y: 0 },
    { id: 2, x: 0, y: face },
    { id: 3, x: face, y: face },
    { id: 4, x: face * 2, y: face },
    { id: 5, x: face * 3, y: face },
    { id: 6, x: face, y: face * 2 },
  ]

  // Fill background if in color mode
  if (colorMode === 'color') {
    const palette = ['#BAE6FD', '#DDD6FE', '#A7F3D0', '#FDE68A', '#FBCFE8', '#C7D2FE']
    faces.forEach((f, i) => {
      ctx.fillStyle = palette[i % palette.length]
      ctx.fillRect(f.x, f.y, face, face)
    })
  } else {
    ctx.fillStyle = '#ffffff'
    faces.forEach((f) => ctx.fillRect(f.x, f.y, face, face))
  }

  // Cut lines around faces
  ctx.strokeStyle = cut
  ctx.lineWidth = 2
  faces.forEach((f) => {
    ctx.strokeRect(f.x, f.y, face, face)
  })

  // Fold lines between touching faces
  ctx.lineWidth = 1.6
  ctx.strokeStyle = valley
  // between 1 and 3
  drawDashedLine(ctx, face, face, face * 2, face, [6, 5])
  // between 2 and 3
  drawDashedLine(ctx, face, face, face, face * 2, [6, 5])
  // between 4 and 3
  drawDashedLine(ctx, face * 2, face, face * 2, face * 2, [6, 5])
  // between 5 and 4
  drawDashedLine(ctx, face * 3, face, face * 3, face * 2, [6, 5])
  // between 6 and 3
  ctx.strokeStyle = mountain
  drawDashedLine(ctx, face, face * 2, face * 2, face * 2, [2, 5])

  // Tabs on outer edges (simple)
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.4
  const t = Math.max(12, face * 0.18)

  // top of face 1
  drawTab(ctx, face, 0, face * 2, 0, -t)
  // left of face 2
  drawTab(ctx, 0, face, 0, face * 2, -t)
  // right of face 5
  drawTab(ctx, face * 4, face, face * 4, face * 2, t)
  // bottom of face 6
  drawTab(ctx, face, face * 3, face * 2, face * 3, t)

  // Numbering
  ctx.fillStyle = '#0F172A'
  ctx.font = '800 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
  faces.forEach((f) => {
    ctx.fillText(String(f.id), f.x + 10, f.y + 26)
  })

  // Alignment marks
  ctx.strokeStyle = '#64748B'
  ctx.lineWidth = 1
  const marks = [
    { x: face * 2, y: face },
    { x: face, y: face * 2 },
    { x: face * 2, y: face * 2 },
  ]
  marks.forEach((m) => {
    ctx.beginPath()
    ctx.arc(m.x, m.y, 4, 0, Math.PI * 2)
    ctx.stroke()
  })

  ctx.restore()
}

function drawAssemblyPage(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.fillStyle = '#0F172A'
  ctx.font = '800 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
  safeText(ctx, '組裝步驟（簡單版）', 24, 90)

  const steps = [
    { n: 1, t: '先裁切外框（實線）。' },
    { n: 2, t: '沿著虛線先壓線再折：短虛線＝山摺；長虛線＝谷摺。' },
    { n: 3, t: '對照編號，把翻蓋（tabs）塗白膠後黏起來。' },
    { n: 4, t: '如果要更硬：建議用較厚紙，或先整張貼到硬紙板再裁。' },
  ]

  const cardX = 24
  const cardY = 112
  const cardW = w - 48
  const cardH = 210

  ctx.fillStyle = '#F8FAFC'
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, 18)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#334155'
  ctx.font = '600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'

  let yy = cardY + 36
  steps.forEach((s) => {
    ctx.fillStyle = '#0F172A'
    ctx.font = '800 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
    safeText(ctx, String(s.n).padStart(2, '0'), cardX + 18, yy)

    ctx.fillStyle = '#334155'
    ctx.font = '600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
    safeText(ctx, s.t, cardX + 56, yy)

    yy += 40
  })

  // Legend
  const legendY = cardY + cardH + 26
  ctx.fillStyle = '#0F172A'
  ctx.font = '800 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
  safeText(ctx, '線條說明', 24, legendY)

  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(24, legendY + 18)
  ctx.lineTo(160, legendY + 18)
  ctx.stroke()
  ctx.fillStyle = '#475569'
  ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
  safeText(ctx, '裁切線（實線）', 174, legendY + 22)

  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 2
  ctx.setLineDash([2, 5])
  ctx.beginPath()
  ctx.moveTo(24, legendY + 44)
  ctx.lineTo(160, legendY + 44)
  ctx.stroke()
  ctx.setLineDash([])
  safeText(ctx, '山摺線（短虛線）', 174, legendY + 48)

  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.moveTo(24, legendY + 70)
  ctx.lineTo(160, legendY + 70)
  ctx.stroke()
  ctx.setLineDash([])
  safeText(ctx, '谷摺線（長虛線）', 174, legendY + 74)

  ctx.restore()
}

async function canvasToPdfBlob(canvases: HTMLCanvasElement[]) {
  const { jsPDF } = await import('jspdf')
  const first = canvases[0]
  // Use pixel units to keep exact image placement
  const pdf = new jsPDF({
    orientation: first.width > first.height ? 'l' : 'p',
    unit: 'px',
    format: [first.width, first.height],
    compress: true,
  })

  canvases.forEach((c, idx) => {
    if (idx > 0) {
      pdf.addPage([c.width, c.height], c.width > c.height ? 'l' : 'p')
    }
    const dataUrl = c.toDataURL('image/png')
    pdf.addImage(dataUrl, 'PNG', 0, 0, c.width, c.height, undefined, 'FAST')
  })

  const blob = pdf.output('blob') as Blob
  return blob
}

export async function generatePapercraftPdf(
  _inputFile: File,
  options: GenerationOptions,
  previewImageDataUrl?: string,
  unfold?: UnfoldDiagnostics,
): Promise<GenerationResult> {
  // This is a client-side MVP that produces a printable PDF template.
  // In production, the backend would run: image->3D (AI) and then unfold (Blender addon).

  const sheets = clamp(options.copies, 1, 12)
  const totalPages = sheets + (options.includeAssemblyPage ? 1 : 0)

  const canvases: HTMLCanvasElement[] = []

  for (let i = 0; i < sheets; i++) {
    const { canvas, ctx, w, h } = makeSheetCanvas(options.paperSize)

    drawHeader(ctx, w, '可列印紙模型模板', '裁切、折線、翻蓋都已經幫你畫好，直接印出來就能玩')

    // Print preview image if available
    const previewX = w - 184
    const previewY = 86
    const previewW = 160
    const previewH = 120

    ctx.save()
    ctx.fillStyle = '#F1F5F9'
    ctx.strokeStyle = '#E2E8F0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(previewX, previewY, previewW, previewH, 16)
    ctx.fill()
    ctx.stroke()

    if (previewImageDataUrl) {
      const img = new Image()
      img.src = previewImageDataUrl
      await new Promise<void>((res) => {
        img.onload = () => res()
        img.onerror = () => res()
      })
      const scale = Math.min(previewW / img.width, previewH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      const dx = previewX + (previewW - dw) / 2
      const dy = previewY + (previewH - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
    } else {
      ctx.fillStyle = '#94A3B8'
      ctx.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
      ctx.fillText('預覽圖', previewX + 54, previewY + 68)
    }
    ctx.restore()

    // Options summary
    ctx.save()
    ctx.fillStyle = '#334155'
    ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
    const sizeLabel = options.modelSize === 'S' ? '小' : options.modelSize === 'M' ? '中' : '大'
    const paperLabel = options.paperSize
    const colorLabel = options.colorMode === 'color' ? '彩色' : options.colorMode === 'line' ? '黑白線稿' : '純白測試'
    const stockLabel = options.paperType === 'thick' ? '較厚美術紙' : '普通紙'
    ctx.fillText(`大小：${sizeLabel}　紙張：${paperLabel}　顏色：${colorLabel}　建議用紙：${stockLabel}`, 24, 82)
    ctx.restore()

    // Net / Unfold visualization
    const netTop = 130
    const pad = 24
    const availableW = w - pad * 2
    const base = options.modelSize === 'S' ? 78 : options.modelSize === 'M' ? 96 : 118
    const face = Math.min(base, Math.floor((availableW - 40) / 4))
    const netW = face * 4
    const netH = face * 3
    const startX = pad + Math.floor((availableW - netW) / 2)
    const startY = netTop + Math.floor((h - netTop - 64 - netH) / 2)

    if (unfold?.usedAutoUnfold) {
      // Draw a piece-based layout from the uploaded mesh (diagnostic style)
      ctx.save()
      ctx.translate(pad, startY)
      ctx.fillStyle = '#0F172A'
      ctx.font = '800 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
      ctx.fillText('自動拆解（依 3D 網格）', 0, -10)
      ctx.fillStyle = '#475569'
      ctx.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
      ctx.fillText(`片數：${unfold.pieces ?? '-'}  三角面：${unfold.totalFaces ?? '-'}`, 0, 10)
      ctx.restore()

      // Placeholder area box to indicate the true unfold is embedded via caller rendering.
      ctx.save()
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 6])
      ctx.strokeRect(pad, startY, availableW, Math.min(420, h - startY - 92))
      ctx.setLineDash([])
      ctx.fillStyle = '#334155'
      ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
      ctx.fillText('此頁已改為「依模型自動拆解」模式（見左側預覽/片段佈局）', pad + 10, startY + 22)
      ctx.restore()
    } else {
      drawSimpleNet(ctx, startX, startY, face, options.colorMode)
    }

    // Small note
    ctx.save()
    ctx.fillStyle = '#475569'
    ctx.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Arial'
    ctx.fillText('小提醒：先用尺和鈍筆沿虛線壓線，折起來會更漂亮。', 24, h - 44)
    ctx.restore()

    drawFooter(ctx, w, h, i + 1, totalPages)
    canvases.push(canvas)
  }

  if (options.includeAssemblyPage) {
    const { canvas, ctx, w, h } = makeSheetCanvas(options.paperSize)
    drawHeader(ctx, w, '組裝說明頁', '這一頁不用剪，放旁邊照著做就好')
    drawAssemblyPage(ctx, w, h)
    drawFooter(ctx, w, h, totalPages, totalPages)
    canvases.push(canvas)
  }

  const pdfBlob = await canvasToPdfBlob(canvases)
  const filename = `PaperCraftAI_${options.paperSize}_${options.modelSize}_${options.colorMode}.pdf`

  const notes = [
    '列印時請選「實際大小 / 100%」，避免自動縮放。',
    options.paperType === 'thick'
      ? '較厚紙比較好黏、也更耐玩。'
      : '一般影印紙也可以做，先試做再換厚紙。',
  ]

  if (unfold?.message) notes.unshift(unfold.message)

  return { pdfBlob, filename, pages: canvases.length, notes }
}
