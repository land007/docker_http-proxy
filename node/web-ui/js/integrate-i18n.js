/**
 * 国际化快速集成脚本
 * Quick Integration Script for i18n
 */

// 在现有页面中集成国际化的步骤
const integrationSteps = {
    1: "在 </head> 前添加国际化脚本引用",
    2: "在导航栏中添加语言切换按钮",
    3: "在需要翻译的元素上添加 data-i18n 属性",
    4: "测试语言切换功能"
};

// 自动集成函数
function integrateI18nToPage() {
    console.log('开始集成国际化功能... / Starting i18n integration...');
    
    // 1. 添加国际化脚本
    const i18nScript = document.createElement('script');
    i18nScript.src = 'js/i18n.js';
    document.head.appendChild(i18nScript);
    
    // 2. 添加语言切换器脚本
    const langSwitcherScript = document.createElement('script');
    langSwitcherScript.src = 'js/lang-switcher.js';
    document.head.appendChild(langSwitcherScript);
    
    console.log('国际化功能已集成！/ i18n integration complete!');
    
    return true;
}

// 示例：为导航项添加翻译键
const translationExamples = {
    navigation: {
        'Dashboard': 'nav.dashboard',
        'HTTP Rules': 'nav.httpRules',
        'WebSocket Rules': 'nav.wsRules',
        'Certificates': 'nav.certificates',
        'Users': 'nav.users',
        'Settings': 'nav.settings',
        'Logout': 'nav.logout'
    },
    common: {
        'Save': 'common.save',
        'Cancel': 'common.cancel',
        'Delete': 'common.delete',
        'Edit': 'common.edit',
        'Add': 'common.add',
        'Loading': 'common.loading'
    }
};

// 批量添加 data-i18n 属性的辅助函数
function addI18nAttributes() {
    // 为导航链接添加翻译
    document.querySelectorAll('.nav-link').forEach(link => {
        const text = link.textContent.trim();
        if (translationExamples.navigation[text]) {
            link.setAttribute('data-i18n', translationExamples.navigation[text]);
        }
    });
    
    // 为按钮添加翻译
    document.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent.trim();
        if (translationExamples.common[text]) {
            btn.setAttribute('data-i18n', translationExamples.common[text]);
        }
    });
    
    console.log('data-i18n 属性已添加！/ data-i18n attributes added!');
}

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        integrateI18nToPage();
        addI18nAttributes();
    });
} else {
    integrateI18nToPage();
    addI18nAttributes();
}

// 导出到全局
window.i18nIntegration = {
    integrate: integrateI18nToPage,
    addAttributes: addI18nAttributes,
    examples: translationExamples
};
