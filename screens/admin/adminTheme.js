export const colors = {
  bg: '#F8FAFC',
  panel: '#FFFFFF',
  panelAlt: '#EFF6FF',
  line: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  accent: '#1976D2',
  accentLight: '#E3F2FD',
  success: '#059669',
  successBg: '#DCFCE7',
  warn: '#D97706',
  warnBg: '#FEF3C7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  info: '#2563EB',
  infoBg: '#DBEAFE',
  demoText: '#7C3AED',
  demoBg: '#F3E8FF',
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};

export const NAV_ITEMS = [
  { key: 'AdminDashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'AdminOfficers', label: 'Officers', icon: 'people-outline' },
  { key: 'AdminPersons', label: 'Persons / Face Database', icon: 'finger-print-outline' },
  { key: 'AdminRecognition', label: 'Recognition Center', icon: 'scan-outline' },
  { key: 'AdminEvidence', label: 'Evidence', icon: 'folder-outline' },
  { key: 'AdminInvestigations', label: 'Investigations', icon: 'briefcase-outline' },
  { key: 'AdminIntegrity', label: 'Record Integrity', icon: 'shield-checkmark-outline' },
  { key: 'AdminAnalytics', label: 'Analytics & Reports', icon: 'bar-chart-outline' },
  { key: 'AdminAudit', label: 'Audit & Security', icon: 'lock-closed-outline' },
  { key: 'AdminSystem', label: 'System Health', icon: 'pulse-outline' },
  { key: 'AdminSettings', label: 'Settings', icon: 'settings-outline' },
  { key: 'AdminAdmins', label: 'Admin Management', icon: 'shield-outline', superOnly: true },
];

export const MOBILE_BREAKPOINT = 768;
export const SIDEBAR_EXPANDED = 260;
export const SIDEBAR_COLLAPSED = 72;

