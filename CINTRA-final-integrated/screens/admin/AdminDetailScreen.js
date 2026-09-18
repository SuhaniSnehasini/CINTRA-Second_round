import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../services/adminApi';
import { isAdminAuthenticated } from '../../services/adminAuth';
import { isAuthenticated } from '../../services/authService';
import AdminChrome from './AdminChrome';
import { colors } from './adminTheme';
import PageHeader from './PageHeader';
import StatusBadge from './StatusBadge';
import { formatDate } from './dateUtils';

const SPECS = {
  AdminOfficerDetail: {
    active: 'AdminOfficers',
    title: 'Officer Profile',
    subtitle: 'Detailed officer status, unit designation, and recognition activity stats.',
    load: (id) => adminApi.officer(id),
  },
  AdminPersonDetail: {
    active: 'AdminPersons',
    title: 'Person / Subject Record',
    subtitle: 'Identity profile, reference face metadata, and enrollment records.',
    load: (id) => adminApi.person(id),
  },
  AdminRecognitionDetail: {
    active: 'AdminRecognition',
    title: 'Recognition Event Record',
    subtitle: 'Facial recognition match result, confidence score, and officer log.',
    load: (id) => adminApi.recognitionEvent(id),
  },
  AdminEvidenceDetail: {
    active: 'AdminEvidence',
    title: 'Digital Evidence Item',
    subtitle: 'Evidence metadata, SHA-256 hash verification, and chain-of-custody status.',
    load: (id) => adminApi.evidenceItem(id),
  },
  AdminInvestigationDetail: {
    active: 'AdminInvestigations',
    title: 'Investigation Timeline',
    subtitle: 'Audit history, evidence links, and suspect identification progression.',
    load: (id) => adminApi.investigation(id),
  },
};

