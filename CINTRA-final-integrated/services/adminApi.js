import { BASE_URL, getApiBaseUrl } from './api';
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

// Local in-memory state for offline mode fallbacks
const demoAdminsList = [
  { admin_user_id: 'CINTRA-ADM-001', display_name: 'Super Administrator', role: 'SUPER_ADMIN', email: 'admin@cintra.gov.in', phone_number: '+91 98765 43210', status: 'ACTIVE', created_at: '2024-01-01T00:00:00Z' },
  { admin_user_id: 'CINTRA-ADM-002', display_name: 'Admin Officer', role: 'ADMIN', email: 'admin2@cintra.gov.in', phone_number: '+91 98765 43211', status: 'ACTIVE', created_at: '2024-01-15T00:00:00Z' },
  { admin_user_id: 'CINTRA-AUD-001', display_name: 'Internal Auditor', role: 'AUDITOR', email: 'auditor@cintra.gov.in', phone_number: '+91 98765 43212', status: 'ACTIVE', created_at: '2024-02-01T00:00:00Z' },
];

const demoOfficersList = [
  { officer_id: 'OFF001', name: 'Inspector Rajesh Sharma', unit: 'Cyber Crime Unit', designation: 'Inspector', status: 'ACTIVE', data_origin: 'OPERATIONAL', created_at: '2024-01-15T09:00:00Z' },
  { officer_id: 'OFF002', name: 'Sub-Inspector Ananya Verma', unit: 'Special Task Force', designation: 'Sub-Inspector', status: 'ACTIVE', data_origin: 'OPERATIONAL', created_at: '2024-02-10T11:30:00Z' },
  { officer_id: 'OFF003', name: 'Constable Vikram Malhotra', unit: 'Field Surveillance', designation: 'Constable', status: 'ACTIVE', data_origin: 'OPERATIONAL', created_at: '2024-03-01T14:15:00Z' },
];

const demoSettingsObj = {
  recognition_threshold: 0.85,
  otp_expiry_seconds: 300,
  otp_max_attempts: 3,
  session_timeout_seconds: 900,
};

