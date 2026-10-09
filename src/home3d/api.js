async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'The request could not be completed.');
  }

  return payload;
}

export async function fetchState() {
  return apiFetch('/api/state');
}

export async function startSimulation() {
  return apiFetch('/api/sim/start', { method: 'POST' });
}

export async function nextEvent() {
  return apiFetch('/api/sim/next', { method: 'POST' });
}

export async function actOnCurrent(actionId) {
  return apiFetch('/api/act', {
    method: 'POST',
    body: JSON.stringify({ action: actionId })
  });
}

export async function approveAction(actionId) {
  if (!actionId) {
    throw new Error('No action selected.');
  }

  const confirmed = window.confirm('ACTION REQUIRES APPROVAL. Continue?');
  if (!confirmed) {
    return null;
  }

  return actOnCurrent(actionId);
}
