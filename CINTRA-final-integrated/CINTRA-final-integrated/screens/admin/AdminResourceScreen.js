import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../services/adminApi';
import { isAdminAuthenticated } from '../../services/adminAuth';
import { isAuthenticated } from '../../services/authService';
import AdminChrome from './AdminChrome';
import { colors, MOBILE_BREAKPOINT } from './adminTheme';
import PageHeader from './PageHeader';
import StatusBadge from './StatusBadge';
import FilterChips from './FilterChips';
import { formatDate } from './dateUtils';

const RESOURCES = {
  AdminOfficers: {
    title: 'Officer Management',
    subtitle: 'Manage registered officers, status, activity and recognition statistics.',
    searchPlaceholder: 'Search officer ID, name, or unit...',
    filterLabel: 'Status',
    filterKey: 'status',
    filters: ['', 'ACTIVE', 'SUSPENDED', 'DISABLED'],
    fetch: (query) => adminApi.officers(query),
    idKey: 'officer_id',
    detail: 'AdminOfficerDetail',
    empty: 'No officers found matching the selected filters.',
    loading: 'Loading officer list…',
  },
  AdminPersons: {
    title: 'Person / Face Database',
    subtitle: 'Manage enrolled identities, reference face records, and enrollment status.',
    searchPlaceholder: 'Search person ID or reference name...',
    filterLabel: 'Enrollment Status',
    filterKey: 'enrollment_status',
    filters: ['', 'REAL_ENROLLMENT', 'DEMO_SEEDED', 'PROCESSING', 'VERIFIED'],
    fetch: (query) => adminApi.persons(query),
    idKey: 'person_id',
    detail: 'AdminPersonDetail',
    empty: 'No person records found matching the selected filters.',
    loading: 'Loading face database…',
  },
  AdminRecognition: {
    title: 'Recognition Center',
    subtitle: 'Review face recognition events, confidence scores, and identification outcomes.',
    searchPlaceholder: 'Search officer ID or person ID...',
    filterLabel: 'Recognition Outcome',
    filterKey: 'result',
    filters: ['', 'MATCH', 'NO_MATCH', 'LOW_CONFIDENCE', 'PROCESSING_ERROR'],
    fetch: (query) => {
      const params = { ...query, page: query.page, page_size: query.page_size, result: query.result };
      if (query.q?.startsWith('CINTRA-OFC') || query.q?.startsWith('OFF')) params.officer_id = query.q;
      else if (query.q) params.person_id = query.q;
      delete params.q;
      delete params.status;
      return adminApi.recognition(params);
    },
    idKey: 'event_id',
    detail: 'AdminRecognitionDetail',
    empty: 'No recognition events found matching the selected filters.',
    loading: 'Loading recognition activity…',
  },
  AdminEvidence: {
    title: 'Evidence Management',
    subtitle: 'Manage captured digital evidence, SHA-256 hashes, and integrity status.',
    searchPlaceholder: 'Search evidence ID, officer, or hash...',
    filterLabel: 'Integrity Status',
    filterKey: 'status',
    filters: ['', 'PENDING', 'HASHED', 'VERIFIED', 'CHAIN_VERIFIED', 'FAILED'],
    fetch: (query) => adminApi.evidence(query),
    idKey: 'evidence_id',
    detail: 'AdminEvidenceDetail',
    empty: 'No evidence records found matching the selected filters.',
    loading: 'Loading digital evidence records…',
  },
  AdminInvestigations: {
    title: 'Investigation Center',
    subtitle: 'Case-oriented investigation tracking, subject matches, and evidence chains.',
    searchPlaceholder: 'Search case ID or title...',
    filterLabel: '',
    filterKey: '',
    filters: [''],
    fetch: (query) => adminApi.investigations({ q: query.q, page: query.page, page_size: query.page_size }),
    idKey: 'case_id',
    detail: 'AdminInvestigationDetail',
    empty: 'No investigation cases found matching the selected filters.',
    loading: 'Loading investigation cases…',
  },
  AdminAudit: {
    title: 'Audit & Security',
    subtitle: 'Comprehensive administrative action audit log and security event tracking.',
    searchPlaceholder: 'Search admin user ID...',
    filterLabel: 'Action Type',
    filterKey: 'action',
    filters: ['', 'ADMIN_LOGIN', 'VIEW_OFFICER', 'VIEW_RECOGNITION', 'VIEW_EVIDENCE', 'CREATE_OFFICER', 'DISABLE_OFFICER', 'EXPORT_REPORT', 'CHANGE_SETTING', 'LOGOUT'],
    fetch: (query) => adminApi.audit({
      admin_user_id: query.q,
      action: query.action,
      page: query.page,
      page_size: query.page_size,
    }),
    idKey: null,
    detail: null,
    empty: 'No audit records found matching the selected filters.',
    loading: 'Loading administrative audit log…',
  },
};

