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
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  getCurrentUser,
  logout,
} from '../services/authService';

import {
  getSelectedCase,
  setSelectedCase,
  fetchCases,
  subscribeCaseChanges,
} from '../services/caseService';

export default function HomeScreen({ navigation }) {
  const user = getCurrentUser();
  const badgeId = user?.badgeId || 'OFF001';

  const [activeCase, setActiveCaseState] = useState(getSelectedCase());
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
    const caseId = caseObj?.case_id;

    switch (actionKey) {
      case 'Evidence':
        navigation.navigate('EvidenceHub', { caseId, case: caseObj });
        break;
      case 'CaptureMatch':
        navigation.navigate('Scanner', { caseId, case: caseObj });
        break;
      case 'DatabaseSearch':
        navigation.navigate('DatabaseSearch', { caseId, case: caseObj });
        break;
      default:
        break;
    }
  };

  const handleAction = (actionKey, requiresCase = true) => {
    if (requiresCase && !activeCase) {
      setPendingAction(actionKey);
      setGuardAlertVisible(true);
      return;
    }
    executeNavAction(actionKey, activeCase);
  };

  const handleLogout = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Login',
        },
      ],
    });
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CINTRA</Text>
          <Text style={styles.headerSubtitle}>Criminal Network Analysis Dashboard</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={22} color="#1976D2" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Officer Profile Card */}
        <View style={styles.officerCard}>
          <View style={styles.officerIcon}>
            <Ionicons name="person" size={27} color="#1976D2" />
          </View>

          <View style={styles.officerInfo}>
            <Text style={styles.officerLabel}>AUTHENTICATED OFFICER</Text>
            <Text style={styles.badgeId}>Badge ID: {badgeId}</Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Secure Session Active</Text>
            </View>
          </View>
        </View>

        {/* Current Case Section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="briefcase" size={20} color="#1976D2" />
          <Text style={styles.sectionTitle}>CURRENT CASE</Text>
        </View>

        {activeCase ? (
          <View style={styles.activeCaseCard}>
            <View style={styles.caseCardHeader}>
              <View style={styles.caseBadgeRow}>
                <View style={[styles.badge, { backgroundColor: getStatusColor(activeCase.status) }]}>
                  <Text style={styles.badgeText}>{activeCase.status}</Text>
                </View>

                {activeCase.priority && (
                  <View style={[styles.badge, { backgroundColor: getPriorityColor(activeCase.priority), marginLeft: 8 }]}>
                    <Text style={styles.badgeText}>{activeCase.priority} PRIORITY</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.switchCaseBtn} onPress={handleOpenCaseModal}>
                <Ionicons name="swap-horizontal" size={16} color="#1976D2" />
                <Text style={styles.switchCaseText}>Switch Case</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.caseIdText}>{activeCase.case_id}</Text>
            <Text style={styles.caseTitleText}>{activeCase.title}</Text>

            <View style={styles.caseDetailRow}>
              <Ionicons name="calendar-outline" size={14} color="#666" />
              <Text style={styles.caseMetaText}>Date: {activeCase.date}</Text>

              <Ionicons name="person-outline" size={14} color="#666" style={{ marginLeft: 16 }} />
              <Text style={styles.caseMetaText}>Assignment: {activeCase.officer || `Badge ${badgeId}`}</Text>
            </View>

            {activeCase.summary ? (
              <Text style={styles.caseSummaryText} numberOfLines={2}>
                {activeCase.summary}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.noCaseCard}>
            <Ionicons name="warning-outline" size={32} color="#D32F2F" />
            <Text style={styles.noCaseTitle}>No Active Case Selected</Text>
            <Text style={styles.noCaseSubtitle}>
              You must select an active case to enable evidence collection, face matching, and integrity operations.
            </Text>

            <TouchableOpacity style={styles.selectCaseButton} onPress={handleOpenCaseModal}>
              <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
              <Text style={styles.selectCaseBtnText}>SELECT ACTIVE CASE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dashboard Actions Section */}
        <View style={[styles.sectionHeader, { marginTop: 22 }]}>
          <Ionicons name="grid-outline" size={20} color="#1976D2" />
          <Text style={styles.sectionTitle}>OFFICER ACTIONS</Text>
        </View>

        {/* 1. Evidence */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => handleAction('Evidence', true)}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="folder-open" size={26} color="#1976D2" />
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Evidence</Text>
            <Text style={styles.actionDescription}>
              Access evidence upload, photo capture, repository, chain of custody, and integrity verification.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#1976D2" />
        </TouchableOpacity>

        {/* 2. Capture & Match */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => handleAction('CaptureMatch', true)}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="scan" size={26} color="#1976D2" />
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Capture & Match</Text>
            <Text style={styles.actionDescription}>
              Biometric face scan and instant database suspect matching.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#1976D2" />
        </TouchableOpacity>

        {/* 3. Database Search */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => handleAction('DatabaseSearch', false)}
          activeOpacity={0.8}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="search" size={26} color="#1976D2" />
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Database Search</Text>
            <Text style={styles.actionDescription}>
              Query criminal records and suspect profiles directly.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#1976D2" />
        </TouchableOpacity>

        {/* Security Alert Card */}
        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Ionicons name="shield-checkmark" size={22} color="#1976D2" />
          </View>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>SECURE SESSION ACTIVE</Text>
            <Text style={styles.securityText}>
              Inactivity timer active (60 seconds). All actions logged to immutable audit ledger.
            </Text>
          </View>
        </View>
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
              You must select an active case before capturing or uploading evidence to ensure chain of custody.
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
                        Assigned: {item.officer || `Badge ${badgeId}`} | Date: {item.date}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 1.5,
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  officerCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  officerIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  officerInfo: {
    marginLeft: 13,
    flex: 1,
  },

  officerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.7,
  },

  badgeId: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 3,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#1976D2',
    marginRight: 6,
  },

  statusText: {
    fontSize: 10,
    color: '#555',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    letterSpacing: 0.8,
  },

  activeCaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    borderLeftWidth: 5,
    borderLeftColor: '#1976D2',
  },

  caseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  caseBadgeRow: {
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

  switchCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
  },

  switchCaseText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 4,
  },

  caseIdText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  caseTitleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 3,
  },

  caseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  caseMetaText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },

  caseSummaryText: {
    fontSize: 12,
    color: '#777',
    marginTop: 8,
    lineHeight: 17,
  },

  noCaseCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE082',
  },

  noCaseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: 8,
  },

  noCaseSubtitle: {
    fontSize: 12,
    color: '#5D4037',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },

  selectCaseButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectCaseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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

  securityCard: {
    marginTop: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 13,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
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
    flex: 1,
    marginLeft: 11,
  },

  securityTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.5,
  },

  securityText: {
    fontSize: 10,
    color: '#666',
    marginTop: 3,
    lineHeight: 15,
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