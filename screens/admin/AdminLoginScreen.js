import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../services/adminApi';
import { colors } from './adminTheme';
import OtpSentModal from './OtpSentModal';

export default function AdminLoginScreen({ navigation }) {
  const [adminUserId, setAdminUserId] = useState('CINTRA-ADM-001');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otpPayload, setOtpPayload] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  const sendOtp = async () => {
    const id = adminUserId.trim();
    if (!id) {
      setError('Enter an administrator identifier such as CINTRA-ADM-001.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = await adminApi.sendOtp(id);
      setOtpPayload({ ...payload, admin_user_id: id });
      setShowPopup(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const continueToEntry = () => {
    setShowPopup(false);
    navigation.navigate('AdminOTP', {
      adminUserId: otpPayload.admin_user_id,
      requestId: otpPayload.request_id,
      expiresAt: otpPayload.expires_at,
      expiresInSeconds: otpPayload.expires_in || otpPayload.expires_in_seconds,
      destinationHint: otpPayload.destination_hint,
      devOtp: otpPayload.dev_otp || otpPayload.demo_otp,
      otpProvider: otpPayload.otp_provider,
      demoMode: otpPayload.demo_mode,
    });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.centerWrapper}>
        
        {/* LOGO HEADER */}
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Ionicons name="shield-checkmark" size={34} color={colors.accent} />
          </View>
          <Text style={styles.title}>CINTRA</Text>
          <Text style={styles.subtitle}>Administrator Portal</Text>
        </View>

        {/* PORTAL SWITCHER CHIPS */}
        <View style={styles.portalRow}>
          <TouchableOpacity
            style={styles.portalChip}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.portalChipTextInactive}>Officer Login</Text>
          </TouchableOpacity>
          <View style={[styles.portalChip, styles.portalChipOn]}>
            <Text style={styles.portalChipTextActive}>Admin Login</Text>
          </View>
        </View>

        {/* LOGIN CARD */}
        <View style={styles.card}>
          <Text style={styles.label}>ADMINISTRATOR ID</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="shield-outline" size={20} color={colors.accent} />
            <TextInput
              style={styles.input}
              value={adminUserId}
              onChangeText={setAdminUserId}
              autoCapitalize="characters"
              placeholder="CINTRA-ADM-001"
              placeholderTextColor={colors.muted}
            />
          </View>
          
          <Text style={styles.hint}>
            Demo IDs: CINTRA-ADM-001 (SUPER_ADMIN), CINTRA-ADM-002 (ADMIN), CINTRA-AUD-001 (AUDITOR)
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={sendOtp}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityLabel="Login"
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>
              {busy ? 'Logging in...' : 'LOGIN'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECURITY INFO FOOTER */}
        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Ionicons name="lock-closed" size={22} color={colors.accent} />
          </View>
          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>SECURE ADMIN ACCESS</Text>
            <Text style={styles.securityText}>Two-factor authentication required for administrative actions</Text>
          </View>
        </View>

      </View>

      <OtpSentModal visible={showPopup} payload={otpPayload} onContinue={continueToEntry} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 22 },
  centerWrapper: { width: '100%', maxWidth: 440 },
  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 34, fontWeight: '800', color: colors.accent, letterSpacing: 2 },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: 4 },
  portalRow: { flexDirection: 'row', marginBottom: 16, gap: 10 },
  portalChip: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  portalChipOn: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  portalChipTextActive: { fontWeight: '700', color: colors.accent, fontSize: 13 },
  portalChipTextInactive: { fontWeight: '600', color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, marginBottom: 8, letterSpacing: 0.5 },
  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 15, color: colors.text, fontWeight: '600' },
  hint: { fontSize: 11, color: colors.muted, marginTop: 8, lineHeight: 16 },
  error: { color: colors.danger, marginTop: 10, fontWeight: '600', fontSize: 13 },
  button: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityContent: { marginLeft: 12, flex: 1 },
  securityTitle: { fontSize: 12, fontWeight: '800', color: colors.accent, letterSpacing: 0.5 },
  securityText: { fontSize: 11, color: colors.muted, marginTop: 2, lineHeight: 15 },
});
