# Proxy Admin Web UI

The active admin UI is served from `index.html` and uses React 18 with Babel standalone. There is no frontend build step.

## Files

- `index.html` - loads the React admin application.
- `login.html` - admin login page.
- `js/i18n-design.jsx` - bilingual dictionary and resolver.
- `js/ui.jsx` - shared layout, navigation, and UI primitives.
- `js/pages-rules.jsx` - unified proxy management page and rule modal components.
- `js/pages-config.jsx` - certificate, settings, and backup pages.
- `js/app-real.jsx` - application state, API calls, routing, and page wiring.
- `css/tokens.css` and `css/app-design.css` - visual system and layout styles.

Proxy client authentication accounts are now edited inside each proxy entry and stored on rule `users` fields in `proxy-config.json`.
