import React, { useEffect, useState } from 'react';

async function api(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
function Status({ children, tone = 'neutral' }) { return <span className={`status ${tone}`}>{children}</span>; }

export default function App() {
  const [health, setHealth] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [tab, setTab] = useState('overview');
  const refresh = async () => {
    const [h, p, r] = await Promise.all([api('/api/health'), api('/api/projects'), api('/api/runtime')]);
    setHealth(h); setProjects(p); setRuntime(r);
    if (selected) setSelected(p.find(x => x.id === selected.id) || null);
  };
  useEffect(() => { refresh().catch(e => setMessage(e.message)); }, []);
  const importZip = async e => {
    e.preventDefault(); if (!file) return setMessage('请先选择 ZIP 文件');
    setBusy(true); setMessage('正在进行静态扫描…');
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('name', name);
      const p = await api('/api/import/zip', { method: 'POST', body: fd });
      await refresh(); setSelected(p); setTab('detail'); setMessage('导入与静态扫描完成；尚未执行项目代码。'); setFile(null); setName('');
    } catch (e2) { setMessage(e2.message); } finally { setBusy(false); }
  };
  const exportAudit = () => { window.location.href = '/api/export/audit'; };
  const choose = p => { setSelected(p); setTab('detail'); };
  return <div className="shell">
    <header className="topbar"><div className="brand"><div className="logo">ASI</div><div><strong>ASI Cloud</strong><small>Agent / Skill Intelligence</small></div></div><div className="topright"><Status tone={health?.ok ? 'good' : 'warn'}>{health?.ok ? '服务在线' : '连接检查中'}</Status><button className="ghost" onClick={() => refresh().catch(e => setMessage(e.message))}>刷新状态</button></div></header>
    <div className="layout">
      <aside className="sidebar"><div className="navtitle">工作台</div><button className={tab === 'overview' ? 'nav active' : 'nav'} onClick={() => setTab('overview')}>总览</button><button className={tab === 'import' ? 'nav active' : 'nav'} onClick={() => setTab('import')}>导入项目</button><button className={tab === 'detail' ? 'nav active' : 'nav'} onClick={() => selected && setTab('detail')} disabled={!selected}>项目识别报告</button><div className="sidefoot"><div className="muted">当前版本</div><strong>ASI MVP 1.0</strong><div className="muted">原生优先 · 非侵入 · 证据驱动</div></div></aside>
      <main className="main">
        <div className="pagehead"><div><div className="eyebrow">AGENT PROJECT CONTROL PLANE</div><h1>{tab === 'import' ? '导入第三方项目' : tab === 'detail' ? '项目识别报告' : '项目总览'}</h1><p>识别项目原生结构，诚实呈现已知、未知与尚未验证的能力。</p></div><button className="primary" onClick={() => setTab('import')}>＋ 导入项目</button></div>
        {message && <div className="notice" role="status">{message}<button onClick={() => setMessage('')}>×</button></div>}
        {tab === 'overview' && <>
          <div className="stats"><div className="stat"><span>已导入项目</span><b>{projects.length}</b></div><div className="stat"><span>运行时探测</span><b>{runtime ? Object.values(runtime.runtimes || {}).filter(x => x.available).length : '—'}</b><small>仅代表宿主运行时可用</small></div><div className="stat"><span>执行状态</span><b className="smallvalue">未启用</b><small>当前版本不执行导入代码</small></div><div className="stat"><span>数据保存方式</span><b className="smallvalue">{health?.persistence?.startsWith('local') ? '本地临时' : '待确认'}</b><small>托管环境重启后不保证保留</small></div></div>
          <section className="panel"><div className="panelhead"><div><h2>已导入项目</h2><p>仅显示真实导入并完成静态扫描的项目</p></div><button className="ghost" onClick={exportAudit}>导出审计 JSON</button></div>
            {projects.length ? <div className="projectlist">{projects.map(p => <button className="projectrow" key={p.id} onClick={() => choose(p)}><div className="projecticon">{p.scan?.summary?.projectType === 'python' ? 'Py' : p.scan?.summary?.projectType === 'node' ? 'JS' : 'PR'}</div><div className="projectinfo"><strong>{p.name}</strong><span>{p.sourceName} · {p.scan?.summary?.fileCount || 0} 个文件</span></div><Status tone="warn">仅静态识别</Status><span className="arrow">›</span></button>)}</div> : <div className="empty"><div className="emptyicon">＋</div><strong>尚未导入项目</strong><p>上传一个公开或可信来源的 ZIP 项目包，开始识别。</p><button className="primary" onClick={() => setTab('import')}>导入第一个项目</button></div>}
          </section>
          <section className="panel"><div className="panelhead"><div><h2>运行环境能力探测</h2><p>探测宿主环境，不代表第三方项目可以运行</p></div><Status tone="warn">不构成沙盒</Status></div><div className="runtimegrid">{Object.entries(runtime?.runtimes || {}).map(([k,v]) => <div className="runtime" key={k}><span>{k}</span><Status tone={v.available ? 'good' : 'neutral'}>{v.available ? v.version || '可用' : '未检测到'}</Status></div>)}</div></section>
        </>}
        {tab === 'import' && <section className="panel importpanel"><div className="panelhead"><div><h2>导入项目压缩包</h2><p>当前版本支持 ZIP 静态识别，不会自动安装依赖或执行代码。</p></div><Status tone="good">只读导入</Status></div><form onSubmit={importZip} className="uploadform"><label>项目显示名称（可选）<input value={name} onChange={e => setName(e.target.value)} placeholder="例如：盒盒研究 Skill Pack" /></label><label className="dropzone"><input type="file" accept=".zip,application/zip" onChange={e => setFile(e.target.files?.[0] || null)} /><span className="uploadicon">⇧</span><strong>{file ? file.name : '选择 ZIP 文件或点击此处'}</strong><small>最大 50MB；压缩包展开总量最大 150MB；最多 5000 个文件</small></label><div className="formactions"><span className="muted">支持 Python、Node、SKILL.md、常见配置文件的初步识别</span><button className="primary" disabled={!file || busy}>{busy ? '扫描中…' : '导入并扫描'}</button></div></form><div className="callout"><strong>安全与能力边界</strong><p>ZIP 内容按不可信数据处理。当前版本不运行项目代码、不执行安装脚本、不调用项目内命令。扫描结果中的入口均为候选项，不代表真实入口已经确认。</p></div></section>}
        {tab === 'detail' && selected && <>
          <section className="panel"><div className="panelhead"><div><h2>{selected.name}</h2><p>{selected.sourceName} · SHA-256：{selected.sourceSha256?.slice(0,20)}…</p></div><Status tone="warn">IMPORTED · STATIC ONLY</Status></div><div className="detailgrid"><div><span>项目类型</span><b>{selected.scan.summary.projectType}</b></div><div><span>文件数量</span><b>{selected.scan.summary.fileCount}</b></div><div><span>压缩包大小</span><b>{(selected.sourceSize / 1024 / 1024).toFixed(2)} MB</b></div><div><span>工作流状态</span><b>{selected.scan.summary.workflowStatus}</b></div></div></section>
          <section className="panel"><div className="panelhead"><div><h2>识别证据</h2><p>{selected.scan.summary.evidenceLevel}</p></div></div><h3>项目描述文件</h3>{selected.scan.summary.manifests.length ? <ul className="evidence">{selected.scan.summary.manifests.map((m,i) => <li key={i}><strong>{m.type}</strong><span>{m.file || m.files?.join(', ')}</span><small>证据：{m.evidence}</small></li>)}</ul> : <p className="muted">未识别到常见项目描述文件。</p>}<h3>入口候选（未验证）</h3>{selected.scan.summary.entryCandidates.length ? <div className="tablewrap"><table><thead><tr><th>文件</th><th>运行时</th><th>置信状态</th><th>证据</th></tr></thead><tbody>{selected.scan.summary.entryCandidates.map((e,i)=><tr key={i}><td>{e.file}</td><td>{e.runtime}</td><td><Status tone="warn">未验证</Status></td><td>{e.evidence}</td></tr>)}</tbody></table></div> : <p className="muted">没有识别到入口候选。不能据此断定项目不可运行。</p>}<h3>风险与未知项</h3><ul className="warnings">{selected.scan.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></section>
          <section className="panel"><div className="panelhead"><div><h2>当前版本可执行操作</h2><p>只开放已经实现且能够验证的能力</p></div></div><div className="capabilityline"><Status tone="good">已实现</Status><span>ZIP 结构扫描、项目清单识别、SHA-256、审计 JSON 导出</span></div><div className="capabilityline"><Status tone="warn">未实现</Status><span>依赖安装、真实入口确认、隔离执行、框架追踪、云端持久化</span></div></section>
        </>}
      </main>
    </div>
    <footer className="footer"><span>ASI Cloud · MVP 1.0</span><span>原生优先 / 非侵入 / 未知即未知</span><span>{health?.persistence || '检查数据存储中'}</span></footer>
  </div>;
}
