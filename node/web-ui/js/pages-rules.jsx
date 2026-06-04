/* global React, Icon, AreaChart, Spark, Dot, Badge, Toggle, Field, Modal, Empty, PageHead */
// pages-rules.jsx — Dashboard, HTTP rules, WebSocket rules. Exposes to window.

const { useState } = React;

function ruleStatsKey(rule) {
  if (rule._unmatched) return "unmatched";
  const protocol = String(rule.protocol || "").toLowerCase() + ":";
  return `${rule._t || "http"}|${protocol}|${rule.domain || ""}|${rule.path || "/"}|${rule.target || ""}`;
}

function formatBytes(n) {
  const value = Number(n || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${Math.round(value)} B`;
}

function formatRate(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function statsForRule(stats, rule) {
  return stats && stats.ruleStats && stats.ruleStats[ruleStatsKey(rule)];
}

function healthFor(rule, stats) {
  if (!rule.enabled) return { kind: "off", ms: "—" };
  const item = statsForRule(stats, rule);
  if (!item || item.requests === 0) return { kind: "off", ms: "—" };
  const errorRate = (item.serverErrors || item.errors || 0) / item.requests;
  const ms = item.requests > 0 ? Math.round(item.durationMs / item.requests) : 0;
  if (errorRate > 0.05) return { kind: "err", ms: ms ? `${ms}ms` : "—" };
  return { kind: ms > 500 ? "warn" : "ok", ms: `${ms}ms` };
}

function ruleSortScore(rule, stats) {
  const item = statsForRule(stats, rule);
  if (!item) return rule.enabled ? 1 : 0;
  const ms = item.requests > 0 ? item.durationMs / item.requests : 0;
  const recent = item.lastSeenAt ? Math.max(0, 10000000000000 - (Date.now() - new Date(item.lastSeenAt).getTime())) / 10000000000000 : 0;
  return (item.serverErrors || item.errors || 0) * 100000 + (ms > 500 ? 10000 : 0) + item.active * 1000 + recent * 100 + item.requests;
}

/* ===================== DASHBOARD (editorial) ===================== */
function DashboardPage({ t, lang, http, ws, certs, status, go, openProxy, openCert, createBackup }) {
  const stats = status && status.proxyStats || {};
  const unmatchedStats = stats.ruleStats && stats.ruleStats.unmatched;
  const unmatchedRule = unmatchedStats && unmatchedStats.requests > 0
    ? [{ id: "unmatched", _t: "http", _unmatched: true, enabled: true, domain: t("common.none"), path: "", target: "unmatched", protocol: "HTTP" }]
    : [];
  const allRules = [...http.map(r => ({ ...r, _t: "http" })), ...ws.map(r => ({ ...r, _t: "ws" })), ...unmatchedRule];
  const buckets = stats.minuteBuckets || [];
  const recent = buckets.slice(-5);
  const recentBytes = recent.reduce((sum, bucket) => sum + (bucket.bytes || 0), 0);
  const recentRequests = recent.reduce((sum, bucket) => sum + (bucket.requests || 0), 0);
  const bytesPerSecond = recent.length ? recentBytes / (recent.length * 60) : 0;
  const requestsPerMinute = recent.length ? recentRequests / recent.length : 0;
  const peakBytesPerSecond = buckets.reduce((max, bucket) => Math.max(max, (bucket.bytes || 0) / 60), 0);
  const chartData = buckets.length ? buckets.map(bucket => bucket.bytes || 0) : [0];
  const requestChartData = buckets.length ? buckets.map(bucket => bucket.requests || 0) : [0];
  const activeConns = Number(stats.activeHttp || 0) + Number(stats.activeWs || 0);
  const errRate = stats.totalRequests > 0 ? ((stats.totalServerErrors || stats.totalErrors || 0) / stats.totalRequests) * 100 : 0;
  const clientErrRate = stats.totalRequests > 0 ? ((stats.totalClientErrors || 0) / stats.totalRequests) * 100 : 0;
  const healthKind = errRate > 5 ? "err" : errRate > 1 ? "warn" : "ok";
  const sortedRules = [...allRules].sort((a, b) => ruleSortScore(b, stats) - ruleSortScore(a, stats));
  const certSorted = [...certs].sort((a, b) => a.daysLeft - b.daysLeft);
  const expiring = certSorted.filter(c => c.daysLeft <= 30).length;

  return (
    <div>
      <PageHead eyebrow={t("dash.eyebrow")} title={t("dash.title")}
        actions={<>
          <Badge kind={healthKind}><Dot kind={healthKind} />{t("dash.ok")}</Badge>
          <button className="btn btn-primary" onClick={openProxy}><Icon name="plus" size={16} />{t("proxy.add")}</button>
        </>} />

      {/* hero */}
      <div className="card hero">
        <div className="hero-left">
          <div className="stat-label">{t("dash.throughput24")}</div>
          <div style={{ margin: "8px 0 2px" }}><span className="hero-num">{formatRate(bytesPerSecond).split(" ")[0]}</span><span className="unit"> {formatRate(bytesPerSecond).split(" ").slice(1).join(" ")}</span></div>
          <div className="status-text" style={{ color: "var(--text-3)" }}><Dot kind={healthKind} />{formatBytes(stats.totalBytes)} · {stats.totalRequests || 0} req</div>
          <div className="hero-mini">
            <div><div className="hm-k">{t("dash.activeConns")}</div><div className="hm-v">{activeConns}</div></div>
            <div><div className="hm-k">{t("dash.peak")}</div><div className="hm-v">{formatRate(peakBytesPerSecond)}</div></div>
            <div><div className="hm-k">{t("dash.errRate")}</div><div className="hm-v" style={{ color: healthKind === "err" ? "var(--err-text)" : healthKind === "warn" ? "var(--warn-text)" : "var(--ok-text)" }}>{errRate.toFixed(2)}%</div></div>
            <div><div className="hm-k">{t("dash.clientErrRate")}</div><div className="hm-v" style={{ color: clientErrRate > 10 ? "var(--warn-text)" : "var(--text)" }}>{clientErrRate.toFixed(2)}%</div></div>
            <div><div className="hm-k">{t("dash.requestRate")}</div><div className="hm-v">{requestsPerMinute.toFixed(1)}/m</div></div>
          </div>
        </div>
        <div className="hero-right">
          <AreaChart data={chartData} h={172} />
          <div className="rowsplit" style={{ borderBottom: "none", padding: "12px 0 0" }}>
            <span className="status-text">{t("dash.requestRate")} · {requestsPerMinute.toFixed(1)}/m</span>
            <Spark data={requestChartData} w={110} h={30} />
          </div>
        </div>
      </div>

      <div className="grid section-gap" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        {/* rule health */}
        <div className="card">
          <div className="card-head">
            <h3>{t("dash.ruleHealth")}</h3>
            <button className="mini-link" onClick={() => go("proxy")}>{t("dash.viewAll")}</button>
          </div>
          <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {allRules.length === 0
              ? <Empty icon="http" title={t("http.empty")} sub={t("http.emptySub")} />
              : <table className="table">
                <tbody>
                  {sortedRules.slice(0, 6).map((r) => {
                    const h = healthFor(r, stats);
                    const item = statsForRule(stats, r);
                    return (
                      <tr key={r._t + r.id}>
                        <td style={{ width: 28 }}><Dot kind={h.kind} /></td>
                        <td className="mono cell-host">{r.domain}</td>
                        <td><Badge kind="neutral" className="badge-proto">{r.protocol}</Badge></td>
                        <td className="mono cell-dim">→ {r.target}</td>
                        <td className="mono cell-dim">{item ? `${item.requests} req · ${item.serverErrors || item.errors || 0} 5xx` : "—"}</td>
                        <td className="mono td-right" style={{ color: h.kind === "err" ? "var(--err-text)" : h.kind === "warn" ? "var(--warn-text)" : "var(--text-2)" }}>{h.ms}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
          </div>
        </div>

        {/* right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>{t("dash.certExpiry")}</h3>
              {expiring > 0 && <Badge kind="warn">{expiring} {t("dash.expiringSoon")}</Badge>}
            </div>
            <div className="card-body" style={{ paddingTop: 4, paddingBottom: 8 }}>
              {certSorted.length === 0
                ? <div className="status-text" style={{ padding: "8px 0" }}>{t("cert.empty")}</div>
                : <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {certSorted.slice(0, 3).map((c, i) => {
                    const k = c.daysLeft <= 30 ? "warn" : "ok";
                    return (
                      <li key={i} className="rowsplit" style={{ borderBottom: i < Math.min(certSorted.length, 3) - 1 ? undefined : "none" }}>
                        <span className="flex items-center gap-10"><Dot kind={k} /><span className="mono">{c.domain}</span></span>
                        <span className="mono" style={{ fontSize: 12.5, color: k === "warn" ? "var(--warn-text)" : "var(--text-3)" }}>{c.daysLeft} {t("dash.daysLeft")}</span>
                      </li>
                    );
                  })}
                </ul>}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>{t("dash.quick")}</h3></div>
            <div className="card-body">
              <div className="quick">
                <button className="qbtn" onClick={openProxy}><Icon name="http" size={15} />{t("nav.proxy")}</button>
                <button className="qbtn" onClick={openCert}><Icon name="upload" size={15} />{t("dash.uploadCert")}</button>
                <button className="qbtn" onClick={createBackup}><Icon name="download" size={15} />{t("dash.createBackup")}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== shared rule modal ===================== */
function RuleModal({ t, mode, kind, initial, onClose, onSave }) {
  const protos = kind === "ws" ? ["WS", "WSS"] : ["HTTP", "HTTPS"];
  const [f, setF] = useState(initial || { enabled: true, domain: "", path: "/", target: "", protocol: protos[1], pretend: false, priority: 1 });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const valid = f.domain.trim() && f.target.trim();
  const tx = kind === "ws" ? "ws" : "http";
  return (
    <Modal onClose={onClose}
      title={mode === "edit" ? t(tx + ".editRule") : t(tx + ".newRule")}
      foot={<>
        <button className="btn btn-soft" onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn btn-primary" disabled={!valid} onClick={() => onSave(f)}>{t("common.save")}</button>
      </>}>
      <Field label={t("common.domain")} req>
        <input className="input mono" placeholder="proxy.example.com" value={f.domain} onChange={(e) => set("domain", e.target.value)} autoFocus />
      </Field>
      <div className="field-row">
        <Field label={t("common.path")}>
          <input className="input mono" placeholder="/" value={f.path} onChange={(e) => set("path", e.target.value)} />
        </Field>
        <Field label={t("common.protocol")}>
          <select className="select" value={f.protocol} onChange={(e) => set("protocol", e.target.value)}>
            {protos.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t("common.target")} req hint={kind === "ws" ? "host:port" : "host:port"}>
        <input className="input mono" placeholder={kind === "ws" ? "192.168.1.100:80" : "adminer1:8080"} value={f.target} onChange={(e) => set("target", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label={t("common.priority")}>
          <input className="input mono" type="number" min="1" value={f.priority} onChange={(e) => set("priority", +e.target.value)} />
        </Field>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label className="check"><input type="checkbox" checked={f.pretend} onChange={(e) => set("pretend", e.target.checked)} /><span>{t("http.pretend")}</span></label>
        </div>
      </div>
      <label className="check" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} /><span>{t("common.enabled")}</span>
      </label>
      {kind !== "ws" && <label className="check" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={!!f.redirectToHttps} onChange={(e) => set("redirectToHttps", e.target.checked)} /><span>{t("proxy.redirectToHttps")}</span>
      </label>}
    </Modal>
  );
}

/* ===================== rule table page (HTTP + WS share) ===================== */
function RulesPage({ t, kind, rules, setRules, modalOpen, setModalOpen, toast }) {
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const tx = kind === "ws" ? "ws" : "http";

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setModalOpen(true); };
  const save = (data) => {
    if (editing) setRules(rules.map(r => r.id === editing.id ? { ...data, id: editing.id } : r));
    else setRules([...rules, { ...data, id: Date.now() }]);
    setModalOpen(false); setEditing(null);
    toast(editing ? t("toast.saved") : t("toast.added"));
  };
  const del = (r) => { setRules(rules.filter(x => x.id !== r.id)); setConfirm(null); toast(t("toast.deleted")); };
  const toggle = (r, v) => setRules(rules.map(x => x.id === r.id ? { ...x, enabled: v } : x));

  return (
    <div>
      <PageHead eyebrow={t(tx + ".eyebrow")} title={t(tx + ".title")} sub={t(tx + ".sub")}
        actions={<button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} />{t(tx + ".addRule")}</button>} />

      <div className="card">
        {rules.length === 0
          ? <Empty icon={kind === "ws" ? "ws" : "http"} title={t(tx + ".empty")} sub={t(tx + ".emptySub")}
              action={<button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} />{t(tx + ".addRule")}</button>} />
          : <div className="tablewrap"><table className="table">
            <thead><tr>
              <th>{t("common.enabled")}</th><th>{t("common.domain")}</th><th>{t("common.path")}</th>
              <th>{t("common.target")}</th><th>{t("common.protocol")}</th><th>{t("http.pretend")}</th>
              <th>{t("common.priority")}</th><th className="td-right">{t("common.actions")}</th>
            </tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td><Toggle checked={r.enabled} onChange={(v) => toggle(r, v)} /></td>
                  <td className="mono cell-host">{r.domain}</td>
                  <td className="mono cell-dim">{r.path || "/"}</td>
                  <td className="mono">{r.target}</td>
                  <td><Badge kind={String(r.protocol).includes("S") ? "accent" : "neutral"} className="badge-proto">{r.protocol}</Badge></td>
                  <td>{r.pretend ? <Badge kind="neutral">{t("common.yes")}</Badge> : <span className="muted">{t("common.no")}</span>}</td>
                  <td className="mono">{r.priority}</td>
                  <td><div className="cell-actions">
                    <button className="btn btn-soft btn-icon" onClick={() => openEdit(r)} title={t("common.edit")}><Icon name="edit" size={16} /></button>
                    <button className="btn btn-soft btn-icon" onClick={() => setConfirm(r)} title={t("common.delete")}><Icon name="trash" size={16} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>}
      </div>

      {modalOpen && <RuleModal t={t} kind={kind} mode={editing ? "edit" : "new"} initial={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={save} />}
      {confirm && <Modal sm t={t} onClose={() => setConfirm(null)} title={t("http.delTitle")} desc={t("http.delDesc")}
        foot={<><button className="btn btn-soft" onClick={() => setConfirm(null)}>{t("common.cancel")}</button>
          <button className="btn btn-danger" onClick={() => del(confirm)}><Icon name="trash" size={15} />{t("common.delete")}</button></>}>
        <div className="mono" style={{ padding: "4px 0 8px", color: "var(--text-2)" }}>{confirm.domain} <span className="muted">→ {confirm.target}</span></div>
      </Modal>}
    </div>
  );
}

function defaultProxyForm() {
  return {
    enabled: true, domain: "", path: "/", target: "", httpEnabled: true, httpProtocol: "HTTPS",
    redirectToHttps: false, wsEnabled: false, wsProtocol: "WSS", pretend: false, priority: 1, users: []
  };
}

function ProxyModal({ t, mode, initial, onClose, onSave }) {
  const [f, setF] = useState(initial || defaultProxyForm());
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const users = f.users || [];
  const valid = f.domain.trim() && f.target.trim() && (f.httpEnabled || f.wsEnabled);
  const addUser = () => set("users", [...users, { username: "", password: "" }]);
  const changeUser = (index, key, value) => set("users", users.map((u, i) => i === index ? { ...u, [key]: value } : u));
  const removeUser = (index) => set("users", users.filter((_, i) => i !== index));

  return (
    <Modal onClose={onClose}
      title={mode === "edit" ? t("proxy.edit") : t("proxy.new")}
      foot={<>
        <button className="btn btn-soft" onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn btn-primary" disabled={!valid} onClick={() => onSave(f)}>{t("common.save")}</button>
      </>}>
      <Field label={t("common.domain")} req>
        <input className="input mono" placeholder="proxy.example.com:8443" value={f.domain} onChange={(e) => set("domain", e.target.value)} autoFocus />
      </Field>
      <div className="field-row">
        <Field label={t("common.path")}>
          <input className="input mono" placeholder="/" value={f.path} onChange={(e) => set("path", e.target.value)} />
        </Field>
        <Field label={t("common.target")} req hint="host:port">
          <input className="input mono" placeholder="192.168.1.100:8080" value={f.target} onChange={(e) => set("target", e.target.value)} />
        </Field>
      </div>
      <div className="proto-block">
        <div className="proto-col">
          <label className="check">
            <input type="checkbox" checked={f.httpEnabled} onChange={(e) => set("httpEnabled", e.target.checked)} />
            <span>{t("proxy.enableHttp")}</span>
          </label>
          <select className="select" value={f.httpProtocol} onChange={(e) => set("httpProtocol", e.target.value)} disabled={!f.httpEnabled}>
            <option>HTTP</option><option>HTTPS</option>
          </select>
        </div>
        <div className="proto-col">
          <label className="check">
            <input type="checkbox" checked={f.wsEnabled} onChange={(e) => set("wsEnabled", e.target.checked)} />
            <span>{t("proxy.enableWs")}</span>
          </label>
          <select className="select" value={f.wsProtocol} onChange={(e) => set("wsProtocol", e.target.value)} disabled={!f.wsEnabled}>
            <option>WS</option><option>WSS</option>
          </select>
        </div>
      </div>
      <label className="check" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={!!f.redirectToHttps} onChange={(e) => set("redirectToHttps", e.target.checked)} disabled={!f.httpEnabled} />
        <span>{t("proxy.redirectToHttps")}</span>
      </label>
      <div className="field-row">
        <Field label={t("common.priority")}>
          <input className="input mono" type="number" min="1" value={f.priority} onChange={(e) => set("priority", +e.target.value)} />
        </Field>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label className="check"><input type="checkbox" checked={f.pretend} onChange={(e) => set("pretend", e.target.checked)} /><span>{t("http.pretend")}</span></label>
        </div>
      </div>
      <label className="check" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} /><span>{t("common.enabled")}</span>
      </label>

      <div className="acct-sec">
        <div className="acct-head">
          <div>
            <div className="label" style={{ marginBottom: 2 }}>{t("proxy.auth")}</div>
            <div className="hint">{t("proxy.passwordKeep")}</div>
          </div>
          <button className="btn btn-soft" onClick={addUser} type="button"><Icon name="plus" size={15} />{t("proxy.addAccount")}</button>
        </div>
        <div className="acct-list">
          {users.map((u, index) => (
            <div key={index} className="acct-row">
              <Field label={t("proxy.username")}>
                <input className="input mono" value={u.username || ""} onChange={(e) => changeUser(index, "username", e.target.value)} />
              </Field>
              <Field label={t("proxy.password")} hint={u.hash ? `MD5 ${String(u.hash).slice(0, 8)}...` : ""}>
                <input className="input mono" type="password" placeholder={u.hash ? t("proxy.passwordKeep") : ""} value={u.password || ""} onChange={(e) => changeUser(index, "password", e.target.value)} />
              </Field>
              <button className="btn btn-soft btn-icon" onClick={() => removeUser(index)} title={t("common.delete")} type="button"><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function ProxyPage({ t, entries, modalOpen, setModalOpen, save, remove, toast }) {
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (entry) => { setEditing(entry); setModalOpen(true); };
  const onSave = async (data) => {
    await save(data, editing);
    setModalOpen(false);
    setEditing(null);
    toast(t("proxy.saved"));
  };
  const onDelete = async () => {
    await remove(confirm);
    setConfirm(null);
    toast(t("toast.deleted"));
  };

  return (
    <div>
      <PageHead eyebrow={t("proxy.eyebrow")} title={t("proxy.title")} sub={t("proxy.sub")}
        actions={<button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} />{t("proxy.add")}</button>} />

      <div className="card">
        {entries.length === 0
          ? <Empty icon="http" title={t("proxy.empty")} sub={t("proxy.emptySub")}
              action={<button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} />{t("proxy.add")}</button>} />
          : <div className="tablewrap"><table className="table">
            <thead><tr>
              <th>{t("common.enabled")}</th><th>{t("common.domain")}</th><th>{t("common.path")}</th>
              <th>{t("common.target")}</th><th>{t("proxy.protocols")}</th><th>{t("proxy.accounts")}</th>
              <th>{t("common.priority")}</th><th className="td-right">{t("common.actions")}</th>
            </tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.enabled ? <Badge kind="ok">{t("common.enabled")}</Badge> : <Badge kind="neutral">{t("common.disabled")}</Badge>}</td>
                  <td className="mono cell-host">{entry.domain}</td>
                  <td className="mono cell-dim">{entry.path || "/"}</td>
                  <td className="mono">{entry.target}</td>
                  <td>
                    <div className="flex gap-10">
                      {entry.httpEnabled && <Badge kind={entry.httpProtocol === "HTTPS" ? "accent" : "neutral"} className="badge-proto">{entry.httpProtocol}</Badge>}
                      {entry.httpEnabled && entry.redirectToHttps && <Badge kind="accent" className="badge-proto">{t("proxy.redirectBadge")}</Badge>}
                      {entry.wsEnabled && <Badge kind={entry.wsProtocol === "WSS" ? "accent" : "neutral"} className="badge-proto">{entry.wsProtocol}</Badge>}
                    </div>
                  </td>
                  <td className="mono">{(entry.users || []).length}</td>
                  <td className="mono">{entry.priority}</td>
                  <td><div className="cell-actions">
                    <button className="btn btn-soft btn-icon" onClick={() => openEdit(entry)} title={t("common.edit")}><Icon name="edit" size={16} /></button>
                    <button className="btn btn-soft btn-icon" onClick={() => setConfirm(entry)} title={t("common.delete")}><Icon name="trash" size={16} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>}
      </div>

      {modalOpen && <ProxyModal t={t} mode={editing ? "edit" : "new"} initial={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={onSave} />}
      {confirm && <Modal sm onClose={() => setConfirm(null)} title={t("proxy.delTitle")} desc={t("proxy.delDesc")}
        foot={<><button className="btn btn-soft" onClick={() => setConfirm(null)}>{t("common.cancel")}</button>
          <button className="btn btn-danger" onClick={onDelete}><Icon name="trash" size={15} />{t("common.delete")}</button></>}>
        <div className="mono" style={{ padding: "4px 0 8px", color: "var(--text-2)" }}>{confirm.domain}{confirm.path} <span className="muted">→ {confirm.target}</span></div>
      </Modal>}
    </div>
  );
}

Object.assign(window, { DashboardPage, RulesPage, RuleModal, ProxyPage, ProxyModal });
