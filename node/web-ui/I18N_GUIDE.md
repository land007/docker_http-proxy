# 国际化使用指南 / Internationalization Guide

## 🌐 中英文国际化支持 / Chinese-English Internationalization

### 📦 文件清单 / File List

1. **js/i18n.js** - 国际化核心配置文件
2. **js/lang-switcher.js** - 语言切换器组件
3. **login-i18n.html** - 支持国际化的登录页面
4. **css/custom.css** - 已添加国际化样式

### 🚀 快速开始 / Quick Start

#### 1. 在 HTML 中使用国际化 / Use i18n in HTML

在需要翻译的元素上添加 `data-i18n` 属性：

```html
<!-- 英文 / English -->
<h2 data-i18n="login.title">Admin Login</h2>
<button data-i18n="common.save">Save</button>

<!-- 中文 / Chinese -->
<h2 data-i18n="login.title">代理管理登录</h2>
<button data-i18n="common.save">保存</button>
```

#### 2. 在 JavaScript 中使用 / Use in JavaScript

```javascript
// 获取翻译文本 / Get translated text
const title = i18n.t('login.title');
const saveBtn = i18n.t('common.save');

// 切换语言 / Toggle language
i18n.setLanguage('zh'); // 切换到中文 / Switch to Chinese
i18n.setLanguage('en'); // Switch to English
```

### 📋 可用的翻译键 / Available Translation Keys

#### 导航栏 / Navigation
- `nav.dashboard` - 仪表板 / Dashboard
- `nav.httpRules` - HTTP规则 / HTTP Rules
- `nav.wsRules` - WebSocket规则 / WebSocket Rules
- `nav.certificates` - 证书管理 / Certificates
- `nav.users` - 用户管理 / Users
- `nav.settings` - 系统设置 / Settings
- `nav.logout` - 退出登录 / Logout

#### 通用操作 / Common Actions
- `common.save` - 保存 / Save
- `common.cancel` - 取消 / Cancel
- `common.delete` - 删除 / Delete
- `common.edit` - 编辑 / Edit
- `common.add` - 添加 / Add
- `common.loading` - 加载中... / Loading...

#### 登录页面 / Login Page
- `login.title` - 代理管理登录 / Proxy Admin Login
- `login.username` - 用户名 / Username
- `login.password` - 密码 / Password
- `login.remember` - 记住我 / Remember me
- `login.button` - 登录 / Login

### 🔧 集成到现有页面 / Integration to Existing Pages

#### 方法 1: 在主页面中添加语言切换器

在 `index.html` 的 `<head>` 中添加：

```html
<script src="js/i18n.js"></script>
<script src="js/lang-switcher.js"></script>
```

#### 方法 2: 手动添加语言按钮

在导航栏中添加：

```html
<li class="nav-item">
    <a class="nav-link" href="#" onclick="i18n.toggleLanguage()">
        <i class="bi bi-globe"></i>
        <span id="currentLang">EN</span>
    </a>
</li>
```

### 🎨 自定义样式 / Custom Styling

语言切换器已自动添加到 `.navbar-collapse` 中，样式已包含在 `css/custom.css` 中。

如需自定义，可以修改这些CSS类：

```css
#langToggle { /* 语言按钮样式 */ }
#currentLangText { /* 当前语言文本样式 */ }
.lang-switch { /* 切换动画 */ }
```

### 💡 最佳实践 / Best Practices

1. **始终提供默认文本** / Always provide default text
   ```html
   <button data-i18n="common.save">Save</button>
   ```

2. **使用一致的键名** / Use consistent key names
   - 使用点号分隔: `category.key`
   - 示例: `common.save`, `nav.dashboard`

3. **添加新翻译** / Adding new translations

   编辑 `js/i18n.js`：

   ```javascript
   translations: {
       en: {
           'your.new.key': 'Your English text'
       },
       zh: {
           'your.new.key': '你的中文文本'
       }
   }
   ```

4. **测试国际化** / Test internationalization

   ```javascript
   // 在浏览器控制台中测试
   i18n.setLanguage('en'); // 切换到英文
   i18n.setLanguage('zh'); // 切换到中文
   console.log(i18n.t('common.save')); // 查看翻译结果
   ```

### 🌍 支持的语言 / Supported Languages

- **en** - English (英语)
- **zh** - 简体中文 (Simplified Chinese)

### 📱 响应式设计 / Responsive Design

语言切换器在移动设备和桌面上都能正常工作，并已针对小屏幕进行优化。

### 🔍 故障排除 / Troubleshooting

#### 问题 1: 翻译不显示
**解决方案**: 确保 `data-i18n` 属性值在翻译配置中存在

#### 问题 2: 语言切换无效
**解决方案**: 检查浏览器控制台是否有JavaScript错误，确保 i18n.js 已加载

#### 问题 3: 样式异常
**解决方案**: 清除浏览器缓存或强制刷新 (Ctrl+F5)

### 📚 更多资源 / More Resources

- [Bootstrap 国际化](https://getbootstrap.com/docs/5.3/getting-started/)
- [JavaScript 国际化最佳实践](https://www.w3.org/International/)
