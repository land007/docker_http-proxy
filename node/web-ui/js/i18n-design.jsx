/* i18n.jsx — bilingual dictionary + resolver. Exposes window.I18N + window.tFor */

const I18N = {
  zh: {
    brand: "Proxy Admin",
    node: "本地节点",
    nav: { group: "管理", dashboard: "仪表板", proxy: "代理", http: "HTTP 规则", ws: "WebSocket", cert: "证书", settings: "系统设置", backup: "备份" },
    common: {
      add: "添加", save: "保存", cancel: "取消", delete: "删除", edit: "编辑", restore: "恢复",
      enabled: "已启用", disabled: "已停用", yes: "是", no: "否", confirm: "确认", upload: "上传",
      domain: "域名", path: "路径", target: "目标", protocol: "协议", priority: "优先级", actions: "操作",
      online: "在线", offline: "离线", all_online: "全部在线", search: "搜索…", none: "无",
    },
    dash: {
      eyebrow: "实时", title: "运行概览", ok: "系统正常",
      throughput24: "过去 24 小时吞吐", vsYesterday: "较昨日", peak: "峰值", activeConns: "活跃连接",
      errRate: "5xx 错误率", clientErrRate: "4xx 比例", requestRate: "请求速率", rules: "规则", certs: "证书", quick: "快速操作",
      expiringSoon: "即将到期", uploadCert: "上传证书", createBackup: "创建备份",
      ruleHealth: "规则健康", certExpiry: "证书到期", viewAll: "查看全部", latency: "延迟", daysLeft: "天后到期",
    },
    http: { eyebrow: "路由", title: "HTTP 代理规则", sub: "按域名与路径将入站请求转发到上游目标。", addRule: "添加规则",
      pretend: "伪装模式", editRule: "编辑 HTTP 规则", newRule: "新建 HTTP 规则",
      empty: "暂无 HTTP 规则", emptySub: "添加第一条规则，将域名转发到上游服务。",
      delTitle: "删除此规则？", delDesc: "此操作不可撤销，规则将立即停止转发。" },
    ws: { eyebrow: "路由", title: "WebSocket 代理规则", sub: "长连接转发，支持 WS / WSS 升级与伪装。", addRule: "添加规则",
      editRule: "编辑 WebSocket 规则", newRule: "新建 WebSocket 规则",
      empty: "暂无 WebSocket 规则", emptySub: "添加规则以代理 WebSocket 长连接。" },
    proxy: { eyebrow: "路由", title: "代理", sub: "按域名、路径与上游目标统一管理 HTTP / WebSocket 与客户端鉴权。", add: "添加代理",
      edit: "编辑代理", new: "新建代理", protocols: "协议", accounts: "账号数", auth: "代理鉴权账号",
      addAccount: "添加账号", username: "用户名", password: "密码", passwordKeep: "留空表示不修改密码",
      enableHttp: "启用 HTTP/HTTPS", enableWs: "启用 WS/WSS", empty: "暂无代理",
      emptySub: "添加一条代理，将域名路径转发到同一个上游目标。", delTitle: "删除此代理？",
      delDesc: "此操作会同时删除该代理的 HTTP 与 WebSocket 规则。", saved: "代理已保存" },
    cert: { eyebrow: "TLS", title: "SSL 证书", sub: "上传证书，或通过 ACME 自动签发并续期。", uploadCert: "上传证书",
      tableTitle: "已安装证书", certFile: "证书文件", keyFile: "密钥文件", expires: "到期时间",
      empty: "尚未配置 SSL 证书", emptySub: "上传证书文件，或在下方使用 ACME 自动签发。",
      acme: "ACME 自动证书", dnsProvider: "DNS 服务商", acmeUrl: "ACME 服务 URL",
      issue: "签发证书", acmeEmpty: "暂无 ACME 证书", acmeNote: "凭据仅存储于本地配置。",
      uploadTitle: "上传 SSL 证书", valid: "有效", expiring: "即将到期", renew: "续期" },
    settings: { eyebrow: "配置", title: "系统设置", sub: "全局默认值与会话策略。", save: "保存设置",
      maxSessions: "最大会话数", maxSessionsHint: "每个用户的最大并发会话数（0 = 无限制）。",
      defaultUser: "默认用户名", defaultPass: "默认密码 (MD5)", defaultPassHint: "默认密码的 MD5 哈希。",
      enableAuth: "启用默认认证", enableAuthHint: "对未匹配规则的请求要求默认凭据。", saved: "设置已保存" },
    backup: { eyebrow: "运维", title: "配置备份", sub: "导出与恢复完整代理配置快照。", create: "创建备份",
      name: "名称", size: "大小", created: "创建时间", restore: "恢复",
      empty: "暂无备份", emptySub: "创建首个配置快照以便随时恢复。",
      restoreTitle: "恢复此备份？", restoreDesc: "当前配置将被该快照覆盖，建议先创建新备份。",
      created_toast: "已创建备份", restored_toast: "配置已恢复", deleted_toast: "备份已删除" },
    toast: { saved: "已保存", deleted: "已删除", added: "已添加" },
  },
  en: {
    brand: "Proxy Admin",
    node: "Local node",
    nav: { group: "Manage", dashboard: "Dashboard", proxy: "Proxy", http: "HTTP Rules", ws: "WebSocket", cert: "Certificates", settings: "Settings", backup: "Backups" },
    common: {
      add: "Add", save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", restore: "Restore",
      enabled: "Enabled", disabled: "Disabled", yes: "Yes", no: "No", confirm: "Confirm", upload: "Upload",
      domain: "Domain", path: "Path", target: "Target", protocol: "Protocol", priority: "Priority", actions: "Actions",
      online: "Online", offline: "Offline", all_online: "All online", search: "Search…", none: "None",
    },
    dash: {
      eyebrow: "Live", title: "Overview", ok: "System healthy",
      throughput24: "Throughput · last 24h", vsYesterday: "vs yesterday", peak: "Peak", activeConns: "Active connections",
      errRate: "5xx error rate", clientErrRate: "4xx rate", requestRate: "Request rate", rules: "Rules", certs: "Certificates", quick: "Quick actions",
      expiringSoon: "expiring soon", uploadCert: "Upload cert", createBackup: "Create backup",
      ruleHealth: "Rule health", certExpiry: "Certificate expiry", viewAll: "View all", latency: "Latency", daysLeft: "days left",
    },
    http: { eyebrow: "Routing", title: "HTTP Proxy Rules", sub: "Forward inbound requests to upstream targets by domain and path.", addRule: "Add rule",
      pretend: "Pretend mode", editRule: "Edit HTTP rule", newRule: "New HTTP rule",
      empty: "No HTTP rules yet", emptySub: "Add your first rule to forward a domain to an upstream.",
      delTitle: "Delete this rule?", delDesc: "This cannot be undone. The rule stops forwarding immediately." },
    ws: { eyebrow: "Routing", title: "WebSocket Proxy Rules", sub: "Persistent-connection forwarding with WS / WSS upgrade & pretend mode.", addRule: "Add rule",
      editRule: "Edit WebSocket rule", newRule: "New WebSocket rule",
      empty: "No WebSocket rules yet", emptySub: "Add a rule to proxy WebSocket connections." },
    proxy: { eyebrow: "Routing", title: "Proxy", sub: "Manage HTTP / WebSocket forwarding and client auth by domain, path, and upstream target.", add: "Add proxy",
      edit: "Edit proxy", new: "New proxy", protocols: "Protocols", accounts: "Accounts", auth: "Proxy auth accounts",
      addAccount: "Add account", username: "Username", password: "Password", passwordKeep: "Leave blank to keep password",
      enableHttp: "Enable HTTP/HTTPS", enableWs: "Enable WS/WSS", empty: "No proxies yet",
      emptySub: "Add a proxy to forward a domain path to one upstream target.", delTitle: "Delete this proxy?",
      delDesc: "This removes both HTTP and WebSocket rules for this proxy.", saved: "Proxy saved" },
    cert: { eyebrow: "TLS", title: "SSL Certificates", sub: "Upload certificates, or auto-issue & renew via ACME.", uploadCert: "Upload cert",
      tableTitle: "Installed certificates", certFile: "Cert file", keyFile: "Key file", expires: "Expires",
      empty: "No SSL certificates configured", emptySub: "Upload a certificate, or use ACME below to auto-issue.",
      acme: "ACME auto-certificates", dnsProvider: "DNS provider", acmeUrl: "ACME service URL",
      issue: "Issue certificate", acmeEmpty: "No ACME certificates yet", acmeNote: "Credentials are stored locally only.",
      uploadTitle: "Upload SSL certificate", valid: "Valid", expiring: "Expiring", renew: "Renew" },
    settings: { eyebrow: "Configure", title: "System Settings", sub: "Global defaults and session policy.", save: "Save settings",
      maxSessions: "Max sessions", maxSessionsHint: "Max concurrent sessions per user (0 = unlimited).",
      defaultUser: "Default username", defaultPass: "Default password (MD5)", defaultPassHint: "MD5 hash of the default password.",
      enableAuth: "Enable default auth", enableAuthHint: "Require default credentials for unmatched requests.", saved: "Settings saved" },
    backup: { eyebrow: "Ops", title: "Configuration Backups", sub: "Export and restore full proxy configuration snapshots.", create: "Create backup",
      name: "Name", size: "Size", created: "Created", restore: "Restore",
      empty: "No backups yet", emptySub: "Create your first snapshot so you can roll back anytime.",
      restoreTitle: "Restore this backup?", restoreDesc: "Your current configuration will be overwritten. Consider backing up first.",
      created_toast: "Backup created", restored_toast: "Configuration restored", deleted_toast: "Backup deleted" },
    toast: { saved: "Saved", deleted: "Deleted", added: "Added" },
  },
};

// resolve dot path against a lang object
function tFor(lang, key) {
  const parts = key.split(".");
  let o = I18N[lang] || I18N.zh;
  for (const p of parts) { o = o && o[p]; if (o == null) break; }
  if (o == null) { let f = I18N.zh; for (const p of parts) { f = f && f[p]; if (f == null) break; } return f != null ? f : key; }
  return o;
}

Object.assign(window, { I18N, tFor });
