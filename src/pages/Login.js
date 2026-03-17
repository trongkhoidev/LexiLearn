/* ============================================
   LexiLearn — Login & Signup Component
   ============================================ */

import { signIn, signUp } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/helpers.js';

export function renderLogin(container) {
  // Hide sidebar/header globally
  document.body.classList.add('auth-view');
  
  let isSignup = false;

  const render = () => {
    container.innerHTML = `
      <div class="auth-container">
        <!-- Background Decorations -->
        <div class="auth-glow-1"></div>
        <div class="auth-glow-2"></div>

        <div class="auth-card animate-scale-in">
          <div class="auth-card-body">
            <div class="auth-header">
              <div class="auth-logo">L</div>
              <h1 class="auth-title">${isSignup ? 'Create Account' : 'Welcome Back'}</h1>
              <p class="auth-subtitle">${isSignup ? 'Join the LexiLearn community today.' : 'Please enter your details to sign in.'}</p>
            </div>

            <form id="auth-form" class="auth-form">
              ${isSignup ? `
                <div class="auth-input-group">
                  <label class="auth-label">Full Name</label>
                  <input type="text" id="auth-name" class="auth-input" placeholder="John Doe" required>
                </div>
              ` : ''}
              
              <div class="auth-input-group">
                <label class="auth-label">Email Address</label>
                <input type="email" id="auth-email" class="auth-input" placeholder="name@company.com" required>
              </div>

              <div class="auth-input-group">
                <label class="auth-label">Password</label>
                <div class="auth-input-wrapper">
                  <input type="password" id="auth-password" class="auth-input pr-12" placeholder="••••••••" required>
                  <button type="button" id="toggle-password" class="auth-toggle-pass">
                     <span>👁️</span>
                  </button>
                </div>
              </div>

              ${isSignup ? `
                <div class="auth-input-group">
                  <label class="auth-label">Account Role</label>
                  <select id="auth-role" class="auth-input">
                    <option value="student">Student — Learning English</option>
                    <option value="teacher">Teacher — Managing Classroom</option>
                  </select>
                </div>
              ` : ''}

              <div id="auth-error" class="auth-error hidden">
                <span>⚠️</span>
                <span id="error-text">Invalid login credentials</span>
              </div>

              <button type="submit" class="auth-submit-btn" id="auth-submit-btn">
                ${isSignup ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div class="auth-footer">
              <p>
                ${isSignup ? 'Already have an account?' : 'Don\'t have an account?'}
                <button type="button" class="auth-switch-btn" id="toggle-auth-mode">
                  ${isSignup ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </div>
          </div>

          <!-- Demo Selector -->
          ${!isSignup ? `
            <div class="demo-section">
              <span class="demo-label">Quick Access Demo</span>
              <div class="demo-chips">
                <button class="demo-chip" data-email="lexilearn.admin@gmail.com" data-pass="Admin123!">
                  <div class="demo-icon teacher">T</div>
                  <div class="demo-info">
                    <div class="demo-name">Teacher Dashboard</div>
                    <div class="demo-email">lexilearn.admin@gmail.com</div>
                  </div>
                </button>
                <button class="demo-chip" data-email="lexilearn.student@gmail.com" data-pass="Student123!">
                  <div class="demo-icon student">S</div>
                  <div class="demo-info">
                    <div class="demo-name">Student Profile</div>
                    <div class="demo-email">lexilearn.student@gmail.com</div>
                  </div>
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    setupEvents();
  };

  const setupEvents = () => {
    const form = container.querySelector('#auth-form');
    const submitBtn = container.querySelector('#auth-submit-btn');
    const errorEl = container.querySelector('#auth-error');
    const errorText = container.querySelector('#error-text');
    const toggleModeBtn = container.querySelector('#toggle-auth-mode');
    const togglePassBtn = container.querySelector('#toggle-password');
    const passInput = container.querySelector('#auth-password');

    // Toggle Password Visibility
    togglePassBtn?.addEventListener('click', () => {
      const type = passInput.type === 'password' ? 'text' : 'password';
      passInput.type = type;
      togglePassBtn.innerHTML = `<span>${type === 'password' ? '👁️' : '🔒'}</span>`;
    });

    // Toggle Mode (Login/Signup)
    toggleModeBtn?.addEventListener('click', () => {
      isSignup = !isSignup;
      render();
    });

    // Demo Chips
    container.querySelectorAll('.demo-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelector('#auth-email').value = chip.dataset.email;
        container.querySelector('#auth-password').value = chip.dataset.pass;
        // Optionally auto-submit
        form.requestSubmit();
      });
    });

    // Handle Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = container.querySelector('#auth-email').value.trim();
      const password = container.querySelector('#auth-password').value.trim();
      
      errorEl.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner-sm"></div>';

      try {
        if (isSignup) {
          const fullName = container.querySelector('#auth-name').value.trim();
          const role = container.querySelector('#auth-role').value;
          const result = await signUp(email, password, fullName, role);
          // After signup, inform user accordingly
          isSignup = false;
          render();
          if (result.pendingConfirmation) {
            errorText.textContent = "Account created! Please check your email to confirm, then sign in.";
          } else {
            errorText.textContent = "Account created! Please sign in.";
          }
          errorEl.classList.remove('hidden');
          errorEl.style.background = '#f0fdf4';
          errorEl.style.borderColor = '#dcfce7';
          errorEl.style.color = '#16a34a';
        } else {
          await signIn(email, password);
          document.body.classList.remove('auth-view');
          window.location.reload();
        }
      } catch (err) {
        errorText.textContent = err.message || 'Authentication failed';
        errorEl.classList.remove('hidden');
        errorEl.style.background = '#fef2f2';
        errorEl.style.borderColor = '#fee2e2';
        errorEl.style.color = '#dc2626';
        submitBtn.disabled = false;
        submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
      }
    });
  };

  render();
}
