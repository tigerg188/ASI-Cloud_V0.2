import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inspectZip } from './scanner.js';
import { store } from './store.js';
import { probeRuntime } from './runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => res.json({ ok: true, app: 'ASI Cloud', version: '1.0.0', persistence: store.durability, executionEnabled: process.env.ASI_ENABLE_PROJECT_EXECUTION === 'true' }));
app.get('/api/runtime', async (_req, res) => res.json({ runtimes: await probeRuntime(), executionEnabled: process.env.ASI_ENABLE_PROJECT_EXECUTION === 'true', warning: '运行时探测不代表项目可运行；子进程不等于安全沙盒。' }));
app.get('/api/projects', async (_req, res) => res.json(await store.listProjects()));
app.get('/api/projects/:id', async (req, res) => {
  const p = await store.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: '项目不存在' });
  res.json(p);
});
app.post('/api/import/zip', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传 ZIP 文件' });
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) return res.status(400).json({ error: '仅支持 ZIP 文件' });
    const inspected = inspectZip(req.file.buffer);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const project = {
      id,
      name: String(req.body.name || req.file.originalname.replace(/\.zip$/i, '')).slice(0, 120),
      sourceName: req.file.originalname,
      importedAt: now,
      updatedAt: now,
      sourceSha256: inspected.digest,
      sourceSize: req.file.size,
      scan: inspected,
      status: 'IMPORTED_STATIC_ONLY',
      note: '当前版本仅保存识别报告，不保存可执行解压目录，不会自动安装依赖或执行项目代码。'
    };
    await store.saveProject(project);
    res.status(201).json(project);
  } catch (e) { res.status(400).json({ error: e.message || '导入失败' }); }
});
app.get('/api/projects/:id/runs', async (req, res) => {
  const p = await store.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: '项目不存在' });
  res.json(await store.listRuns(req.params.id));
});
app.get('/api/export/audit', async (req, res) => {
  const projects = await store.listProjects();
  const runs = await store.listRuns();
  const payload = { exportedAt: new Date().toISOString(), durability: store.durability, projects, runs };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="asi-audit-export.json"');
  res.send(JSON.stringify(payload, null, 2));
});
app.get('/api/capabilities', async (_req, res) => res.json({
  implemented: ['ZIP上传与安全路径检查','压缩包清单与常见项目描述文件扫描','入口候选识别（启发式）','项目元数据与审计记录本地文件持久化','运行时可用性探测','审计JSON导出'],
  notImplemented: ['第三方依赖自动安装','Python/Node项目安全沙盒','GitHub在线克隆','原生Agent框架事件追踪','模型API代理与Token计量','云端Firestore/GCS持久化适配','项目源码完整提取与文件浏览','任务编排和DAG转换'],
  honesty: '本版本不把入口候选说成真实入口，不把静态扫描说成完整理解，不把运行时探测说成项目执行成功。'
}));

const port = Number(process.env.PORT || 8080);
const dist = path.resolve(__dirname, '../dist');
try { await fs.access(dist); app.use(express.static(dist)); app.use((_req, res) => res.sendFile(path.join(dist, 'index.html'))); } catch {}
app.listen(port, '0.0.0.0', () => console.log(`ASI Cloud server listening on ${port}`));
