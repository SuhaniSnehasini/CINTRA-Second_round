import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from './adminTheme';

function PulseBox({ style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.pulse, style, { opacity }]} />;
}

export function StatCardSkeleton({ count = 4 }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.statCard}>
          <View style={styles.statHeader}>
            <PulseBox style={{ width: 100, height: 14, borderRadius: 4 }} />
            <PulseBox style={{ width: 34, height: 34, borderRadius: 8 }} />
          </View>
          <PulseBox style={{ width: 80, height: 28, borderRadius: 6, marginVertical: 8 }} />
          <PulseBox style={{ width: 110, height: 12, borderRadius: 4 }} />
        </View>
      ))}
    </View>
  );
}

export function ChartCardSkeleton({ count = 2 }) {
  return (
    <View style={styles.chartGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <PulseBox style={{ width: 140, height: 18, borderRadius: 4 }} />
            <PulseBox style={{ width: 220, height: 12, borderRadius: 4, marginTop: 6 }} />
          </View>
          <View style={styles.chartBars}>
            {Array.from({ length: 5 }).map((_, b) => (
              <View key={b} style={styles.barRow}>
                <PulseBox style={{ width: 80, height: 12, borderRadius: 4 }} />
                <PulseBox style={{ flex: 1, height: 10, borderRadius: 5 }} />
                <PulseBox style={{ width: 30, height: 12, borderRadius: 4 }} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <View style={styles.tableCard}>
      <View style={styles.tableHeader}>
        <PulseBox style={{ width: 100, height: 14, borderRadius: 4 }} />
        <PulseBox style={{ width: 140, height: 14, borderRadius: 4 }} />
        <PulseBox style={{ width: 80, height: 14, borderRadius: 4 }} />
      </View>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.tableRow}>
          <PulseBox style={{ flex: 1, height: 14, borderRadius: 4, marginRight: 12 }} />
          <PulseBox style={{ flex: 1.5, height: 14, borderRadius: 4, marginRight: 12 }} />
          <PulseBox style={{ width: 70, height: 20, borderRadius: 10 }} />
        </View>
      ))}
    </View>
  );
}

export function PageHeaderSkeleton() {
  return (
    <View style={styles.header}>
      <PulseBox style={{ width: 200, height: 26, borderRadius: 6 }} />
      <PulseBox style={{ width: 320, height: 14, borderRadius: 4, marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  pulse: {
    backgroundColor: '#E2E8F0',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 24,
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
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartBars: {
    gap: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tableCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    padding: 16,
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  header: {
    marginBottom: 20,
  },
});
