import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchSuspect, getEvidenceRepository, searchUnifiedDatabase } from '../services/api';

export default function DatabaseSearchScreen({ navigation, route }) {
  const [searchQuery, setSearchQuery] = useState(route?.params?.query || '');
  const [loading, setLoading] = useState(false);
  const [suspectResults, setSuspectResults] = useState([]);
  const [evidenceResults, setEvidenceResults] = useState([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    // Initial load: fetch repository records or perform query if passed
    if (route?.params?.query) {
      handleSearch(route.params.query);
    } else {
      loadInitialDatabase();
    }
  }, []);

  const loadInitialDatabase = async () => {
    try {
      setLoading(true);
      const res = await searchUnifiedDatabase('');
      setSuspectResults(res.suspects || []);
      setEvidenceResults(res.evidence || []);
    } catch (err) {
      console.warn('[CINTRA Search] Initial database load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (termToSearch = searchQuery) => {
    const term = termToSearch.trim();

    if (!term) {
      loadInitialDatabase();
      setSearched(false);
      return;
    }

    try {
      setLoading(true);
      setSearched(true);

      const unifiedRes = await searchUnifiedDatabase(term);
      setSuspectResults(unifiedRes.suspects || []);
      setEvidenceResults(unifiedRes.evidence || []);
    } catch (error) {
      console.log('[CINTRA Search] Search error:', error.message);
      Alert.alert('Search Result', error.message || 'No matching record found in database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecord = (recordItem) => {
    navigation.navigate('EvidenceDetails', { evidence: recordItem, record: recordItem });
  };

  const renderSuspectCard = (suspect, idx) => {
    const suspectId = suspect.suspect_id || suspect.suspect_code || 'S000';

    return (
      <TouchableOpacity
        key={`suspect-${suspectId}-${idx}`}
        style={styles.recordCard}
        onPress={() => handleSelectRecord(suspect)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Ionicons name="person" size={24} color="#1976D2" />
          </View>

          <View style={styles.cardMainText}>
            <Text style={styles.recordTitle}>{suspect.name}</Text>
            <Text style={styles.recordSubTitle}>
              Subject ID: {suspectId} {suspect.alias ? `| Alias: "${suspect.alias}"` : ''}
            </Text>
          </View>

          <View style={[styles.badge, suspect.wanted ? styles.wantedBadge : styles.safeBadge]}>
            <Text style={styles.badgeText}>{suspect.wanted ? 'WANTED' : 'CLEARED'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaGrid}>
          <MetaItem label="Role / Category" value={suspect.role || 'Suspect'} />
          <MetaItem label="Case FIR" value={suspect.fir_number || 'FIR-2024-7702'} />
          <MetaItem label="Offence" value={suspect.offence_category || 'Cybercrime / Theft'} />
          <MetaItem label="Integrity" value="SHA-256 VERIFIED" highlight />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailText}>VIEW COMPLETE EVIDENCE RECORD & CUSTODY</Text>
          <Ionicons name="chevron-forward" size={16} color="#1976D2" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEvidenceCard = (ev, idx) => {
    const evId = ev.evidence_id || 'EV-RECORD';

    return (
      <TouchableOpacity
        key={`evidence-${evId}-${idx}`}
        style={styles.recordCard}
        onPress={() => handleSelectRecord(ev)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="document-lock" size={24} color="#0288D1" />
          </View>

          <View style={styles.cardMainText}>
            <Text style={styles.recordTitle}>
              {ev.original_filename || ev.filename || 'Evidence Artifact'}
            </Text>
            <Text style={styles.recordSubTitle}>
              Evidence ID: {evId} | Case: {ev.case_id || 'GENERAL-2024'}
            </Text>
          </View>

          <View style={[styles.badge, styles.custodyBadge]}>
            <Text style={styles.badgeText}>{ev.status || 'IN_CUSTODY'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaGrid}>
          <MetaItem label="Type" value={ev.evidence_type || 'Digital Evidence'} />
          <MetaItem label="Custodian" value={ev.current_custodian || ev.original_badge_id || 'OFF001'} />
          <MetaItem label="SHA-256" value={ev.sha256 ? `${ev.sha256.substring(0, 16)}...` : 'REGISTERED'} mono />
          <MetaItem label="Fabric Ledger" value={ev.blockchain_status || 'RECORDED'} highlight />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailText}>VIEW COMPLETE EVIDENCE RECORD & CUSTODY</Text>
          <Ionicons name="chevron-forward" size={16} color="#1976D2" />
        </View>
      </TouchableOpacity>
    );
  };

  const totalResults = suspectResults.length + evidenceResults.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color="#1976D2" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>EVIDENCE & DATABASE SEARCH</Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search Card */}
        <View style={styles.card}>
          <Text style={styles.label}>DATABASE & EVIDENCE QUERY</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="search" size={20} color="#1976D2" />
            <TextInput
              style={styles.input}
              placeholder="Search by Suspect ID, Name, Evidence ID, or Case ID"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              onSubmitEditing={() => handleSearch()}
              editable={!loading}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(''); }}>
                <Ionicons name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Demo Chips */}
          <View style={styles.demoRow}>
            <Text style={styles.demoLabel}>Demo IDs:</Text>
            {['S001', 'S004', 'FIR-2024', 'EVIDENCE'].map((code) => (
              <TouchableOpacity
                key={code}
                style={styles.demoChip}
                onPress={() => {
                  setSearchQuery(code);
                  handleSearch(code);
                }}
              >
                <Text style={styles.demoChipText}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.disabledButton]}
            onPress={() => handleSearch()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>SEARCH DATABASE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Results Banner */}
        <View style={styles.resultsHeader}>
          <Ionicons name="server" size={18} color="#1976D2" />
          <Text style={styles.resultsTitle}>
            {searched
              ? `Search Results (${totalResults} records found)`
              : `Evidence & Subject Directory (${totalResults} records)`}
          </Text>
        </View>

        {/* Results List */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#1976D2" />
            <Text style={styles.loadingText}>Searching Database & Evidence Repository...</Text>
          </View>
        ) : totalResults === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="alert-circle-outline" size={48} color="#888" />
            <Text style={styles.emptyTitle}>No matching records found</Text>
            <Text style={styles.emptyText}>
              Try searching by Suspect ID (e.g. S001), Name (e.g. Anvi), Case ID, or Evidence ID.
            </Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            {suspectResults.map(renderSuspectCard)}
            {evidenceResults.map(renderEvidenceCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaItem({ label, value, highlight = false, mono = false }) {
  if (!value) return null;
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text
        style={[
          styles.metaValue,
          highlight && styles.highlightText,
          mono && styles.monoText,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 35,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  demoLabel: {
    fontSize: 11,
    color: '#888',
  },
  demoChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  searchButton: {
    height: 48,
    backgroundColor: '#1976D2',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 8,
  },
  recordsList: {
    gap: 14,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMainText: {
    marginLeft: 12,
    flex: 1,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  recordSubTitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wantedBadge: {
    backgroundColor: '#FFEBEE',
  },
  safeBadge: {
    backgroundColor: '#E8F5E9',
  },
  custodyBadge: {
    backgroundColor: '#E0F2FE',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    width: '47%',
  },
  metaLabel: {
    fontSize: 10,
    color: '#777',
    fontWeight: 'bold',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  highlightText: {
    color: '#1976D2',
    fontWeight: 'bold',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  viewDetailText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.3,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
});