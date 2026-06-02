/* global React, Icon, AreaChart, Spark, Dot, Badge, Toggle, Field, Modal, Empty, PageHead */
// pages-rules.jsx — Dashboard, HTTP rules, WebSocket rules. Exposes to window.

const { useState } = React;

const TRAFFIC = [12, 18, 14, 22, 19, 28, 24, 33, 30, 38, 31, 44, 40, 52, 46, 58, 49, 63, 55, 60, 57, 64, 59, 66];
const CONNS = [8, 9, 11, 10, 14, 13, 17, 16, 19, 22, 20, 24, 23, 27, 30, 28, 33, 31, 35, 38, 36, 40, 39, 42];

// deterministic pseudo health for a rule
function healthFor(rule) {
  if (!rule.enabled) return { kind: "off", ms: "—" };
  const seed = (rule.domain || "").length + (rule.target || "").length;
  if (seed % 7 === 0) return { kind: "err", ms: "—" };
  const ms = 12 + (seed * 13) % 180;
  return { kind: ms > 150 ? "warn" : "ok", ms: ms + "ms" };
}

/* ===================== DASHBOARD (editorial) ===================== */
function DashboardPage({ t, lang, http, ws, certs, go, openHttp, openWs, openCert, createBackup }) {
  const allRules = [...http.map(r => ({ ...r, _t: "http" })), ...ws.map(r => ({ ...r, _t: "ws" }))];
  const online = allRules.filter(r => r.enabled).length;
  const certSorted = [...certs].sort((a, b) => a.daysLeft - b.daysLeft);
  const expiring = certSorted.filter(c => c.daysLeft <= 30).length;

  return (
    <div>
      <PageHead eyebrow={t("dash.eyebrow")} title={t("dash.title")}
        actions={<>
          <Badge kind="ok"><Dot kind="ok" />{t("dash.ok")}</Badge>
          <button className="btn btn-primary" onClick={openHttp}><Icon name="plus" size={16} />{t("http.addRule")}</button>
        </>} />

      {/* hero */}
      <div className="card hero">
        <div className="hero-left">
          <div className="stat-label">{t("dash.throughput24")}</div>
          <div style={{ margin: "8px 0 2px" }}><span className="hero-num">1.84</span><span className="unit"> GB/s</span></div>
          <div className="status-text" style={{ color: "var(--ok-text)" }}><Dot kind="ok" />{t("dash.vsYesterday")} +12%</div>
          <div className="hero-mini">
            <div><div className="hm-k">{t("dash.activeConns")}</div><div className="hm-v">382</div></div>
            <div><div className="hm-k">{t("dash.peak")}</div><div className="hm-v">2.31</div></div>
            <div><div className="hm-k">{t("dash.errRate")}</div><div className="hm-v" style={{ color: "var(--ok-text)" }}>0.02%</div></div>
          </div>
        </div>
        <div className="hero-right"><AreaChart data={TRAFFIC} h={196} /></div>
      </div>

      <div className="grid section-gap" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        {/* rule health */}
        <div className="card">
          <div className="card-head">
            <h3>{t("dash.ruleHealth")}</h3>
            <button className="mini-link" onClick={() => go("http")}>{t("dash.viewAll")}</button>
          </div>
          <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {allRules.length === 0
              ? <Empty icon="http" title={t("http.empty")} sub={t("http.emptySub")} />
              : <table className="table">
                <tbody>
                  {allRules.slice(0, 6).map((r) => {
                    const h = healthFor(r);
                    return (
                      <tr key={r._t + r.id}>
                        <td style={{ width: 28 }}><Dot kind={h.kind} /></td>
                        <td className="mono cell-host">{r.domain}</td>
                        <td><Badge kind="neutral" className="badge-proto">{r.protocol}</Badge></td>
                        <td className="mono cell-dim">→ {r.target}</td>
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
                <button className="qbtn" onClick={openHttp}><Icon name="http" size={15} />{t("nav.http")}</button>
                <button className="qbtn" onClick={openWs}><Icon name="ws" size={15} />{t("nav.ws")}</button>
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

Object.assign(window, { DashboardPage, RulesPage, RuleModal, TRAFFIC, CONNS });
