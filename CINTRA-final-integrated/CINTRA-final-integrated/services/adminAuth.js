const ADMIN_SESSION_TIMEOUT = 60 * 1000; // 60 seconds

let adminSession = null;
let lastAdminActivityTime = null;

export function setAdminSession(session) {
  if (session) {
    adminSession = {
      token: session.token,
      admin: session.admin,
      expiresInSeconds: session.expiresInSeconds || 60,
    };
    lastAdminActivityTime = Date.now();
  } else {
    clearAdminSession();
  }
}

export function getAdminSession() {
  return adminSession;
}

export function getAdminToken() {
  if (!isAdminAuthenticated()) {
    return null;
  }
  return adminSession?.token || null;
}

export function getAdminProfile() {
  return adminSession?.admin || null;
}

export function updateAdminActivity() {
  if (adminSession !== null) {
    lastAdminActivityTime = Date.now();
  }
}

export function clearAdminSession() {
  adminSession = null;
  lastAdminActivityTime = null;
}

export function isAdminAuthenticated() {
  if (!adminSession || !adminSession.token) {
    return false;
  }

  if (lastAdminActivityTime === null) {
    clearAdminSession();
    return false;
  }

  const inactiveTime = Date.now() - lastAdminActivityTime;
  if (inactiveTime >= ADMIN_SESSION_TIMEOUT) {
    clearAdminSession();
    return false;
  }

  return true;
}

export function getRemainingAdminSessionTime() {
  if (!adminSession || lastAdminActivityTime === null) {
    return 0;
  }

  const elapsed = Date.now() - lastAdminActivityTime;
  const remaining = ADMIN_SESSION_TIMEOUT - elapsed;
  return Math.max(0, remaining);
}

// Bind browser DOM activity listeners for web execution environment
if (typeof window !== 'undefined' && window.addEventListener) {
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, () => {
      updateAdminActivity();
    }, { passive: true });
  });
}
