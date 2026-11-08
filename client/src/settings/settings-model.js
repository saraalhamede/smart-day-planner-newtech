export function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? [words[0], words.at(-1)] : words).map(word => Array.from(word)[0]).join('').toUpperCase() || '?';
}
export function passwordFormError(currentPassword, newPassword, confirmation) {
  if (!currentPassword || currentPassword.length > 128) return 'Enter your current password (1–128 characters).';
  if (newPassword.length < 12 || newPassword.length > 128) return 'New password must contain 12–128 characters.';
  if (newPassword !== confirmation) return 'New passwords do not match.';
  if (newPassword === currentPassword) return 'Choose a password different from your current password.';
  return '';
}
