import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './adminTheme';

export default function PageHeader({ title, subtitle, actions, demoMode }) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{title}</Text>
        </View>
        {(demoMode || actions) && (
          <View style={styles.rightGroup}>
            {demoMode ? (
              <View style={styles.demoBadge}>
                <Text style={styles.demoText}>DEMO DATA</Text>
              </View>
            ) : null}
            {actions ? <View style={styles.actions}>{actions}</View> : null}
          </View>
        )}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  titleGroup: {
    flex: 1,
    minWidth: 160,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 19,
  },
  demoBadge: {
    backgroundColor: colors.demoBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  demoText: {
    color: colors.demoText,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
