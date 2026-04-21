import cors from 'cors'
import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

type UnfoldRequest = {
  paperSize?: 'A4' | 'A3'
  scale?: string
  title?: string
  // future: color_mode, add_assembly, etc.
}

function mustGetEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const p = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    p.stdout.on('data', (d) => (stdout += String(d)))
    p.stderr.on('data', (d) => (stderr += String(d)))
    p.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })
}

app.post('/api/unfold', upload.single('file'), async (req, res) => {
  const body = req.body as UnfoldRequest
  const file = req.file

  if (!file) {
    res.status(400).json({ ok: false, error: 'missing file' })
    return
  }

  const blenderPath = mustGetEnv('BLENDER_PATH')
  const workRoot = process.env.WORK_DIR || path.join(__dirname, '..', '.work')

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const workDir = path.join(workRoot, id)
  await fs.mkdir(workDir, { recursive: true })

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
  const inPath = path.join(workDir, safeName)
  const outPath = path.join(workDir, 'papermodel.pdf')
  const logPath = path.join(workDir, 'blender.log')

  try {
    await fs.writeFile(inPath, file.buffer)

    const scriptPath = path.join(__dirname, 'scripts', 'export_papermodel.py')

    const args = [
      '--background',
      '--addons',
      'io_export_paper_model',
      '--python',
      scriptPath,
      '--',
      '--input',
      inPath,
      '--output',
      outPath,
      '--paper',
      body.paperSize || 'A4',
      '--scale',
      body.scale || '1.0',
      '--title',
      body.title || 'PaperCraft AI',
    ]

    const started = Date.now()
    const r = await run(blenderPath, args, { cwd: workDir })
    const ms = Date.now() - started

    await fs.writeFile(
      logPath,
      [
        `cmd: ${blenderPath} ${args.join(' ')}`,
        `exit: ${r.code}`,
        `time_ms: ${ms}`,
        `\n--- stdout ---\n${r.stdout}`,
        `\n--- stderr ---\n${r.stderr}`,
      ].join('\n'),
    )

    if (r.code !== 0) {
      res.status(500).json({ ok: false, error: 'blender_failed', details: r.stderr.slice(-4000) })
      return
    }

    const pdf = await fs.readFile(outPath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="papermodel.pdf"')
    res.send(pdf)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  } finally {
    // Cleanup best-effort
    try {
      const keep = process.env.KEEP_WORK === '1'
      if (!keep) await fs.rm(workDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

const port = Number(process.env.PORT || 8787)
app.listen(port, () => {
  console.log(`[papercraft-api] listening on :${port}`)
})
