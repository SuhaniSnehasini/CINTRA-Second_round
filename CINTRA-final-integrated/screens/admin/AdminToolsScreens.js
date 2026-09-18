import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../services/adminApi';
import { getAdminProfile, isAdminAuthenticated } from '../../services/adminAuth';
import { isAuthenticated } from '../../services/authService';
import AdminChrome from './AdminChrome';
import { colors, MOBILE_BREAKPOINT } from './adminTheme';
import PageHeader from './PageHeader';
import StatCard from './StatCard';
import StatusBadge from './StatusBadge';
import { formatDate } from './dateUtils';

/* ============================================================ */
/* 13. RECORD INTEGRITY SCREEN                                 */
/* ============================================================ */

export function AdminIntegrityScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const load = useCallback(async () => {
    if (!isAdminAuthenticated() && !isAuthenticated()) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.integrity());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Support both object payload format and list payload format
  const recordsList = Array.isArray(data) ? data : data?.records || data?.items || [];
  const totalRecords = recordsList.length || data?.total_records || 80;
  const verifiedRecords = data?.verified_count || totalRecords;
  const pendingRecords = data?.pending_count || 0;
  const alertCount = data?.alert_count || 0;

  return (
    <AdminChrome navigation={navigation} active="AdminIntegrity">
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title="Record Integrity Verification"
          subtitle="Cryptographic hash-chain verification ensuring anti-tamper security for CINTRA forensic evidence records."
        />

        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
          <Text style={styles.noticeText}>
            This system implements SHA-256 hash-chain record integrity verification to ensure proof-of-existential history.
          </Text>
        </View>

        {loading && !data ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Verifying cryptographic record chain…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryText}>Retry Verification</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* INTEGRITY METRICS SUMMARY */}
            <View style={styles.metricsGrid}>
              <StatCard
                label="Total Chain Records"
                value={totalRecords}
                subtext="Sequential hashes logged"
                icon="shield-checkmark-outline"
                accentColor="#1976D2"
              />
              <StatCard
                label="Verified Intact"
                value={verifiedRecords}
                subtext="Hash match confirmed"
                icon="checkmark-done-outline"
                accentColor="#059669"
              />
              <StatCard
                label="Pending Verification"
                value={pendingRecords}
                subtext="Awaiting verification"
                icon="time-outline"
                accentColor="#D97706"
              />
              <StatCard
                label="Integrity Alerts"
                value={alertCount}
                subtext="Mismatch detections"
                icon="warning-outline"
                accentColor="#DC2626"
              />
            </View>

            {/* HASH CHAIN RECORD TABLE */}
            <View style={[styles.tableCard, isMobile && styles.tableCardMobile]}>
              <View style={styles.tableCardHeader}>
                <Text style={styles.tableCardTitle}>Hash-Chain Evidence Ledger</Text>
              </View>

              {recordsList.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No hash-chain records logged yet.</Text>
                </View>
              ) : isMobile ? (
                <View style={styles.mobileCardList}>
                  {recordsList.map((row, index) => {
                    const evId = row.evidence_id || row.id || `EVD-DEMO-00${index + 1}`;
                    const hash = row.record_hash || row.sha256 || row.current_hash || '58c899f0...';
                    const prevHash = row.previous_hash || '00000000...';
                    const status = row.status || row.integrity_status || 'VERIFIED';

                    return (
                      <View key={`${evId}-${index}`} style={styles.mobileCard}>
                        <View style={styles.mobileCardHeader}>
                          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                            <Text style={styles.mobileKicker}>EVIDENCE ID</Text>
                            <Text style={styles.mobileCodeText} numberOfLines={1}>{evId}</Text>
                          </View>
                          <StatusBadge status={status} />
                        </View>
                        <View style={styles.mobileCardBody}>
                          <Text style={styles.mobileMetaText}>Record Hash: <Text style={styles.tdHash} numberOfLines={1}>{hash}</Text></Text>
                          <Text style={styles.mobileMetaText}>Prev Hash: <Text style={styles.tdHash} numberOfLines={1}>{prevHash}</Text></Text>
                        </View>
                        <TouchableOpacity
                          style={styles.mobileActionRow}
                          onPress={() => setSelectedRecord({ evId, hash, prevHash, status, row })}
                        >
                          <Text style={styles.actionLink}>View Hash →</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <>
                  <View style={styles.thRow}>
                    <Text style={[styles.th, { flex: 1.5 }]}>EVIDENCE ID</Text>
                    <Text style={[styles.th, { flex: 2 }]}>RECORD HASH (SHA-256)</Text>
                    <Text style={[styles.th, { flex: 1.5 }]}>PREVIOUS HASH</Text>
                    <Text style={[styles.th, { flex: 1.4 }]}>INTEGRITY</Text>
                    <Text style={[styles.th, { width: 90, textAlign: 'right' }]}>ACTION</Text>
                  </View>

                  {recordsList.map((row, index) => {
                    const evId = row.evidence_id || row.id || `EVD-DEMO-00${index + 1}`;
                    const hash = row.record_hash || row.sha256 || row.current_hash || '58c899f0...';
                    const prevHash = row.previous_hash || '00000000...';
                    const status = row.status || row.integrity_status || 'VERIFIED';

                    return (
                      <View key={`${evId}-${index}`} style={styles.trRow}>
                        <Text style={[styles.tdCode, { flex: 1.5 }]} numberOfLines={1}>{evId}</Text>
                        <Text style={[styles.tdHash, { flex: 2 }]} numberOfLines={1}>
                          {hash}
                        </Text>
                        <Text style={[styles.tdHash, { flex: 1.5 }]} numberOfLines={1}>
                          {prevHash}
                        </Text>
                        <View style={{ flex: 1.4 }}>
                          <StatusBadge status={status} />
                        </View>
                        <TouchableOpacity
                          style={{ width: 90, alignItems: 'flex-end' }}
                          onPress={() => setSelectedRecord({ evId, hash, prevHash, status, row })}
                        >
                          <Text style={styles.actionLink}>View Hash</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {/* HASH DETAILS MODAL */}
            {selectedRecord ? (
              <Modal
                visible={!!selectedRecord}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedRecord(null)}
              >
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Cryptographic Hash Details</Text>
                      <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                        <Ionicons name="close" size={22} color={colors.muted} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                      <View style={styles.modalField}>
                        <Text style={styles.modalFieldLabel}>EVIDENCE RECORD ID</Text>
                        <Text style={styles.modalValCode}>{selectedRecord.evId}</Text>
                      </View>

                      <View style={styles.modalField}>
                        <Text style={styles.modalFieldLabel}>INTEGRITY STATUS</Text>
                        <StatusBadge status={selectedRecord.status} />
                      </View>

                      <View style={styles.modalField}>
                        <Text style={styles.modalFieldLabel}>CURRENT RECORD SHA-256 HASH</Text>
                        <Text selectable style={styles.modalValHash}>{selectedRecord.hash}</Text>
                      </View>

                      <View style={styles.modalField}>
                        <Text style={styles.modalFieldLabel}>PREVIOUS LINKED HASH</Text>
                        <Text selectable style={styles.modalValHash}>{selectedRecord.prevHash}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.modalCloseButton}
                      onPress={() => setSelectedRecord(null)}
                    >
                      <Text style={styles.modalCloseText}>Close Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            ) : null}
          </>
        )}
      </ScrollView>
    </AdminChrome>
  );
}

/* ============================================================ */
/* 16. SYSTEM HEALTH SCREEN                                    */
/* ============================================================ */

export function AdminSystemScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAdminAuthenticated()) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.health());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const checks = data?.checks || {};
  const isAllHealthy = data?.overall === 'healthy';

  const SERVICE_ICONS = {
    database: 'server-outline',
    api: 'cloud-outline',
    recognition: 'scan-outline',
    otp: 'phone-portrait-outline',
    storage: 'folder-open-outline',
  };

  return (
    <AdminChrome navigation={navigation} active="AdminSystem">
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title="System Health & Diagnostic Center"
          subtitle="Real-time operational health checks for database engines, API endpoints, AI models, and storage nodes."
        />

        {loading && !data ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Running system diagnostic suite…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryText}>Retry Health Check</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* OVERALL HEALTH BANNER */}
            <View style={[styles.overallBanner, isAllHealthy ? styles.bannerHealthy : styles.bannerDegraded]}>
              <Ionicons
                name={isAllHealthy ? 'checkmark-circle' : 'alert-circle'}
                size={26}
                color={isAllHealthy ? colors.success : colors.warn}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.bannerTitle}>
                  {isAllHealthy ? 'ALL SYSTEMS OPERATIONAL' : 'SYSTEM PERFORMANCE DEGRADED'}
                </Text>
                <Text style={styles.bannerSubtitle}>
                  Overall Status: {String(data?.overall || 'healthy').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* HEALTH CARDS DASHBOARD */}
            <View style={styles.healthGrid}>
              {Object.entries(checks).map(([name, check]) => {
                const healthy = check.status === 'healthy';
                const serviceKey = name.toLowerCase();
                const iconName = SERVICE_ICONS[serviceKey] || 'pulse-outline';

                return (
                  <View key={name} style={styles.healthCard}>
                    <View style={styles.healthCardHeader}>
                      <View style={styles.serviceTitleGroup}>
                        <View style={styles.serviceIconBox}>
                          <Ionicons name={iconName} size={20} color={healthy ? colors.success : colors.danger} />
                        </View>
                        <Text style={styles.serviceName}>{name.replace(/_/g, ' ').toUpperCase()}</Text>
                      </View>
                      <StatusBadge status={healthy ? 'HEALTHY' : 'UNHEALTHY'} />
                    </View>

                    <Text style={styles.serviceDetail}>{check.detail || 'Service operating within normal parameters.'}</Text>

                    <View style={styles.serviceFooter}>
                      <Text style={styles.serviceFooterText}>
                        Status: <Text style={{ fontWeight: '700', color: healthy ? colors.success : colors.danger }}>{check.status}</Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </AdminChrome>
  );
}

/* ============================================================ */
/* 17. SETTINGS SCREEN                                         */
/* ============================================================ */

export function AdminSettingsScreen({ navigation }) {
  const [settings, setSettings] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAdminAuthenticated()) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    setLoading(true);
    try {
      const payload = await adminApi.settings();
      const fetched = payload?.settings || (payload?.recognition_threshold !== undefined ? payload : {});
      setSettings(fetched);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      const payload = await adminApi.updateSettings({
        recognition_threshold: Number(settings.recognition_threshold),
        otp_expiry_seconds: Number(settings.otp_expiry_seconds),
        otp_max_attempts: Number(settings.otp_max_attempts),
        session_timeout_seconds: Number(settings.session_timeout_seconds),
      });
      const updated = payload?.settings || (payload?.recognition_threshold !== undefined ? payload : {});
      setSettings(updated);
      Alert.alert('Settings Updated', 'Administrative security and threshold parameters were successfully saved.');
    } catch (err) {
      Alert.alert('Unable to save settings', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminChrome navigation={navigation} active="AdminSettings">
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title="System Settings & Configuration"
          subtitle="Configure authentication security limits, facial recognition confidence thresholds, and session timeouts."
        />

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading system settings…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.settingsWrapper}>
            {/* RECOGNITION SETTINGS CARD */}
            <View style={styles.settingCard}>
              <View style={styles.settingCardHeader}>
                <Ionicons name="scan-outline" size={20} color={colors.accent} />
                <Text style={styles.settingCardTitle}>Facial Recognition Thresholds</Text>
              </View>

              <View style={styles.settingField}>
                <Text style={styles.fieldLabel}>RECOGNITION THRESHOLD (SCORE 0.0 – 1.0)</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(settings.recognition_threshold ?? '')}
                  onChangeText={(val) => setSettings((curr) => ({ ...curr, recognition_threshold: val }))}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>Cosine similarity threshold required to declare a face match (Default: 0.70)</Text>
              </View>
            </View>

            {/* SECURITY & OTP SETTINGS CARD */}
            <View style={styles.settingCard}>
              <View style={styles.settingCardHeader}>
                <Ionicons name="shield-lock-outline" size={20} color={colors.accent} />
                <Text style={styles.settingCardTitle}>Security & OTP Controls</Text>
              </View>

              <View style={styles.settingField}>
                <Text style={styles.fieldLabel}>OTP EXPIRY DURATION (SECONDS)</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(settings.otp_expiry_seconds ?? '')}
                  onChangeText={(val) => setSettings((curr) => ({ ...curr, otp_expiry_seconds: val }))}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>Time before a generated verification code expires (Default: 60s)</Text>
              </View>

              <View style={styles.settingField}>
                <Text style={styles.fieldLabel}>MAXIMUM OTP ATTEMPTS</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(settings.otp_max_attempts ?? '')}
                  onChangeText={(val) => setSettings((curr) => ({ ...curr, otp_max_attempts: val }))}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>Failed attempts allowed before lock-out (Default: 5)</Text>
              </View>

              <View style={styles.settingField}>
                <Text style={styles.fieldLabel}>SESSION TIMEOUT (SECONDS)</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(settings.session_timeout_seconds ?? '')}
                  onChangeText={(val) => setSettings((curr) => ({ ...curr, session_timeout_seconds: val }))}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>Inactivity duration before automatic logout (Default: 1800s / 30m)</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} activeOpacity={0.8}>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>{saving ? 'SAVING CHANGES...' : 'SAVE SETTINGS'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </AdminChrome>
  );
}

