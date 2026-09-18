import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../services/adminApi';
import { setAdminSession } from '../../services/adminAuth';
import { colors } from './adminTheme';
import OtpSentModal from './OtpSentModal';
import { remainingSecondsFrom } from './otpTiming';

export default function AdminOtpScreen({ navigation, route }) {
  const [adminUserId, setAdminUserId] = useState(route.params?.adminUserId || '');
  const [requestId, setRequestId] = useState(route.params?.requestId || '');
  const [expiresAt, setExpiresAt] = useState(route.params?.expiresAt || '');
  const [otpProvider, setOtpProvider] = useState(route.params?.otpProvider || '');
  const [devOtp, setDevOtp] = useState(route.params?.devOtp || route.params?.demo_otp || '');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [remaining, setRemaining] = useState(() => remainingSecondsFrom(route.params?.expiresAt));
  const [popupPayload, setPopupPayload] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (route.params?.adminUserId) setAdminUserId(route.params.adminUserId);
    if (route.params?.requestId) setRequestId(route.params.requestId);
    if (route.params?.expiresAt) setExpiresAt(route.params.expiresAt);
    if (route.params?.otpProvider) setOtpProvider(route.params.otpProvider);
    if (route.params?.devOtp || route.params?.demo_otp) {
      setDevOtp(route.params.devOtp || route.params.demo_otp);
    }
  }, [route.params]);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(remainingSecondsFrom(expiresAt));
    }, 250);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const expired = remaining <= 0;

  const applyOtpValue = (value) => {
    const cleaned = String(value || '').replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
    setError('');
  };

  const verify = async () => {
    if (expired) {
      setError('The verification code has expired.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('OTP must contain exactly 6 digits.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = await adminApi.verifyOtp({
        admin_user_id: adminUserId,
        otp,
        request_id: requestId,
      });
      setAdminSession({
        token: payload.access_token,
        admin: payload.admin,
        expiresInSeconds: payload.expires_in_seconds,
      });
      setSuccess('Verification successful');
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
      }, 600);
    } catch (err) {
      const message = err.message || '';
      if (message.toLowerCase().includes('expired')) {
        setError('The verification code has expired.');
      } else if (err.status === 401) {
        setError('Invalid OTP. Please check the code and try again.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    setOtp('');
    try {
      const payload = await adminApi.sendOtp(adminUserId);
      setRequestId(payload.request_id);
      setExpiresAt(payload.expires_at);
      setOtpProvider(payload.otp_provider);
      if (payload.dev_otp || payload.demo_otp) {
        setDevOtp(payload.dev_otp || payload.demo_otp);
      }
      setPopupPayload({ ...payload, admin_user_id: adminUserId });
      setShowPopup(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleFillDemoOtp = () => {
    if (devOtp) {
      applyOtpValue(devOtp);
    }
  };

  const handleBackToLogin = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('AdminLogin');
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.iconHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="keypad-outline" size={26} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.kicker}>CINTRA ADMIN VERIFICATION</Text>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.meta}>
          Enter the 6-digit OTP code sent for admin account <Text style={styles.boldId}>{adminUserId || 'Admin'}</Text>
        </Text>


        <View style={styles.otpWrapper}>
          <View style={styles.boxes} pointerEvents="none">
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = Boolean(otp[index]);
              const isCurrent = otp.length === index || (otp.length === 6 && index === 5);
              return (
                <View
                  key={index}
                  style={[
                    styles.box,
                    isFilled && styles.boxFilled,
                    isCurrent && isFocused && styles.boxActive,
                  ]}
                >
                  <Text style={styles.boxText}>{otp[index] || ''}</Text>
                </View>
              );
            })}
          </View>

          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={applyOtpValue}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={6}
            style={styles.realOtpInput}
            accessibilityLabel="Six digit OTP input"
          />
        </View>

        <Text style={[styles.timer, expired && styles.expired]}>
          {expired ? 'OTP EXPIRED' : `Code expires in ${remaining} second${remaining === 1 ? '' : 's'}`}
        </Text>

        {expired ? <Text style={styles.error}>The verification code has expired.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {expired ? (
          <TouchableOpacity style={styles.button} onPress={resend} disabled={Boolean(resending)} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{resending ? 'Sending new OTP...' : 'RESEND OTP'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, (busy || Boolean(success) || otp.length !== 6) && styles.buttonDisabled]}
            onPress={verify}
            disabled={Boolean(busy || success || otp.length !== 6)}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{busy ? 'VERIFYING...' : 'VERIFY OTP'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={16} color={colors.accent} style={styles.backIcon} />
          <Text style={styles.backText}>Back to Admin Login</Text>
        </TouchableOpacity>
      </View>

      <OtpSentModal
        visible={showPopup}
        payload={popupPayload}
        onContinue={() => setShowPopup(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconHeader: { marginBottom: 14 },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kicker: { color: colors.accent, letterSpacing: 1.5, fontWeight: '800', fontSize: 11, marginBottom: 4 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  meta: { color: colors.muted, marginBottom: 16, textAlign: 'center', fontSize: 13, lineHeight: 18 },
  boldId: { color: colors.text, fontWeight: '700' },
  demoBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },
  demoBadgeText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  demoCodeText: { color: colors.accent, fontWeight: '800', letterSpacing: 1 },
  otpWrapper: {
    width: '100%',
    height: 54,
    position: 'relative',
    marginTop: 4,
    marginBottom: 8,
    justifyContent: 'center',
  },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%', height: '100%' },
  box: {
    flex: 1,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  boxActive: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accentLight,
  },
  boxText: { color: colors.text, fontSize: 22, fontWeight: '800' },
  realOtpInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.01,
    color: 'transparent',
    fontSize: 1,
    zIndex: 10,
  },
  timer: { color: colors.muted, marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: '600' },
  expired: { color: colors.danger, fontWeight: '800' },
  error: { color: colors.danger, marginBottom: 10, fontWeight: '600', fontSize: 13 },
  success: { color: colors.success, fontWeight: '700', marginBottom: 10, fontSize: 13 },
  button: {
    marginTop: 10,
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, fontSize: 14 },
  backButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backIcon: { marginRight: 6 },
  backText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
