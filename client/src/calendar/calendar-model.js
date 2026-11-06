import { adjacentDate, isPlannerDate } from '../planner/planner-model.js';

export const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (value) => String(value).padStart(2, '0');
export const isCalendarMonth = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) && isPlannerDate(`${value}-01`);

export function daysInMonth(month) {
  if (!isCalendarMonth(month)) throw new RangeError('Invalid calendar month.');
  const [year, number] = month.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][number - 1];
}

export function monthLabel(month) {
  if (!isCalendarMonth(month)) throw new RangeError('Invalid calendar month.');
  return `${monthLabels[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}

export function adjacentMonth(month, direction) {
  if (!isCalendarMonth(month) || ![-1, 1].includes(direction)) return null;
  let [year, number] = month.split('-').map(Number);
  number += direction;
  if (number < 1) { number = 12; year -= 1; }
  if (number > 12) { number = 1; year += 1; }
  return year < 1000 || year > 9999 ? null : `${year}-${pad(number)}`;
}

export function monthGrid(month) {
  const days = daysInMonth(month);
  let [year, number] = month.split('-').map(Number);
  // Gregorian weekday arithmetic, independent of timezone, UTC parsing and DST.
  if (number < 3) year -= 1;
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const sundayFirst = (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + offsets[number - 1] + 1) % 7;
  const start = (sundayFirst + 6) % 7;
  const cells = Array.from({ length: Math.ceil((start + days) / 7) * 7 }, (_, index) => index >= start && index < start + days ? `${month}-${pad(index - start + 1)}` : null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export function indexTasksForMonth(tasks, month) {
  if (!isCalendarMonth(month)) throw new RangeError('Invalid calendar month.');
  const byDate = new Map();
  for (const task of tasks) {
    if (!isPlannerDate(task.task_date) || !task.task_date.startsWith(`${month}-`)) continue;
    if (!byDate.has(task.task_date)) byDate.set(task.task_date, []);
    byDate.get(task.task_date).push(task);
  }
  return byDate;
}

export function keyboardDate(date, key) {
  if (!isPlannerDate(date)) return null;
  if (key === 'Home') return `${date.slice(0, 7)}-01`;
  if (key === 'End') return `${date.slice(0, 7)}-${daysInMonth(date.slice(0, 7))}`;
  const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key];
  if (!offset) return null;
  let next = date;
  for (let i = 0; i < Math.abs(offset); i++) { next = adjacentDate(next, Math.sign(offset)); if (!next) return null; }
  return next;
}
