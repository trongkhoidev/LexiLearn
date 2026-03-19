/* ============================================
   LexiLearn — Auth Utility
   ============================================
   Manages user authentication and session.
*/

import { supabaseFetch, supabaseSave, SUPABASE_URL, SUPABASE_KEY } from './db.js';
import { setCookie, getCookie, eraseCookie } from '../utils/helpers.js';

/**
 * Get current logged in user
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('lexilearn_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Get current token
 */
export function getSession() {
  return getCookie('lexilearn_token');
}

/**
 * Sign in user
 */
export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || 'Login failed');

  const userId = data.user.id;
  const token = data.access_token;
  
  setCookie('lexilearn_token', token, 7);

  try {
    const profiles = await supabaseFetch('profiles', { filters: { id: userId } });
    let profile = profiles[0];
    
    // Lazy Profile Creation
    if (!profile) {
      const metadata = data.user.user_metadata || {};
      if (metadata.full_name || metadata.role) {
        profile = {
          id: userId,
          full_name: metadata.full_name || 'User',
          email: email,
          role: metadata.role || 'student',
          created_at: new Date().toISOString()
        };
        await supabaseSave('profiles', profile);
      } else {
        throw new Error('Profile not found. Please contact admin.');
      }
    }

    const userData = {
      id: userId,
      email: data.user.email,
      ...profile
    };

    localStorage.setItem('lexilearn_user', JSON.stringify(userData));
    localStorage.setItem('lexilearn_session', JSON.stringify(data));
    
    return userData;
  } catch (err) {
    eraseCookie('lexilearn_token');
    throw err;
  }
}

/**
 * Sign up user
 */
export async function signUp(email, password, fullName, role = 'student') {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      email, 
      password,
      data: { full_name: fullName, role: role }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.message || 'Sign up failed');

  if (data.confirmation_sent_at && !data.email_confirmed_at) {
    return { ...data, pendingConfirmation: true };
  }

  return data;
}

/**
 * Sign out user
 */
export async function signOut() {
  const token = getSession();
  if (token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {}
  }
  localStorage.removeItem('lexilearn_user');
  localStorage.removeItem('lexilearn_session');
  eraseCookie('lexilearn_token');
}
