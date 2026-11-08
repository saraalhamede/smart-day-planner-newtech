export async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method, credentials: 'same-origin', signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the server. Please try again.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'The server is unavailable. Please try again.');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

export const authApi = (path, body) => request(`auth/${path}`, { method: body === undefined ? 'GET' : 'POST', body });
