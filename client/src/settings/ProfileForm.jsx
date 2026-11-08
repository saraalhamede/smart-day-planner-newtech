import { useEffect, useState } from 'react';
import FormFeedback from './FormFeedback.jsx';
export default function ProfileForm({ user, busy, saving, feedback, onSave, onReset }) {
  const [name, setName] = useState(user.name);
  useEffect(() => { setName(user.name); }, [user.name]);
  function reset() { setName(user.name); onReset(); }
  return <section className="settings-card" aria-labelledby="profile-title">
    <p className="eyebrow">PERSONAL INFORMATION</p><h2 id="profile-title">Your profile</h2>
    <p className="muted">Choose the name you see throughout your planner.</p>
    <form onSubmit={event => { event.preventDefault(); onSave({ name }); }}><fieldset disabled={busy}>
      <label htmlFor="profile-name">Full name<input id="profile-name" name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required maxLength={100} aria-describedby="profile-name-hint" /></label>
      <p className="field-hint" id="profile-name-hint">Required. Up to 100 characters. Extra spaces at the edges are removed.</p>
      <div className="settings-actions"><button className="primary" type="submit">{saving ? 'Saving name…' : 'Save name'}</button><button className="secondary" type="button" onClick={reset}>Cancel changes</button></div>
    </fieldset></form><FormFeedback {...feedback} />
  </section>;
}
