const STORAGE_KEY = 'cintra.admin.sidebar.collapsed';

let collapsed = false;

function readStored() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === '1';
    }
  } catch (error) {
    return collapsed;
  }
  return collapsed;
}

collapsed = readStored();

export function getSidebarCollapsed() {
  return collapsed;
}

export function setSidebarCollapsed(value) {
  collapsed = Boolean(value);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    }
  } catch (error) {
    // Persistence is optional; in-memory state still survives Admin page navigation.
  }
  return collapsed;
}
