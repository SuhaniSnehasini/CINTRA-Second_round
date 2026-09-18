import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

import {
  verifyOTP,
  login,
  isAuthenticated,
  updateActivity,
} from '../services/authService';

export default function OTPScreen({ navigation, route }) {
  const [otp, setOtp] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const badgeId = route?.params?.badgeId;

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleOTPChange = (value) => {
    const cleaned = String(value || '').replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);

    if (isAuthenticated()) {
      updateActivity();
    }
  };

  const handleVerify = () => {
    if (isAuthenticated()) {
      updateActivity();
    }

    if (attempts >= 3) {
      Alert.alert(
        'Access Blocked',
        'Too many incorrect OTP attempts.'
      );
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      Alert.alert(
        'Invalid OTP',
        'OTP must contain exactly 6 digits.'
      );
      return;
    }

    if (!verifyOTP(otp)) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 3) {
        Alert.alert(
          'Access Blocked',
          'Too many incorrect OTP attempts.'
        );
      } else {
        Alert.alert(
          'Incorrect OTP',
          `You have ${3 - newAttempts} attempt(s) remaining.`
        );
      }

      setOtp('');
      return;
    }

    login(badgeId);
    navigation.replace('Home');
  };

  return (
    <View
      style={styles.container}
      onTouchStart={() => {
        if (isAuthenticated()) {
          updateActivity();
        }
      }}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          Verify OTP
        </Text>

        <Text style={styles.subtitle}>
          Enter the 6-digit OTP code to verify your access
        </Text>

        {/* 6 DIGIT OTP BOXES */}
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
            onChangeText={handleOTPChange}
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

        <TouchableOpacity
          style={[
            styles.button,
            (attempts >= 3 || otp.length !== 6) && styles.disabledButton,
          ]}
          onPress={handleVerify}
          disabled={attempts >= 3 || otp.length !== 6}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            VERIFY OTP
          </Text>
        </TouchableOpacity>

        {attempts > 0 && attempts < 3 && (
          <Text style={styles.attemptText}>
            Failed attempts: {attempts}/3
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
    backgroundColor: '#F5F7FA',
  },

  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1976D2',
  },

  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },

  otpWrapper: {
    width: '100%',
    height: 54,
    position: 'relative',
    marginBottom: 24,
    justifyContent: 'center',
  },

  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: '100%',
  },

  box: {
    flex: 1,
    height: 54,
    borderWidth: 1.5,
    borderColor: '#D5D5D5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  boxFilled: {
    borderColor: '#1976D2',
    backgroundColor: '#E3F2FD',
  },

  boxActive: {
    borderColor: '#1976D2',
    borderWidth: 2,
    backgroundColor: '#E3F2FD',
  },

  boxText: {
    color: '#222',
    fontSize: 22,
    fontWeight: 'bold',
  },

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

  button: {
    width: '100%',
    height: 52,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  attemptText: {
    marginTop: 14,
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '600',
  },
});