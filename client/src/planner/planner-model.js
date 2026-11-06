const pad = (value) => String(value).padStart(2, '0');
const leap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const monthDays = (year, month) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isPlannerDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1000 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= monthDays(year, month);
}

export function selectedDay(search, fallback = localToday()) {
  const value = new URLSearchParams(search).get('day');
  return isPlannerDate(value) ? value : fallback;
}

// Calendar arithmetic only: no parsing of date-only strings as UTC or DST-sensitive instants.
export function adjacentDate(value, direction) {
  if (!isPlannerDate(value) || ![-1, 1].includes(direction)) return null;
  let [year, month, day] = value.split('-').map(Number);
  day += direction;
  if (day > monthDays(year, month)) { day = 1; month += 1; }
  if (day < 1) { month -= 1; if (month < 1) { month = 12; year -= 1; } day = monthDays(year, month); }
  if (month > 12) { month = 1; year += 1; }
  if (year < 1000 || year > 9999) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export const statusLabels = { waiting: 'Waiting', in_progress: 'In Progress', completed: 'Completed' };

export function dailyView(tasks, date) {
  const day = tasks.filter((task) => task.task_date === date);
  const timed = day.filter((task) => task.start_time !== null && task.end_time !== null)
    .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time) || a.id - b.id);
  return {
    waiting: day.filter((task) => task.status === 'waiting'),
    in_progress: day.filter((task) => task.status === 'in_progress'),
    completed: day.filter((task) => task.status === 'completed'),
    timed,
    untimed: day.filter((task) => task.start_time === null && task.end_time === null),
  };
}
