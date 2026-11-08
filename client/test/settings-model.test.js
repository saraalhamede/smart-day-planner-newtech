import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials, passwordFormError } from '../src/settings/settings-model.js';
import { workspaceFromSearch, workspaceUrl } from '../src/navigation.js';
import { selectedDay } from '../src/planner/planner-model.js';
test('avatar uses account initials including Unicode and whitespace without external storage', () => {
  assert.equal(initials('  Sara   Alhamede  '),'SA'); assert.equal(initials('Sara'),'S');
  assert.equal(initials('سارة أحمد'),'سأ'); assert.equal(initials(''),'?');
});
test('password form requires current password, length, confirmation and a different password', () => {
  assert.ok(passwordFormError('','new-password-long','new-password-long'));
  assert.ok(passwordFormError('old','short','short'));
  assert.ok(passwordFormError('old','x'.repeat(129),'x'.repeat(129)));
  assert.equal(passwordFormError('old','new-password-long','different'),'New passwords do not match.');
  assert.ok(passwordFormError('same-password-long','same-password-long','same-password-long'));
  assert.equal(passwordFormError('old','new-password-long','new-password-long'),'');
});
test('Settings URL restores view and selected planner date on refresh without new routing dependency', () => {
  const href = workspaceUrl('http://127.0.0.1:5173/?view=calendar&day=2028-02-29',{view:'settings'});
  const search = new URL(href,'http://127.0.0.1:5173').search;
  assert.equal(workspaceFromSearch(search),'settings'); assert.equal(selectedDay(search),'2028-02-29');
});
