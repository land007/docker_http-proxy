# HTTP 代理管理界面 - 国际化版本
# HTTP Proxy Admin Interface - Internationalized Version

## 🌐 中英文双语支持 / Chinese-English Bilingual Support

本管理界面现已支持中英文双语切换！

This admin interface now supports Chinese-English language switching!

### 🚀 快速使用 / Quick Start

#### 访问管理界面 / Access Admin Interface

1. **使用新登录页面** / Use new login page:
   ```
   http://your-host:8444/admin/login-i18n.html
   ```

2. **使用默认凭据登录** / Login with default credentials:
   - 用户名 / Username: `admin`
   - 密码 / Password: `Msa@1234567`

3. **切换语言** / Toggle Language:
   - 点击右上角的地球图标 🌐
   - Click the globe icon 🌐 in the top-right corner

### 📁 新增文件 / New Files

- `js/i18n.js` - 国际化配置 / Internationalization configuration
- `js/lang-switcher.js` - 语言切换器组件 / Language switcher component
- `login-i18n.html` - 国际化登录页面 / Internationalized login page
- `I18N_GUIDE.md` - 详细使用指南 / Detailed usage guide
- `js/integrate-i18n.js` - 集成辅助脚本 / Integration helper script

### 🎯 功能特性 / Features

✅ **双语界面** / Bilingual Interface
- 支持简体中文和英文 / Supports Simplified Chinese and English
- 一键切换语言 / One-click language switching
- 自动保存语言偏好 / Auto-save language preference

✅ **响应式设计** / Responsive Design
- 移动设备优化 / Mobile device optimized
- 平板和桌面完美支持 / Perfect tablet and desktop support

✅ **用户友好** / User Friendly
- 直观的语言切换按钮 / Intuitive language toggle button
- 流畅的切换动画 / Smooth transition animations

### 🔧 集成到现有页面 / Integration to Existing Pages

如果您想将国际化功能添加到现有的 index.html 页面：

If you want to add i18n functionality to existing index.html page:

#### 方法 1: 使用集成脚本 / Method 1: Use Integration Script

在 `index.html` 的 `<head>` 中添加：

In the `<head>` of `index.html`, add:

```html
<script src="js/i18n.js"></script>
<script src="js/lang-switcher.js"></script>
```

#### 方法 2: 手动添加 / Method 2: Manual Addition

为需要翻译的文本添加 `data-i18n` 属性：

Add `data-i18n` attribute to translatable text:

```html
<!-- 英文 / English -->
<h2 data-i18n="login.title">Admin Login</h2>

<!-- 中文 / Chinese -->
<h2 data-i18n="login.title">代理管理登录</h2>
```

### 📖 使用示例 / Usage Examples

#### 在 HTML 中 / In HTML

```html
<button data-i18n="common.save">保存</button>
<span data-i18n="nav.dashboard">仪表板</span>
```

#### 在 JavaScript 中 / In JavaScript

```javascript
// 获取翻译文本 / Get translated text
const saveText = i18n.t('common.save'); // 返回 "保存" or "Save"

// 切换语言 / Switch language
i18n.setLanguage('zh'); // 切换到中文 / Switch to Chinese
i18n.setLanguage('en'); // Switch to English

// 获取当前语言 / Get current language
const currentLang = i18n.getCurrentLanguage();
```

### 🎨 自定义翻译 / Custom Translations

要添加新的翻译，编辑 `js/i18n.js`：

To add new translations, edit `js/i18n.js`:

```javascript
translations: {
    en: {
        'your.key': 'Your English text'
    },
    zh: {
        'your.key': '你的中文文本'
    }
}
```

### 💡 提示 / Tips

1. **语言偏好自动保存** / Language preference auto-saved
   - 系统会记住您的语言选择
   - System remembers your language choice

2. **所有翻译文本集中管理** / All translations centrally managed
   - 位于 `js/i18n.js` 文件中
   - Located in `js/i18n.js` file

3. **扩展容易** / Easy to extend
   - 只需添加新的翻译键值对
   - Just add new translation key-value pairs

### 🆘 获取帮助 / Get Help

详细的使用指南和 API 文档，请参阅：

For detailed usage guide and API documentation, please refer to:

📖 **[I18N_GUIDE.md](I18N_GUIDE.md)** - 完整国际化指南 / Complete i18n Guide

### 🔄 更新日志 / Changelog

**v1.0.0** (2025-03-07)
- ✨ 添加中英文双语支持 / Added Chinese-English bilingual support
- 🎨 全新的语言切换界面 / Brand new language switcher UI
- 📱 优化移动端体验 / Optimized mobile experience
- 📚 完整的使用文档 / Complete documentation

---

**需要帮助？/ Need Help?**

查看详细文档：Check detailed documentation: `I18N_GUIDE.md`

报告问题：Report issues: 在项目 GitHub 仓库提交 issue / Submit issue at project GitHub repository
