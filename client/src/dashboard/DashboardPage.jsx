import { taskStatistics } from './dashboard-model.js';
import useDashboardTasks from './useDashboardTasks.js';
import '../tasks/tasks.css';
import './dashboard.css';

export default function DashboardPage({ user, onLogout, signingOut, authError, onSessionExpired }) {
  const { tasks, loading, error, refresh } = useDashboardTasks(onSessionExpired);
  const statistics = taskStatistics(tasks);
  const cards = [
    ['Total Tasks', statistics.total], ['Completed Tasks', statistics.completed],
    ['In Progress Tasks', statistics.in_progress], ['Waiting Tasks', statistics.waiting],
  ];
  return <main className="dashboard-page">
    <div className="tasks-heading"><div><p className="eyebrow">A LITTLE PERSPECTIVE</p><h1>Your progress,<br /><span>at a glance.</span></h1><p className="muted">Welcome, {user.name}. A simple overview of your tasks.</p></div><button className="secondary" disabled={signingOut} onClick={onLogout}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    {authError && <p className="message error" role="alert">{authError}</p>}
    <section aria-labelledby="dashboard-scope" aria-busy={loading}>
      <div className="dashboard-toolbar"><div><h2 id="dashboard-scope">All Tasks</h2><p className="muted">Your tasks across all dates. Read-only statistics.</p></div><button type="button" className="secondary" onClick={refresh} disabled={loading || signingOut}>Refresh Dashboard</button></div>
      {loading ? <p className="empty-state" role="status">Loading your dashboard…</p> : error ? <div className="empty-state" role="alert"><p>Could not load Dashboard. {error}</p><button type="button" className="secondary" onClick={refresh} disabled={signingOut}>Retry Dashboard</button></div> : <>
        {!statistics.total && <p className="dashboard-empty" role="status">No tasks yet. Add a task in Daily Planner or Tasks to get started.</p>}
        <dl className="dashboard-cards">{cards.map(([label, count]) => <div className="dashboard-card" key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
        <section className="dashboard-completion" aria-labelledby="completion-title">
          <div className="completion-heading"><h3 id="completion-title">Completion Rate</h3><p className="completion-value">{statistics.completionRate.toFixed(1)}%</p></div>
          <progress max="100" value={statistics.completionRate} aria-label="Completion Rate for All Tasks" aria-valuetext={`${statistics.completionRate.toFixed(1)}% completed`} />
          <p className="muted">{statistics.completed} of {statistics.total} tasks completed.</p>
        </section>
        <p className="dashboard-note">Updated when you open or refresh Dashboard. Manage tasks in Daily Planner or Tasks.</p>
      </>}
    </section>
  </main>;
}
