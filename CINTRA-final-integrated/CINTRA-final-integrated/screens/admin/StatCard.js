import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './adminTheme';

export default function StatCard({ label, value, subtext, icon, accentColor = colors.accent }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: `${accentColor}15` }]}>
            <Ionicons name={icon} size={18} color={accentColor} />
          </View>
        ) : null}
      </View>
      <Text style={styles.value}>{value ?? '—'}</Text>
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtext: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
});
