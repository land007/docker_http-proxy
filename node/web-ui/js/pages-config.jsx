/* global React, Icon, Dot, Badge, Toggle, Field, Modal, Empty, PageHead */
// pages-config.jsx — Certificates, Settings, Backups. Exposes to window.

const { useState: useStateC } = React;

/* ===================== CERTIFICATES ===================== */
const CRED_LINKS = {
  CF_Token: "https://dash.cloudflare.com/profile/api-tokens",
  CF_Account_ID: "https://dash.cloudflare.com/profile/api-tokens",
  CF_Key: "https://dash.cloudflare.com/profile/api-tokens",
  DP_Id: "https://console.dnspod.cn/account/token",
  DP_Key: "https://console.dnspod.cn/account/token",
  Ali_Key: "https://ram.console.aliyun.com/manage/ak",
  Ali_Secret: "https://ram.console.aliyun.com/manage/ak",
  EAB_KID: "https://app.zerossl.com/developer",
  EAB_HMAC_KEY: "https://app.zerossl.com/developer",
};

function CertPage({ t, lang, certs, acme, modalOpen, setModalOpen, uploadCert, deleteCert, issueAcme, renewAcme, toast }) {
  const [up, setUp] = useStateC({ domain: "", certFile: null, keyFile: null });
  const providers = acme.providers || [];
  const firstProvider = providers[0] && providers[0].id || "";
  const [form, setForm] = useStateC({ domain: "", provider: firstProvider, url: acme.defaultServer || "", credentials: {}, cfMethod: "", eabKid: "", eabHmacKey: "" });
  const [advOpen, setAdvOpen] = useStateC(false);
  const [issuing, setIssuing] = useStateC(false);
  const [issueError, setIssueError] = useStateC("");
  const [issueDone, setIssueDone] = useStateC("");
  const setF = (k, v) => setForm(s => ({ ...s, [k]: v }));
  React.useEffect(() => {
    setForm(s => ({ ...s, provider: s.provider || firstProvider, url: s.url || acme.defaultServer || "" }));
  }, [firstProvider, acme.defaultServer]);
  const provider = providers.find(p => p.id === form.provider);
  const providerKey = provider ? `${provider.id}:${(provider.methods || []).map(m => m.id).join(",")}` : "";
  React.useEffect(() => {
    if (!provider) return;
    const firstMethod = provider.methods && provider.methods[0] && provider.methods[0].id || "";
    setForm(s => ({ ...s, cfMethod: firstMethod, credentials: {} }));
  }, [providerKey]);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : t("common.none");
  const maybeT = (key) => {
    const value = t(key);
    return value === key ? "" : value;
  };
  const methodLabel = (method) => maybeT("cert.method." + method.id) || method.label;
  const activeMethod = provider && provider.methods && provider.methods.find(m => m.id === form.cfMethod);
  const activeFields = provider && provider.methods ? (activeMethod || provider.methods[0]).fields : (provider && provider.fields || []);
  const credHint = (name) => {
    const text = maybeT("cert.credHint." + name);
    const link = CRED_LINKS[name];
    if (!text && !link) return null;
    return <>{text} {link && <a href={link} target="_blank" rel="noreferrer">{t("cert.credGet")} ↗</a>}</>;
  };

  const doUpload = async () => {
    if (!up.domain.trim() || !up.certFile || !up.keyFile) return;
    await uploadCert(up);
    setUp({ domain: "", certFile: null, keyFile: null }); setModalOpen(false);
  };
  const issue = async () => {
    if (!form.domain.trim() || !form.provider || issuing) return;
    const requestedDomain = form.domain.trim();
    setIssuing(true);
    setIssueError("");
    setIssueDone("");
    try {
      await issueAcme({
        domain: requestedDomain,
        dnsProvider: form.provider,
        server: form.url,
        credentials: form.credentials,
        eabKid: form.eabKid,
        eabHmacKey: form.eabHmacKey,
      });
      setForm(s => ({ ...s, credentials: {}, eabKid: "", eabHmacKey: "" }));
      setIssueDone(`${requestedDomain} ${t("cert.issueDone")}`);
    } catch (error) {
      setIssueError(error && error.message ? error.message : t("cert.issueFailed"));
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div>
      <PageHead eyebrow={t("cert.eyebrow")} title={t("cert.title")} sub={t("cert.sub")}
        actions={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="upload" size={16} />{t("cert.uploadCert")}</button>} />

      <div className="card">
        <div className="card-head"><h3>{t("cert.tableTitle")}</h3></div>
        {certs.length === 0
          ? <Empty icon="shield" title={t("cert.empty")} sub={t("cert.emptySub")} />
          : <div className="tablewrap"><table className="table">
            <thead><tr><th>{t("common.domain")}</th><th>{t("cert.certFile")}</th><th>{t("cert.keyFile")}</th><th>{t("cert.expires")}</th><th></th><th className="td-right">{t("common.actions")}</th></tr></thead>
            <tbody>{certs.map((c, i) => {
              const warn = c.daysLeft <= 30;
              return <tr key={i}>
                <td className="mono cell-host">{c.domain}</td>
                <td className="mono cell-dim">{c.certFile}</td>
                <td className="mono cell-dim">{c.keyFile}</td>
                <td className="mono">{fmtDate(c.expires)}</td>
                <td><Badge kind={warn ? "warn" : "ok"}><Dot kind={warn ? "warn" : "ok"} />{warn ? t("cert.expiring") : t("cert.valid")}</Badge></td>
                <td><div className="cell-actions"><button className="btn btn-soft btn-icon" onClick={() => deleteCert(c.domain)} title={t("common.delete")}><Icon name="trash" size={16} /></button></div></td>
              </tr>;
            })}</tbody>
          </table></div>}
      </div>

      {acme.available && <div className="card section-gap">
        <div className="card-head"><h3>{t("cert.acme")}</h3><span className="hint">{t("cert.acmeNote")}</span></div>
        <div className="card-body">
          <div className="field-row-3">
            <Field label={t("common.domain")}><input className="input mono" placeholder="example.com" value={form.domain} onChange={(e) => setF("domain", e.target.value)} /></Field>
            <Field label={t("cert.dnsProvider")}><select className="select" value={form.provider} onChange={(e) => setF("provider", e.target.value)}>{providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label={t("cert.acmeUrl")}><input className="input mono" value={form.url} onChange={(e) => setF("url", e.target.value)} /></Field>
          </div>
          {provider && provider.methods && <div className="field-row">
            <Field label={t("cert.cfMethod")}>
              <div className="seg seg-grow">{provider.methods.map(method => (
                <button key={method.id} className={form.cfMethod === method.id ? "is-on" : ""}
                  onClick={() => setForm(s => s.cfMethod === method.id ? s : ({ ...s, cfMethod: method.id, credentials: {} }))}>{methodLabel(method)}</button>
              ))}</div>
            </Field>
          </div>}
          <div className="field-row">
            {activeFields.map(field => (
              <Field key={field.name} label={field.label} hint={credHint(field.name)}>
                <input className="input mono" type={field.type || "text"} placeholder={field.label}
                  value={form.credentials[field.name] || ""}
                  onChange={(e) => setF("credentials", { ...form.credentials, [field.name]: e.target.value })} />
              </Field>
            ))}
          </div>
          <button className="btn btn-soft btn-sm" onClick={() => setAdvOpen(v => !v)}>{advOpen ? "▾" : "▸"} {t("cert.advanced")}</button>
          {advOpen && <div className="field-row" style={{ marginTop: 12 }}>
              <Field label={t("cert.eabKid")} hint={credHint("EAB_KID")}>
                <input className="input mono" type="text" placeholder="EAB_KID" value={form.eabKid} onChange={(e) => setF("eabKid", e.target.value)} />
              </Field>
              <Field label={t("cert.eabHmacKey")} hint={credHint("EAB_HMAC_KEY")}>
                <input className="input mono" type="password" placeholder="EAB_HMAC_KEY" value={form.eabHmacKey} onChange={(e) => setF("eabHmacKey", e.target.value)} />
              </Field>
            </div>}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={!form.domain.trim() || !form.provider || issuing} onClick={issue}>
            {issuing ? <span className="spinner" aria-hidden="true"></span> : <Icon name="shield" size={16} />}
            {issuing ? t("cert.issuing") : t("cert.issue")}
          </button>
          {issuing && <span className="status-text"><Dot kind="warn" />{t("cert.issueWait")}</span>}
          </div>
          {issueDone && <div className="status-text" style={{ marginTop: 10, color: "var(--ok-text)" }}><Dot kind="ok" />{issueDone}</div>}
          {issueError && <div className="status-text" style={{ marginTop: 10, color: "var(--err-text)" }}><Dot kind="err" />{issueError}</div>}

          <div style={{ marginTop: 20 }}>
            {acme.certs.length === 0
              ? <div className="status-text" style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>{t("cert.acmeEmpty")}</div>
              : <table className="table">
                <thead><tr><th>{t("common.domain")}</th><th>{t("cert.expires")}</th><th>{t("cert.certFile")}</th><th className="td-right">{t("common.actions")}</th></tr></thead>
                <tbody>{acme.certs.map((c, i) => <tr key={i}>
                  <td className="mono cell-host">{c.domain}</td>
                  <td className="mono">{fmtDate(c.expires)}</td>
                  <td className="mono cell-dim">{c.certFile}</td>
                  <td><div className="cell-actions"><button className="btn btn-soft btn-sm" onClick={() => renewAcme(c.domain)}><Icon name="restore" size={15} />{t("cert.renew")}</button></div></td>
                </tr>)}</tbody>
              </table>}
          </div>
        </div>
      </div>}

      {modalOpen && <Modal t={t} onClose={() => setModalOpen(false)} title={t("cert.uploadTitle")}
        foot={<><button className="btn btn-soft" onClick={() => setModalOpen(false)}>{t("common.cancel")}</button>
          <button className="btn btn-primary" disabled={!up.domain.trim() || !up.certFile || !up.keyFile} onClick={doUpload}><Icon name="upload" size={15} />{t("common.upload")}</button></>}>
        <Field label={t("common.domain")} req><input className="input mono" placeholder="example.com" value={up.domain} onChange={(e) => setUp(s => ({ ...s, domain: e.target.value }))} autoFocus /></Field>
        <Field label={t("cert.certFile")} req><input className="input mono" type="file" accept=".crt,.pem" onChange={(e) => setUp(s => ({ ...s, certFile: e.target.files[0] }))} /></Field>
        <Field label={t("cert.keyFile")} req><input className="input mono" type="file" accept=".key,.pem" onChange={(e) => setUp(s => ({ ...s, keyFile: e.target.files[0] }))} /></Field>
      </Modal>}
    </div>
  );
}

/* ===================== SETTINGS ===================== */
function SettingsPage({ t, settings, saveSettings, toast }) {
  const [f, setF] = useStateC(settings);
  React.useEffect(() => setF(settings), [settings]);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const save = () => saveSettings(f);
  return (
    <div>
      <PageHead eyebrow={t("settings.eyebrow")} title={t("settings.title")} sub={t("settings.sub")} />
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-body">
          <div className="field-row">
            <Field label={t("settings.maxSessions")} hint={t("settings.maxSessionsHint")}>
              <input className="input mono" type="number" min="0" value={f.maxSessions} onChange={(e) => set("maxSessions", +e.target.value)} />
            </Field>
            <Field label={t("settings.defaultUser")}>
              <input className="input mono" placeholder="admin" value={f.defaultUser} onChange={(e) => set("defaultUser", e.target.value)} />
            </Field>
          </div>
          <Field label={t("settings.defaultPass")} hint={t("settings.defaultPassHint")}>
            <input className="input mono" type="password" placeholder="••••••••" value={f.defaultPass} onChange={(e) => set("defaultPass", e.target.value)} />
          </Field>
          <label className="check" style={{ margin: "4px 0 20px", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-2)" }}>
            <input type="checkbox" checked={f.enableAuth} onChange={(e) => set("enableAuth", e.target.checked)} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{t("settings.enableAuth")}</span>
              <span className="hint">{t("settings.enableAuthHint")}</span>
            </span>
          </label>
          <button className="btn btn-primary" onClick={save}><Icon name="download" size={16} />{t("settings.save")}</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== BACKUPS ===================== */
function BackupPage({ t, lang, backups, createBackup, restoreBackup, deleteBackup, toast, registerCreate }) {
  const [confirm, setConfirm] = useStateC(null);
  const fmt = (d) => new Date(d).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const create = () => createBackup();
  React.useEffect(() => { if (registerCreate) registerCreate(create); });
  return (
    <div>
      <PageHead eyebrow={t("backup.eyebrow")} title={t("backup.title")} sub={t("backup.sub")}
        actions={<button className="btn btn-primary" onClick={create}><Icon name="download" size={16} />{t("backup.create")}</button>} />
      <div className="card">
        {backups.length === 0
          ? <Empty icon="backup" title={t("backup.empty")} sub={t("backup.emptySub")}
              action={<button className="btn btn-primary" onClick={create}><Icon name="download" size={16} />{t("backup.create")}</button>} />
          : <div className="tablewrap"><table className="table">
            <thead><tr><th>{t("backup.name")}</th><th>{t("backup.size")}</th><th>{t("backup.created")}</th><th className="td-right">{t("common.actions")}</th></tr></thead>
            <tbody>{backups.map((b, i) => <tr key={i}>
              <td className="mono cell-host">{b.name}</td>
              <td className="mono cell-dim">{b.size} B</td>
              <td className="mono">{fmt(b.created)}</td>
              <td><div className="cell-actions">
                <button className="btn btn-soft btn-sm" onClick={() => setConfirm(i)}><Icon name="restore" size={15} />{t("backup.restore")}</button>
                <button className="btn btn-soft btn-icon" onClick={() => deleteBackup(b)} title={t("common.delete")}><Icon name="trash" size={16} /></button>
              </div></td>
            </tr>)}</tbody>
          </table></div>}
      </div>
      {confirm != null && <Modal sm t={t} onClose={() => setConfirm(null)} title={t("backup.restoreTitle")} desc={t("backup.restoreDesc")}
        foot={<><button className="btn btn-soft" onClick={() => setConfirm(null)}>{t("common.cancel")}</button>
          <button className="btn btn-primary" onClick={async () => { await restoreBackup(backups[confirm]); setConfirm(null); }}><Icon name="restore" size={15} />{t("backup.restore")}</button></>}>
        <div className="mono" style={{ padding: "4px 0 8px", color: "var(--text-2)" }}>{backups[confirm].name}</div>
      </Modal>}
    </div>
  );
}

Object.assign(window, { CertPage, SettingsPage, BackupPage });
