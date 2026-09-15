import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { adminApi } from '../../services/adminApi';
import { isAdminAuthenticated } from '../../services/adminAuth';
import AdminChrome from './AdminChrome';
import { colors } from './adminTheme';
import PageHeader from './PageHeader';
import StatCard from './StatCard';

function ChartCard({ title, subtitle, series, valueKey = 'count', color = colors.accent }) {
  const max = Math.max(1, ...series.map((item) => item[valueKey] || 0));

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
      </View>

      {series.length === 0 ? (
        <Text style={styles.emptyChart}>No trend data recorded for this period.</Text>
      ) : (
        <View style={styles.chartBody}>
          {series.map((item, index) => {
            const label = item.date || item.bucket || item.officer_id || `Item ${index + 1}`;
            const val = item[valueKey] ?? item.scans ?? 0;
            const pct = Math.round((val / max) * 100);

            return (
              <View key={label} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.barValue}>{val}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function AdminAnalyticsScreen({ navigation }) {
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
      setData(await adminApi.analytics(14));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminChrome navigation={navigation} active="AdminAnalytics">
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title="Analytics & Reports"
          subtitle="System performance, recognition accuracy distributions, and activity trends over the last 14 days."
        />

        {loading && !data ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Computing analytics overview…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryText}>Retry Loading</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            {/* TOP METRIC CARDS SUMMARY */}
            <View style={styles.metricsGrid}>
              <StatCard
                label="Total Scans"
                value={data.totals?.scans ?? 0}
                subtext="Last 14 days"
                icon="scan-outline"
                accentColor="#2563EB"
              />
              <StatCard
                label="Total Matches"
                value={data.totals?.matches ?? 0}
                subtext="Identity verified"
                icon="checkmark-circle-outline"
                accentColor="#059669"
              />
              <StatCard
                label="No-Match Rate"
                value={data.totals?.no_matches ?? 0}
                subtext="Unidentified events"
                icon="alert-circle-outline"
                accentColor="#D97706"
              />
              <StatCard
                label="Evidence Created"
                value={data.totals?.evidence ?? 0}
                subtext="Digital records logged"
                icon="folder-outline"
                accentColor="#7C3AED"
              />
            </View>

            {/* RESPONSIVE CHARTS GRID */}
            <View style={styles.chartsGrid}>
              <ChartCard
                title="Scans Over Time"
                subtitle="Daily facial recognition volume"
                series={data.scans_per_day || []}
                color="#2563EB"
              />

              <ChartCard
                title="Matches Over Time"
                subtitle="Daily verified suspect identifications"
                series={data.matches_per_day || []}
                color="#059669"
              />

              <ChartCard
                title="No-Match Events"
                subtitle="Daily unmatched scan volume"
                series={data.no_match_per_day || []}
                color="#D97706"
              />

              <ChartCard
                title="Confidence Score Distribution"
                subtitle="Match confidence frequency breakdown"
                series={data.confidence_distribution || []}
                color="#7C3AED"
              />

              <ChartCard
                title="Officer Activity Breakdown"
                subtitle="Total scans executed per registered officer"
                series={data.activity_by_officer || []}
                valueKey="scans"
                color="#0284C7"
              />

              <ChartCard
                title="Evidence Logged Over Time"
                subtitle="Digital evidence uploads per day"
                series={data.evidence_over_time || []}
                color="#4F46E5"
              />
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
    marginBottom: 12,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  chartsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 32,
  },
  chartCard: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 260,
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
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  chartBody: {
    gap: 10,
  },
  emptyChart: {
    color: colors.muted,
    fontSize: 13,
    paddingVertical: 20,
    textAlign: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 90,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barValue: {
    width: 36,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
});
