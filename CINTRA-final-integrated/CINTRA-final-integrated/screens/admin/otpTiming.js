export function remainingSecondsFrom(expiresAt) {
  if (!expiresAt) {
    return 0;
  }
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) {
    return 0;
  }
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

export function canShowDemoOtp(payload) {
  if (!payload) {
    return false;
  }
  const code = payload.dev_otp || payload.demo_otp;
  return Boolean(code) && payload.otp_provider === 'console';
}
