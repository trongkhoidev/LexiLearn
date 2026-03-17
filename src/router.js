import { getCurrentUser } from './utils/supabase.js';
import { showToast } from './components/Toast.js';

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler, options = {}) {
  routes[path] = { handler, options };
}

export function navigateTo(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/dashboard';
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

    const user = getCurrentUser();

    // Global auth guard: redirect unauthenticated users to dashboard
    // (Dashboard handles login rendering internally)
    if (!user && hash !== '/dashboard') {
      navigateTo('/dashboard');
      return;
    }

    // Check match
    let matchFound = false;
    let targetRoute = null;
    let targetParams = {};

    // Try exact match
    if (routes[hash]) {
      targetRoute = routes[hash];
      matchFound = true;
    } else {
      // Try pattern match
      for (const [pattern, config] of Object.entries(routes)) {
        const regex = patternToRegex(pattern);
        const match = hash.match(regex);
        if (match) {
          targetRoute = config;
          targetParams = extractParams(pattern, match);
          matchFound = true;
          break;
        }
      }
    }

    // Role check
    if (targetRoute) {
      const requiredRole = targetRoute.options.role;
      if (requiredRole && (!user || user.role !== requiredRole)) {
        showToast(`Access Denied: ${requiredRole} only`, 'error');
        navigateTo('/dashboard');
        return;
      }
      currentCleanup = targetRoute.handler(main, targetParams);
      updateActiveNav(hash);
    } else {
      // Fallback
      if (routes['/dashboard']) {
        currentCleanup = routes['/dashboard'].handler(main);
        updateActiveNav('/dashboard');
      }
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
