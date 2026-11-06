// Each task returned by the authenticated API contributes to one status count.
export function taskStatistics(tasks) {
  const counts = { waiting: 0, in_progress: 0, completed: 0 };
  for (const task of tasks) counts[task.status] += 1;
  const total = counts.waiting + counts.in_progress + counts.completed;
  const completionRate = total === 0 ? 0 : Math.round((counts.completed / total) * 1000) / 10;
  return { total, ...counts, completionRate };
}