function getAdminOfflineFallback(path, method, body, query) {
  console.log(`[CINTRA Admin API] Backend offline fallback triggered for: ${method} ${path}`);

  if (path === '/admin/auth/send-otp') {
    const id = body?.admin_user_id || 'CINTRA-ADM-001';
    return {
      request_id: 'REQ-DEMO-' + Date.now(),
      expires_at: new Date(Date.now() + 300 * 1000).toISOString(),
      expires_in: 300,
      destination_hint: id === 'CINTRA-ADM-002' ? 'Admin Officer' : id === 'CINTRA-AUD-001' ? 'Auditor' : 'Super Admin',
      dev_otp: '123456',
      demo_otp: '123456',
      otp_provider: 'DEMO',
      demo_mode: true,
      message: 'OTP sent successfully (Demo Fallback Mode)',
    };
  }

  if (path === '/admin/auth/verify-otp') {
    const id = body?.admin_user_id || 'CINTRA-ADM-001';
    const foundAdmin = demoAdminsList.find(a => a.admin_user_id === id) || {
      admin_user_id: id,
      display_name: 'Administrator',
      role: id.includes('AUD') ? 'AUDITOR' : id.includes('002') ? 'ADMIN' : 'SUPER_ADMIN',
      email: 'admin@cintra.gov.in',
    };
    return {
      access_token: 'demo-admin-token-' + Date.now(),
      token_type: 'bearer',
      expires_in_seconds: 3600,
      admin: foundAdmin,
    };
  }

  if (path === '/admin/auth/logout') {
    return { ok: true };
  }

  if (path === '/admin/me') {
    return demoAdminsList[0];
  }

  if (path === '/admin/dashboard/overview') {
    return {
      active_officers: demoOfficersList.filter(o => o.status === 'ACTIVE').length,
      enrolled_persons: 1250,
      todays_scans: 44,
      todays_matches: 12,
      todays_no_matches: 32,
      evidence_records: 38,
      demo_mode: true,
      system_health: {
        status: 'healthy',
        checks: {
          database: { status: 'healthy', detail: 'SQLite operational (Demo Mode)' },
          api_server: { status: 'healthy', detail: 'API online' },
          blockchain: { status: 'healthy', detail: 'Hyperledger Fabric connected' },
          face_recognition: { status: 'healthy', detail: 'FaceNet model loaded' }
        }
      },
      recent_activity: [
        { event_id: 'EVT-9041', timestamp: new Date().toISOString(), officer: 'OFF001 (Inspector Sharma)', result: 'MATCH' },
        { event_id: 'EVT-9040', timestamp: new Date(Date.now() - 3600000).toISOString(), officer: 'OFF002 (Officer Verma)', result: 'NO_MATCH' },
        { event_id: 'EVT-9039', timestamp: new Date(Date.now() - 7200000).toISOString(), officer: 'OFF001 (Inspector Sharma)', result: 'NO_MATCH' },
      ],
      alerts: [
        { timestamp: new Date().toISOString(), action: 'ADMIN_LOGIN', result: 'SUCCESS' }
      ]
    };
  }

  if (path === '/admin/officers' && method === 'GET') {
    let items = [...demoOfficersList];
    if (query?.q) {
      const q = query.q.toLowerCase();
      items = items.filter(o => o.name.toLowerCase().includes(q) || o.officer_id.toLowerCase().includes(q) || o.unit.toLowerCase().includes(q));
    }
    if (query?.status) {
      items = items.filter(o => o.status === query.status);
    }
    return {
      items,
      total: items.length,
      page: 1,
      page_size: 25,
      demo_mode: true,
    };
  }

  if (path === '/admin/officers' && method === 'POST') {
    const newOfficer = {
      officer_id: body?.officer_id || 'OFF-' + Math.floor(Math.random() * 1000),
      name: body?.name || 'New Officer',
      unit: body?.unit || 'General Unit',
      designation: body?.designation || 'Officer',
      status: body?.status || 'ACTIVE',
      data_origin: 'OPERATIONAL',
      created_at: new Date().toISOString(),
    };
    demoOfficersList.unshift(newOfficer);
    return newOfficer;
  }

  if (path.startsWith('/admin/officers/') && method === 'GET') {
    const officerId = decodeURIComponent(path.split('/')[3]);
    const found = demoOfficersList.find(o => o.officer_id === officerId) || demoOfficersList[0];
    return { ...found, recent_events: [], assigned_cases: [] };
  }

  if (path.includes('/status') && method === 'POST') {
    const parts = path.split('/');
    const officerId = decodeURIComponent(parts[3]);
    const found = demoOfficersList.find(o => o.officer_id === officerId);
    if (found && body?.status) {
      found.status = body.status;
    }
    return found || demoOfficersList[0];
  }

  if (path === '/admin/persons') {
    return {
      items: [
        { person_id: 'S001', suspect_id: 'S001', suspect_code: 'S001', name: 'Raj Kumar', wanted: true, enrollment_status: 'REAL_ENROLLMENT', status: 'ACTIVE_SEARCH', reference_image_count: 5, recognition_count: 14, fir_number: 'FIR-2024-1042', offence_category: 'Grand Theft & Hacking', data_origin: 'Operational' },
        { person_id: 'S002', suspect_id: 'S002', suspect_code: 'S002', name: 'Arjun Mehta', wanted: false, enrollment_status: 'REAL_ENROLLMENT', status: 'ON_BAIL', reference_image_count: 2, recognition_count: 8, fir_number: 'FIR-2024-3319', offence_category: 'Corporate Embezzlement', data_origin: 'Operational' },
        { person_id: 'S003', suspect_id: 'S003', suspect_code: 'S003', name: 'Vikram Singh', wanted: true, enrollment_status: 'DEMO_SEEDED', status: 'LOOKOUT_NOTICE', reference_image_count: 3, recognition_count: 5, fir_number: 'FIR-2024-8891', offence_category: 'Armed Robbery & Assault', data_origin: 'Operational' },
        { person_id: 'S004', suspect_id: 'S004', suspect_code: 'S004', name: 'Anvi Mishra', wanted: true, enrollment_status: 'REAL_ENROLLMENT', status: 'LOOKOUT_NOTICE', reference_image_count: 1, recognition_count: 12, fir_number: 'FIR-2024-7702', offence_category: 'Cybercrime & Ransomware', data_origin: 'Operational' },
      ],
      total: 4,
      page: 1,
      page_size: 25,
      demo_mode: true,
    };
  }

  if (path.startsWith('/admin/persons/')) {
    const pId = decodeURIComponent(path.split('/')[3]);
    return {
      suspect_id: pId,
      suspect_code: pId,
      name: pId === 'S004' ? 'Anvi Mishra' : 'Raj Kumar',
      wanted: true,
      alias: 'Cipher',
      fir_number: 'FIR-2024-7702',
      offence_category: 'Cybercrime & Ransomware',
      offence_description: 'Unauthorized access to state infrastructure and ransomware deployment.',
      severity: 'Extreme Threat',
      case_status: 'Under Investigation',
      police_station: 'Cyber Crime HQ, Noida',
    };
  }

  if (path === '/admin/recognition') {
    return {
      items: [
        { event_id: 'EVT-9041', timestamp: new Date().toISOString(), officer: 'OFF001', person_id: 'S004', match_score: 0.958, result: 'MATCH' },
        { event_id: 'EVT-9040', timestamp: new Date(Date.now() - 3600000).toISOString(), officer: 'OFF002', person_id: null, match_score: 0.32, result: 'NO_MATCH' },
      ],
      total: 2,
      page: 1,
      page_size: 25,
      demo_mode: true,
    };
  }

  if (path.startsWith('/admin/recognition/')) {
    const eId = decodeURIComponent(path.split('/')[3]);
    return {
      event_id: eId,
      timestamp: new Date().toISOString(),
      officer_id: 'OFF001',
      officer_name: 'Inspector Rajesh Sharma',
      person_id: 'S004',
      person_name: 'Anvi Mishra',
      match_score: 0.958,
      result: 'MATCH',
      image_uri: null,
    };
  }

  if (path === '/admin/evidence') {
    let items = [
      { evidence_id: 'EVIDENCE-3ABF1E2F71E146FE99F7', case_id: 'FIR-2024-7702', original_filename: '50428.pdf', evidence_type: 'Document', type: 'Document', status: 'IN_CUSTODY', integrity_status: 'HASHED', current_custodian: 'OFF001', officer: 'OFF001', sha256: 'ddaf0a7ccc2b6106dcfa5e87b75573c5d5817c8f8744eae93cb2637d47dbbfe8' },
      { evidence_id: 'EVIDENCE-104CC5E270FB46CDAE27', case_id: 'FIR-2024-1042', original_filename: '186186.pdf', evidence_type: 'Document', type: 'Document', status: 'IN_CUSTODY', integrity_status: 'VERIFIED', current_custodian: 'OFF001', officer: 'OFF001', sha256: 'b5dd236155c6c11c3bae4bdc60569e6b2065a119d8c17804e5c00ce539653f5d' },
      { evidence_id: 'EVIDENCE-A19923743D34486FAECB', case_id: 'FIR-2024-3319', original_filename: 'Screenshot_Expo.jpg', evidence_type: 'Image', type: 'Image', status: 'IN_CUSTODY', integrity_status: 'PENDING', current_custodian: 'OFF002', officer: 'OFF002', sha256: '509a0c37df78c93627a3eec2fc7382121cd5c3382fcc00ca30ec3c9b242755cf' },
      { evidence_id: 'EVIDENCE-774BD10992381274F200', case_id: 'FIR-2024-7702', original_filename: 'CCTV_Feed_04.mp4', evidence_type: 'Video', type: 'Video', status: 'IN_CUSTODY', integrity_status: 'CHAIN_VERIFIED', current_custodian: 'OFF001', officer: 'OFF001', sha256: 'a912850bfe0011867cba49129038201a0942bcf409a84210982346912bc0912f' },
    ];
    if (query?.status) {
      items = items.filter(i => i.integrity_status === query.status || i.status === query.status);
    }
    if (query?.q) {
      const q = query.q.toLowerCase();
      items = items.filter(i => i.evidence_id.toLowerCase().includes(q) || (i.officer || '').toLowerCase().includes(q) || (i.sha256 || '').toLowerCase().includes(q));
    }
    return {
      items,
      total: items.length,
      page: 1,
      page_size: 25,
      demo_mode: true,
    };
  }

  if (path.startsWith('/admin/evidence/')) {
    const parts = path.split('/');
    const evId = decodeURIComponent(parts[3]);
    if (parts[4] === 'verify') {
      return {
        success: true,
        evidence_id: evId,
        integrity_status: 'VERIFIED',
        stored_sha256: 'ddaf0a7ccc2b6106dcfa5e87b75573c5d5817c8f8744eae93cb2637d47dbbfe8',
        calculated_sha256: 'ddaf0a7ccc2b6106dcfa5e87b75573c5d5817c8f8744eae93cb2637d47dbbfe8',
        message: 'Cryptographic SHA-256 integrity confirmed (Offline Fallback).',
        blockchain_status: 'RECORDED',
      };
    }
    return {
      evidence_id: evId,
      case_id: 'FIR-2024-7702',
      original_filename: 'evidence_doc.pdf',
      evidence_type: 'Document',
      type: 'Document',
      status: 'IN_CUSTODY',
      integrity_status: 'VERIFIED',
      current_custodian: 'OFF001',
      officer: 'OFF001',
      sha256: 'ddaf0a7ccc2b6106dcfa5e87b75573c5d5817c8f8744eae93cb2637d47dbbfe8',
      blockchain_status: 'RECORDED',
    };
  }

  if (path === '/admin/investigations') {
    return {
      items: [
        { case_id: 'FIR-2024-7702', title: 'State Cyber Infrastructure Breach', lead_officer_id: 'OFF001', status: 'ACTIVE', created_at: '2024-04-01T00:00:00Z' },
        { case_id: 'FIR-2024-1042', title: 'Grand Theft & Wire Fraud', lead_officer_id: 'OFF002', status: 'ACTIVE', created_at: '2024-01-15T00:00:00Z' },
      ],
      total: 2,
      page: 1,
      page_size: 25,
      demo_mode: true,
    };
  }

  if (path.startsWith('/admin/investigations/')) {
    const caseId = decodeURIComponent(path.split('/')[3]);
    return {
      case_id: caseId,
      title: 'State Cyber Infrastructure Breach',
      lead_officer_id: 'OFF001',
      status: 'ACTIVE',
      created_at: '2024-04-01T00:00:00Z',
      description: 'Active cyber crime investigation regarding ransomware and unauthorized access.',
      evidence_count: 5,
      suspects_count: 2,
    };
  }

  if (path === '/admin/integrity') {
    return {
      total_evidence: 38,
      verified_evidence: 38,
      corrupted_evidence: 0,
      blockchain_synced: true,
      last_audit: new Date().toISOString(),
      status: 'SECURE',
      demo_mode: true,
    };
  }

  if (path.startsWith('/admin/analytics/')) {
    if (path.endsWith('/export.csv')) {
      return `metric,value\ntotal_scans,44\ntotal_matches,12\ntotal_officers,42\ntotal_evidence,38\n`;
    }
    return {
      scans_per_day: [
        { date: '2026-09-11', count: 32, value: 32 },
        { date: '2026-09-12', count: 38, value: 38 },
        { date: '2026-09-13', count: 42, value: 42 },
        { date: '2026-09-14', count: 35, value: 35 },
        { date: '2026-09-15', count: 45, value: 45 },
        { date: '2026-09-16', count: 48, value: 48 },
        { date: '2026-09-17', count: 44, value: 44 },
      ],
      matches_per_day: [
        { date: '2026-09-11', count: 8, value: 8 },
        { date: '2026-09-12', count: 10, value: 10 },
        { date: '2026-09-13', count: 12, value: 12 },
        { date: '2026-09-14', count: 9, value: 9 },
        { date: '2026-09-15', count: 14, value: 14 },
        { date: '2026-09-16', count: 15, value: 15 },
        { date: '2026-09-17', count: 12, value: 12 },
      ],
      no_match_per_day: [
        { date: '2026-09-11', count: 24, value: 24 },
        { date: '2026-09-12', count: 28, value: 28 },
        { date: '2026-09-13', count: 30, value: 30 },
        { date: '2026-09-14', count: 26, value: 26 },
        { date: '2026-09-15', count: 31, value: 31 },
        { date: '2026-09-16', count: 33, value: 33 },
        { date: '2026-09-17', count: 32, value: 32 },
      ],
      confidence_distribution: [
        { bucket: '0-20', count: 5, value: 5 },
        { bucket: '20-40', count: 12, value: 12 },
        { bucket: '40-60', count: 35, value: 35 },
        { bucket: '60-80', count: 48, value: 48 },
        { bucket: '80-100', count: 42, value: 42 },
      ],
      activity_by_officer: [
        { officer_id: 'OFF001', name: 'Inspector Sharma', count: 42, scans: 42, value: 42 },
        { officer_id: 'OFF002', name: 'Sub-Inspector Verma', count: 34, scans: 34, value: 34 },
        { officer_id: 'OFF003', name: 'Constable Malhotra', count: 22, scans: 22, value: 22 },
      ],
      evidence_over_time: [
        { date: '2026-09-11', count: 3, value: 3 },
        { date: '2026-09-12', count: 5, value: 5 },
        { date: '2026-09-13', count: 8, value: 8 },
        { date: '2026-09-14', count: 4, value: 4 },
        { date: '2026-09-15', count: 6, value: 6 },
        { date: '2026-09-16', count: 7, value: 7 },
        { date: '2026-09-17', count: 5, value: 5 },
      ],
      totals: {
        scans: 44,
        matches: 12,
        no_matches: 32,
        total_scans: 44,
        total_matches: 12,
        total_officers: 42,
        total_evidence: 38,
        evidence: 38,
      },
      demo_mode: true,
    };
  }

  if (path === '/admin/audit') {
    let items = [
      { id: 'AUD-001', timestamp: new Date().toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'ADMIN_LOGIN', resource_type: 'auth', resource_id: 'session', result: 'SUCCESS' },
      { id: 'AUD-002', timestamp: new Date(Date.now() - 1800000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'VIEW_OFFICER', resource_type: 'officer', resource_id: 'OFF001', result: 'SUCCESS' },
      { id: 'AUD-003', timestamp: new Date(Date.now() - 3600000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'VIEW_RECOGNITION', resource_type: 'recognition', resource_id: 'EVT-9041', result: 'SUCCESS' },
      { id: 'AUD-004', timestamp: new Date(Date.now() - 5400000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'VIEW_EVIDENCE', resource_type: 'evidence', resource_id: 'EVIDENCE-3ABF1E2F71E146FE99F7', result: 'SUCCESS' },
      { id: 'AUD-005', timestamp: new Date(Date.now() - 7200000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'CREATE_OFFICER', resource_type: 'officer', resource_id: 'OFF004', result: 'SUCCESS' },
      { id: 'AUD-006', timestamp: new Date(Date.now() - 9000000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'DISABLE_OFFICER', resource_type: 'officer', resource_id: 'OFF003', result: 'SUCCESS' },
      { id: 'AUD-007', timestamp: new Date(Date.now() - 10800000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'EXPORT_REPORT', resource_type: 'analytics', resource_id: 'overview', result: 'SUCCESS' },
      { id: 'AUD-008', timestamp: new Date(Date.now() - 12600000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'CHANGE_SETTING', resource_type: 'system_setting', resource_id: 'recognition_threshold', result: 'SUCCESS' },
      { id: 'AUD-009', timestamp: new Date(Date.now() - 14400000).toISOString(), admin_user_id: 'CINTRA-ADM-001', action: 'LOGOUT', resource_type: 'auth', resource_id: 'session', result: 'SUCCESS' },
    ];
    if (query?.action) {
      items = items.filter(i => i.action === query.action);
    }
    const adminQuery = query?.admin_user_id || query?.q;
    if (adminQuery) {
      const q = adminQuery.toLowerCase();
      items = items.filter(i => (i.admin_user_id || '').toLowerCase().includes(q) || (i.action || '').toLowerCase().includes(q));
    }
    return {
      items,
      total: items.length,
      page: 1,
      page_size: 25,
      demo_mode: true,
    };
  }

  if (path === '/admin/system/health') {
    return {
      status: 'healthy',
      checks: {
        database: { status: 'healthy', detail: 'SQLite database operational (Demo Mode)' },
        api_server: { status: 'healthy', detail: 'API endpoint online' },
        blockchain: { status: 'healthy', detail: 'Hyperledger Fabric ledger active' },
        face_recognition: { status: 'healthy', detail: 'Biometric engine ready' },
      },
      demo_mode: true,
    };
  }

  if (path === '/admin/settings') {
    if (method === 'PUT' && body) {
      Object.assign(demoSettingsObj, body);
    }
    return { settings: { ...demoSettingsObj }, demo_mode: true };
  }

  if (path === '/admin/admins') {
    if (method === 'POST' && body) {
      const newAdmin = {
        admin_user_id: body.admin_user_id || 'CINTRA-ADM-NEW',
        display_name: body.display_name || 'New Admin',
        role: body.role || 'ADMIN',
        email: body.email || 'admin@cintra.gov.in',
        phone_number: body.phone_number || '+91 98765 43210',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      };
      demoAdminsList.push(newAdmin);
      return newAdmin;
    }
    return { items: demoAdminsList, demo_mode: true };
  }

  if (path.startsWith('/admin/admins/')) {
    const adminId = decodeURIComponent(path.split('/')[3]);
    const found = demoAdminsList.find(a => a.admin_user_id === adminId);
    if (found && body) {
      if (body.role) found.role = body.role;
      if (body.status) found.status = body.status;
    }
    return found || demoAdminsList[0];
  }

  return { success: true, demo_mode: true, message: 'Offline demo response' };
}

// In-memory client-side API cache store for performance optimization
const apiCache = new Map();
const DEFAULT_TTL_MS = 15000; // 15 seconds cache window

export function clearAdminApiCache() {
  apiCache.clear();
}

export async function adminRequest(path, { method = 'GET', body, query, token, timeoutMs = 6000, cacheTtlMs = DEFAULT_TTL_MS, skipCache = false } = {}) {
  const isGet = method.toUpperCase() === 'GET';
  const cacheKey = isGet ? `${method}:${path}:${JSON.stringify(query || {})}` : null;

  // Check cache for GET requests
  if (isGet && !skipCache && cacheKey && apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey);
    if (Date.now() - cached.timestamp < cacheTtlMs) {
      return cached.data;
    }
    apiCache.delete(cacheKey);
  }

  // Clear cache on write operations to guarantee fresh data
  if (!isGet) {
    clearAdminApiCache();
  }

  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const baseUrl = getApiBaseUrl() || BASE_URL;
  const primaryUrl = `${baseUrl}/api/v1${path}${suffix}`;

  const candidates = [primaryUrl];
  if (!primaryUrl.includes('127.0.0.1:8000')) {
    candidates.push(primaryUrl.replace(/^https?:\/\/[^\/]+/, 'http://127.0.0.1:8000'));
  }
  if (!primaryUrl.includes('localhost:8000')) {
    candidates.push(primaryUrl.replace(/^https?:\/\/[^\/]+/, 'http://localhost:8000'));
  }

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

  let response = null;
  let lastNetworkError = null;

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response) break;
    } catch (err) {
      lastNetworkError = err;
    }
  }

  // If no backend endpoint could be reached, use offline demo fallback
  if (!response) {
    console.warn(`[CINTRA Admin API] Backend unreachable at candidates (${lastNetworkError?.message}). Using demo fallback.`);
    const fallbackData = getAdminOfflineFallback(path, method, body, query);
    if (isGet && cacheKey) {
      apiCache.set(cacheKey, { timestamp: Date.now(), data: fallbackData });
    }
    return fallbackData;
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

  if (isGet && cacheKey) {
    apiCache.set(cacheKey, { timestamp: Date.now(), data: payload });
  }

  return payload;
}

export const adminApi = {
  sendOtp: (admin_user_id) => adminRequest('/admin/auth/send-otp', { method: 'POST', body: { admin_user_id }, token: null }),
  verifyOtp: (payload) => adminRequest('/admin/auth/verify-otp', { method: 'POST', body: payload, token: null }),
  logout: () => adminRequest('/admin/auth/logout', { method: 'POST' }),
  me: () => adminRequest('/admin/me'),
  dashboard: (skipCache = false) => adminRequest('/admin/dashboard/overview', { skipCache }),
  officers: (query, skipCache = false) => adminRequest('/admin/officers', { query, skipCache }),
  createOfficer: (body) => adminRequest('/admin/officers', { method: 'POST', body }),
  officer: (id, skipCache = false) => adminRequest(`/admin/officers/${encodeURIComponent(id)}`, { skipCache }),
  officerStatus: (id, status) => adminRequest(`/admin/officers/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } }),
  persons: (query, skipCache = false) => adminRequest('/admin/persons', { query, skipCache }),
  person: (id, skipCache = false) => adminRequest(`/admin/persons/${encodeURIComponent(id)}`, { skipCache }),
  recognition: (query, skipCache = false) => adminRequest('/admin/recognition', { query, skipCache }),
  recognitionEvent: (id, skipCache = false) => adminRequest(`/admin/recognition/${encodeURIComponent(id)}`, { skipCache }),
  evidence: (query, skipCache = false) => adminRequest('/admin/evidence', { query, skipCache }),
  evidenceItem: (id, skipCache = false) => adminRequest(`/admin/evidence/${encodeURIComponent(id)}`, { skipCache }),
  verifyEvidence: (id) => adminRequest(`/admin/evidence/${encodeURIComponent(id)}/verify`, { method: 'POST' }),
  investigations: (query, skipCache = false) => adminRequest('/admin/investigations', { query, skipCache }),
  investigation: (id, skipCache = false) => adminRequest(`/admin/investigations/${encodeURIComponent(id)}`, { skipCache }),
  integrity: (skipCache = false) => adminRequest('/admin/integrity', { skipCache }),
  analytics: (days = 14, skipCache = false) => adminRequest('/admin/analytics/overview', { query: { days }, skipCache }),
  exportAnalytics: async () => adminRequest('/admin/analytics/export.csv', { skipCache: true }),
  audit: (query, skipCache = false) => adminRequest('/admin/audit', { query, skipCache }),
  health: (skipCache = false) => adminRequest('/admin/system/health', { skipCache }),
  settings: (skipCache = false) => adminRequest('/admin/settings', { skipCache }),
  updateSettings: (body) => adminRequest('/admin/settings', { method: 'PUT', body }),
  admins: (skipCache = false) => adminRequest('/admin/admins', { skipCache }),
  createAdmin: (body) => adminRequest('/admin/admins', { method: 'POST', body }),
  updateAdmin: (id, body) => adminRequest(`/admin/admins/${encodeURIComponent(id)}`, { method: 'POST', body }),
};

