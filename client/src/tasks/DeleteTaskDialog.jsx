import { useEffect, useRef } from 'react';

export default function DeleteTaskDialog({ task, busy, error, onConfirm, onCancel }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="delete-dialog" aria-labelledby="delete-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <p className="eyebrow">PLEASE CONFIRM</p>
    <h2 id="delete-title">Delete this task?</h2>
    <p className="muted">“{task.title}” will be permanently deleted.</p>
    {error && <p role="alert" className="message error">{error}</p>}
    <div className="dialog-actions"><button autoFocus type="button" className="secondary" disabled={busy} onClick={onCancel}>Keep task</button><button type="button" className="delete-confirm" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : 'Delete task'}</button></div>
  </dialog>;
}
