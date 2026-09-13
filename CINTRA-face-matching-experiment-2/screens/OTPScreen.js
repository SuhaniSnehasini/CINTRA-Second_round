import React, { useEffect, useState } from 'react';
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

  const badgeId = route?.params?.badgeId;

  // --------------------
  // Session check
  // --------------------

  useEffect(() => {
    // OTP screen is before login authentication,
    // so do not require isAuthenticated() here.
    // The officer becomes authenticated only after
    // successful OTP verification.
  }, []);

  // --------------------
  // OTP input activity
  // --------------------

  const handleOTPChange = (value) => {
    setOtp(value);

    // If a session already exists, record activity.
    if (isAuthenticated()) {
      updateActivity();
    }
  };

  // --------------------
  // OTP verification
  // --------------------

  const handleVerify = () => {
    if (isAuthenticated()) {
      updateActivity();
    }

    // Stop verification after 3 failed attempts
    if (attempts >= 3) {
      Alert.alert(
        'Access Blocked',
        'Too many incorrect OTP attempts.'
      );
      return;
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert(
        'Invalid OTP',
        'OTP must contain exactly 6 digits.'
      );
      return;
    }

    // Verify OTP
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
          ` You have ${
            3 - newAttempts
          } attempt(s) remaining.`
        );
      }

      setOtp('');
      return;
    }

    // Successful authentication
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
      <Text style={styles.title}>
        Verify OTP
      </Text>

      <Text style={styles.subtitle}>
        Enter the 6-digit OTP sent to your device
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit OTP"
        placeholderTextColor="#888"
        keyboardType="numeric"
        maxLength={6}
        value={otp}
        onChangeText={handleOTPChange}
      />

      <TouchableOpacity
        style={[
          styles.button,
          attempts >= 3 &&
            styles.disabledButton,
        ]}
        onPress={handleVerify}
        disabled={attempts >= 3}
      >
        <Text style={styles.buttonText}>
          VERIFY
        </Text>
      </TouchableOpacity>

      {attempts > 0 && attempts < 3 && (
        <Text style={styles.attemptText}>
          Failed attempts: {attempts}/3
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1976D2',
  },

  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#555',
    fontSize: 14,
  },

  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
  },

  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  attemptText: {
    marginTop: 12,
    color: '#c62828',
    fontSize: 14,
  },
});