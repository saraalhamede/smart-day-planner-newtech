import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

async function api(path, body) {
  let response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new Error('Cannot reach the server. Please try again.'); }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'The server is unavailable. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');

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
      } else { setUser((await api('login', fields)).user); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await api('logout', {}); setUser(null); setNotice('You have signed out.'); setPage('login'); }
    catch (failure) { if (failure.status === 401) setUser(null); else setError(failure.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="app-shell">
      <header className="site-header"><a className="brand" href="/" aria-label="Smart Day Planner home"><span className="brand-icon" aria-hidden="true">✓</span><span>Smart Day <strong>Planner</strong></span></a><span className="project-tag">NEWTECH · GRADUATION PROJECT</span></header>
      <main className="auth-layout">
        <section className="intro" aria-labelledby="intro-title">
          <p className="eyebrow">A LITTLE SPACE FOR YOUR DAY</p>
          <h1 id="intro-title">A fresh start.<br /><span>A day of your own.</span></h1>
          <p className="intro-copy">Your personal planning space starts with an account. Welcome to Smart Day Planner.</p>
          <div className="day-art" aria-hidden="true"><div className="sun" /><div className="horizon" /><span className="art-label">ONE DAY AT A TIME</span></div>
          <p className="intro-footnote">Simple beginnings. Thoughtful days.</p>
        </section>
        <section className="auth-card" aria-labelledby="form-title">
          <p className="eyebrow">YOUR PERSONAL SPACE</p>
          {loading ? <div role="status" className="loading">Checking your session…</div> : user ? <>
            <span className="account-mark" aria-hidden="true">✓</span>
            <h2 id="form-title">Welcome, {user.name}.</h2>
            <p className="muted">You are signed in to your account.</p>
            <dl className="account-details"><dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd></dl>
            {error && <p role="alert" className="message error">{error}</p>}
            <button className="primary" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button>
          </> : <>
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
      </main>
      <footer>Smart Day Planner <span>Built for a simpler day.</span></footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
