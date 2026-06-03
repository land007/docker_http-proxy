/* global React, Icon, Dot, Badge, Toggle, Field, Modal, Empty, PageHead */
// pages-ddns.jsx — DDNS management page. Exposes to window.

const { useEffect: useEffectD, useMemo: useMemoD, useState: useStateD } = React;

const DDNS_CRED_LINKS = {
  CF_Token: "https://dash.cloudflare.com/profile/api-tokens",
  DP_Id: "https://console.dnspod.cn/account/token",
  DP_Key: "https://console.dnspod.cn/account/token",
  Ali_Key: "https://ram.console.aliyun.com/manage/ak",
  Ali_Secret: "https://ram.console.aliyun.com/manage/ak",
};

function DdnsPage({ t, lang, config, status, providers, modalOpen, setModalOpen, save, remove, sync, toast }) {
  const emptyForm = { enabled: true, provider: providers[0] && providers[0].id || "cloudflare", domain: "", recordTypes: ["A"], ttl: 600, credentials: {} };
  const [editing, setEditing] = useStateD(null);
  const [form, setForm] = useStateD(emptyForm);
  const [syncing, setSyncing] = useStateD("");
  const entries = config.entries || [];
  const provider = providers.find(p => p.id === form.provider);
  const activeFields = provider ? provider.fields || [] : [];

  useEffectD(() => {
    if (!form.provider && providers[0]) setForm(s => ({ ...s, provider: providers[0].id }));
  }, [providers.length]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, provider: providers[0] && providers[0].id || "cloudflare" });
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      enabled: entry.enabled !== false,
      provider: entry.provider || "cloudflare",
      domain: entry.domain || "",
      recordTypes: entry.recordTypes && entry.recordTypes.length ? entry.recordTypes : ["A"],
      ttl: Number(entry.ttl || 600),
      credentials: { ...(entry.credentials || {}) },
    });
    setModalOpen(true);
  };

  const setF = (key, value) => setForm(s => ({ ...s, [key]: value }));
  const setCred = (key, value) => setForm(s => ({ ...s, credentials: { ...s.credentials, [key]: value } }));
  const toggleType = (type) => {
    setForm(s => {
      const has = (s.recordTypes || []).includes(type);
      const next = has ? s.recordTypes.filter(t => t !== type) : [...(s.recordTypes || []), type];
      return { ...s, recordTypes: next.length ? next : [type] };
    });
  };

  const submit = async () => {
    if (!form.domain.trim()) return;
    await save({ ...form, domain: form.domain.trim() }, editing);
    setModalOpen(false);
  };

  const doSync = async (entry) => {
    setSyncing(entry.id);
    try {
      await sync(entry);
    } finally {
      setSyncing("");
    }
  };

  const providerLabel = useMemoD(() => Object.fromEntries(providers.map(p => [p.id, p.name])), [providers]);
  const fmt = (value) => value ? new Date(value).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : t("common.none");
  const kind = (entry) => entry.lastStatus === "success" ? "ok" : entry.lastStatus === "error" ? "err" : entry.lastStatus === "skipped" ? "warn" : "neutral";
  const statusText = (entry) => {
    if (entry.lastStatus === "success") return t("ddns.success");
    if (entry.lastStatus === "error") return entry.lastError || t("ddns.error");
    if (entry.lastStatus === "skipped") return t("ddns.skipped");
    return t("ddns.pending");
  };
  const maybeT = (key) => {
    const value = t(key);
    return value === key ? "" : value;
  };
  const credHint = (name) => {
    const hints = [];
    if (editing) hints.push(t("ddns.keepCredential"));
    const text = maybeT("ddns.credHint." + name);
    if (text) hints.push(text);
    const link = DDNS_CRED_LINKS[name];
    if (!hints.length && !link) return null;
    return <>{hints.join(" ")} {link && <a href={link} target="_blank" rel="noreferrer">{t("ddns.credGet")} ↗</a>}</>;
  };

  return (
    <div>
      <PageHead eyebrow={t("ddns.eyebrow")} title={t("ddns.title")} sub={t("ddns.sub")}
        actions={<button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} />{t("ddns.add")}</button>} />

      <div className="grid grid-3">
        <div className="card card-pad">
          <div className="stat-label">{t("ddns.currentIp4")}</div>
          <div className="hm-v">{status.ip4 || t("common.none")}</div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">{t("ddns.currentIp6")}</div>
          <div className="hm-v">{status.ip6 || t("common.none")}</div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">{t("ddns.interval")}</div>
          <div className="hm-v">{Number(config.interval || 300)}s</div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-head"><h3>{t("ddns.entries")}</h3><span className="hint">{t("ddns.note")}</span></div>
        {entries.length === 0
          ? <Empty icon="globe" title={t("ddns.empty")} sub={t("ddns.emptySub")} action={<button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} />{t("ddns.add")}</button>} />
          : <div className="tablewrap"><table className="table">
            <thead><tr><th>{t("common.domain")}</th><th>{t("ddns.provider")}</th><th>{t("ddns.records")}</th><th>{t("ddns.lastIp")}</th><th>{t("ddns.lastSync")}</th><th>{t("ddns.status")}</th><th className="td-right">{t("common.actions")}</th></tr></thead>
            <tbody>{entries.map(entry => <tr key={entry.id}>
              <td className="mono cell-host">{entry.domain}</td>
              <td>{providerLabel[entry.provider] || entry.provider}</td>
              <td>{(entry.recordTypes || []).map(type => <Badge key={type} kind="accent" className="badge-proto">{type}</Badge>)}</td>
              <td className="mono cell-dim">{[entry.lastIp4, entry.lastIp6].filter(Boolean).join(" / ") || t("common.none")}</td>
              <td className="mono cell-dim">{fmt(entry.lastSyncAt)}</td>
              <td><Badge kind={kind(entry)}><Dot kind={kind(entry) === "neutral" ? "off" : kind(entry)} />{statusText(entry)}</Badge></td>
              <td><div className="cell-actions">
                <Toggle checked={entry.enabled !== false} onChange={(enabled) => save({ ...entry, enabled }, entry)} />
                <button className="btn btn-soft btn-sm" disabled={syncing === entry.id} onClick={() => doSync(entry)}>
                  {syncing === entry.id ? <span className="spinner" aria-hidden="true"></span> : <Icon name="restore" size={15} />}{t("ddns.sync")}
                </button>
                <button className="btn btn-soft btn-icon" onClick={() => openEdit(entry)} title={t("common.edit")}><Icon name="edit" size={16} /></button>
                <button className="btn btn-soft btn-icon" onClick={() => remove(entry)} title={t("common.delete")}><Icon name="trash" size={16} /></button>
              </div></td>
            </tr>)}</tbody>
          </table></div>}
      </div>

      {modalOpen && <Modal t={t} onClose={() => setModalOpen(false)} title={editing ? t("ddns.edit") : t("ddns.new")}
        foot={<><button className="btn btn-soft" onClick={() => setModalOpen(false)}>{t("common.cancel")}</button>
          <button className="btn btn-primary" disabled={!form.domain.trim()} onClick={submit}><Icon name="download" size={15} />{t("common.save")}</button></>}>
        <div className="field-row">
          <Field label={t("common.domain")} req><input className="input mono" placeholder="home.example.com" value={form.domain} onChange={(e) => setF("domain", e.target.value)} autoFocus /></Field>
          <Field label={t("ddns.provider")} req><select className="select" value={form.provider} onChange={(e) => setForm(s => ({ ...s, provider: e.target.value, credentials: {} }))}>{providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        </div>
        <div className="field-row">
          <Field label={t("ddns.records")}>
            <div className="seg seg-grow">
              {["A", "AAAA"].map(type => <button key={type} className={(form.recordTypes || []).includes(type) ? "is-on" : ""} onClick={() => toggleType(type)}>{type}</button>)}
            </div>
          </Field>
          <Field label="TTL"><input className="input mono" type="number" min="60" value={form.ttl} onChange={(e) => setF("ttl", Number(e.target.value || 600))} /></Field>
        </div>
        <label className="check" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={form.enabled !== false} onChange={(e) => setF("enabled", e.target.checked)} />
          <span>{t("common.enabled")}</span>
        </label>
        <div className="field-row">
          {activeFields.map(field => <Field key={field.name} label={field.label} hint={credHint(field.name)}>
            <input className="input mono" type={field.type || "text"} placeholder={field.label}
              value={form.credentials[field.name] || ""} onChange={(e) => setCred(field.name, e.target.value)} />
          </Field>)}
        </div>
      </Modal>}
    </div>
  );
}

Object.assign(window, { DdnsPage });
