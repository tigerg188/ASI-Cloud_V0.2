import test from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { inspectZip } from '../server/scanner.js';

test('识别常见 Python / Skill 清单并保持入口候选状态', () => {
  const z = new AdmZip();
  z.addFile('demo/README.md', Buffer.from('# Demo'));
  z.addFile('demo/requirements.txt', Buffer.from('requests\n'));
  z.addFile('demo/main.py', Buffer.from('print("hello")'));
  z.addFile('demo/SKILL.md', Buffer.from('# Skill'));
  const out = inspectZip(z.toBuffer());
  assert.equal(out.summary.projectType, 'python');
  assert.ok(out.summary.manifests.some(x => x.type === 'python-requirements'));
  assert.ok(out.summary.manifests.some(x => x.type === 'prompt-skill'));
  assert.equal(out.summary.entryCandidates[0].confidence, 'candidate-not-verified');
  assert.match(out.summary.workflowStatus, /不生成拓扑图/);
});

test('拒绝路径穿越 ZIP 条目', () => {
  const z = new AdmZip();
  z.addFile('../escape.txt', Buffer.from('bad'));
  assert.throws(() => inspectZip(z.toBuffer()), /不安全路径/);
});
