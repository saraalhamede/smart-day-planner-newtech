import { useEffect, useRef, useState } from 'react';
import { request } from '../api.js';
import { initials } from './settings-model.js';
import ProfileForm from './ProfileForm.jsx';
import EmailForm from './EmailForm.jsx';
import PasswordForm from './PasswordForm.jsx';
import './settings.css';

export default function SettingsPage({ user, onUserChange, onAccountBusy, onPasswordChanged, onSessionExpired, onLogout, signingOut, authError }) {
  const [pending, setPending] = useState('');
  const [feedback, setFeedback] = useState({});
  const lock = useRef(false);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  async function save(section, body) {
    if (lock.current) return false;
    lock.current = true; setPending(section); onAccountBusy(true);
    setFeedback(current => ({ ...current, [section]: {} }));
    try {
      const result = await request(`account/${section}`, { method: section === 'password' ? 'POST' : 'PATCH', body });
      if (result?.user) onUserChange(result.user);
      if (section !== 'password') setFeedback(current => ({ ...current, [section]: { success: section === 'profile' ? 'Your name has been updated.' : 'Your email has been updated. Use it the next time you sign in.' } }));
      return true;
    } catch (failure) {
      if (failure.status === 401 && failure.code !== 'INVALID_CURRENT_PASSWORD') onSessionExpired();
      else setFeedback(current => ({ ...current, [section]: { error: failure.message } }));
      return false;
    } finally { lock.current = false; setPending(''); onAccountBusy(false); }
  }
  const props = section => ({ user, busy: Boolean(pending) || signingOut, saving: pending === section, feedback: feedback[section] || {}, onSave: body => save(section, body), onReset: () => setFeedback(current => ({ ...current, [section]: {} })) });
  return <main className="settings-page" aria-busy={Boolean(pending)}>
    <div className="tasks-heading"><div><p className="eyebrow">YOUR PERSONAL SPACE</p><h1 ref={heading} tabIndex={-1}>Profile <span>Settings</span></h1><p className="muted">Keep your personal information and sign-in details up to date.</p></div><button className="secondary" disabled={Boolean(pending) || signingOut} onClick={onLogout}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    {authError && <p role="alert" className="message error">{authError}</p>}
    <div className="settings-layout">
      <aside className="settings-overview" aria-labelledby="overview-title">
        <div className="settings-avatar" aria-hidden="true">{initials(user.name)}</div>
        <p className="eyebrow">YOUR ACCOUNT</p><h2 id="overview-title">{user.name}</h2><p className="settings-email">{user.email}</p>
        <div className="settings-note"><strong>A space of your own.</strong><p>Your profile belongs to this account. Updating your details keeps your tasks and planner in place.</p></div>
      </aside>
      <div className="settings-forms"><ProfileForm {...props('profile')} /><EmailForm {...props('email')} /><PasswordForm {...props('password')} onPasswordChanged={onPasswordChanged} /></div>
    </div>
  </main>;
}
