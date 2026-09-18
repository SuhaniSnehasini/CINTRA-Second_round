import { BASE_URL } from './api';

const DEFAULT_CASES = [
  {
    case_id: 'CASE-2024-8841',
    title: 'Operation Cyber Shield - Ransomware Breach',
    status: 'ACTIVE',
    date: '2024-04-01',
    priority: 'CRITICAL',
    officer: 'Badge OFF001 (Insp. R. Sharma)',
    summary: 'State infrastructure ransomware payload deployment and cyber extortion investigation.',
  },
  {
    case_id: 'CASE-2024-7702',
    title: 'Financial Identity Theft & Banking Fraud',
    status: 'UNDER INVESTIGATION',
    date: '2024-05-12',
    priority: 'HIGH',
    officer: 'Badge OFF001 (Insp. R. Sharma)',
    summary: 'Large-scale spoofing and credential theft across regional financial networks.',
  },
  {
    case_id: 'CASE-2024-6519',
    title: 'State Infrastructure Unauthorized Intrusion',
    status: 'ACTIVE',
    date: '2024-06-20',
    priority: 'CRITICAL',
    officer: 'Badge OFF001 (Insp. R. Sharma)',
    summary: 'Unauthorized physical and digital access attempt to secure server node.',
  },
  {
    case_id: 'CASE-2024-4108',
    title: 'Cross-Border Cyber Extortion Syndicate',
    status: 'OPEN',
    date: '2024-08-15',
    priority: 'MEDIUM',
    officer: 'Badge OFF001 (Insp. R. Sharma)',
    summary: 'Syndicate operation involving fake crypto exchanges and extortion messages.',
  },
];

let activeCase = null;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(activeCase);
    } catch (e) {
      console.warn('[CaseService] Listener error:', e);
    }
  });
}

export function getSelectedCase() {
  return activeCase;
}

export function setSelectedCase(caseItem) {
  activeCase = caseItem;
  notifyListeners();
  return activeCase;
}

export function clearSelectedCase() {
  activeCase = null;
  notifyListeners();
}

export function subscribeCaseChanges(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetches available cases from GET /api/v1/cases
 * Structured to cleanly switch from fallback to real API.
 */
export async function fetchCases() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${BASE_URL}/api/v1/cases`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[CaseService] GET /api/v1/cases fallback:', err.message);
  }

  return DEFAULT_CASES;
}
