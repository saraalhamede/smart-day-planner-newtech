export const priorities = ['low', 'medium', 'high'];
export const statuses = ['waiting', 'in_progress', 'completed'];

export class TaskError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const invalid = (message) => { throw new TaskError(400, message); };

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

export function validateTask(body, existing) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Send a JSON object with task fields.');
  const keys = ['title', 'description', 'task_date', 'start_time', 'end_time', 'priority', 'status'];
  if (Object.keys(body).some((key) => !keys.includes(key))) invalid('Unknown task field. Ownership and IDs cannot be supplied.');
  if (existing && !Object.keys(body).length) invalid('Supply at least one task field to update.');
  const task = { title: '', description: '', start_time: null, end_time: null, priority: 'medium', status: 'waiting', ...existing, ...body };
  if (typeof task.title !== 'string' || !task.title.trim() || [...task.title.trim()].length > 180) invalid('Title must contain 1–180 characters.');
  task.title = task.title.trim();
  if (typeof task.description !== 'string' || task.description.length > 2000) invalid('Description must be text with at most 2,000 characters.');
  if (!isCalendarDate(task.task_date)) invalid('Task date must be a real calendar date in YYYY-MM-DD format (years 1000–9999).');
  if (!priorities.includes(task.priority)) invalid('Choose low, medium, or high priority.');
  if (!statuses.includes(task.status)) invalid('Choose waiting, in_progress, or completed status.');
  const timed = task.start_time !== null || task.end_time !== null;
  if (timed) {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (typeof task.start_time !== 'string' || typeof task.end_time !== 'string' || !time.test(task.start_time) || !time.test(task.end_time)) invalid('Provide both start and end times in HH:mm format, or leave both null.');
    if (task.start_time >= task.end_time) invalid('Start time must be earlier than end time.');
  }
  return Object.fromEntries(keys.map((key) => [key, task[key]]));
}

export function validateFilters(query) {
  if (Object.keys(query).some((key) => !['date', 'status', 'priority'].includes(key))) invalid('Supported filters are date, status, and priority.');
  if (query.date !== undefined && !isCalendarDate(query.date)) invalid('Date filter must be a real date in YYYY-MM-DD format.');
  if (query.priority !== undefined && !priorities.includes(query.priority)) invalid('Invalid priority filter.');
  if (query.status !== undefined && !statuses.includes(query.status)) invalid('Invalid status filter.');
  return query;
}

export function validateId(value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 4294967295) invalid('Task ID must be a positive integer.');
  return Number(value);
}
