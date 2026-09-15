import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../services/adminApi';
import { clearAdminSession, getAdminProfile, getRemainingAdminSessionTime } from '../../services/adminAuth';
import { colors, MOBILE_BREAKPOINT, NAV_ITEMS, SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED } from './adminTheme';
import { getSidebarCollapsed, setSidebarCollapsed } from './sidebarState';

export default function AdminChrome({ navigation, active, children }) {
  const profile = getAdminProfile();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [collapsed, setCollapsed] = useState(getSidebarCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tooltip, setTooltip] = useState('');
  const [tooltipY, setTooltipY] = useState(72);
  const [remainingSecs, setRemainingSecs] = useState(() => Math.max(0, Math.round(getRemainingAdminSessionTime() / 1000)));
  const rowRef = useRef(null);

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => !item.superOnly || profile?.role === 'SUPER_ADMIN'),
    [profile?.role]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const secs = Math.max(0, Math.round(getRemainingAdminSessionTime() / 1000));
      setRemainingSecs(secs);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch (error) {
      // Local session is still cleared so admin screens become inaccessible.
    }
    clearAdminSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const toggleCollapsed = () => {
    const next = setSidebarCollapsed(!collapsed);
    setCollapsed(next);
  };

  const go = (key) => {
    setDrawerOpen(false);
    if (key !== active) {
      navigation.replace(key);
    }
  };

  const sidebar = (
    <SidebarBody
      collapsed={!isMobile && collapsed}
      items={items}
      active={active}
      profile={profile}
      isMobile={isMobile}
      onToggle={isMobile ? () => setDrawerOpen(false) : toggleCollapsed}
      onNavigate={go}
      onLogout={logout}
      onHover={(label, pageY) => {
        setTooltip(label);
        if (typeof pageY !== 'number') {
          return;
        }
        if (rowRef.current?.measureInWindow) {
          rowRef.current.measureInWindow((_x, top) => {
            setTooltipY(Math.max(8, pageY - top - 12));
          });
        } else {
          setTooltipY(pageY);
        }
      }}
    />
  );

  const sessionWarningBadge = (compact = false) => (
    <View style={[styles.timerBadge, remainingSecs <= 15 && styles.timerBadgeWarning, compact && styles.timerBadgeCompact]}>
      <Ionicons
        name={remainingSecs <= 15 ? 'warning-outline' : 'time-outline'}
        size={14}
        color={remainingSecs <= 15 ? '#DC2626' : colors.accent}
      />
      <Text style={[styles.timerBadgeText, remainingSecs <= 15 && styles.timerBadgeTextWarning]} numberOfLines={1}>
        {compact ? `${remainingSecs}s` : `Session expires in ${remainingSecs}s due to inactivity.`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {isMobile ? (
        <View style={styles.mobileRoot}>
          <View style={styles.mobileBar}>
            <TouchableOpacity
              style={styles.iconHit}
              onPress={() => setDrawerOpen(true)}
              accessibilityLabel="Open navigation"
              accessibilityRole="button"
            >
              <Ionicons name="menu" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.mobileTitleGroup}>
              <Text style={styles.mobileTitle} numberOfLines={1}>CINTRA</Text>
              <Text style={styles.mobileSubtitle} numberOfLines={1}>ADMIN PORTAL</Text>
            </View>
            {sessionWarningBadge(true)}
          </View>
          <View style={[styles.content, isMobile && styles.contentMobile]}>
            {children}
          </View>
          {drawerOpen ? (
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.drawer}>{sidebar}</View>
              <Pressable
                style={styles.backdrop}
                onPress={() => setDrawerOpen(false)}
                accessibilityLabel="Close navigation"
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View ref={rowRef} style={styles.row} collapsable={false}>
          <View style={[styles.sidebarShell, { width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }]}>
            {sidebar}
          </View>
          <View style={styles.content}>
            <View style={styles.topSessionHeader}>
              <View style={{ flex: 1 }} />
              {sessionWarningBadge(false)}
            </View>
            {children}
          </View>
          {collapsed && tooltip ? (
            <View pointerEvents="none" style={[styles.tooltip, { top: tooltipY }]}>
              <Text style={styles.tooltipText}>{tooltip}</Text>
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function SidebarBody({ collapsed, items, active, profile, isMobile, onToggle, onNavigate, onLogout, onHover }) {
  const toggleLabel = isMobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <View style={styles.sidebarInner}>
      <View style={[styles.brandRow, collapsed && styles.brandRowCollapsed]}>
        <View style={styles.brandGroup}>
          <View style={styles.brandIconBox}>
            <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
          </View>
          {!collapsed ? (
            <View style={styles.brandTextGroup}>
              <Text style={styles.brandMarkText}>CINTRA</Text>
              <Text style={styles.portalSubtitle}>ADMIN PORTAL</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.toggleHit}
          onPress={onToggle}
          accessibilityLabel={toggleLabel}
          accessibilityRole="button"
        >
          <Ionicons
            name={isMobile ? 'close' : collapsed ? 'chevron-forward' : 'chevron-back'}
            size={18}
            color={colors.muted}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <ScrollView style={styles.scrollNav} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const selected = active === item.key;
          return (
            <Pressable
              key={item.key}
              style={[styles.navItem, collapsed && styles.navItemCollapsed, selected && styles.navItemActive]}
              onPress={() => onNavigate(item.key)}
              onHoverIn={(event) => collapsed && onHover(item.label, event?.nativeEvent?.pageY)}
              onHoverOut={() => onHover('')}
              accessibilityLabel={item.label}
              accessibilityRole="button"
            >
              <Ionicons name={item.icon} size={20} color={selected ? colors.accent : colors.muted} />
              {!collapsed ? (
                <Text style={[styles.navText, selected && styles.navTextActive]} numberOfLines={1}>
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.profile, collapsed && styles.profileCollapsed]}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={colors.accent} />
          </View>
          {!collapsed ? (
            <View style={styles.profileText}>
              <Text style={styles.footerId} numberOfLines={1}>{profile?.admin_user_id || '—'}</Text>
              <Text style={styles.footerRole} numberOfLines={1}>{profile?.role || ''}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={onLogout}
          style={[styles.logout, collapsed && styles.logoutCollapsed]}
          onHoverIn={(event) => collapsed && onHover('Logout', event?.nativeEvent?.pageY)}
          onHoverOut={() => onHover('')}
          accessibilityLabel="Logout"
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          {!collapsed ? <Text style={styles.logoutText}>Logout</Text> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  row: { flex: 1, flexDirection: 'row', minWidth: 0 },
  mobileRoot: { flex: 1, minWidth: 0 },
  mobileBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panel,
  },
  mobileTitleGroup: { marginLeft: 10, flex: 1 },
  mobileTitle: { color: colors.accent, fontWeight: '800', fontSize: 16, letterSpacing: 1 },
  mobileSubtitle: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  topSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timerBadgeWarning: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  timerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  timerBadgeTextWarning: {
    color: '#DC2626',
  },
  sidebarShell: {
    backgroundColor: colors.panel,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    flexShrink: 0,
  },
  sidebarInner: { flex: 1, paddingHorizontal: 12, paddingTop: 16 },
  drawer: {
    width: SIDEBAR_EXPANDED,
    maxWidth: '86%',
    height: '100%',
    backgroundColor: colors.panel,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  brandRowCollapsed: { flexDirection: 'column', alignItems: 'center', gap: 10 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTextGroup: { justifyContent: 'center' },
  brandMarkText: { color: colors.accent, fontSize: 18, fontWeight: '800', letterSpacing: 1.5 },
  portalSubtitle: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: -2 },
  toggleHit: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  scrollNav: { flex: 1 },
  navItem: {
    minHeight: 42,
    borderRadius: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  navItemActive: { backgroundColor: colors.panelAlt, borderWidth: 1, borderColor: '#BFDBFE' },
  navText: { color: colors.muted, fontSize: 13, fontWeight: '500', flex: 1, minWidth: 0 },
  navTextActive: { color: colors.text, fontWeight: '700' },
  footer: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  profileCollapsed: { justifyContent: 'center' },
  profileText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerId: { color: colors.text, fontSize: 13, fontWeight: '700' },
  footerRole: { color: colors.muted, fontSize: 11, marginTop: 1 },
  logout: {
    minHeight: 40,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  logoutCollapsed: { paddingHorizontal: 0 },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  content: { flex: 1, minWidth: 0, padding: 24, backgroundColor: colors.bg },
  contentMobile: { padding: 12 },
  iconHit: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  tooltip: {
    position: 'absolute',
    left: SIDEBAR_COLLAPSED + 12,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 100,
  },
  tooltipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
});
