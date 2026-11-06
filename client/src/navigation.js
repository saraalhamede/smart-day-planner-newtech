import { isPlannerDate } from './planner/planner-model.js';

const views = ['planner', 'calendar', 'tasks'];
export function workspaceFromSearch(search) {
  const value = new URLSearchParams(search).get('view');
  return views.includes(value) ? value : 'planner';
}

export function workspaceUrl(href, { view, day } = {}) {
  const url = new URL(href);
  if (view !== undefined) {
    if (!views.includes(view)) throw new RangeError('Unknown workspace.');
    url.searchParams.set('view', view);
  }
  if (day !== undefined) {
    if (!isPlannerDate(day)) throw new RangeError('Invalid calendar date.');
    url.searchParams.set('day', day);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
