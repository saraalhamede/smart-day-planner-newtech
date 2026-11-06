import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { authApi as api } from './api.js';
import TasksPage from './tasks/TasksPage.jsx';
import DailyPlanner from './planner/DailyPlanner.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [workspace, setWorkspace] = useState('planner');

  async function restore() {
    setLoading(true); setError('');
    try { setUser((await api('me')).user); }
    catch (failure) { if (failure.status !== 401) setError(failure.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { restore(); }, []);

  function changePage(next) { setPage(next); setError(''); setNotice(''); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (page === 'register') {
        await api('register', fields);
        setEmail(fields.email); setPage('login');
        setNotice('Account created. Sign in to continue.');
      } else { setUser((await api('login', fields)).user); setWorkspace('planner'); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await api('logout', {}); setUser(null); setNotice('You have signed out.'); setPage('login'); }
    catch (failure) { if (failure.status === 401) setUser(null); else setError(failure.message); }
    finally { setBusy(false); }
  }

  const WorkspacePage = workspace === 'planner' ? DailyPlanner : TasksPage;
  return (
    <div className="app-shell">
      <header className="site-header"><a className="brand" href="/" aria-label="Smart Day Planner home"><span className="brand-icon" aria-hidden="true">✓</span><span>Smart Day <strong>Planner</strong></span></a><span className="project-tag">NEWTECH · GRADUATION PROJECT</span></header>
      {user ? <>
        <nav className="workspace-nav" aria-label="Planner navigation">
          <button type="button" aria-current={workspace === 'planner' ? 'page' : undefined} disabled={busy} onClick={() => setWorkspace('planner')}>Daily Planner</button>
          <button type="button" aria-current={workspace === 'tasks' ? 'page' : undefined} disabled={busy} onClick={() => setWorkspace('tasks')}>Tasks</button>
        </nav>
        <WorkspacePage user={user} onLogout={logout} signingOut={busy} authError={error} onSessionExpired={() => { setUser(null); setNotice('Your session expired. Please sign in again.'); setPage('login'); }} />
      </> : <main className="auth-layout">
        <section className="intro" aria-labelledby="intro-title">
          <p className="eyebrow">A LITTLE SPACE FOR YOUR DAY</p>
          <h1 id="intro-title">A fresh start.<br /><span>A day of your own.</span></h1>
          <p className="intro-copy">Your personal planning space starts with an account. Welcome to Smart Day Planner.</p>
          <div className="day-art" aria-hidden="true"><div className="sun" /><div className="horizon" /><span className="art-label">ONE DAY AT A TIME</span></div>
          <p className="intro-footnote">Simple beginnings. Thoughtful days.</p>
        </section>
        <section className="auth-card" aria-labelledby="form-title">
          <p className="eyebrow">YOUR PERSONAL SPACE</p>
          {loading ? <div role="status" className="loading">Checking your session…</div> : <>
            <h2 id="form-title">{page === 'login' ? 'Welcome back.' : 'Make yourself at home.'}</h2>
            <p className="muted">{page === 'login' ? 'Sign in to your personal space.' : 'Create your Smart Day Planner account.'}</p>
            <div className="auth-switch" aria-label="Account options"><button type="button" aria-pressed={page === 'login'} onClick={() => changePage('login')} disabled={busy}>Sign in</button><button type="button" aria-pressed={page === 'register'} onClick={() => changePage('register')} disabled={busy}>Create account</button></div>
            {error && <p role="alert" className="message error">{error}</p>}
            {notice && <p role="status" className="message success">{notice}</p>}
            <form onSubmit={submit} key={page}>
              <fieldset disabled={busy}>
                {page === 'register' && <label>Full name<input name="name" type="text" autoComplete="name" placeholder="Your name" required maxLength={100} /></label>}
                <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} defaultValue={email} /></label>
                <label>Password<input name="password" type="password" autoComplete={page === 'register' ? 'new-password' : 'current-password'} placeholder={page === 'register' ? 'At least 12 characters' : 'Enter your password'} required minLength={page === 'register' ? 12 : 1} maxLength={128} aria-describedby={page === 'register' ? 'password-hint' : undefined} /></label>
                {page === 'register' && <p id="password-hint" className="field-hint">Use 12–128 characters. A longer, unique passphrase works well.</p>}
                <button className="primary" type="submit">{busy ? 'Please wait…' : page === 'login' ? 'Sign in' : 'Create account'}<span aria-hidden="true"> →</span></button>
              </fieldset>
            </form>
            <p className="card-note">Your account. Your personal space.</p>
          </>}
        </section>
      </main>}
      <footer>Smart Day Planner <span>Built for a simpler day.</span></footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
