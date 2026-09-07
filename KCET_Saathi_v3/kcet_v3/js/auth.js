/* KCET Saathi - Supabase Auth */

const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
let supabaseClient = null;

function authConfigReady() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
}

function initAuth() {
  if (!authConfigReady()) return;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseClient.auth.onAuthStateChange((_event, session) => updateAuthUI(session));
  supabaseClient.auth.getSession().then(({ data }) => updateAuthUI(data.session));
}

async function registerUser(email, password) {
  if (!supabaseClient) throw new Error('Supabase Auth is not configured.');
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function loginUser(email, password) {
  if (!supabaseClient) throw new Error('Supabase Auth is not configured.');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function logoutUser() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getAccessToken() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
}

function updateAuthUI(session) {
  const auth = document.getElementById('authScreen');
  const app = document.getElementById('appContent');
  const userEmail = document.getElementById('userEmail');
  if (!auth || !app) return;
  auth.style.display = session ? 'none' : 'flex';
  app.style.display = session ? '' : 'none';
  if (userEmail) userEmail.textContent = session?.user?.email || '';
}

function showAuthMessage(message, isError = false) {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `auth-message ${isError ? 'error' : 'success'}`;
}

window.Auth = { initAuth, registerUser, loginUser, logoutUser, getAccessToken, showAuthMessage };
document.addEventListener('DOMContentLoaded', initAuth);
