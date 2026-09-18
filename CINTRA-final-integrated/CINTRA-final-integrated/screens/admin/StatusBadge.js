import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './adminTheme';

const STATUS_MAP = {
  // Green / Success
  ACTIVE: { bg: colors.successBg, text: colors.success, label: 'ACTIVE' },
  VERIFIED: { bg: colors.successBg, text: colors.success, label: 'VERIFIED' },
  CHAIN_VERIFIED: { bg: colors.successBg, text: colors.success, label: 'CHAIN VERIFIED' },
  HEALTHY: { bg: colors.successBg, text: colors.success, label: 'HEALTHY' },
  MATCH: { bg: colors.successBg, text: colors.success, label: 'MATCH' },
  SUCCESS: { bg: colors.successBg, text: colors.success, label: 'SUCCESS' },
  SUPER_ADMIN: { bg: '#EDE9FE', text: '#6D28D9', label: 'SUPER ADMIN' },
  
  // Amber / Warning
  SUSPENDED: { bg: colors.warnBg, text: colors.warn, label: 'SUSPENDED' },
  PENDING: { bg: colors.warnBg, text: colors.warn, label: 'PENDING' },
  LOW_CONFIDENCE: { bg: colors.warnBg, text: colors.warn, label: 'LOW CONFIDENCE' },
  DEGRADED: { bg: colors.warnBg, text: colors.warn, label: 'DEGRADED' },
  WARNING: { bg: colors.warnBg, text: colors.warn, label: 'WARNING' },
  
  // Red / Danger
  DISABLED: { bg: colors.dangerBg, text: colors.danger, label: 'DISABLED' },
  FAILED: { bg: colors.dangerBg, text: colors.danger, label: 'FAILED' },
  UNHEALTHY: { bg: colors.dangerBg, text: colors.danger, label: 'UNHEALTHY' },
  PROCESSING_ERROR: { bg: colors.dangerBg, text: colors.danger, label: 'ERROR' },
  ERROR: { bg: colors.dangerBg, text: colors.danger, label: 'ERROR' },

  // Blue / Info
  REAL_ENROLLMENT: { bg: colors.infoBg, text: colors.info, label: 'REAL ENROLLMENT' },
  PROCESSING: { bg: colors.infoBg, text: colors.info, label: 'PROCESSING' },
  HASHED: { bg: colors.infoBg, text: colors.info, label: 'HASHED' },
  NO_MATCH: { bg: '#F1F5F9', text: '#475569', label: 'NO MATCH' },
  ADMIN: { bg: colors.infoBg, text: colors.info, label: 'ADMIN' },

  // Purple / Demo
  DEMO_SEEDED: { bg: colors.demoBg, text: colors.demoText, label: 'DEMO SEEDED' },
  DEMO: { bg: colors.demoBg, text: colors.demoText, label: 'DEMO' },
  AUDITOR: { bg: '#F1F5F9', text: '#475569', label: 'AUDITOR' },
};

export default function StatusBadge({ status, customLabel }) {
  const normalizedKey = String(status || '').toUpperCase().trim();
  const config = STATUS_MAP[normalizedKey] || {
    bg: '#F1F5F9',
    text: '#475569',
    label: normalizedKey.replace(/_/g, ' ') || 'UNKNOWN',
  };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.text }]} numberOfLines={1}>
        {customLabel || config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    whiteSpace: 'nowrap',
  },
});
