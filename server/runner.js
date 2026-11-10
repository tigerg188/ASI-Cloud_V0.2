import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function probeRuntime() {
  const candidates = ['node', 'python3', 'python', 'git'];
  const found = {};
  for (const bin of candidates) {
    found[bin] = await new Promise(resolve => {
      const p = spawn(bin, ['--version'], { stdio: ['ignore','pipe','pipe'], windowsHide: true });
      let out = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => out += d.toString());
      p.on('error', () => resolve({ available: false }));
      p.on('close', code => resolve({ available: code === 0, version: out.trim().slice(0, 160) }));
      setTimeout(() => { try { p.kill(); } catch {} }, 2500).unref?.();
    });
  }
  return found;
}

// Deliberately disabled by default. This is process execution, NOT a security sandbox.
export async function runApprovedCommand({ cwd, executable, args = [], timeoutMs = 120000, onEvent = () => {} }) {
  if (process.env.ASI_ENABLE_PROJECT_EXECUTION !== 'true') {
    const e = new Error('项目代码执行已关闭。只有在私有、受控且明确授权的运行环境中，才可设置 ASI_ENABLE_PROJECT_EXECUTION=true。');
    e.code = 'EXECUTION_DISABLED';
    throw e;
  }
  const allowed = new Set(['python', 'python3', 'node']);
  if (!allowed.has(executable)) throw new Error('当前 MVP 仅允许 python/python3/node 可执行文件；不接受 shell 命令字符串。');
  const resolved = path.resolve(cwd);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) throw new Error('运行目录无效');
  if (!Array.isArray(args) || args.length > 30 || args.some(x => typeof x !== 'string' || x.length > 500)) throw new Error('运行参数无效');
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: resolved, shell: false, windowsHide: true, env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', LANG: process.env.LANG || 'C.UTF-8' }, stdio: ['ignore','pipe','pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const append = (stream, chunk) => {
      const value = chunk.toString('utf8');
      if (stream === 'stdout') stdout = (stdout + value).slice(-200000);
      else stderr = (stderr + value).slice(-200000);
      onEvent({ id, stream, text: value, at: new Date().toISOString() });
    };
    child.stdout.on('data', d => append('stdout', d));
    child.stderr.on('data', d => append('stderr', d));
    child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ id, startedAt, endedAt: new Date().toISOString(), exitCode: code, timedOut, stdout, stderr, status: code === 0 && !timedOut ? 'process-exit-zero' : 'process-failed' });
    });
  });
}
