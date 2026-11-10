import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.env.ASI_DATA_DIR || './.asi-data');
const PROJECTS = path.join(ROOT, 'projects');
const RUNS = path.join(ROOT, 'runs');

async function ensure() {
  await fs.mkdir(PROJECTS, { recursive: true });
  await fs.mkdir(RUNS, { recursive: true });
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export const store = {
  durability: 'local-filesystem-no-managed-persistence-guarantee',
  async listProjects() { await ensure(); return readJson(path.join(PROJECTS, 'index.json'), []); },
  async getProject(id) { await ensure(); return readJson(path.join(PROJECTS, `${id}.json`), null); },
  async saveProject(project) {
    await ensure();
    const file = path.join(PROJECTS, `${project.id}.json`);
    await writeJsonAtomic(file, project);
    const list = await this.listProjects();
    const next = [project, ...list.filter(x => x.id !== project.id)].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    await writeJsonAtomic(path.join(PROJECTS, 'index.json'), next);
    return project;
  },
  async appendRun(run) {
    await ensure();
    const file = path.join(RUNS, `${run.id}.json`);
    await writeJsonAtomic(file, run);
    return run;
  },
  async listRuns(projectId) {
    await ensure();
    const names = await fs.readdir(RUNS).catch(() => []);
    const rows = [];
    for (const name of names.filter(n => n.endsWith('.json'))) {
      const item = await readJson(path.join(RUNS, name), null);
      if (item && (!projectId || item.projectId === projectId)) rows.push(item);
    }
    return rows.sort((a,b) => b.startedAt.localeCompare(a.startedAt));
  }
};
