import { useEffect, useState } from 'react';
import FormFeedback from './FormFeedback.jsx';
export default function EmailForm({ user, busy, saving, feedback, onSave, onReset }) {
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  useEffect(() => { setEmail(user.email); }, [user.email]);
  function reset() { setEmail(user.email); setPassword(''); onReset(); }
  async function submit(event) { event.preventDefault(); if (await onSave({ email, currentPassword: password })) setPassword(''); }
  return <section className="settings-card" aria-labelledby="email-title">
    <p className="eyebrow">SIGN-IN DETAILS</p><h2 id="email-title">Email address</h2>
    <p className="muted">Current email: <strong>{user.email}</strong></p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <label htmlFor="account-email">New email address<input id="account-email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} aria-describedby="email-hint" /></label>
      <label htmlFor="email-password">Current password for email change<input id="email-password" name="currentPassword" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={128} /></label>
      <p className="field-hint" id="email-hint">Use your new email the next time you sign in. Email ownership verification is not available.</p>
      <div className="settings-actions"><button className="primary" type="submit">{saving ? 'Updating email…' : 'Update email'}</button><button className="secondary" type="button" onClick={reset}>Reset email form</button></div>
    </fieldset></form><FormFeedback {...feedback} />
  </section>;
}
