/**
 * 国际化配置
 * Internationalization (i18n) Configuration
 */

const i18n = {
    currentLang: localStorage.getItem('language') || 'en',

    translations: {
        en: {
            // Navigation
            'nav.dashboard': 'Dashboard',
            'nav.httpRules': 'HTTP Rules',
            'nav.wsRules': 'WebSocket Rules',
            'nav.certificates': 'Certificates',
            'nav.users': 'Users',
            'nav.settings': 'Settings',
            'nav.logout': 'Logout',
            'nav.backups': 'Backups',

            // Common
            'common.save': 'Save',
            'common.cancel': 'Cancel',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.add': 'Add',
            'common.loading': 'Loading...',
            'common.success': 'Success',
            'common.error': 'Error',
            'common.confirm': 'Confirm',
            'common.close': 'Close',
            'common.back': 'Back',
            'common.next': 'Next',
            'common.previous': 'Previous',
            'common.search': 'Search',
            'common.filter': 'Filter',
            'common.export': 'Export',
            'common.import': 'Import',
            'common.enable': 'Enable',
            'common.disable': 'Disable',
            'common.enabled': 'Enabled',
            'common.disabled': 'Disabled',
            'common.actions': 'Actions',
            'common.status': 'Status',
            'common.name': 'Name',
            'common.value': 'Value',
            'common.createdAt': 'Created At',
            'common.updatedAt': 'Updated At',

            // Dashboard
            'dashboard.title': 'Dashboard',
            'dashboard.overview': 'Overview',
            'dashboard.proxyStatus': 'Proxy Status',
            'dashboard.activeRules': 'Active Rules',
            'dashboard.totalRequests': 'Total Requests',
            'dashboard.systemHealth': 'System Health',
            'dashboard.wsRules': 'WebSocket Rules',
            'dashboard.certificates': 'Certificates',
            'dashboard.proxyUsers': 'Proxy Users',
            'dashboard.systemStatus': 'System Status',
            'dashboard.uptime': 'Uptime',
            'dashboard.memoryUsed': 'Memory Used',
            'dashboard.configVersion': 'Config Version',
            'dashboard.lastModified': 'Last Modified',
            'dashboard.quickActions': 'Quick Actions',
            'dashboard.addHttpRule': 'Add HTTP Rule',
            'dashboard.addWsRule': 'Add WebSocket Rule',
            'dashboard.uploadCert': 'Upload Certificate',
            'dashboard.createBackup': 'Create Backup',

            // HTTP Rules
            'httpRules.title': 'HTTP Proxy Rules',
            'httpRules.add': 'Add HTTP Rule',
            'httpRules.edit': 'Edit HTTP Rule',
            'httpRules.protocol': 'Protocol',
            'httpRules.domain': 'Domain',
            'httpRules.path': 'Path',
            'httpRules.targetHost': 'Target Host',
            'httpRules.targetPort': 'Target Port',
            'httpRules.pretendMode': 'Pretend Mode',
            'httpRules.priority': 'Priority',
            'httpRules.addRule': 'Add Rule',
            'httpRules.enabled': 'Enabled',
            'httpRules.target': 'Target',
            'httpRules.actions': 'Actions',
            'httpRules.loading': 'Loading...',

            // WebSocket Rules
            'wsRules.title': 'WebSocket Proxy Rules',
            'wsRules.add': 'Add WebSocket Rule',
            'wsRules.edit': 'Edit WebSocket Rule',
            'wsRules.addRule': 'Add Rule',
            'wsRules.enabled': 'Enabled',
            'wsRules.target': 'Target',
            'wsRules.actions': 'Actions',
            'wsRules.loading': 'Loading...',

            // Certificates
            'certificates.title': 'SSL Certificates',
            'certificates.add': 'Add Certificate',
            'certificates.domain': 'Domain',
            'certificates.certFile': 'Certificate File',
            'certificates.keyFile': 'Key File',
            'certificates.upload': 'Upload Certificate',
            'certificates.expiresAt': 'Expires At',
            'certificates.actions': 'Actions',
            'certificates.loading': 'Loading...',

            // ACME
            'acme.title': 'ACME Automatic Certificates',
            'acme.domain': 'Domain',
            'acme.dnsProvider': 'DNS Provider',
            'acme.server': 'ACME Server URL',
            'acme.issue': 'Issue Certificate',

            // Auth
            'auth.changePassword': 'Change Password',
            'auth.currentPassword': 'Current Password',
            'auth.newPassword': 'New Password',
            'auth.confirmPassword': 'Confirm Password',

            // Users
            'users.title': 'User Management',
            'users.add': 'Add User',
            'users.edit': 'Edit User',
            'users.username': 'Username',
            'users.password': 'Password',
            'users.role': 'Role',
            'users.lastLogin': 'Last Login',
            'users.proxyUsers': 'Proxy Users',
            'users.addUser': 'Add User',
            'users.host': 'Host',
            'users.passwordHash': 'Password Hash',
            'users.actions': 'Actions',
            'users.loading': 'Loading...',

            // Settings
            'settings.title': 'Settings',
            'settings.general': 'General',
            'settings.language': 'Language',
            'settings.theme': 'Theme',
            'settings.maxSession': 'Max Session (0 = unlimited)',
            'settings.maxSessionHelp': 'Maximum number of concurrent sessions per user (0 = unlimited)',
            'settings.defaultUsername': 'Default Username',
            'settings.defaultPassword': 'Default Password (MD5)',
            'settings.defaultPasswordHelp': 'MD5 hash of the default password',
            'settings.enableDefaultAuth': 'Enable Default Authentication',
            'settings.saveSettings': 'Save Settings',

            // Backups
            'backups.title': 'Configuration Backups',
            'backups.create': 'Create Backup',
            'backups.name': 'Name',
            'backups.size': 'Size',
            'backups.created': 'Created',
            'backups.actions': 'Actions',
            'backups.loading': 'Loading...',

            // Login
            'login.title': 'Proxy Admin Login',
            'login.username': 'Username',
            'login.password': 'Password',
            'login.button': 'Login',

            // Modals
            'modal.enabled': 'Enabled',
            'modal.protocol': 'Protocol',
            'modal.domain': 'Domain (optional)',
            'modal.domainHelp': 'Leave empty to match all domains',
            'modal.path': 'Path',
            'modal.targetHost': 'Target Host',
            'modal.targetPort': 'Target Port',
            'modal.pretendMode': 'Pretend Mode (rewrite host header)',
            'modal.priority': 'Priority',
            'modal.priorityHelp': 'Lower numbers have higher priority',
            'modal.save': 'Save',
            'modal.cancel': 'Cancel',
            'modal.userHost': 'Host',
            'modal.userHostHelp': 'The host/domain this user can access',
            'modal.userUsername': 'Username',
            'modal.userPassword': 'Password',

            // Notifications
            'notification.title': 'Notification'
        },
        zh: {
            // Navigation
            'nav.dashboard': '仪表板',
            'nav.httpRules': 'HTTP规则',
            'nav.wsRules': 'WebSocket规则',
            'nav.certificates': '证书管理',
            'nav.users': '用户管理',
            'nav.settings': '系统设置',
            'nav.logout': '退出登录',
            'nav.backups': '备份管理',

            // Common
            'common.save': '保存',
            'common.cancel': '取消',
            'common.delete': '删除',
            'common.edit': '编辑',
            'common.add': '添加',
            'common.loading': '加载中...',
            'common.success': '成功',
            'common.error': '错误',
            'common.confirm': '确认',
            'common.close': '关闭',
            'common.back': '返回',
            'common.next': '下一步',
            'common.previous': '上一步',
            'common.search': '搜索',
            'common.filter': '筛选',
            'common.export': '导出',
            'common.import': '导入',
            'common.enable': '启用',
            'common.disable': '禁用',
            'common.enabled': '已启用',
            'common.disabled': '已禁用',
            'common.actions': '操作',
            'common.status': '状态',
            'common.name': '名称',
            'common.value': '值',
            'common.createdAt': '创建时间',
            'common.updatedAt': '更新时间',

            // Dashboard
            'dashboard.title': '仪表板',
            'dashboard.overview': '概览',
            'dashboard.proxyStatus': '代理状态',
            'dashboard.activeRules': '活动规则',
            'dashboard.totalRequests': '总请求数',
            'dashboard.systemHealth': '系统健康',
            'dashboard.wsRules': 'WebSocket规则',
            'dashboard.certificates': '证书',
            'dashboard.proxyUsers': '代理用户',
            'dashboard.systemStatus': '系统状态',
            'dashboard.uptime': '运行时间',
            'dashboard.memoryUsed': '内存使用',
            'dashboard.configVersion': '配置版本',
            'dashboard.lastModified': '最后修改',
            'dashboard.quickActions': '快速操作',
            'dashboard.addHttpRule': '添加HTTP规则',
            'dashboard.addWsRule': '添加WebSocket规则',
            'dashboard.uploadCert': '上传证书',
            'dashboard.createBackup': '创建备份',

            // HTTP Rules
            'httpRules.title': 'HTTP代理规则',
            'httpRules.add': '添加HTTP规则',
            'httpRules.edit': '编辑HTTP规则',
            'httpRules.protocol': '协议',
            'httpRules.domain': '域名',
            'httpRules.path': '路径',
            'httpRules.targetHost': '目标主机',
            'httpRules.targetPort': '目标端口',
            'httpRules.pretendMode': '伪装模式',
            'httpRules.priority': '优先级',
            'httpRules.addRule': '添加规则',
            'httpRules.enabled': '已启用',
            'httpRules.target': '目标',
            'httpRules.actions': '操作',
            'httpRules.loading': '加载中...',

            // WebSocket Rules
            'wsRules.title': 'WebSocket代理规则',
            'wsRules.add': '添加WebSocket规则',
            'wsRules.edit': '编辑WebSocket规则',
            'wsRules.addRule': '添加规则',
            'wsRules.enabled': '已启用',
            'wsRules.target': '目标',
            'wsRules.actions': '操作',
            'wsRules.loading': '加载中...',

            // Certificates
            'certificates.title': 'SSL证书',
            'certificates.add': '添加证书',
            'certificates.domain': '域名',
            'certificates.certFile': '证书文件',
            'certificates.keyFile': '密钥文件',
            'certificates.upload': '上传证书',
            'certificates.expiresAt': '到期时间',
            'certificates.actions': '操作',
            'certificates.loading': '加载中...',

            // ACME
            'acme.title': 'ACME自动证书',
            'acme.domain': '域名',
            'acme.dnsProvider': 'DNS服务商',
            'acme.server': 'ACME服务URL',
            'acme.issue': '签发证书',

            // Auth
            'auth.changePassword': '修改密码',
            'auth.currentPassword': '当前密码',
            'auth.newPassword': '新密码',
            'auth.confirmPassword': '确认密码',

            // Users
            'users.title': '用户管理',
            'users.add': '添加用户',
            'users.edit': '编辑用户',
            'users.username': '用户名',
            'users.password': '密码',
            'users.role': '角色',
            'users.lastLogin': '最后登录',
            'users.proxyUsers': '代理用户',
            'users.addUser': '添加用户',
            'users.host': '主机',
            'users.passwordHash': '密码哈希',
            'users.actions': '操作',
            'users.loading': '加载中...',

            // Settings
            'settings.title': '系统设置',
            'settings.general': '通用设置',
            'settings.language': '语言',
            'settings.theme': '主题',
            'settings.maxSession': '最大会话数（0=无限制）',
            'settings.maxSessionHelp': '每个用户的最大并发会话数（0=无限制）',
            'settings.defaultUsername': '默认用户名',
            'settings.defaultPassword': '默认密码（MD5）',
            'settings.defaultPasswordHelp': '默认密码的MD5哈希',
            'settings.enableDefaultAuth': '启用默认认证',
            'settings.saveSettings': '保存设置',

            // Backups
            'backups.title': '配置备份',
            'backups.create': '创建备份',
            'backups.name': '名称',
            'backups.size': '大小',
            'backups.created': '创建时间',
            'backups.actions': '操作',
            'backups.loading': '加载中...',

            // Login
            'login.title': '代理管理登录',
            'login.username': '用户名',
            'login.password': '密码',
            'login.button': '登录',

            // Modals
            'modal.enabled': '已启用',
            'modal.protocol': '协议',
            'modal.domain': '域名（可选）',
            'modal.domainHelp': '留空以匹配所有域名',
            'modal.path': '路径',
            'modal.targetHost': '目标主机',
            'modal.targetPort': '目标端口',
            'modal.pretendMode': '伪装模式（重写主机头）',
            'modal.priority': '优先级',
            'modal.priorityHelp': '数字越小优先级越高',
            'modal.save': '保存',
            'modal.cancel': '取消',
            'modal.userHost': '主机',
            'modal.userHostHelp': '该用户可以访问的主机/域名',
            'modal.userUsername': '用户名',
            'modal.userPassword': '密码',

            // Notifications
            'notification.title': '通知'
        }
    },

    t(key) {
        return this.translations[this.currentLang][key] || this.translations['en'][key] || key;
    },

    getCurrentLanguage() {
        return this.currentLang;
    },

    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('language', lang);
            this.updatePageLanguage();
        }
    },

    toggleLanguage() {
        const newLang = this.currentLang === 'en' ? 'zh' : 'en';
        this.setLanguage(newLang);
    },

    updatePageLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                element.setAttribute('placeholder', translation);
            } else {
                element.textContent = translation;
            }
        });
        document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : 'en';
    },

    init() {
        this.updatePageLanguage();
    }
};

window.i18n = i18n;
