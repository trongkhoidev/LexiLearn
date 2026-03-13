/* ============================================
   LexiLearn — Hash-Based SPA Router
   ============================================ */

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigateTo(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/dashboard';
}

export function getRouteParams() {
  const hash = getCurrentRoute();
  const parts = hash.split('/').filter(Boolean);
  return parts;
}

export function startRouter() {
  const handleRoute = () => {
    // Cleanup previous page
    if (currentCleanup && typeof currentCleanup === 'function') {
      currentCleanup();
      currentCleanup = null;
    }

    const hash = getCurrentRoute();
    const main = document.getElementById('main-content');
    if (!main) return;

    // Try exact match first
    if (routes[hash]) {
      currentCleanup = routes[hash](main);
      updateActiveNav(hash);
      return;
    }

    // Try pattern match (e.g. /deck/:id)
    for (const [pattern, handler] of Object.entries(routes)) {
      const regex = patternToRegex(pattern);
      const match = hash.match(regex);
      if (match) {
        const params = extractParams(pattern, match);
        currentCleanup = handler(main, params);
        updateActiveNav(pattern);
        return;
      }
    }

    // Fallback to dashboard
    if (routes['/dashboard']) {
      currentCleanup = routes['/dashboard'](main);
      updateActiveNav('/dashboard');
    }
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function patternToRegex(pattern) {
  const regexStr = pattern.replace(/:[a-zA-Z]+/g, '([^/]+)');
  return new RegExp('^' + regexStr + '$');
}

function extractParams(pattern, match) {
  const keys = [...pattern.matchAll(/:([a-zA-Z]+)/g)].map(m => m[1]);
  const params = {};
  keys.forEach((key, i) => {
    params[key] = match[i + 1];
  });
  return params;
}

function updateActiveNav(route) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('data-route');
    if (href === route || (href && route.startsWith(href) && href !== '/dashboard')) {
      link.classList.add('active');
    } else if (href === '/dashboard' && route === '/dashboard') {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
