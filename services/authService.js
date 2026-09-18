const DEMO_BADGE_ID = 'OFF001';

const SESSION_TIMEOUT = 60 * 1000; // 60 seconds
const OTP_TIMEOUT = 60 * 1000; // 60 seconds

let currentUser = null;
let lastActivityTime = null;

let currentOTP = null;
let otpGeneratedTime = null;

export const validateBadgeId = (badgeId) => {
  return badgeId === DEMO_BADGE_ID;
};

export const generateOTP = () => {
  const otp = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  currentOTP = otp;
  otpGeneratedTime = Date.now();

  return otp;
};

export const verifyOTP = (otp) => {
  if (!currentOTP || !otpGeneratedTime) {
    return false;
  }

  if (Date.now() - otpGeneratedTime >= OTP_TIMEOUT) {
    currentOTP = null;
    otpGeneratedTime = null;
    return false;
  }

  if (otp !== currentOTP) {
    return false;
  }

  // OTP can only be used once
  currentOTP = null;
  otpGeneratedTime = null;

  return true;
};


export const login = (badgeId) => {
  currentUser = {
    badgeId: badgeId,
  };

  lastActivityTime = Date.now();
};

export const logout = () => {
  currentUser = null;
  lastActivityTime = null;
  currentOTP = null;
  otpGeneratedTime = null;
};

export const updateActivity = () => {
  if (currentUser !== null) {
    lastActivityTime = Date.now();
  }
};

export const isAuthenticated = () => {
  if (currentUser === null) {
    return false;
  }

  if (lastActivityTime === null) {
    logout();
    return false;
  }

  const inactiveTime =
    Date.now() - lastActivityTime;

  if (inactiveTime >= SESSION_TIMEOUT) {
    logout();
    return false;
  }

  return true;
};


export const getCurrentUser = () => {
  return currentUser;
};

export const getRemainingSessionTime = () => {
  if (
    currentUser === null ||
    lastActivityTime === null
  ) {
    return 0;
  }

  const elapsed =
    Date.now() - lastActivityTime;

  const remaining =
    SESSION_TIMEOUT - elapsed;

  return Math.max(0, remaining);
};