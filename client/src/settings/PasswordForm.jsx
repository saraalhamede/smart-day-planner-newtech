import { useRef, useState } from 'react';
import { passwordFormError } from './settings-model.js';
import FormFeedback from './FormFeedback.jsx';
export default function PasswordForm({ busy, saving, feedback, onSave, onReset, onPasswordChanged }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const confirmInput = useRef(null);
  function reset() { setCurrent(''); setPassword(''); setConfirmation(''); setError(''); onReset(); }
  async function submit(event) {
    event.preventDefault();
    const problem = passwordFormError(current, password, confirmation);
    if (problem) { setError(problem); confirmInput.current?.focus(); return; }
    setError('');
    if (await onSave({ currentPassword: current, newPassword: password })) { reset(); onPasswordChanged(); }
  }
  return <section className="settings-card" aria-labelledby="security-title">
    <p className="eyebrow">ACCOUNT SECURITY</p><h2 id="security-title">Change password</h2>
    <p className="muted">Changing your password signs out this session. Other signed-in sessions remain active until they sign out or expire.</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <label htmlFor="security-current">Current password<input id="security-current" name="currentPassword" type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} required maxLength={128} /></label>
      <div className="settings-password-row">
        <label htmlFor="security-new">New password<input id="security-new" name="newPassword" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} maxLength={128} aria-describedby="password-policy" /></label>
        <label htmlFor="security-confirm">Confirm new password<input ref={confirmInput} id="security-confirm" name="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={12} maxLength={128} /></label>
      </div>
      <p className="field-hint" id="password-policy">Use 12–128 characters and choose a password you are not currently using.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="settings-actions"><button className="primary" type="submit">{saving ? 'Changing password…' : 'Change password'}</button><button className="secondary" type="button" onClick={reset}>Clear password form</button></div>
    </fieldset></form><FormFeedback {...feedback} />
  </section>;
}
