/* ============================================
   LexiLearn — Main Entry Point
   ============================================ */

import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/auth.css';
import './styles/dashboard.css';
import './styles/cambridge.css';

import { registerRoute, startRouter } from './router.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderDashboard } from './pages/dashboard/DashboardPage.js';
import { renderDeckList } from './pages/DeckList.js';
import { renderDeckDetail } from './pages/DeckDetail.js';
import { renderStudy } from './pages/study/StudyPage.js';
import { renderSearch } from './pages/Search.js';
import { renderReadingPractice } from './pages/ReadingPractice.js';
import { renderCambridgeTest } from './pages/CambridgeTest.js';
import { renderTestPlayer } from './pages/TestPlayer.js';
import { renderClassrooms } from './pages/Classrooms.js';
import { renderClassroomDetail } from './pages/ClassroomDetail.js';
import { renderNewClassroom } from './pages/NewClassroom.js';
import { renderMaterialsManager } from './pages/MaterialsManager.js';
import { renderAssignmentDetail } from './pages/AssignmentDetail.js';
import { renderStudentAssignments } from './pages/StudentAssignments.js';
import { renderPersonalDesk } from './pages/PersonalDesk.js';
import { renderGradingHub } from './pages/GradingHub.js';
import { renderStats } from './pages/Stats.js';
import { renderSettings } from './pages/Settings.js';

// Register routes
registerRoute('/dashboard', (main) => { renderDashboard(main); });
registerRoute('/decks', (main) => { renderDeckList(main); });
registerRoute('/deck/:slug', (main, params) => { renderDeckDetail(main, params); });
registerRoute('/study/:slug', (main, params) => { renderStudy(main, params); });
registerRoute('/search', (main) => { renderSearch(main); });
registerRoute('/reading', (main) => { renderReadingPractice(main); });
registerRoute('/cambridge', (main) => { renderCambridgeTest(main); });
registerRoute('/test/:id', (main, params) => { renderTestPlayer(main, params); });

// Teacher-only routes
registerRoute('/classes', (main) => { renderClassrooms(main); }, { role: 'teacher' });
registerRoute('/classes/new', (main) => { renderNewClassroom(main); }, { role: 'teacher' });
registerRoute('/class/:id', (main, params) => { renderClassroomDetail(main, params); }, { role: 'teacher' });
registerRoute('/materials', (main) => { renderMaterialsManager(main); }, { role: 'teacher' });
registerRoute('/grading-hub', (main) => { renderGradingHub(main); }, { role: 'teacher' });

// Student-only routes
registerRoute('/my-assignments', (main) => { renderStudentAssignments(main); }, { role: 'student' });
registerRoute('/personal-desk', (main) => { renderPersonalDesk(main); }, { role: 'student' });

registerRoute('/assignment/:id', (main, params) => { renderAssignmentDetail(main, params); });
registerRoute('/stats', (main) => { renderStats(main); });
registerRoute('/settings', (main) => { renderSettings(main); });

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
