import { BASE_URL } from './api';
import { clearAdminSession, getAdminToken } from './adminAuth';

function userMessage(status, detail) {
  if (status === 401) return 'Administrator session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'The requested record was not found.';
  if (status === 422) return 'The request could not be processed. Check the entered values.';
  if (status === 423) return detail || 'OTP is locked after too many attempts.';
  if (status === 503) return 'Unable to send or verify OTP at this time.';
  if (status >= 500) return 'CINTRA server error. Please retry.';
  return detail || 'Unable to complete the request.';
}

export class AdminApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function adminRequest(path, { method = 'GET', body, query, token, timeoutMs = 12000 } = {}) {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const targetUrl = `${BASE_URL}/api/v1${path}${suffix}`;
  const headers = { Accept: 'application/json' };
  const authToken = token ?? getAdminToken();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    response = await fetch(targetUrl, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (error) {
    throw new AdminApiError('Unable to connect to CINTRA server.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const detail = payload && typeof payload === 'object' ? payload.detail : payload;
    const message = userMessage(response.status, typeof detail === 'string' ? detail : null);
    if (response.status === 401) {
      clearAdminSession();
    }
    throw new AdminApiError(message, response.status);
  }
  return payload;
}

export const adminApi = {
  sendOtp: (admin_user_id) => adminRequest('/admin/auth/send-otp', { method: 'POST', body: { admin_user_id }, token: null }),
  verifyOtp: (payload) => adminRequest('/admin/auth/verify-otp', { method: 'POST', body: payload, token: null }),
  logout: () => adminRequest('/admin/auth/logout', { method: 'POST' }),
  me: () => adminRequest('/admin/me'),
  dashboard: () => adminRequest('/admin/dashboard/overview'),
  officers: (query) => adminRequest('/admin/officers', { query }),
  createOfficer: (body) => adminRequest('/admin/officers', { method: 'POST', body }),
  officer: (id) => adminRequest(`/admin/officers/${encodeURIComponent(id)}`),
  officerStatus: (id, status) => adminRequest(`/admin/officers/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } }),
  persons: (query) => adminRequest('/admin/persons', { query }),
  person: (id) => adminRequest(`/admin/persons/${encodeURIComponent(id)}`),
  recognition: (query) => adminRequest('/admin/recognition', { query }),
  recognitionEvent: (id) => adminRequest(`/admin/recognition/${encodeURIComponent(id)}`),
  evidence: (query) => adminRequest('/admin/evidence', { query }),
  evidenceItem: (id) => adminRequest(`/admin/evidence/${encodeURIComponent(id)}`),
  verifyEvidence: (id) => adminRequest(`/admin/evidence/${encodeURIComponent(id)}/verify`, { method: 'POST' }),
  investigations: (query) => adminRequest('/admin/investigations', { query }),
  investigation: (id) => adminRequest(`/admin/investigations/${encodeURIComponent(id)}`),
  integrity: () => adminRequest('/admin/integrity'),
  analytics: (days = 14) => adminRequest('/admin/analytics/overview', { query: { days } }),
  exportAnalytics: async () => adminRequest('/admin/analytics/export.csv'),
  audit: (query) => adminRequest('/admin/audit', { query }),
  health: () => adminRequest('/admin/system/health'),
  settings: () => adminRequest('/admin/settings'),
  updateSettings: (body) => adminRequest('/admin/settings', { method: 'PUT', body }),
  admins: () => adminRequest('/admin/admins'),
  createAdmin: (body) => adminRequest('/admin/admins', { method: 'POST', body }),
  updateAdmin: (id, body) => adminRequest(`/admin/admins/${encodeURIComponent(id)}`, { method: 'POST', body }),
};
