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

  async function analyzeProfile(payload) {
    const response = await fetch('/api/v1/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return readJsonResponse(response);
  }

  async function listEntries(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.pseudo) params.set('pseudo', options.pseudo);
    if (options.verdict) params.set('verdict', options.verdict);
    if (options.rank) params.set('rank', options.rank);
    if (options.minScore) params.set('minScore', String(options.minScore));
    if (options.sort) params.set('sort', options.sort);

    const headers = { Accept: 'application/json' };
    if (options.readKey) headers['x-read-key'] = options.readKey;

    const path = `/api/v1/entries${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(path, { method: 'GET', headers });
    return readJsonResponse(response);
  }

  function buildExportCsvUrl(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.pseudo) params.set('pseudo', options.pseudo);
    if (options.verdict) params.set('verdict', options.verdict);
    if (options.rank) params.set('rank', options.rank);
    if (options.minScore) params.set('minScore', String(options.minScore));
    if (options.sort) params.set('sort', options.sort);
    return `/api/v1/export.csv${params.toString() ? `?${params.toString()}` : ''}`;
  }

  async function login(username, password) {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return readJsonResponse(response);
  }

  async function me(token) {
    const response = await fetch('/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return readJsonResponse(response);
  }

  async function logout(token) {
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return readJsonResponse(response);
  }

  global.R6Api = {
    analyzeProfile,
    buildExportCsvUrl,
    login,
    logout,
    me,
    saveSubmission,
    listEntries,
  };
})(window);
