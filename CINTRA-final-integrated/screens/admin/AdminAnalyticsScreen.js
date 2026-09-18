import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { adminApi } from '../../services/adminApi';
import { isAdminAuthenticated } from '../../services/adminAuth';
import AdminChrome from './AdminChrome';
import { CHART_SERIES_COLORS, colors } from './adminTheme';
import PageHeader from './PageHeader';
import { ChartCardSkeleton, StatCardSkeleton } from './SkeletonLoaders';
import StatCard from './StatCard';

const ANALYTICS_GRAPH_COLORS = {
  navy: '#104052',   // Dark Navy Teal (Scans, No-Match, Officer Activity)
  olive: '#4C7638',  // Muted Forest/Olive Green (Matches, Evidence Logged)
  teal: '#388E8E',   // Muted Cyan Teal (Confidence Score Distribution)
};

function ChartCard({ title, subtitle, series, valueKey = 'count', color = ANALYTICS_GRAPH_COLORS.navy, showViewProfile = false }) {
  const getItemVal = (item) => item[valueKey] ?? item.count ?? item.value ?? item.scans ?? 0;
  const max = Math.max(1, ...series.map(getItemVal));

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartHeaderLeft}>
          <Text style={styles.chartTitle}>{title}</Text>
          {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.chartHeaderRight}>
          <Text style={styles.activeBadge}>ACTIVE</Text>
          {showViewProfile ? <Text style={styles.viewProfileText}>View Profile →</Text> : null}
        </View>
      </View>

      {series.length === 0 ? (
        <Text style={styles.emptyChart}>No trend data recorded for this period.</Text>
      ) : (
        <View style={styles.chartBody}>
          {series.map((item, index) => {
            const label = item.date || item.bucket || item.name || item.officer_id || `Item ${index + 1}`;
            const val = getItemVal(item);
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
          <>
            <StatCardSkeleton count={4} />
            <ChartCardSkeleton count={4} />
          </>
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
                accentColor={ANALYTICS_GRAPH_COLORS.navy}
              />
              <StatCard
                label="Total Matches"
                value={data.totals?.matches ?? 0}
                subtext="Identity verified"
                icon="checkmark-circle-outline"
                accentColor={ANALYTICS_GRAPH_COLORS.olive}
              />
              <StatCard
                label="No-Match Rate"
                value={data.totals?.no_matches ?? 0}
                subtext="Unidentified events"
                icon="alert-circle-outline"
                accentColor={ANALYTICS_GRAPH_COLORS.navy}
              />
              <StatCard
                label="Evidence Created"
                value={data.totals?.evidence ?? 0}
                subtext="Digital records logged"
                icon="folder-outline"
                accentColor={ANALYTICS_GRAPH_COLORS.olive}
              />
            </View>

            {/* RESPONSIVE CHARTS GRID */}
            <View style={styles.chartsGrid}>
              <ChartCard
                title="Scans Over Time"
                subtitle="Daily facial recognition volume"
                series={data.scans_per_day || []}
                color={ANALYTICS_GRAPH_COLORS.navy}
                showViewProfile={false}
              />

              <ChartCard
                title="Matches Over Time"
                subtitle="Daily verified suspect identifications"
                series={data.matches_per_day || []}
                color={ANALYTICS_GRAPH_COLORS.olive}
                showViewProfile={true}
              />

              <ChartCard
                title="No-Match Events"
                subtitle="Daily unmatched scan volume"
                series={data.no_match_per_day || []}
                color={ANALYTICS_GRAPH_COLORS.navy}
                showViewProfile={true}
              />

              <ChartCard
                title="Confidence Score Distribution"
                subtitle="Match confidence frequency breakdown"
                series={data.confidence_distribution || []}
                color={ANALYTICS_GRAPH_COLORS.teal}
                showViewProfile={true}
              />

              <ChartCard
                title="Officer Activity Breakdown"
                subtitle="Total scans executed per registered officer"
                series={data.activity_by_officer || []}
                valueKey="scans"
                color={ANALYTICS_GRAPH_COLORS.navy}
                showViewProfile={true}
              />

              <ChartCard
                title="Evidence Logged Over Time"
                subtitle="Digital evidence uploads per day"
                series={data.evidence_over_time || []}
                color={ANALYTICS_GRAPH_COLORS.olive}
                showViewProfile={true}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </AdminChrome>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  chartHeaderRight: {
    alignItems: 'flex-end',
  },
  activeBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#104052',
    letterSpacing: 0.5,
  },
  viewProfileText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#104052',
    marginTop: 2,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
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
    backgroundColor: colors.panelAlt,
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

