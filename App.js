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

import EvidenceDetailsScreen from './screens/EvidenceDetailsScreen';
import EvidenceCustodyScreen from './screens/EvidenceCustodyScreen';
import EvidenceVerifyScreen from './screens/EvidenceVerifyScreen';

import {
  isAuthenticated,
  logout,
  updateActivity,
} from './services/authService';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef(null);

  const wasAuthenticated = useRef(false);
  const loggingOut = useRef(false);

  useEffect(() => {
    const checkSession = () => {
      if (loggingOut.current) {
        return;
      }

      const authenticated = isAuthenticated();

      const currentRoute =
        navigationRef.current?.getCurrentRoute()?.name;

      if (authenticated) {
        wasAuthenticated.current = true;
        return;
      }

      if (
        wasAuthenticated.current &&
        currentRoute !== 'Login' &&
        currentRoute !== 'OTP'
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
      }
    };

    checkSession();

    const interval = setInterval(
      checkSession,
      1000
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleActivity = () => {
    if (loggingOut.current) {
      return;
    }

    if (isAuthenticated()) {
      updateActivity();
    }
  };

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        handleActivity();
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
            name="EvidenceDetails"
            component={EvidenceDetailsScreen}
          />

          <Stack.Screen
            name="EvidenceCustody"
            component={EvidenceCustodyScreen}
          />

          <Stack.Screen
            name="EvidenceVerify"
            component={EvidenceVerifyScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}