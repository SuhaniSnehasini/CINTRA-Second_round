import React, { useEffect, useRef } from 'react';

import {
  View,
  Alert,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import OTPScreen from './screens/OTPScreen';
import HomeScreen from './screens/HomeScreen';
import ScannerScreen from './screens/ScannerScreen';
import ResultScreen from './screens/ResultScreen';
import CaptureEvidenceScreen from './screens/CaptureEvidenceScreen';
import FaceMatchResultScreen from './screens/FaceMatchResultScreen';
import DatabaseSearchScreen from './screens/DatabaseSearchScreen';
import EvidenceUploadScreen from './screens/EvidenceUploadScreen';
import EvidenceTypeScreen from './screens/EvidenceTypeScreen';
import EvidenceHubScreen from './screens/EvidenceHubScreen';
import AdminLoginScreen from './screens/admin/AdminLoginScreen';
import AdminOtpScreen from './screens/admin/AdminOtpScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import AdminResourceScreen from './screens/admin/AdminResourceScreen';
import AdminDetailScreen from './screens/admin/AdminDetailScreen';
import AdminAnalyticsScreen from './screens/admin/AdminAnalyticsScreen';
import {
  AdminAdminsScreen,
  AdminIntegrityScreen,
  AdminSettingsScreen,
  AdminSystemScreen,
} from './screens/admin/AdminToolsScreens';

import {
  isAuthenticated,
  logout,
  updateActivity,
} from './services/authService';

import {
  isAdminAuthenticated,
  clearAdminSession,
  updateAdminActivity,
} from './services/adminAuth';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef(null);

  // Used to know whether a real session was previously active
  const wasAuthenticated = useRef(false);
  const wasAdminAuthenticated = useRef(false);

  // Prevent duplicate logout/alerts
  const loggingOut = useRef(false);

  useEffect(() => {
    const checkSession = () => {
      if (loggingOut.current) {
        return;
      }

      const officerAuth = isAuthenticated();
      const adminAuth = isAdminAuthenticated();
      const currentRoute = navigationRef.current?.getCurrentRoute()?.name;

      // Track officer authentication
      if (officerAuth) {
        wasAuthenticated.current = true;
      }

      // Track admin authentication
      if (adminAuth) {
        wasAdminAuthenticated.current = true;
      }

      /*
       * Officer session expiration handling
       */
      if (
        !officerAuth &&
        wasAuthenticated.current &&
        currentRoute !== 'Login' &&
        currentRoute !== 'OTP' &&
        !String(currentRoute || '').startsWith('Admin')
      ) {
        wasAuthenticated.current = false;
        loggingOut.current = true;

        logout();

        Alert.alert(
          'Session Expired',
          'You have been automatically logged out after 60 seconds of inactivity.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigationRef.current?.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Login',
                    },
                  ],
                });

                loggingOut.current = false;
              },
            },
          ],
          {
            cancelable: false,
          }
        );
        return;
      }

      /*
       * Admin session expiration handling (60-second inactivity security)
       */
      if (
        !adminAuth &&
        wasAdminAuthenticated.current &&
        currentRoute !== 'AdminLogin' &&
        currentRoute !== 'AdminOTP'
      ) {
        wasAdminAuthenticated.current = false;
        loggingOut.current = true;

        clearAdminSession();

        Alert.alert(
          'Session Expired',
          'Your session expired due to inactivity. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigationRef.current?.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'AdminLogin',
                    },
                  ],
                });

                loggingOut.current = false;
              },
            },
          ],
          {
            cancelable: false,
          }
        );
      }
    };

    // Check immediately
    checkSession();

    // Check every second
    const interval = setInterval(checkSession, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
   * Any touch/interaction anywhere in the application
   * counts as user activity.
   */
  const handleActivity = () => {
    if (loggingOut.current) {
      return;
    }

    if (isAuthenticated()) {
      updateActivity();
    }

    if (isAdminAuthenticated()) {
      updateAdminActivity();
    }
  };

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        handleActivity();

        // Return false so the actual button/input
        // can still receive the touch.
        return false;
      }}
    >
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
          />

          <Stack.Screen
            name="OTP"
            component={OTPScreen}
          />

          <Stack.Screen
            name="Home"
            component={HomeScreen}
          />

          <Stack.Screen
            name="Scanner"
            component={ScannerScreen}
          />

          <Stack.Screen
            name="Result"
            component={ResultScreen}
          />

          <Stack.Screen
            name="CaptureEvidence"
            component={CaptureEvidenceScreen}
          />

          <Stack.Screen
            name="FaceMatchResult"
            component={FaceMatchResultScreen}
          />

          <Stack.Screen
            name="DatabaseSearch"
            component={DatabaseSearchScreen}
          />

          <Stack.Screen
            name="EvidenceUpload"
            component={EvidenceUploadScreen}
          />

          <Stack.Screen
            name="EvidenceType"
            component={EvidenceTypeScreen}
          />

          <Stack.Screen
            name="EvidenceHub"
            component={EvidenceHubScreen}
          />

          <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          <Stack.Screen name="AdminOTP" component={AdminOtpScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="AdminOfficers" component={AdminResourceScreen} />
          <Stack.Screen name="AdminPersons" component={AdminResourceScreen} />
          <Stack.Screen name="AdminRecognition" component={AdminResourceScreen} />
          <Stack.Screen name="AdminEvidence" component={AdminResourceScreen} />
          <Stack.Screen name="AdminInvestigations" component={AdminResourceScreen} />
          <Stack.Screen name="AdminAudit" component={AdminResourceScreen} />
          <Stack.Screen name="AdminOfficerDetail" component={AdminDetailScreen} />
          <Stack.Screen name="AdminPersonDetail" component={AdminDetailScreen} />
          <Stack.Screen name="AdminRecognitionDetail" component={AdminDetailScreen} />
          <Stack.Screen name="AdminEvidenceDetail" component={AdminDetailScreen} />
          <Stack.Screen name="AdminInvestigationDetail" component={AdminDetailScreen} />
          <Stack.Screen name="AdminIntegrity" component={AdminIntegrityScreen} />
          <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
          <Stack.Screen name="AdminSystem" component={AdminSystemScreen} />
          <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
          <Stack.Screen name="AdminAdmins" component={AdminAdminsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}