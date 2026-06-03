/* global React */
// ui.jsx — shared primitives, icons, charts, sidebar. Exposes to window.

const ICON = {
  dashboard: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  http: "M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16",
  ws: "M9 2v6m6-6v6M4 8h16v3a8 8 0 0 1-16 0V8Z",
  cert: "M12 2l7 3v6c0 5-3 8-7 11-4-3-7-6-7-11V5l7-3Zm-2.5 9l1.7 1.7L15 9.5",
  users: "M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3a8 8 0 0 0-.2-1.8l2-1.5-2-3.4-2.3 1a8 8 0 0 0-3-1.8L14 1h-4l-.5 2.5a8 8 0 0 0-3 1.8l-2.3-1-2 3.4 2 1.5A8 8 0 0 0 4 12c0 .6.1 1.2.2 1.8l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 3 1.8L10 23h4l.5-2.5a8 8 0 0 0 3-1.8l2.3 1 2-3.4-2-1.5c.1-.6.2-1.2.2-1.8Z",
  backup: "M4 7h16M4 12h16M4 17h16",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3ZM13.5 6.5l3 3",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7",
  upload: "M12 16V4m0 0L8 8m4-4 4 4M5 18v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1",
  download: "M12 4v12m0 0 4-4m-4 4-4-4M5 18v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1",
  restore: "M4 4v6h6M4 10a8 8 0 1 1-1.5 5",
  close: "M6 6l12 12M18 6 6 18",
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  moon: "M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.5 2.5 15.5 0 18M3.5 9h17M3.5 15h17",
  logout: "M16 17l5-5-5-5M21 12H9M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-6Z",
  inbox: "M4 13h4l1.5 3h5L16 13h4M4 13l2.5-8h11L20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z",
  shield: "M12 2l7 3v6c0 5-3 8-7 11-4-3-7-6-7-11V5l7-3Z",
};

function Icon({ name, d, size = 18, sw = 1.7, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={d || ICON[name]} />
    </svg>
  );
}

/* ---------- charts ---------- */
function AreaChart({ data, h = 180, stroke = "var(--accent)", fill = "var(--accent)", pad = 6 }) {
  const w = 600;
  const max = Math.max(1, ...data) * 1.15, min = 0, n = data.length || 1;
  const x = (i) => pad + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad * 2));
  const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const gid = React.useMemo(() => "g" + Math.random().toString(36).slice(2, 8), []);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={fill} stopOpacity="0.16" /><stop offset="100%" stopColor={fill} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function Spark({ data, w = 84, h = 28, stroke = "var(--accent)" }) {
  const max = Math.max(...data), min = Math.min(...data);
  const x = (i) => (i / (data.length - 1)) * w;
  const y = (v) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block" }}>
    <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ---------- small components ---------- */
function Dot({ kind }) { return <span className={"dot dot-" + kind} />; }
function Badge({ kind = "neutral", children, className = "" }) { return <span className={`badge badge-${kind} ${className}`}>{children}</span>; }

function Toggle({ checked, onChange }) {
  return (
    <label className="switch" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track"><span className="thumb" /></span>
    </label>
  );
}

function Field({ label, req, hint, children }) {
  return (
    <div className="field">
      {label && <label className="label">{label}{req && <span className="req">*</span>}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Modal({ title, desc, onClose, children, foot, sm }) {
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"modal" + (sm ? " modal-sm" : "")} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {desc && <div className="modal-desc">{desc}</div>}
          </div>
          <button className="close-x" onClick={onClose} aria-label="close"><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

function Empty({ icon = "inbox", title, sub, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <header className="phead">
      <div>
        <div className="phead-eyebrow">{eyebrow}</div>
        <h1 className="phead-title">{title}</h1>
        {sub && <p className="phead-sub">{sub}</p>}
      </div>
      {actions && <div className="phead-actions">{actions}</div>}
    </header>
  );
}

/* ---------- sidebar ---------- */
const NAV_ITEMS = [
  ["dashboard", "dashboard"], ["proxy", "http"], ["cert", "cert"], ["settings", "settings"], ["backup", "backup"],
];

function Sidebar({ route, setRoute, t, lang, setLang, theme, setTheme, counts, user, onLogout }) {
  const username = user && user.username ? user.username : "admin";
  return (
    <aside className="side">
      <div className="brand">
        <span className="brand-logo"><Icon name="ws" size={18} sw={2} /></span>
        <span className="brand-name">{t("brand")}</span>
      </div>
      <nav className="nav">
        <div className="nav-label">{t("nav.group")}</div>
        {NAV_ITEMS.map(([key, icon]) => (
          <button key={key} className={"navitem" + (route === key ? " is-active" : "")} onClick={() => setRoute(key)}>
            <Icon name={icon} size={17} />
            <span>{t("nav." + key)}</span>
            {counts[key] != null && counts[key] > 0 && <span className="badge-count">{counts[key]}</span>}
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <div className="side-controls">
          <div className="seg seg-grow">
            <button className={theme === "light" ? "is-on" : ""} onClick={() => setTheme("light")} title="Light"><Icon name="sun" size={15} /></button>
            <button className={theme === "dark" ? "is-on" : ""} onClick={() => setTheme("dark")} title="Dark"><Icon name="moon" size={15} /></button>
          </div>
          <div className="seg seg-grow">
            <button className={lang === "zh" ? "is-on" : ""} onClick={() => setLang("zh")}>中</button>
            <button className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>
        <div className="flex between items-center">
          <div className="user-chip">
            <div className="avatar">A</div>
            <div style={{ lineHeight: 1.3 }}>
              <div className="user-name">{username}</div>
              <div className="user-sub">{t("node")}</div>
            </div>
          </div>
          <button className="btn-icon mini-link" title="logout" onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><Icon name="logout" size={17} /></button>
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { ICON, Icon, AreaChart, Spark, Dot, Badge, Toggle, Field, Modal, Empty, PageHead, Sidebar, NAV_ITEMS });