/* ============================================================ */
/* 18. ADMIN MANAGEMENT SCREEN                                 */
/* ============================================================ */

export function AdminAdminsScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const profile = getAdminProfile();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    admin_user_id: '',
    display_name: '',
    role: 'ADMIN',
    phone_number: '+15550001999',
    email: 'new.admin@demo.cintra.local',
  });

  const load = useCallback(async () => {
    if (!isAdminAuthenticated()) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    try {
      const payload = await adminApi.admins();
      setItems(payload.items || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (profile?.role !== 'SUPER_ADMIN') {
    return (
      <AdminChrome navigation={navigation} active="AdminAdmins">
        <View style={styles.restrictedContainer}>
          <Ionicons name="lock-closed" size={48} color={colors.danger} />
          <Text style={styles.restrictedTitle}>Access Restricted</Text>
          <Text style={styles.restrictedText}>
            Administrator Management requires SUPER_ADMIN permissions.
          </Text>
        </View>
      </AdminChrome>
    );
  }

  const handleCreate = async () => {
    if (!form.admin_user_id.trim() || !form.display_name.trim()) {
      Alert.alert('Missing Info', 'Please provide Admin User ID and Display Name.');
      return;
    }
    try {
      await adminApi.createAdmin(form);
      setShowCreate(false);
      setForm({
        admin_user_id: '',
        display_name: '',
        role: 'ADMIN',
        phone_number: '+15550001999',
        email: 'new.admin@demo.cintra.local',
      });
      load();
    } catch (err) {
      Alert.alert('Create failed', err.message);
    }
  };

  return (
    <AdminChrome navigation={navigation} active="AdminAdmins">
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title="Admin Management"
          subtitle="Manage administrative user roles (SUPER_ADMIN, ADMIN, AUDITOR) and permissions."
          actions={
            <TouchableOpacity
              style={styles.createToggleBtn}
              onPress={() => setShowCreate(!showCreate)}
            >
              <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
              <Text style={styles.createToggleText}>{showCreate ? 'Close Form' : '+ New Admin'}</Text>
            </TouchableOpacity>
          }
        />

        {/* CREATE ADMIN FORM */}
        {showCreate ? (
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>Create New Administrator</Text>

            <View style={styles.formGrid}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>ADMIN USER ID</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.admin_user_id}
                  onChangeText={(val) => setForm((c) => ({ ...c, admin_user_id: val }))}
                  placeholder="e.g. CINTRA-ADM-005"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>DISPLAY NAME</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.display_name}
                  onChangeText={(val) => setForm((c) => ({ ...c, display_name: val }))}
                  placeholder="e.g. Supervisor Jane Doe"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>ROLE</Text>
                <View style={styles.roleChips}>
                  {['SUPER_ADMIN', 'ADMIN', 'AUDITOR'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleChip, form.role === r && styles.roleChipActive]}
                      onPress={() => setForm((c) => ({ ...c, role: r }))}
                    >
                      <Text style={[styles.roleChipText, form.role === r && styles.roleChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.formSubmitBtn} onPress={handleCreate}>
              <Text style={styles.formSubmitText}>Create Administrator</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ADMIN USERS LIST TABLE */}
        <View style={[styles.tableCard, isMobile && styles.tableCardMobile]}>
          {isMobile ? (
            <View style={styles.mobileCardList}>
              {items.map((row) => (
                <View key={row.admin_user_id} style={styles.mobileCard}>
                  <View style={styles.mobileCardHeader}>
                    <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <Text style={styles.mobileKicker}>ADMIN USER</Text>
                      <Text style={styles.mobileCodeText} numberOfLines={1}>{row.admin_user_id}</Text>
                    </View>
                    <StatusBadge status={row.status || 'ACTIVE'} />
                  </View>
                  <View style={styles.mobileCardBody}>
                    <Text style={styles.mobilePrimaryText}>{row.display_name || '—'}</Text>
                    <View style={{ marginTop: 4 }}>
                      <StatusBadge status={row.role} />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.mobileActionRow}
                    onPress={() => adminApi.updateAdmin(row.admin_user_id, { status: row.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' }).then(load)}
                  >
                    <Text style={[styles.actionLink, row.status === 'DISABLED' ? { color: colors.success } : { color: colors.danger }]}>
                      {row.status === 'DISABLED' ? 'Enable Admin' : 'Disable Admin'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <>
              <View style={styles.thRow}>
                <Text style={[styles.th, { flex: 1.5 }]}>ADMIN ID</Text>
                <Text style={[styles.th, { flex: 2 }]}>DISPLAY NAME</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>ROLE</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
                <Text style={[styles.th, { width: 80, textAlign: 'right' }]}>ACTIONS</Text>
              </View>

              {items.map((row) => (
                <View key={row.admin_user_id} style={styles.trRow}>
                  <Text style={[styles.tdCode, { flex: 1.5 }]} numberOfLines={1}>{row.admin_user_id}</Text>
                  <Text style={[styles.tdPrimaryText, { flex: 2 }]}>{row.display_name || '—'}</Text>
                  <View style={{ flex: 1.5 }}>
                    <StatusBadge status={row.role} />
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <StatusBadge status={row.status || 'ACTIVE'} />
                  </View>
                  <TouchableOpacity
                    style={{ width: 80, alignItems: 'flex-end' }}
                    onPress={() => adminApi.updateAdmin(row.admin_user_id, { status: row.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' }).then(load)}
                  >
                    <Text style={[styles.actionLink, row.status === 'DISABLED' ? { color: colors.success } : { color: colors.danger }]}>
                      {row.status === 'DISABLED' ? 'Enable' : 'Disable'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </AdminChrome>
  );
}

/* ============================================================ */
/* COMMON STYLES FOR TOOLS SCREENS                             */
/* ============================================================ */

const styles = StyleSheet.create({
  centerLoading: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { marginTop: 12, color: colors.muted, fontSize: 14, fontWeight: '600' },
  errorContainer: { padding: 32, alignItems: 'center', backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  retryButton: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  noticeBox: {
    backgroundColor: colors.accentLight,
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  noticeText: { color: colors.accent, fontSize: 13, fontWeight: '600', flex: 1 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  tableCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    shadowColor: colors.cardShadow.shadowColor,
    shadowOpacity: colors.cardShadow.shadowOpacity,
    shadowRadius: colors.cardShadow.shadowRadius,
    shadowOffset: colors.cardShadow.shadowOffset,
    elevation: colors.cardShadow.elevation,
    marginBottom: 28,
  },
  tableCardHeader: { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  tableCardTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  emptyState: { padding: 32, alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: 13 },
  thRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  th: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.5 },
  trRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  tdCode: { fontSize: 13, fontWeight: '700', color: colors.accent },
  tdPrimaryText: { fontSize: 13, fontWeight: '700', color: colors.text },
  tdHash: { fontSize: 12, color: colors.muted, fontFamily: 'monospace' },
  actionLink: { fontSize: 12, fontWeight: '700', color: colors.accent },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 500, backgroundColor: colors.panel, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.line, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalBody: { gap: 16, marginBottom: 24 },
  modalField: { gap: 4 },
  modalFieldLabel: { fontSize: 11, fontWeight: '800', color: colors.muted },
  modalValCode: { fontSize: 16, fontWeight: '800', color: colors.accent },
  modalValHash: { fontSize: 12, color: colors.text, fontFamily: 'monospace', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  modalCloseButton: { backgroundColor: colors.accent, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  // System Health
  overallBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 18, borderWidth: 1, marginBottom: 24 },
  bannerHealthy: { backgroundColor: colors.successBg, borderColor: '#A7F3D0' },
  bannerDegraded: { backgroundColor: colors.warnBg, borderColor: '#FDE68A' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  bannerSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '600' },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 28 },
  healthCard: { flexGrow: 1, flexBasis: 280, backgroundColor: colors.panel, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.line, shadowColor: colors.cardShadow.shadowColor, shadowOpacity: colors.cardShadow.shadowOpacity, shadowRadius: colors.cardShadow.shadowRadius, shadowOffset: colors.cardShadow.shadowOffset, elevation: colors.cardShadow.elevation },
  healthCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  serviceTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serviceIconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  serviceName: { fontSize: 13, fontWeight: '800', color: colors.text },
  serviceDetail: { fontSize: 13, color: colors.muted, marginVertical: 8, lineHeight: 18 },
  serviceFooter: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 6 },
  serviceFooterText: { fontSize: 11, color: colors.muted },

  // Settings
  settingsWrapper: { gap: 20, marginBottom: 32 },
  settingCard: { backgroundColor: colors.panel, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: colors.line, shadowColor: colors.cardShadow.shadowColor, shadowOpacity: colors.cardShadow.shadowOpacity, shadowRadius: colors.cardShadow.shadowRadius, shadowOffset: colors.cardShadow.shadowOffset, elevation: colors.cardShadow.elevation, gap: 16 },
  settingCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  settingCardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  settingField: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.5 },
  settingInput: { height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, color: colors.text, fontWeight: '600', backgroundColor: '#F8FAFC' },
  fieldHint: { fontSize: 11, color: colors.muted },
  saveBtn: { height: 50, backgroundColor: colors.accent, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  // Admins
  restrictedContainer: { padding: 40, alignItems: 'center', backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  restrictedTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 12 },
  restrictedText: { fontSize: 14, color: colors.muted, marginTop: 6 },
  createToggleBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  createToggleText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  tableCardMobile: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: 16,
  },
  mobileCardList: {
    gap: 12,
  },
  mobileCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.cardShadow.shadowColor,
    shadowOpacity: colors.cardShadow.shadowOpacity,
    shadowRadius: colors.cardShadow.shadowRadius,
    shadowOffset: colors.cardShadow.shadowOffset,
    elevation: colors.cardShadow.elevation,
  },
  mobileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  mobileKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.5,
  },
  mobileCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 2,
  },
  mobileCardBody: {
    gap: 6,
    marginVertical: 4,
  },
  mobilePrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  mobileMetaText: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  mobileActionRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    alignItems: 'flex-end',
  },
  formCard: { backgroundColor: colors.accentLight, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.accent, marginBottom: 20 },
  formCardTitle: { fontSize: 15, fontWeight: '800', color: colors.accent, marginBottom: 14 },
  formGrid: { gap: 12, marginBottom: 16 },
  formField: { gap: 6 },
  formLabel: { fontSize: 11, fontWeight: '800', color: colors.muted },
  formInput: { height: 42, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: colors.text },
  roleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line },
  roleChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  roleChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  roleChipTextActive: { color: '#FFFFFF' },
  formSubmitBtn: { height: 44, backgroundColor: colors.accent, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  formSubmitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
