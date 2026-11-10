import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import path from 'node:path';

const MAX_ENTRIES = 5000;
const MAX_UNCOMPRESSED = 150 * 1024 * 1024;
const MAX_SINGLE_FILE = 20 * 1024 * 1024;
const TEXT_EXT = new Set(['.md','.txt','.json','.toml','.yaml','.yml','.py','.js','.mjs','.cjs','.ts','.tsx','.jsx','.sh','.ini','.cfg']);

function safeName(name) {
  const normalized = name.replaceAll('\\', '/');
  return !normalized.startsWith('/') && !normalized.split('/').some(p => p === '..') && !normalized.includes('\0');
}
function textOf(entry) {
  if (entry.isDirectory || entry.header.size > MAX_SINGLE_FILE) return '';
  const ext = path.extname(entry.entryName).toLowerCase();
  if (!TEXT_EXT.has(ext)) return '';
  try { return entry.getData().toString('utf8'); } catch { return ''; }
}
function parseJson(s) { try { return JSON.parse(s); } catch { return null; } }

export function inspectZip(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) throw new Error(`压缩包文件数超过限制：${MAX_ENTRIES}`);
  let total = 0;
  const files = [];
  for (const e of entries) {
    if (!safeName(e.entryName)) throw new Error(`压缩包包含不安全路径：${e.entryName}`);
    total += Number(e.header.size || 0);
    if (total > MAX_UNCOMPRESSED) throw new Error('压缩包解压后体积超过 150MB 限制');
    if (!e.isDirectory) files.push({ name: e.entryName, size: Number(e.header.size || 0), text: textOf(e) });
  }
  const byName = new Map(files.map(f => [f.name.toLowerCase(), f]));
  const find = name => files.find(f => path.basename(f.name).toLowerCase() === name.toLowerCase());
  const pyproject = find('pyproject.toml');
  const requirements = find('requirements.txt');
  const packageFile = find('package.json');
  const readme = find('README.md') || find('README.txt');
  const skillFiles = files.filter(f => path.basename(f.name).toLowerCase() === 'skill.md');
  const mcpFiles = files.filter(f => /mcp|server/i.test(path.basename(f.name)) && /\.json$/.test(f.name));
  const packageJson = packageFile ? parseJson(packageFile.text) : null;
  const pythonCandidates = ['main.py','app.py','server.py','cli.py','run.py','agent.py']
    .map(n => files.find(f => path.basename(f.name).toLowerCase() === n)).filter(Boolean).map(f => f.name);
  const nodeCandidates = ['index.js','server.js','main.js','index.mjs','server.mjs']
    .map(n => files.find(f => path.basename(f.name).toLowerCase() === n)).filter(Boolean).map(f => f.name);
  const manifests = [];
  if (pyproject) manifests.push({ type: 'python-project', file: pyproject.name, evidence: 'pyproject.toml' });
  if (requirements) manifests.push({ type: 'python-requirements', file: requirements.name, evidence: 'requirements.txt' });
  if (packageFile) manifests.push({ type: 'node-project', file: packageFile.name, evidence: 'package.json' });
  if (skillFiles.length) manifests.push({ type: 'prompt-skill', files: skillFiles.map(x => x.name), evidence: 'SKILL.md' });
  if (mcpFiles.length) manifests.push({ type: 'possible-mcp-config', files: mcpFiles.map(x => x.name), evidence: 'JSON filename heuristic' });
  const entryCandidates = [
    ...pythonCandidates.map(file => ({ file, runtime: 'python', confidence: 'candidate-not-verified', evidence: 'filename heuristic' })),
    ...nodeCandidates.map(file => ({ file, runtime: 'node', confidence: 'candidate-not-verified', evidence: 'filename heuristic' }))
  ];
  const projectType = manifests.some(x => x.type.startsWith('python')) && manifests.some(x => x.type === 'node-project')
    ? 'mixed' : manifests.some(x => x.type.startsWith('python')) ? 'python' : manifests.some(x => x.type === 'node-project') ? 'node' : skillFiles.length ? 'prompt-skill' : 'unknown';
  const summary = {
    projectType,
    fileCount: files.length,
    totalBytes: total,
    manifests,
    entryCandidates,
    skillFiles: skillFiles.map(x => x.name),
    readmeFound: Boolean(readme),
    packageScripts: packageJson?.scripts || {},
    dependencies: packageJson?.dependencies || {},
    requirementsPreview: requirements?.text.split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#')).slice(0, 80) || [],
    pythonEntrypointStatus: pythonCandidates.length ? '候选入口，尚未验证' : '未识别',
    workflowStatus: '未解析原生控制流；不生成拓扑图',
    executionStatus: '尚未执行；本次仅静态检查',
    evidenceLevel: 'L1/L2-lite：文件清单与显式清单/文件名证据，不代表完整代码理解'
  };
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  return { digest, files: files.map(({name,size}) => ({name,size})), summary, warnings: [
    '文件名匹配只能提供入口候选，不能证明它是真实入口。',
    '本版本不执行导入项目，不安装项目依赖，不推断隐藏的动态控制流。',
    '未提供的运行时、密钥、数据库、MCP 服务和系统依赖均视为未知。'
  ] };
}