export default function AdminResourceScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const spec = RESOURCES[route.name];
  if (!spec) {
    return null;
  }
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createId, setCreateId] = useState('');

  const load = useCallback(async (nextPage = page) => {
    if (!isAdminAuthenticated() && !isAuthenticated()) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const query = { q, page: nextPage, page_size: 25 };
      if (spec.filterKey && filter) query[spec.filterKey] = filter;
      setPayload(await spec.fetch(query));
      setPage(nextPage);
    } catch (err) {
      setError(err.message);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [filter, navigation, page, q, spec]);

  useFocusEffect(useCallback(() => { load(1); }, [filter]));

  const createOfficer = async () => {
    if (!createId.trim() || !createName.trim()) {
      Alert.alert('Missing Fields', 'Please provide both Officer ID and Full Name.');
      return;
    }
    try {
      await adminApi.createOfficer({
        officer_id: createId.trim(),
        name: createName.trim(),
        unit: 'Field Investigation Unit',
        designation: 'Field Officer',
        status: 'ACTIVE',
      });
      setCreateId('');
      setCreateName('');
      setShowCreateModal(false);
      load(1);
    } catch (err) {
      Alert.alert('Unable to create officer', err.message);
    }
  };

  return (
    <AdminChrome navigation={navigation} active={route.name}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageHeader
          title={spec.title}
          subtitle={spec.subtitle}
          actions={
            route.name === 'AdminOfficers' ? (
              <TouchableOpacity
                style={styles.actionPrimaryButton}
                onPress={() => setShowCreateModal(!showCreateModal)}
              >
                <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionPrimaryText}>
                  {showCreateModal ? 'Close Form' : '+ Add Officer'}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {/* OFFICER CREATE FORM (TOGGLEABLE) */}
        {route.name === 'AdminOfficers' && showCreateModal ? (
          <View style={styles.createCard}>
            <Text style={styles.createCardTitle}>Register New Officer</Text>
            <View style={styles.createRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>OFFICER ID</Text>
                <TextInput
                  style={styles.input}
                  value={createId}
                  onChangeText={setCreateId}
                  placeholder="e.g. CINTRA-OFC-010"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <TextInput
                  style={styles.input}
                  value={createName}
                  onChangeText={setCreateName}
                  placeholder="e.g. Agent Alex Rivera"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <TouchableOpacity style={styles.createSubmitButton} onPress={createOfficer}>
                <Text style={styles.createSubmitText}>Create Officer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* SEARCH AND FILTER BAR */}
        <View style={styles.filterCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={q}
                onChangeText={setQ}
                placeholder={spec.searchPlaceholder}
                placeholderTextColor={colors.muted}
                onSubmitEditing={() => load(1)}
              />
            </View>
            <TouchableOpacity style={styles.searchButton} onPress={() => load(1)}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {spec.filters.length > 1 ? (
            <FilterChips
              label={spec.filterLabel}
              options={spec.filters}
              selected={filter}
              onSelect={(val) => {
                setFilter(val);
              }}
            />
          ) : null}
        </View>

        {/* CONTENT TABLE / LIST */}
        {loading && !payload ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>{spec.loading}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load(page)}>
              <Text style={styles.retryText}>Retry Loading</Text>
            </TouchableOpacity>
          </View>
        ) : payload ? (
          <View style={styles.tableCard}>
            {(payload.items || []).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={36} color={colors.muted} />
                <Text style={styles.emptyText}>{spec.empty}</Text>
              </View>
            ) : (
              <>
                {/* RENDER SPECIFIC TABLE HEADERS AND ROWS DEPENDING ON ROUTE */}
                {renderTableContent(route.name, payload.items, navigation, spec, isMobile)}

                {/* PAGINATION CONTROLS */}
                <View style={styles.pager}>
                  <TouchableOpacity
                    style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                    disabled={page <= 1}
                    onPress={() => load(page - 1)}
                  >
                    <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.muted : colors.accent} />
                    <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>
                      {isMobile ? 'Prev' : 'Previous'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.pagerMeta} numberOfLines={1}>
                    Page <Text style={styles.pagerMetaBold}>{payload.page}</Text> of{' '}
                    <Text style={styles.pagerMetaBold}>{payload.total_pages || 1}</Text>
                    {!isMobile ? ` · ${payload.total} total` : ''}
                  </Text>

                  <TouchableOpacity
                    style={[styles.pageBtn, page >= (payload.total_pages || 1) && styles.pageBtnDisabled]}
                    disabled={page >= (payload.total_pages || 1)}
                    onPress={() => load(page + 1)}
                  >
                    <Text style={[styles.pageBtnText, page >= (payload.total_pages || 1) && styles.pageBtnTextDisabled]}>Next</Text>
                    <Ionicons name="chevron-forward" size={16} color={page >= (payload.total_pages || 1) ? colors.muted : colors.accent} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </AdminChrome>
  );
}

function renderTableContent(routeName, items, navigation, spec, isMobile) {
  if (routeName === 'AdminOfficers') {
    if (isMobile) {
      return (
        <View style={styles.mobileCardList}>
          {items.map((row) => (
            <View key={row.officer_id} style={styles.mobileCard}>
              <View style={styles.mobileCardHeader}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={styles.mobileKicker}>OFFICER ID</Text>
                  <Text style={styles.mobileCodeText} numberOfLines={1}>{row.officer_id}</Text>
                </View>
                <StatusBadge status={row.status} />
              </View>
              <View style={styles.mobileCardBody}>
                <Text style={styles.mobilePrimaryText}>{row.name}</Text>
                <Text style={styles.mobileSecondaryText}>{row.unit || 'Field Officer'}</Text>
                <View style={styles.mobileMetaGrid}>
                  <Text style={styles.mobileMetaText}>Scans: <Text style={styles.mobileValText}>{row.total_scans ?? 0}</Text></Text>
                  <Text style={styles.mobileMetaText}>Matches: <Text style={styles.mobileValText}>{row.matches ?? 0}</Text></Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.mobileActionRow}
                onPress={() => navigation.navigate('AdminOfficerDetail', { id: row.officer_id })}
              >
                <Text style={styles.actionLink}>View Profile →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View>
        <View style={styles.thRow}>
          <Text style={[styles.th, { flex: 1.5 }]}>OFFICER ID</Text>
          <Text style={[styles.th, { flex: 2 }]}>NAME & UNIT</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
          <Text style={[styles.th, { flex: 1 }]}>SCANS</Text>
          <Text style={[styles.th, { flex: 1 }]}>MATCHES</Text>
          <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>ACTION</Text>
        </View>
        {items.map((row) => (
          <View key={row.officer_id} style={styles.trRow}>
            <Text style={[styles.tdCode, { flex: 1.5 }]} numberOfLines={1}>{row.officer_id}</Text>
            <View style={{ flex: 2 }}>
              <Text style={styles.tdPrimaryText}>{row.name}</Text>
              <Text style={styles.tdSecondaryText}>{row.unit || 'Field Officer'}</Text>
            </View>
            <View style={{ flex: 1.2 }}>
              <StatusBadge status={row.status} />
            </View>
            <Text style={[styles.tdText, { flex: 1 }]}>{row.total_scans ?? 0}</Text>
            <Text style={[styles.tdText, { flex: 1 }]}>{row.matches ?? 0}</Text>
            <TouchableOpacity
              style={{ width: 70, alignItems: 'flex-end' }}
              onPress={() => navigation.navigate('AdminOfficerDetail', { id: row.officer_id })}
            >
              <Text style={styles.actionLink}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  if (routeName === 'AdminPersons') {
    if (isMobile) {
      return (
        <View style={styles.mobileCardList}>
          {items.map((row) => (
            <View key={row.person_id} style={styles.mobileCard}>
              <View style={styles.mobileCardHeader}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={styles.mobileKicker}>PERSON ID</Text>
                  <Text style={styles.mobileCodeText} numberOfLines={1}>{row.person_id}</Text>
                </View>
                <StatusBadge status={row.enrollment_status} />
              </View>
              <View style={styles.mobileCardBody}>
                <Text style={styles.mobileMetaText}>Ref Images: <Text style={styles.mobileValText}>{row.reference_image_count ?? 0} images</Text></Text>
                <Text style={styles.mobileMetaText}>Recognitions: <Text style={styles.mobileValText}>{row.recognition_count ?? 0} events</Text></Text>
                <Text style={styles.mobileMetaText}>Origin: <Text style={styles.mobileValText}>{row.data_origin || 'Operational'}</Text></Text>
              </View>
              <TouchableOpacity
                style={styles.mobileActionRow}
                onPress={() => navigation.navigate('AdminPersonDetail', { id: row.person_id })}
              >
                <Text style={styles.actionLink}>View Details →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View>
        <View style={styles.thRow}>
          <Text style={[styles.th, { flex: 1.5 }]}>PERSON ID</Text>
          <Text style={[styles.th, { flex: 1.8 }]}>STATUS</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>REF IMAGES</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>RECOGNITIONS</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>ORIGIN</Text>
          <Text style={[styles.th, { width: 70, textAlign: 'right' }]}>ACTION</Text>
        </View>
        {items.map((row) => (
          <View key={row.person_id} style={styles.trRow}>
            <Text style={[styles.tdCode, { flex: 1.5 }]} numberOfLines={1}>{row.person_id}</Text>
            <View style={{ flex: 1.8 }}>
              <StatusBadge status={row.enrollment_status} />
            </View>
            <Text style={[styles.tdText, { flex: 1.2 }]}>{row.reference_image_count ?? 0} images</Text>
            <Text style={[styles.tdText, { flex: 1.2 }]}>{row.recognition_count ?? 0} events</Text>
            <Text style={[styles.tdSecondaryText, { flex: 1.5 }]}>{row.data_origin || 'Operational'}</Text>
            <TouchableOpacity
              style={{ width: 70, alignItems: 'flex-end' }}
              onPress={() => navigation.navigate('AdminPersonDetail', { id: row.person_id })}
            >
              <Text style={styles.actionLink}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  if (routeName === 'AdminRecognition') {
    if (isMobile) {
      return (
        <View style={styles.mobileCardList}>
          {items.map((row) => (
            <View key={row.event_id} style={styles.mobileCard}>
              <View style={styles.mobileCardHeader}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={styles.mobileKicker}>EVENT</Text>
                  <Text style={styles.mobileCodeText} numberOfLines={1}>{row.event_id}</Text>
                </View>
                <StatusBadge status={row.result} />
              </View>
              <View style={styles.mobileCardBody}>
                <Text style={styles.mobileMetaText}>Time: <Text style={styles.mobileValText}>{formatDate(row.timestamp)}</Text></Text>
                <Text style={styles.mobileMetaText}>Officer: <Text style={styles.mobileValText} numberOfLines={1}>{row.officer || '—'}</Text></Text>
                <Text style={styles.mobileMetaText}>Person: <Text style={styles.mobileValText} numberOfLines={1}>{row.person || '—'}</Text></Text>
                <Text style={styles.mobileMetaText}>Confidence: <Text style={styles.mobileValText}>{typeof row.score === 'number' ? `${(row.score * (row.score <= 1 ? 100 : 1)).toFixed(1)}%` : '—'}</Text></Text>
              </View>
              <TouchableOpacity
                style={styles.mobileActionRow}
                onPress={() => navigation.navigate('AdminRecognitionDetail', { id: row.event_id })}
              >
                <Text style={styles.actionLink}>Details →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View>
        <View style={styles.thRow}>
          <Text style={[styles.th, { flex: 1.4 }]}>EVENT ID</Text>
          <Text style={[styles.th, { flex: 1.8 }]}>TIMESTAMP</Text>
          <Text style={[styles.th, { flex: 1.3 }]}>OFFICER</Text>
          <Text style={[styles.th, { flex: 1.3 }]}>PERSON</Text>
          <Text style={[styles.th, { flex: 1.1 }]}>CONFIDENCE</Text>
          <Text style={[styles.th, { flex: 1.4 }]}>RESULT</Text>
          <Text style={[styles.th, { width: 60, textAlign: 'right' }]}>ACTION</Text>
        </View>
        {items.map((row) => (
          <View key={row.event_id} style={styles.trRow}>
            <Text style={[styles.tdCode, { flex: 1.4 }]} numberOfLines={1}>{row.event_id}</Text>
            <Text style={[styles.tdSecondaryText, { flex: 1.8 }]}>{formatDate(row.timestamp)}</Text>
            <Text style={[styles.tdText, { flex: 1.3 }]} numberOfLines={1}>{row.officer || '—'}</Text>
            <Text style={[styles.tdText, { flex: 1.3 }]} numberOfLines={1}>{row.person || '—'}</Text>
            <Text style={[styles.tdPrimaryText, { flex: 1.1 }]}>
              {typeof row.score === 'number' ? `${(row.score * (row.score <= 1 ? 100 : 1)).toFixed(1)}%` : '—'}
            </Text>
            <View style={{ flex: 1.4 }}>
              <StatusBadge status={row.result} />
            </View>
            <TouchableOpacity
              style={{ width: 60, alignItems: 'flex-end' }}
              onPress={() => navigation.navigate('AdminRecognitionDetail', { id: row.event_id })}
            >
              <Text style={styles.actionLink}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  if (routeName === 'AdminEvidence') {
    if (isMobile) {
      return (
        <View style={styles.mobileCardList}>
          {items.map((row) => (
            <View key={row.evidence_id} style={styles.mobileCard}>
              <View style={styles.mobileCardHeader}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={styles.mobileKicker}>EVIDENCE ID</Text>
                  <Text style={styles.mobileCodeText} numberOfLines={1}>{row.evidence_id}</Text>
                </View>
                <StatusBadge status={row.integrity_status} />
              </View>
              <View style={styles.mobileCardBody}>
                <Text style={styles.mobileMetaText}>Type: <Text style={styles.mobileValText}>{row.type}</Text></Text>
                <Text style={styles.mobileMetaText}>Officer: <Text style={styles.mobileValText} numberOfLines={1}>{row.officer || '—'}</Text></Text>
                <Text style={styles.mobileMetaText}>SHA-256 Hash: <Text style={styles.tdHash} numberOfLines={1}>{row.sha256 ? `${row.sha256.slice(0, 16)}…` : '—'}</Text></Text>
              </View>
              <TouchableOpacity
                style={styles.mobileActionRow}
                onPress={() => navigation.navigate('AdminEvidenceDetail', { id: row.evidence_id })}
              >
                <Text style={styles.actionLink}>View Item →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View>
        <View style={styles.thRow}>
          <Text style={[styles.th, { flex: 1.5 }]}>EVIDENCE ID</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>TYPE</Text>
          <Text style={[styles.th, { flex: 1.4 }]}>OFFICER</Text>
          <Text style={[styles.th, { flex: 1.6 }]}>SHA-256 HASH</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>INTEGRITY</Text>
          <Text style={[styles.th, { width: 60, textAlign: 'right' }]}>ACTION</Text>
        </View>
        {items.map((row) => (
          <View key={row.evidence_id} style={styles.trRow}>
            <Text style={[styles.tdCode, { flex: 1.5 }]} numberOfLines={1}>{row.evidence_id}</Text>
            <Text style={[styles.tdPrimaryText, { flex: 1.2 }]}>{row.type}</Text>
            <Text style={[styles.tdText, { flex: 1.4 }]} numberOfLines={1}>{row.officer || '—'}</Text>
            <Text style={[styles.tdHash, { flex: 1.6 }]} numberOfLines={1}>
              {row.sha256 ? `${row.sha256.slice(0, 12)}…` : '—'}
            </Text>
            <View style={{ flex: 1.5 }}>
              <StatusBadge status={row.integrity_status} />
            </View>
            <TouchableOpacity
              style={{ width: 60, alignItems: 'flex-end' }}
              onPress={() => navigation.navigate('AdminEvidenceDetail', { id: row.evidence_id })}
            >
              <Text style={styles.actionLink}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  if (routeName === 'AdminInvestigations') {
    return (
      <View style={{ padding: 12, gap: 12 }}>
        {items.map((row) => (
          <TouchableOpacity
            key={row.case_id}
            style={styles.caseCard}
            onPress={() => navigation.navigate('AdminInvestigationDetail', { id: row.case_id })}
            activeOpacity={0.8}
          >
            <View style={styles.caseCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <Ionicons name="briefcase-outline" size={20} color={colors.accent} />
                <Text style={styles.caseId} numberOfLines={1}>{row.case_id}</Text>
              </View>
              <StatusBadge status={row.status || 'ACTIVE'} />
            </View>

            <Text style={styles.caseTitle}>{row.title}</Text>

            <View style={styles.caseMetaRow}>
              <Text style={styles.caseMetaItem}>Assigned: <Text style={styles.caseMetaValue}>{row.officer || 'Unassigned'}</Text></Text>
              <Text style={styles.caseMetaItem}>Subject: <Text style={styles.caseMetaValue}>{row.person || 'Unknown'}</Text></Text>
            </View>

            <View style={styles.caseCardFooter}>
              <Text style={styles.openCaseText}>Open Case Timeline →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (routeName === 'AdminAudit') {
    if (isMobile) {
      return (
        <View style={styles.mobileCardList}>
          {items.map((row, index) => (
            <View key={`${row.timestamp}-${index}`} style={styles.mobileCard}>
              <View style={styles.mobileCardHeader}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <Text style={styles.mobileKicker}>ADMIN ACTION</Text>
                  <Text style={styles.mobilePrimaryText} numberOfLines={1}>{row.action}</Text>
                </View>
                <StatusBadge status={row.result} />
              </View>
              <View style={styles.mobileCardBody}>
                <Text style={styles.mobileMetaText}>Time: <Text style={styles.mobileValText}>{formatDate(row.timestamp)}</Text></Text>
                <Text style={styles.mobileMetaText}>Admin User: <Text style={styles.mobileCodeText} numberOfLines={1}>{row.admin_user_id || 'SYSTEM'}</Text></Text>
                <Text style={styles.mobileMetaText}>Resource: <Text style={styles.mobileValText}>{row.resource_type || 'system'}</Text></Text>
              </View>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View>
        <View style={styles.thRow}>
          <Text style={[styles.th, { flex: 1.8 }]}>TIMESTAMP</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>ADMIN USER</Text>
          <Text style={[styles.th, { flex: 2 }]}>ACTION</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>RESOURCE</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>RESULT</Text>
        </View>
        {items.map((row, index) => (
          <View key={`${row.timestamp}-${index}`} style={styles.trRow}>
            <Text style={[styles.tdSecondaryText, { flex: 1.8 }]}>{formatDate(row.timestamp)}</Text>
            <Text style={[styles.tdCode, { flex: 1.5 }]} numberOfLines={1}>{row.admin_user_id || 'SYSTEM'}</Text>
            <Text style={[styles.tdPrimaryText, { flex: 2 }]}>{row.action}</Text>
            <Text style={[styles.tdSecondaryText, { flex: 1.5 }]}>{row.resource_type || 'system'}</Text>
            <View style={{ flex: 1.2 }}>
              <StatusBadge status={row.result} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  actionPrimaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  createCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 20,
    backgroundColor: colors.accentLight,
  },
  createCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 12,
  },
  createRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    minWidth: 180,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
  },
  createSubmitButton: {
    height: 42,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filterCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
    shadowColor: colors.cardShadow.shadowColor,
    shadowOpacity: colors.cardShadow.shadowOpacity,
    shadowRadius: colors.cardShadow.shadowRadius,
    shadowOffset: colors.cardShadow.shadowOffset,
    elevation: colors.cardShadow.elevation,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  searchButton: {
    height: 44,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
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
    marginVertical: 12,
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
    marginBottom: 24,
  },
  thRow: {
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
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tdCode: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  tdPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  tdSecondaryText: {
    fontSize: 12,
    color: colors.muted,
  },
  tdText: {
    fontSize: 13,
    color: colors.text,
  },
  tdHash: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: 'monospace',
  },
  actionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 10,
  },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  pageBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  pageBtnTextDisabled: {
    color: colors.muted,
  },
  pagerMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  pagerMetaBold: {
    fontWeight: '700',
    color: colors.text,
  },
  caseCard: {
    backgroundColor: '#FFFFFF',
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
  caseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseId: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  caseMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  caseMetaItem: {
    fontSize: 12,
    color: colors.muted,
  },
  caseMetaValue: {
    fontWeight: '700',
    color: colors.text,
  },
  caseCardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  openCaseText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  mobileCardList: {
    padding: 12,
    gap: 10,
  },
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
  mobilePrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  mobileSecondaryText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  mobileMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
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
    marginTop: 8,
    paddingTop: 6,
  },
});