export default function AdminDetailScreen({ navigation, route }) {
  const spec = SPECS[route.name];
  const { id } = route.params || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);

  const load = useCallback(async () => {
    if (!isAdminAuthenticated() && !isAuthenticated()) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await spec.load(id));
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, navigation, spec]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleOfficer = async (status) => {
    try {
      setData(await adminApi.officerStatus(id, status));
    } catch (err) {
      Alert.alert('Update failed', err.message);
    }
  };

  const verify = async () => {
    try {
      const result = await adminApi.verifyEvidence(id);
      Alert.alert(
        'Integrity Verification Result',
        `Status: ${result.integrity_status}\nChain Hash Matches: ${result.chain_hash_matches}\nFile Hash Matches: ${result.file_hash_matches}`
      );
      load();
    } catch (err) {
      Alert.alert('Verification failed', err.message);
    }
  };

  return (
    <AdminChrome navigation={navigation} active={spec.active}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title={spec.title}
          subtitle={`${spec.subtitle} (ID: ${id})`}
          actions={
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={16} color={colors.accent} />
              <Text style={styles.backBtnText}>Back to List</Text>
            </TouchableOpacity>
          }
        />

        {loading && !data ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading record details…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryText}>Retry Loading</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            {/* TOP ACTION BAR */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={styles.recordIdLabel}>RECORD IDENTIFIER</Text>
                  <Text style={styles.recordIdValue} numberOfLines={1}>{id}</Text>
                </View>
                {data.status || data.enrollment_status || data.result || data.integrity_status ? (
                  <StatusBadge status={data.status || data.enrollment_status || data.result || data.integrity_status} />
                ) : null}
              </View>

              {/* ROUTE-SPECIFIC QUICK ACTIONS */}
              {route.name === 'AdminOfficerDetail' ? (
                <View style={styles.actionRow}>
                  <Text style={styles.actionRowLabel}>Manage Status:</Text>
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnSuccess]}
                    onPress={() => toggleOfficer('ACTIVE')}
                  >
                    <Text style={styles.btnTextWhite}>Activate Officer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnWarn]}
                    onPress={() => toggleOfficer('SUSPENDED')}
                  >
                    <Text style={styles.btnTextWhite}>Suspend Officer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnDanger]}
                    onPress={() => toggleOfficer('DISABLED')}
                  >
                    <Text style={styles.btnTextWhite}>Disable Officer</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {route.name === 'AdminEvidenceDetail' ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.btnPrimary} onPress={verify}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.btnTextWhite}>VERIFY HASH INTEGRITY</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {route.name === 'AdminRecognitionDetail' && data.linked_evidence?.length ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={() => navigation.navigate('AdminEvidenceDetail', { id: data.linked_evidence[0].evidence_id })}
                  >
                    <Ionicons name="document-text-outline" size={16} color={colors.accent} />
                    <Text style={styles.btnTextOutline}>
                      Open Linked Evidence ({data.linked_evidence[0].evidence_id})
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {/* CASE TIMELINE VIEW FOR INVESTIGATIONS */}
            {route.name === 'AdminInvestigationDetail' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Investigation Sequence Timeline</Text>
                <View style={styles.timeline}>
                  <View style={styles.timelineStep}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.stepTitle}>1. Enrollment & Subject Register</Text>
                      <Text style={styles.stepMeta}>Subject ID: {data.person || 'P-DEMO-001'}</Text>
                    </View>
                  </View>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineStep}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.stepTitle}>2. Recognition Event Capture</Text>
                      <Text style={styles.stepMeta}>Assigned Officer: {data.officer || 'CINTRA-OFC-001'}</Text>
                    </View>
                  </View>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineStep}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.stepTitle}>3. Evidence Logged & SHA-256 Hashed</Text>
                      <Text style={styles.stepMeta}>Status: {data.status || 'ACTIVE'}</Text>
                    </View>
                  </View>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineStep}>
                    <View style={[styles.timelineDot, { backgroundColor: colors.success }]} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.stepTitle}>4. Hash-Chain Integrity Verified</Text>
                      <Text style={styles.stepMeta}>Immutable audit record confirmed</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {/* FORMATTED KEY-VALUE DETAILS */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Record Details & Attributes</Text>
              <View style={styles.detailsGrid}>
                {Object.entries(data).map(([key, value]) => {
                  if (typeof value === 'object' && value !== null) return null; // handle arrays/objects separately
                  const formattedKey = key.replace(/_/g, ' ').toUpperCase();
                  const isDate = key.includes('at') || key.includes('date') || key === 'timestamp';
                  const displayValue = isDate ? formatDate(value) : String(value ?? '—');
                  
                  return (
                    <View key={key} style={styles.detailItem}>
                      <Text style={styles.detailKey}>{formattedKey}</Text>
                      <Text style={styles.detailVal}>{displayValue}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* COLLAPSIBLE RAW JSON DRAWER */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.rawHeader}
                onPress={() => setShowRawJson(!showRawJson)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="code-slash-outline" size={18} color={colors.muted} />
                  <Text style={styles.rawTitle}>Technical Details / Raw API Object</Text>
                </View>
                <Ionicons
                  name={showRawJson ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.muted}
                />
              </TouchableOpacity>

              {showRawJson ? (
                <View style={styles.rawBox}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <Text selectable style={styles.rawText}>
                      {JSON.stringify(data, null, 2)}
                    </Text>
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </AdminChrome>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panelAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  backBtnText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 12,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
    shadowColor: colors.cardShadow.shadowColor,
    shadowOpacity: colors.cardShadow.shadowOpacity,
    shadowRadius: colors.cardShadow.shadowRadius,
    shadowOffset: colors.cardShadow.shadowOffset,
    elevation: colors.cardShadow.elevation,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordIdLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.5,
  },
  recordIdValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actionRowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    marginRight: 4,
  },
  btnAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnSuccess: { backgroundColor: colors.success },
  btnWarn: { backgroundColor: colors.warn },
  btnDanger: { backgroundColor: colors.danger },
  btnPrimary: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnOutline: {
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  btnTextOutline: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 130,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  detailKey: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    marginBottom: 4,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '100%',
    flexShrink: 1,
  },
  rawHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rawTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  rawBox: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    maxHeight: 300,
    overflow: 'hidden',
  },
  rawText: {
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    marginTop: 3,
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.line,
    marginLeft: 6,
    marginVertical: 2,
  },
  timelineContent: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  stepMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
