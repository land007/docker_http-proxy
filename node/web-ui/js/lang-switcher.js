/**
 * 语言切换器组件
 * Language Switcher Component
 */

class LanguageSwitcher {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 'en';
        this.init();
    }

    init() {
        this.addLanguageButton();
        this.addI18nScript();
        this.updateDisplay();
        this.attachEventListeners();
    }

    addLanguageButton() {
        const navbar = document.querySelector('.navbar-collapse');
        if (!navbar) return;

        const langButton = document.createElement('li');
        langButton.className = 'nav-item';
        langButton.innerHTML = `
            <a class="nav-link" href="#" id="langToggle">
                <i class="bi bi-globe"></i>
                <span id="currentLangText">EN</span>
            </a>
        `;

        const navList = navbar.querySelector('.navbar-nav');
        if (navList) {
            navList.appendChild(langButton);
        }
    }

    addI18nScript() {
        if (document.getElementById('i18n-script')) return;

        const script = document.createElement('script');
        script.id = 'i18n-script';
        script.src = 'js/i18n.js';
        document.head.appendChild(script);
    }

    attachEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            const langToggle = document.getElementById('langToggle');
            if (langToggle) {
                langToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleLanguage();
                });
            }
        });
    }

    toggleLanguage() {
        this.currentLang = this.currentLang === 'en' ? 'zh' : 'en';
        localStorage.setItem('language', this.currentLang);
        
        if (window.i18n) {
            window.i18n.setLanguage(this.currentLang);
        }
        
        this.updateDisplay();
    }

    updateDisplay() {
        const currentLangText = document.getElementById('currentLangText');
        if (currentLangText) {
            currentLangText.textContent = this.currentLang === 'zh' ? '中文' : 'EN';
        }

        // 更新所有带有 data-i18n 属性的元素
        if (window.i18n) {
            window.i18n.updatePageLanguage();
        }
    }
}

// 创建全局实例
window.langSwitcher = new LanguageSwitcher();
