import React, { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  validateBadgeId,
  generateOTP,
  logout,
} from '../services/authService';

export default function LoginScreen({ navigation }) {
  const [badgeId, setBadgeId] = useState('');
  const [showOTPNotification, setShowOTPNotification] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState('');

  const handleLogin = () => {
    const cleanedBadgeId = badgeId.trim();

    // Clear any previous session
    logout();

    // Check Badge ID
    if (!cleanedBadgeId) {
      Alert.alert(
        'Badge ID Required',
        'Please enter your Badge ID (Demo: OFF001).'
      );
      return;
    }

    // Validate Badge ID
    if (!validateBadgeId(cleanedBadgeId)) {
      Alert.alert(
        'Access Denied',
        'Invalid Badge ID. Please use Demo Badge ID: OFF001.'
      );
      return;
    }

    // Generate random 6-digit OTP
    const newOTP = generateOTP();

    setGeneratedOTP(newOTP);
    setShowOTPNotification(true);
  };

  const continueToOTP = () => {
    setShowOTPNotification(false);

    navigation.navigate('OTP', {
      badgeId: badgeId.trim(),
    });
  };

  return (
    <View style={styles.container}>

      {/* ================================= */}
      {/* TOP OTP NOTIFICATION              */}
      {/* ================================= */}

      <Modal
        visible={showOTPNotification}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowOTPNotification(false);
        }}
      >
        <View style={styles.notificationOverlay}>

          <View style={styles.notification}>

            {/* Blue Icon */}
            <View style={styles.notificationIcon}>
              <Ionicons
                name="shield-checkmark"
                size={23}
                color="#1976D2"
              />
            </View>

            {/* Notification Information */}
            <View style={styles.notificationContent}>

              <Text style={styles.notificationTitle}>
                CINTRA Security
              </Text>

              <Text style={styles.notificationSubtitle}>
                One-Time Password
              </Text>

              <View style={styles.otpContainer}>
                <Text style={styles.otpLabel}>
                  OTP
                </Text>

                <Text style={styles.otpText}>
                  {generatedOTP}
                </Text>
              </View>

              <Text style={styles.notificationExpiry}>
                Valid for 60 seconds
              </Text>

            </View>

            {/* Continue */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={continueToOTP}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-forward"
                size={16}
                color="#FFFFFF"
              />

              <Text style={styles.continueText}>
                CONTINUE
              </Text>
            </TouchableOpacity>

          </View>

        </View>
      </Modal>

      {/* ================================= */}
      {/* LOGIN SCREEN                       */}
      {/* ================================= */}

      <View style={styles.logoSection}>

        <View style={styles.logoIcon}>
          <Ionicons
            name="shield-checkmark"
            size={34}
            color="#1976D2"
          />
        </View>

        <Text style={styles.title}>
          CINTRA
        </Text>

        <Text style={styles.subtitle}>
          Officer Login
        </Text>

      </View>

      {/* ================================= */}
      {/* BADGE ID CARD                      */}
      {/* ================================= */}

      <View style={styles.loginCard}>

        <Text style={styles.inputLabel}>
          OFFICER BADGE ID
        </Text>

        <View style={styles.inputContainer}>

          <Ionicons
            name="card"
            size={21}
            color="#1976D2"
          />

          <TextInput
            style={styles.input}
            placeholder="Enter Badge ID"
            placeholderTextColor="#999"
            value={badgeId}
            onChangeText={setBadgeId}
            autoCapitalize="characters"
            autoCorrect={false}
          />

        </View>

        <Text style={styles.demoText}>
          Demo Badge ID: OFF001
        </Text>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          activeOpacity={0.8}
        >

          <Ionicons
            name="log-in"
            size={21}
            color="#FFFFFF"
          />

          <Text style={styles.loginButtonText}>
            LOGIN
          </Text>

        </TouchableOpacity>

      </View>

      {/* ================================= */}
      {/* SECURITY INFORMATION               */}
      {/* ================================= */}

      <View style={styles.securityCard}>

        <View style={styles.securityIcon}>
          <Ionicons
            name="shield-checkmark"
            size={22}
            color="#1976D2"
          />
        </View>

        <View style={styles.securityContent}>

          <Text style={styles.securityTitle}>
            SECURE ACCESS
          </Text>

          <Text style={styles.securityText}>
            Two-factor authentication required
          </Text>

        </View>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  // =================================
  // MAIN SCREEN
  // =================================

  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: '#F5F7FA',
  },

  // =================================
  // LOGO
  // =================================

  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 2,
  },

  subtitle: {
    fontSize: 17,
    color: '#666',
    marginTop: 4,
  },

  // =================================
  // LOGIN CARD
  // =================================

  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 3,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 9,
    letterSpacing: 0.5,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },

  demoText: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },

  // =================================
  // LOGIN BUTTON
  // =================================

  loginButton: {
    height: 52,
    backgroundColor: '#1976D2',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    elevation: 2,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  },

  // =================================
  // SECURITY CARD
  // =================================

  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
  },

  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  securityContent: {
    marginLeft: 11,
  },

  securityTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.5,
  },

  securityText: {
    fontSize: 11,
    color: '#666',
    marginTop: 3,
  },

  // =================================
  // OTP NOTIFICATION
  // =================================

  notificationOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 42,
    paddingHorizontal: 12,
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
    shadowOffset: {
      width: 0,
      height: 3,
    },
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

  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  otpLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#777',
    marginRight: 7,
  },

  otpText: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: '#1976D2',
  },

  notificationExpiry: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },

  continueButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    marginLeft: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },

  continueText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 4,
  },

});