import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PALETTES = {
  // Priority Tags
  CRITICAL: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  URGENT: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  EXTREME: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  
  HIGH: { bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74' },
  
  MEDIUM: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  MODERATE: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  
  LOW: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  NORMAL: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },

  // Status Tags
  ACTIVE: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  OPEN: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  VERIFIED: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  MATCH: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  HEALTHY: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  IN_CUSTODY: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  RECORDED: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  SUCCESS: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  CHAIN_VERIFIED: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },

  UNDER_INVESTIGATION: { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' },
  IN_PROGRESS: { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' },
  ACTIVE_SEARCH: { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' },
  PROCESSING: { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' },
  REAL_ENROLLMENT: { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' },

  PENDING: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  ON_HOLD: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  SUSPENDED: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  LOOKOUT_NOTICE: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  DEMO: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  DEMO_SEEDED: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  SUPER_ADMIN: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },

  FAILED: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  DISABLED: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  UNHEALTHY: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  ERROR: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },

  DEFAULT: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
};

export function getBadgeStyle(value) {
  if (!value) return PALETTES.DEFAULT;
  const key = String(value).toUpperCase().trim().replace(/[\s-]+/g, '_');
  return PALETTES[key] || PALETTES.DEFAULT;
}

export default function Badge({ label, type, text, variant, style, textStyle }) {
  const displayLabel = text || label || variant || type || '';
  if (!displayLabel) return null;

  const styleConfig = getBadgeStyle(variant || type || text || label);

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: styleConfig.text },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {String(displayLabel).toUpperCase()}
      </Text>
    </View>
  );
}

export function BadgeGroup({ children, style }) {
  return (
    <View style={[styles.badgeGroup, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  badgeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
});
