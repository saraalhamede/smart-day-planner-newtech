import { useEffect, useRef } from 'react';
export default function FormFeedback({ error, success }) {
  const message = useRef(null);
  useEffect(() => { if (error) message.current?.focus(); }, [error]);
  if (!error && !success) return null;
  return <p ref={message} tabIndex={-1} role={error ? 'alert' : 'status'} className={`message ${error ? 'error' : 'success'}`}>{error || success}</p>;
}
