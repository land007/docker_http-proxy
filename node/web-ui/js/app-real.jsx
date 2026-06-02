/* global React, ReactDOM, tFor, Sidebar, DashboardPage, RulesPage, CertPage, UsersPage, SettingsPage, BackupPage, Icon */

const { useCallback, useEffect, useMemo, useState } = React;

const LS = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const saveLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const api = {
  async request(url, options = {}) {
    const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
    const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (response.status === 401) {
      window.location.href = "/admin/login.html";
      throw new Error("Unauthorized");
    }
    if (!response.ok) {
      let message = "Request failed";
      try {
        const error = await response.json();
        message = error.error || (error.errors && error.errors[0] && error.errors[0].msg) || message;
      } catch {}
      throw new Error(message);
    }
    return response.json();
  },
  get(url) { return this.request(url); },
  post(url, data) { return this.request(url, { method: "POST", body: data instanceof FormData ? data : JSON.stringify(data || {}) }); },
  put(url, data) { return this.request(url, { method: "PUT", body: JSON.stringify(data || {}) }); },
  delete(url) { return this.request(url, { method: "DELETE" }); },
};

function splitTarget(value) {
  const text = String(value || "").trim();
  const idx = text.lastIndexOf(":");
  if (idx < 0) return { targetHost: text, targetPort: 80 };
  return { targetHost: text.slice(0, idx), targetPort: Number(text.slice(idx + 1)) || 80 };
}

function normalizeRule(rule, kind) {
  return {
    id: rule.id,
    enabled: !!rule.enabled,
    domain: rule.domain || "",
    path: rule.path || "/",
    target: `${rule.targetHost || ""}:${rule.targetPort || ""}`,
    protocol: String(rule.protocol || (kind === "ws" ? "ws:" : "http:")).replace(":", "").toUpperCase(),
    pretend: !!rule.pretendMode,
    priority: Number(rule.priority || 1),
  };
}

function denormalizeRule(rule, kind) {
  const target = splitTarget(rule.target);
  const protocol = String(rule.protocol || (kind === "ws" ? "WS" : "HTTP")).toLowerCase();
  return {
    enabled: !!rule.enabled,
    domain: rule.domain || "",
    path: rule.path || "/",
    targetHost: target.targetHost,
    targetPort: target.targetPort,
    protocol: protocol.endsWith(":") ? protocol : `${protocol}:`,
    pretendMode: !!rule.pretend,
    priority: Number(rule.priority || 1),
  };
}

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const n = new Date(expiresAt).getTime();
  if (Number.isNaN(n)) return null;
  return Math.ceil((n - Date.now()) / 86400000);
}

function normalizeCert(cert) {
  const left = daysLeft(cert.expiresAt);
  return {
    domain: cert.domain || "",
    certFile: cert.certFile || cert.file || "",
    keyFile: cert.keyFile || "",
    expires: cert.expiresAt ? new Date(cert.expiresAt).getTime() : null,
    daysLeft: left == null ? 999 : left,
  };
}

function normalizeUser(user) {
  return {
    host: user.host || "",
    username: user.username || "",
    hash: user.passwordHash || user.hash || "",
  };
}

function normalizeBackup(backup) {
  return {
    name: backup.name || backup.filename || "",
    size: backup.size || 0,
    created: backup.createdAt || backup.created || backup.mtime || Date.now(),
  };
}

