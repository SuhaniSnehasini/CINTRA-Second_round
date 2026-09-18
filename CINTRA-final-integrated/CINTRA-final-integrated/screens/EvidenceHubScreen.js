import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  getSelectedCase,
  setSelectedCase,
  fetchCases,
  subscribeCaseChanges,
} from '../services/caseService';

export default function EvidenceHubScreen({ navigation, route }) {
  const [activeCase, setActiveCaseState] = useState(
    route?.params?.case || getSelectedCase()
  );
  const caseId = route?.params?.caseId || activeCase?.case_id;

  const [modalVisible, setModalVisible] = useState(false);
  const [casesList, setCasesList] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [guardAlertVisible, setGuardAlertVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeCaseChanges((updatedCase) => {
      setActiveCaseState(updatedCase);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenCaseModal = async () => {
    setModalVisible(true);
    setLoadingCases(true);
    try {
      const data = await fetchCases();
      setCasesList(data);
    } catch (err) {
      console.warn('Error loading cases:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  const handleSelectCaseItem = (item) => {
    setSelectedCase(item);
    setActiveCaseState(item);
    setModalVisible(false);
    setGuardAlertVisible(false);

    if (pendingAction) {
      const actionToExecute = pendingAction;
      setPendingAction(null);
      setTimeout(() => {
        executeNavAction(actionToExecute, item);
      }, 300);
    }
  };

  const executeNavAction = (actionKey, currentCase) => {
    const caseObj = currentCase || activeCase;
    const currentCaseId = caseObj?.case_id;

    switch (actionKey) {
      case 'EvidenceUpload':
        navigation.navigate('EvidenceUpload', { caseId: currentCaseId, case: caseObj });
        break;
      case 'CapturePhoto':
        navigation.navigate('CaptureEvidence', { caseId: currentCaseId, case: caseObj });
        break;
      case 'EvidenceRepo':
        navigation.navigate('DatabaseSearch', { caseId: currentCaseId, case: caseObj });
        break;
      default:
        break;
    }
  };

  const handleAction = (actionKey) => {
    if (!activeCase) {
      setPendingAction(actionKey);
      setGuardAlertVisible(true);
      return;
    }
    executeNavAction(actionKey, activeCase);
  };

  const getPriorityColor = (priority) => {
    switch (String(priority).toUpperCase()) {
      case 'CRITICAL':
        return '#D32F2F';
      case 'HIGH':
        return '#E65100';
      case 'MEDIUM':
        return '#F57C00';
      default:
        return '#1976D2';
    }
  };

  const getStatusColor = (status) => {
    switch (String(status).toUpperCase()) {
      case 'ACTIVE':
        return '#2E7D32';
      case 'UNDER INVESTIGATION':
        return '#0288D1';
      default:
        return '#757575';
    }
  };

  const evidenceOptions = [
    {
      key: 'EvidenceUpload',
      title: 'Upload Evidence',
      description: 'Upload images, video, audio, or document files to active case.',
      icon: 'cloud-upload',
    },
    {
      key: 'CapturePhoto',
      title: 'Capture Photo Evidence',
      description: 'Capture forensic evidence photos with SHA-256 integrity watermark.',
      icon: 'camera',
    },
    {
      key: 'EvidenceRepo',
      title: 'Evidence & Database Search',
      description: 'View and audit all digital evidence linked to investigation cases.',
      icon: 'search',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color="#1976D2" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>EVIDENCE HUB</Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Case Banner */}
        {activeCase ? (
          <View style={styles.caseBanner}>
            <View style={styles.caseBannerLeft}>
              <Ionicons name="briefcase" size={18} color="#1976D2" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.caseBannerLabel}>ACTIVE CASE</Text>
                <Text style={styles.caseBannerId}>{activeCase.case_id}</Text>
                <Text style={styles.caseBannerTitle} numberOfLines={1}>{activeCase.title}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.switchCaseBtn}
              onPress={handleOpenCaseModal}
            >
              <Ionicons name="swap-horizontal" size={14} color="#1976D2" />
              <Text style={styles.switchCaseText}>Switch</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noCaseBanner}>
            <Ionicons name="warning-outline" size={22} color="#D32F2F" />
            <Text style={styles.noCaseText}>No active case selected for evidence operations.</Text>
            <TouchableOpacity
              style={styles.selectCaseBtn}
              onPress={handleOpenCaseModal}
            >
              <Text style={styles.selectCaseBtnText}>Select Case</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.hubTitle}>Case Evidence Management</Text>
        <Text style={styles.hubSubtitle}>
          Select an evidence action below to upload, capture, or review evidence for the active case.
        </Text>

        {/* Evidence Hub Options */}
        {evidenceOptions.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.actionCard}
            onPress={() => handleAction(item.key)}
            activeOpacity={0.8}
          >
            <View style={styles.actionIcon}>
              <Ionicons name={item.icon} size={26} color="#1976D2" />
            </View>

            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{item.title}</Text>
              <Text style={styles.actionDescription}>{item.description}</Text>
            </View>

            <Ionicons name="chevron-forward" size={22} color="#1976D2" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Case Guard Warning Modal */}
      <Modal
        visible={guardAlertVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setGuardAlertVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertDialog}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={36} color="#D32F2F" />
              <Text style={styles.alertTitle}>Active Case Required</Text>
            </View>

            <Text style={styles.alertMessage}>
              You must select an active case before performing evidence operations to ensure proper chain of custody tracking.
            </Text>

            <View style={styles.alertActions}>
              <TouchableOpacity
                style={styles.alertCancelBtn}
                onPress={() => setGuardAlertVisible(false)}
              >
                <Text style={styles.alertCancelText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alertConfirmBtn}
                onPress={() => {
                  setGuardAlertVisible(false);
                  handleOpenCaseModal();
                }}
              >
                <Text style={styles.alertConfirmText}>SELECT CASE NOW</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Case Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="briefcase" size={22} color="#1976D2" />
                <Text style={styles.modalTitle}>SELECT ACTIVE CASE</Text>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>

            {loadingCases ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#1976D2" />
                <Text style={styles.loadingText}>Loading Active Cases...</Text>
              </View>
            ) : (
              <FlatList
                data={casesList}
                keyExtractor={(item) => item.case_id}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                  const isSelected = activeCase?.case_id === item.case_id;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.caseSelectItem,
                        isSelected && styles.caseSelectItemActive,
                      ]}
                      onPress={() => handleSelectCaseItem(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.caseItemHeader}>
                        <Text style={styles.caseItemCode}>{item.case_id}</Text>

                        <View style={styles.badgeRow}>
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: getStatusColor(item.status) },
                            ]}
                          >
                            <Text style={styles.badgeText}>{item.status}</Text>
                          </View>

                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: getPriorityColor(item.priority),
                                marginLeft: 6,
                              },
                            ]}
                          >
                            <Text style={styles.badgeText}>{item.priority}</Text>
                          </View>
                        </View>
                      </View>

                      <Text style={styles.caseItemTitle}>{item.title}</Text>

                      <Text style={styles.caseItemMeta}>
                        Assigned: {item.officer || 'Badge OFF001'} | Date: {item.date}
                      </Text>

                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#1976D2" />
                          <Text style={styles.selectedText}>Currently Active</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 35,
  },
  caseBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  caseBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  caseBannerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.6,
  },
  caseBannerId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
  },
  caseBannerTitle: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  switchCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  switchCaseText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 4,
  },
  noCaseBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  noCaseText: {
    fontSize: 12,
    color: '#5D4037',
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  selectCaseBtn: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  selectCaseBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  hubTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  hubSubtitle: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 20,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
  },
  actionDescription: {
    fontSize: 11,
    color: '#777',
    marginTop: 3,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 8,
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 4,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#666',
    marginTop: 10,
  },
  listContainer: {
    paddingVertical: 12,
  },
  caseSelectItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  caseSelectItemActive: {
    borderColor: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  caseItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  caseItemCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  caseItemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  caseItemMeta: {
    fontSize: 11,
    color: '#666',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  selectedText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 4,
  },
  alertDialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    elevation: 8,
  },
  alertHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: 8,
  },
  alertMessage: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  alertActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  alertCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCancelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#666',
  },
  alertConfirmBtn: {
    flex: 1.4,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertConfirmText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
