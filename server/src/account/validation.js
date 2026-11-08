export class AccountError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function validateAccount(body, section) {
  const fields = { profile: ['name'], email: ['email', 'currentPassword'], password: ['currentPassword', 'newPassword'] }[section];
  const invalid = (message) => { throw new AccountError(400, message); };
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) {
    invalid('Send only the supported account fields. Account ownership cannot be supplied.');
  }
  if (section === 'profile') {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) invalid('Full name must contain 1–100 characters.');
    return { name: body.name.trim() };
  }
  if (typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > 128) invalid('Enter your current password (1–128 characters).');
  if (section === 'email') {
    if (typeof body.email !== 'string' || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) invalid('Enter a valid email address (at most 254 characters).');
    return { email: body.email.trim().toLowerCase(), currentPassword: body.currentPassword };
  }
  if (typeof body.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 128) invalid('New password must contain 12–128 characters.');
  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
}