function App() {
  const [route, setRoute] = useState(() => LS("pa.route", "dashboard"));
  const [lang, setLang] = useState(() => LS("pa.lang", "zh"));
  const [theme, setTheme] = useState(() => LS("pa.theme", "light"));
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null);

  const [http, setHttp] = useState([]);
  const [ws, setWs] = useState([]);
  const [certs, setCerts] = useState([]);
  const [acme, setAcme] = useState({ available: false, providers: [], defaultServer: "", certs: [] });
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ maxSessions: 0, defaultUser: "", defaultPass: "", enableAuth: false });
  const [backups, setBackups] = useState([]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); saveLS("pa.theme", theme); }, [theme]);
  useEffect(() => saveLS("pa.lang", lang), [lang]);
  useEffect(() => saveLS("pa.route", route), [route]);

  const t = useCallback((k) => tFor(lang, k), [lang]);
  const toast = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 2600);
  }, []);
  const fail = useCallback((error) => toast(error.message || "Error"), [toast]);

  const loadStatus = useCallback(async () => {
    setStatus(await api.get("/api/status"));
  }, []);
  const loadHttp = useCallback(async () => {
    setHttp((await api.get("/api/http-rules")).map(r => normalizeRule(r, "http")));
  }, []);
  const loadWs = useCallback(async () => {
    setWs((await api.get("/api/ws-rules")).map(r => normalizeRule(r, "ws")));
  }, []);
  const loadCerts = useCallback(async () => {
    setCerts((await api.get("/api/certificates")).map(normalizeCert));
  }, []);
  const loadAcme = useCallback(async () => {
    const info = await api.get("/api/acme/status");
    if (!info.available) {
      setAcme({ available: false, providers: info.providers || [], defaultServer: info.defaultServer || "", certs: [] });
      return;
    }
    const acmeCerts = await api.get("/api/acme/certs");
    setAcme({ available: true, providers: info.providers || [], defaultServer: info.defaultServer || "", certs: acmeCerts.map(normalizeCert) });
  }, []);
  const loadUsers = useCallback(async () => {
    setUsers((await api.get("/api/users")).map(normalizeUser));
  }, []);
  const loadSettings = useCallback(async () => {
    const data = await api.get("/api/settings");
    setSettings({
      maxSessions: Number(data.maxSession || 0),
      defaultUser: data.defaultAuth && data.defaultAuth.username || "",
      defaultPass: data.defaultAuth && data.defaultAuth.password || "",
      enableAuth: !!(data.defaultAuth && data.defaultAuth.enabled),
    });
  }, []);
  const loadBackups = useCallback(async () => {
    setBackups((await api.get("/api/backups")).map(normalizeBackup));
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadStatus(), loadHttp(), loadWs(), loadCerts(), loadAcme(), loadUsers(), loadSettings(), loadBackups()]);
  }, [loadStatus, loadHttp, loadWs, loadCerts, loadAcme, loadUsers, loadSettings, loadBackups]);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/api/auth/me");
        setUser(me.user);
        await reloadAll();
      } catch (error) {
        if (error.message !== "Unauthorized") fail(error);
      }
    })();
  }, [reloadAll, fail]);

  useEffect(() => {
    if (route !== "dashboard") return undefined;
    const timer = setInterval(() => {
      loadStatus().catch(fail);
    }, 10000);
    return () => clearInterval(timer);
  }, [route, loadStatus, fail]);

  const withSaveRules = (kind) => async (nextRules) => {
    const current = kind === "ws" ? ws : http;
    const setLocal = kind === "ws" ? setWs : setHttp;
    const load = kind === "ws" ? loadWs : loadHttp;
    const base = kind === "ws" ? "/api/ws-rules" : "/api/http-rules";
    const before = new Map(current.map(r => [r.id, r]));
    const next = typeof nextRules === "function" ? nextRules(current) : nextRules;
    setLocal(next);
    try {
      if (next.length < current.length) {
        const removed = current.find(r => !next.some(n => n.id === r.id));
        if (removed) await api.delete(`${base}/${removed.id}`);
      } else {
        const changed = next.find(r => !before.has(r.id) || JSON.stringify(before.get(r.id)) !== JSON.stringify(r));
        if (changed) {
          const payload = denormalizeRule(changed, kind);
          if (before.has(changed.id)) await api.put(`${base}/${changed.id}`, payload);
          else await api.post(base, payload);
        }
      }
      await Promise.all([load(), loadStatus()]);
    } catch (error) {
      await load();
      fail(error);
    }
  };

  const uploadCert = async ({ domain, certFile, keyFile }) => {
    const form = new FormData();
    form.append("domain", domain);
    form.append("cert", certFile);
    form.append("key", keyFile);
    await api.post("/api/certificates", form);
    await Promise.all([loadCerts(), loadStatus()]);
    toast(t("toast.added"));
  };

  const deleteCert = async (domain) => {
    await api.delete(`/api/certificates/${encodeURIComponent(domain)}`);
    await Promise.all([loadCerts(), loadStatus()]);
    toast(t("toast.deleted"));
  };

  const issueAcme = async (form) => {
    await api.post("/api/acme/issue", form);
    await Promise.all([loadCerts(), loadAcme(), loadStatus()]);
    toast(t("toast.added"));
  };

  const renewAcme = async (domain) => {
    await api.post(`/api/acme/${encodeURIComponent(domain)}/renew`);
    await Promise.all([loadCerts(), loadAcme()]);
    toast(t("toast.saved"));
  };

  const addUser = async (data) => {
    await api.post("/api/users", data);
    await loadUsers();
    toast(t("toast.added"));
  };

  const deleteUser = async (data) => {
    await api.delete(`/api/users/${encodeURIComponent(data.host)}/${encodeURIComponent(data.username)}`);
    await loadUsers();
    toast(t("toast.deleted"));
  };

  const saveSettings = async (next) => {
    await api.put("/api/settings", {
      maxSession: Number(next.maxSessions || 0),
      defaultAuth: {
        enabled: !!next.enableAuth,
        username: next.defaultUser || "",
        password: next.defaultPass || "",
      },
    });
    await loadSettings();
    toast(t("settings.saved"));
  };

  const createBackup = async () => {
    await api.post("/api/backups");
    await loadBackups();
    setRoute("backup");
    toast(t("backup.created_toast"));
  };

  const restoreBackup = async (backup) => {
    await api.post(`/api/backups/${encodeURIComponent(backup.name)}/restore`);
    await reloadAll();
    toast(t("backup.restored_toast"));
  };

  const deleteBackup = async (backup) => {
    await api.delete(`/api/backups/${encodeURIComponent(backup.name)}`);
    await loadBackups();
    toast(t("backup.deleted_toast"));
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    window.location.href = "/admin/login.html";
  };

  const counts = useMemo(() => ({
    dashboard: 0,
    http: http.length,
    ws: ws.length,
    cert: certs.length,
    users: users.length,
    backup: backups.length,
  }), [http.length, ws.length, certs.length, users.length, backups.length]);

  const go = (r) => { setModal(null); setRoute(r); };
  const openOn = (r) => { setRoute(r); setModal(r); };
  const mOpen = (key) => modal === key;
  const setMOpen = (key) => (v) => setModal(v ? key : null);

  return (
    <div className="app">
      <Sidebar route={route} setRoute={go} t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} counts={counts} user={user} onLogout={logout} />
      <main className="main">
        {route === "dashboard" && <DashboardPage t={t} lang={lang} http={http} ws={ws} certs={certs} status={status} go={go}
          openHttp={() => openOn("http")} openWs={() => openOn("ws")} openCert={() => openOn("cert")} createBackup={createBackup} />}
        {route === "http" && <RulesPage t={t} kind="http" rules={http} setRules={withSaveRules("http")} modalOpen={mOpen("http")} setModalOpen={setMOpen("http")} toast={toast} />}
        {route === "ws" && <RulesPage t={t} kind="ws" rules={ws} setRules={withSaveRules("ws")} modalOpen={mOpen("ws")} setModalOpen={setMOpen("ws")} toast={toast} />}
        {route === "cert" && <CertPage t={t} lang={lang} certs={certs} acme={acme} modalOpen={mOpen("cert")} setModalOpen={setMOpen("cert")}
          uploadCert={uploadCert} deleteCert={deleteCert} issueAcme={issueAcme} renewAcme={renewAcme} toast={toast} />}
        {route === "users" && <UsersPage t={t} users={users} modalOpen={mOpen("users")} setModalOpen={setMOpen("users")} addUser={addUser} deleteUser={deleteUser} toast={toast} />}
        {route === "settings" && <SettingsPage t={t} settings={settings} saveSettings={saveSettings} toast={toast} />}
        {route === "backup" && <BackupPage t={t} lang={lang} backups={backups} createBackup={createBackup} restoreBackup={restoreBackup} deleteBackup={deleteBackup} toast={toast} />}
      </main>

      <div className="toast-wrap">
        {toasts.map(item => <div key={item.id} className="toast"><Icon name="cert" size={15} style={{ color: "var(--ok)" }} />{item.msg}</div>)}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
