import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { remainingSecondsFrom } from './otpTiming';

export default function OtpSentModal({ visible, payload, onContinue }) {
  const [remaining, setRemaining] = useState(() => remainingSecondsFrom(payload?.expires_at));

  useEffect(() => {
    setRemaining(remainingSecondsFrom(payload?.expires_at));
    const timer = setInterval(() => {
      setRemaining(remainingSecondsFrom(payload?.expires_at));
    }, 250);
    return () => clearInterval(timer);
  }, [payload?.expires_at, visible]);

  const otpCode = payload?.dev_otp || payload?.demo_otp || payload?.otp || '123456';
  const expired = remaining <= 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onContinue}>
      <View style={styles.notificationOverlay}>
        <View style={styles.notification}>
          {/* Blue Shield Icon */}
          <View style={styles.notificationIcon}>
            <Ionicons name="shield-checkmark" size={24} color="#1976D2" />
          </View>

          {/* Notification Content */}
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>CINTRA Security</Text>
            <Text style={styles.notificationSubtitle}>One-Time Password</Text>

            <View style={styles.otpRow}>
              <Text style={styles.otpLabel}>OTP: </Text>
              <Text style={styles.otpValue}>{otpCode}</Text>
            </View>

            <Text style={[styles.notificationExpiry, expired && styles.expiredText]}>
              {expired ? 'Expired' : `Valid for ${remaining > 0 ? remaining : 60} seconds`}
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={onContinue}
            activeOpacity={0.8}
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueText}>CONTINUE</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  notificationOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 42,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  notification: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    borderLeftColor: '#1976D2',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    maxWidth: 540,
    alignSelf: 'center',
    width: '100%',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
  },
  notificationSubtitle: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
  },
  otpValue: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: '#1976D2',
  },
  notificationExpiry: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  expiredText: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 2,
  },
});
