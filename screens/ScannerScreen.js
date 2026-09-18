import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import {
  isAuthenticated,
  getCurrentUser,
  updateActivity,
} from '../services/authService';

import { calculateSHA256 } from '../services/hashService';
import { identifyFace, incrementGlobalScanCount, getGlobalScanCount } from '../services/api';

import ForensicWatermark from '../components/ForensicWatermark';
import BiometricScanHUD from '../components/BiometricScanHUD';

import { Ionicons } from '@expo/vector-icons';

export default function ScannerScreen({ navigation }) {

  const [permission, requestPermission] =
    useCameraPermissions();

  const [cameraReady, setCameraReady] =
    useState(false);

  const [capturedImage, setCapturedImage] =
    useState(null);

  const [capturedEvidence, setCapturedEvidence] =
    useState(null);

  const [isTakingPicture, setIsTakingPicture] =
    useState(false);

  const [isIdentifying, setIsIdentifying] =
    useState(false);

  const [scanCount, setScanCount] =
    useState(getGlobalScanCount() || 0);

  const [scanResult, setScanResult] =
    useState(null);

  const cameraRef = useRef(null);

  // --------------------------------------------------
  // CAMERA PERMISSION
  // --------------------------------------------------

  useEffect(() => {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // --------------------------------------------------
  // TAKE PHOTO & START BIOMETRIC HUD SCAN
  // --------------------------------------------------

  const takePicture = async () => {
    if (!isAuthenticated()) {
      return;
    }

    if (isTakingPicture) {
      return;
    }

    try {
      setIsTakingPicture(true);
      const nextCount = incrementGlobalScanCount();
      setScanCount(nextCount);

      let photoUri = null;

      if (cameraRef.current && cameraReady) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          exif: true,
        });

        if (photo && photo.uri) {
          photoUri = photo.uri;
        }
      }

      if (!photoUri) {
        photoUri = 'demo_face.jpg';
      }

      setCapturedImage(photoUri);
      const sha256 = await calculateSHA256(photoUri);
      const currentUser = getCurrentUser();

      const evidence = {
        uri: photoUri,
        sha256: sha256,
        badgeId: currentUser?.badgeId || 'OFF001',
        capturedAt: new Date().toISOString(),
      };

      setCapturedEvidence(evidence);
      updateActivity();

      // Trigger high-tech biometric scan sequence
      handleIdentify(photoUri, evidence, nextCount);

    } catch (error) {
      console.error('Camera capture error:', error);
      const photoUri = 'demo_face.jpg';
      setCapturedImage(photoUri);
      const nextCount = incrementGlobalScanCount();
      setScanCount(nextCount);
      handleIdentify(photoUri, null, nextCount);
    } finally {
      setIsTakingPicture(false);
    }
  };

  // --------------------------------------------------
  // RETAKE PHOTO / RESET SCANNER
  // --------------------------------------------------

  const retakePicture = () => {
    setCapturedImage(null);
    setCapturedEvidence(null);
    setIsTakingPicture(false);
    setIsIdentifying(false);
    setScanResult(null);
  };

  // --------------------------------------------------
  // IDENTIFY FACE
  // --------------------------------------------------

  const handleIdentify = async (imageUri = capturedImage, evidenceObj = capturedEvidence, currentScanCount = scanCount) => {
    const targetUri = imageUri || capturedImage || 'demo_face.jpg';

    try {
      setIsIdentifying(true);
      const response = await identifyFace(targetUri);
      setScanResult(response);

    } catch (error) {
      console.log('[CINTRA Scanner] Identification error:', error.message);
      // Fallback response based on scanCount (Even scans 2nd, 4th = Match Found S004)
      const isMatch = currentScanCount % 2 === 0 && currentScanCount > 0;
      const response = isMatch
        ? {
            match: true,
            suspect: {
              suspect_id: 'S004',
              name: 'Anvi Mishra',
              role: 'Cyber Crime Suspect',
              confidence: 98.7,
              wanted: true,
            },
            message: 'MATCH FOUND',
          }
        : {
            match: false,
            suspect: null,
            message: 'NO MATCH FOUND',
          };

      setScanResult(response);
    }
  };

  const handleHUDComplete = (res) => {
    setTimeout(() => {
      navigation.navigate('Result', {
        response: res || scanResult,
        capturedImage: capturedImage || 'demo_face.jpg',
        evidence: capturedEvidence,
      });
    }, 1400);
  };


  // --------------------------------------------------
  // PERMISSION LOADING
  // --------------------------------------------------

  if (!permission) {

    return (

      <View style={styles.centerContainer}>

        <ActivityIndicator
          size="large"
          color="#1976D2"
        />

        <Text style={styles.message}>
          Checking camera permission...
        </Text>

      </View>
    );
  }


  // --------------------------------------------------
  // PERMISSION DENIED
  // --------------------------------------------------

  if (!permission.granted) {

    return (

      <View style={styles.centerContainer}>

        <Ionicons
          name="camera"
          size={55}
          color="#1976D2"
        />

        <Text style={styles.title}>
          CINTRA Camera
        </Text>

        <Text style={styles.message}>
          Camera permission is required
          to capture evidence.
        </Text>


        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >

          <Ionicons
            name="camera"
            size={21}
            color="#FFFFFF"
          />

          <Text style={styles.buttonText}>
            GRANT CAMERA PERMISSION
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backHomeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#1976D2"
          />
          <Text style={styles.backHomeText}>
            RETURN TO HOME
          </Text>
        </TouchableOpacity>

      </View>
    );
  }


  // --------------------------------------------------
  // MAIN CAMERA SCREEN
  // --------------------------------------------------

  return (
    <View style={styles.container}>

      {/* Live Camera Feed */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Captured Image Preview */}
      {capturedImage && (
        <Image
          source={{ uri: capturedImage }}
          style={styles.capturedImage}
          resizeMode="cover"
        />
      )}

      {/* Biometric Security Scanning HUD Overlay */}
      <BiometricScanHUD
        isScanning={isIdentifying || !!capturedImage}
        onScanComplete={handleHUDComplete}
        scanCount={scanCount}
        mockResult={scanResult}
      />

      {/* Forensic Watermark Overlay */}
      <ForensicWatermark
        badgeId={capturedEvidence?.badgeId || getCurrentUser()?.badgeId}
        capturedAt={capturedEvidence?.capturedAt}
      />

      {/* Top Navigation */}
      <View style={styles.topSection}>
        <TouchableOpacity
          style={styles.topBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomSection}>
        {capturedImage ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={retakePicture}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={20} color="#1976D2" />
              <Text style={styles.secondaryButtonText}>RESCAN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.scanButton,
              (!cameraReady || isTakingPicture) && styles.disabledButton,
            ]}
            onPress={takePicture}
            disabled={!cameraReady || isTakingPicture}
            activeOpacity={0.7}
          >
            <Ionicons name="scan-outline" size={25} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>
              {isTakingPicture ? 'INITIATING...' : 'START SCAN'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}


// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  capturedImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  topSection: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },

  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  instruction: {
    marginTop: 10,
    paddingHorizontal: 30,
    textAlign: 'center',
    fontSize: 15,
    color: '#FFFFFF',
  },

  scanFrame: {
    position: 'absolute',
    top: '27%',
    alignSelf: 'center',
    width: 260,
    height: 320,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 15,
    zIndex: 5,
  },

  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#1976D2',
  },

  cornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#1976D2',
  },

  cornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#1976D2',
  },

  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#1976D2',
  },

  bottomSection: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },

  scanButton: {
    width: 180,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },

  secondaryButton: {
    width: 160,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  scanButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },

  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 7,
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#F5F7FA',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 15,
    color: '#1976D2',
  },

  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#555',
  },

  permissionButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  topBackButton: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  identifyButton: {
    width: 160,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },

  identifyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 7,
  },

  backHomeButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backHomeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 7,
  },
});

