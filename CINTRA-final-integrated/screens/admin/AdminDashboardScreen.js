import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../services/adminApi';
import { isAdminAuthenticated } from '../../services/adminAuth';
import AdminChrome from './AdminChrome';
import { CHART_SERIES_COLORS, colors, MOBILE_BREAKPOINT } from './adminTheme';
import PageHeader from './PageHeader';
import { StatCardSkeleton, TableSkeleton } from './SkeletonLoaders';
import StatCard from './StatCard';
import StatusBadge from './StatusBadge';
import { formatDate, formatTimeOnly } from './dateUtils';

export default function AdminDashboardScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
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
      setData(await adminApi.dashboard());
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminChrome navigation={navigation} active="AdminDashboard">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.accent]} />}
      >
        <PageHeader
          title="System Overview"
          subtitle="Operational overview of the CINTRA facial recognition and security platform."
          demoMode={data?.demo_mode}
        />

        {loading && !data ? (
          <>
            <StatCardSkeleton count={6} />
            <TableSkeleton rows={4} />
          </>
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
            {/* STATISTICAL METRICS GRID */}
            <View style={styles.grid}>
              <StatCard
                label="Active Officers"
                value={data.active_officers}
                subtext="Registered personnel"
                icon="people-outline"
                accentColor={CHART_SERIES_COLORS.indigo}
              />
              <StatCard
                label="Enrolled Persons"
                value={data.enrolled_persons}
                subtext="Face database records"
                icon="finger-print-outline"
                accentColor={CHART_SERIES_COLORS.teal}
              />
              <StatCard
                label="Today's Scans"
                value={data.todays_scans}
                subtext="Facial scans processed"
                icon="scan-outline"
                accentColor={CHART_SERIES_COLORS.sky}
              />
              <StatCard
                label="Today's Matches"
                value={data.todays_matches}
                subtext="Verified identity matches"
                icon="checkmark-circle-outline"
                accentColor={CHART_SERIES_COLORS.sage}
              />
              <StatCard
                label="No Matches"
                value={data.todays_no_matches}
                subtext="Unidentified subjects"
                icon="alert-circle-outline"
                accentColor={CHART_SERIES_COLORS.amber}
              />
              <StatCard
                label="Evidence Records"
                value={data.evidence_records}
                subtext="Secured digital evidence"
                icon="folder-outline"
                accentColor={CHART_SERIES_COLORS.slate}
              />
            </View>

            {/* SYSTEM HEALTH CARDS */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>System Health</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AdminSystem')}>
                  <Text style={styles.sectionLink}>View All Systems →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.healthGrid}>
                {Object.entries(data.system_health?.checks || {}).map(([key, value]) => {
                  const healthy = value.status === 'healthy';
                  const title = key.replace(/_/g, ' ').toUpperCase();
                  return (
                    <View key={key} style={styles.healthCard}>
                      <View style={styles.healthCardHeader}>
                        <Text style={styles.healthTitle}>{title}</Text>
                        <StatusBadge status={healthy ? 'HEALTHY' : 'UNHEALTHY'} />
                      </View>
                      <Text style={styles.healthDetail}>{value.detail}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* RECENT ACTIVITY TABLE */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AdminRecognition')}>
                  <Text style={styles.sectionLink}>View Full Log →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tableCard}>
                {(data.recent_activity || []).length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No recent recognition activity recorded.</Text>
                  </View>
                ) : isMobile ? (
                  <View style={styles.mobileCardList}>
                    {(data.recent_activity || []).map((item) => (
                      <View key={item.event_id} style={styles.mobileCard}>
                        <View style={styles.mobileCardHeader}>
                          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                            <Text style={styles.mobileKicker}>EVENT</Text>
                            <Text style={styles.mobileCodeText} numberOfLines={1}>{item.event_id}</Text>
                          </View>
                          <StatusBadge status={item.result} />
                        </View>
                        <View style={styles.mobileCardBody}>
                          <Text style={styles.mobileMetaText}>
                            Time: <Text style={styles.mobileValText}>{formatTimeOnly(item.timestamp)}</Text>
                          </Text>
                          <Text style={styles.mobileMetaText}>
                            Officer: <Text style={styles.mobileValText} numberOfLines={1}>{item.officer || '—'}</Text>
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.mobileActionRow}
                          onPress={() => navigation.navigate('AdminRecognitionDetail', { id: item.event_id })}
                        >
                          <Text style={styles.tableActionText}>Details →</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.th, { flex: 1.2 }]}>TIME</Text>
                      <Text style={[styles.th, { flex: 1.5 }]}>EVENT ID</Text>
                      <Text style={[styles.th, { flex: 1.5 }]}>OFFICER</Text>
                      <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
                      <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>ACTION</Text>
                    </View>
                    {(data.recent_activity || []).map((item) => (
                      <View key={item.event_id} style={styles.tableRow}>
                        <Text style={[styles.tdTime, { flex: 1.2 }]}>
                          {formatTimeOnly(item.timestamp)}
                        </Text>
                        <Text style={[styles.tdCode, { flex: 1.5 }]} numberOfLines={1}>{item.event_id}</Text>
                        <Text style={[styles.tdText, { flex: 1.5 }]} numberOfLines={1}>{item.officer || '—'}</Text>
                        <View style={{ flex: 1.2 }}>
                          <StatusBadge status={item.result} />
                        </View>
                        <TouchableOpacity
                          style={{ width: 70, alignItems: 'flex-end' }}
                          onPress={() => navigation.navigate('AdminRecognitionDetail', { id: item.event_id })}
                        >
                          <Text style={styles.tableActionText}>Details</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>

            {/* SECURITY ALERTS */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Security Alerts</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AdminAudit')}>
                  <Text style={styles.sectionLink}>View Audit Log →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.alertsContainer}>
                {(data.alerts || []).length === 0 ? (
                  <View style={styles.tableCard}>
                    <View style={styles.emptyState}>
                      <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
                      <Text style={[styles.emptyText, { marginLeft: 8 }]}>No active security alerts.</Text>
                    </View>
                  </View>
                ) : (
                  (data.alerts || []).map((item, index) => (
                    <View key={`${item.timestamp}-${index}`} style={styles.alertCard}>
                      <View style={styles.alertIconBox}>
                        <Ionicons name="warning-outline" size={20} color={colors.warn} />
                      </View>
                      <View style={styles.alertContent}>
                        <Text style={styles.alertTitle}>{item.action?.replace(/_/g, ' ')}</Text>
                        <Text style={styles.alertMeta}>{formatDate(item.timestamp)}</Text>
                      </View>
                      <StatusBadge status={item.result} />
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </AdminChrome>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 12,
    textAlign: 'center',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  healthCard: {
    flexGrow: 1,
    flexBasis: 180,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.cardShadow.shadowColor,
    shadowOpacity: colors.cardShadow.shadowOpacity,
    shadowRadius: colors.cardShadow.shadowRadius,
    shadowOffset: colors.cardShadow.shadowOffset,
    elevation: colors.cardShadow.elevation,
  },
  healthCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
  },
  healthDetail: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
    marginTop: 4,
  },
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
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tdTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  tdCode: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  tdText: {
    fontSize: 13,
    color: colors.text,
  },
  tableActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  emptyState: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
  },
  alertsContainer: {
    gap: 10,
  },
  alertCard: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.warnBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  alertMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  mobileCardList: {
    padding: 12,
    gap: 10,
  },
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
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
    marginTop: 1,
  },
  mobileCardBody: {
    gap: 4,
    marginVertical: 6,
  },
  mobileMetaText: {
    fontSize: 12,
    color: colors.muted,
  },
  mobileValText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  mobileActionRow: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingTop: 6,
  },
});
