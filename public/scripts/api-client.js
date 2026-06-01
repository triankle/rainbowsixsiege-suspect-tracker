(function initR6ApiClient(global) {
  async function readJsonResponse(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        body && body.error
          ? typeof body.error === 'string'
            ? body.error
            : body.error.message
          : `Request failed (${response.status})`;
      throw new Error(message || `Request failed (${response.status})`);
    }
    return body;
  }

  async function saveSubmission(payload, saveKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (saveKey) headers['x-save-key'] = saveKey;

    const response = await fetch('/api/v1/submissions', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return readJsonResponse(response);
  }

  async function listEntries(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.pseudo) params.set('pseudo', options.pseudo);

    const headers = { Accept: 'application/json' };
    if (options.readKey) headers['x-read-key'] = options.readKey;

    const path = `/api/v1/entries${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(path, { method: 'GET', headers });
    return readJsonResponse(response);
  }

  global.R6Api = {
    saveSubmission,
    listEntries,
  };
})(window);
