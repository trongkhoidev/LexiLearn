/* ============================================
   LexiLearn — Main Entry Point
   ============================================ */

import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';

import { registerRoute, startRouter } from './router.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderDashboard } from './pages/Dashboard.js';
import { renderDeckList } from './pages/DeckList.js';
import { renderDeckDetail } from './pages/DeckDetail.js';
import { renderStudy } from './pages/Study.js';
import { renderSearch } from './pages/Search.js';
import { renderReadingPractice } from './pages/ReadingPractice.js';
import { renderCambridgeTest } from './pages/CambridgeTest.js';
import { renderTestPlayer } from './pages/TestPlayer.js';

// Register routes
registerRoute('/dashboard', (main) => { renderDashboard(main); });
registerRoute('/decks', (main) => { renderDeckList(main); });
registerRoute('/deck/:slug', (main, params) => { renderDeckDetail(main, params); });
registerRoute('/study/:slug', (main, params) => { renderStudy(main, params); });
registerRoute('/search', (main) => { renderSearch(main); });
registerRoute('/reading', (main) => { renderReadingPractice(main); });
registerRoute('/cambridge', (main) => { renderCambridgeTest(main); });
registerRoute('/test/:id', (main, params) => { renderTestPlayer(main, params); });

// Re-render sidebar on route change to update active states and counts
window.addEventListener('hashchange', () => {
  renderSidebar();
});

// Initial render
renderSidebar();
startRouter();

// If no hash, go to dashboard
if (!window.location.hash) {
  window.location.hash = '/dashboard';
}
