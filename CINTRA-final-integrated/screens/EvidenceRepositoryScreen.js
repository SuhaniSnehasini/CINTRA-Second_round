import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getEvidenceRepository } from '../services/api';
import { getSelectedCase } from '../services/caseService';

export default function EvidenceRepositoryScreen({ navigation, route }) {
  const activeCase = route?.params?.case || getSelectedCase();
  const caseId = route?.params?.caseId || activeCase?.case_id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setLoading(true); setError(''); const payload = await getEvidenceRepository(caseId); setItems(payload.evidence || []); }
    catch (err) { setError(err.message || 'Unable to load evidence.'); }
    finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { load(); }, [load]);
  return <SafeAreaView style={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#1976D2" /></TouchableOpacity><Text style={styles.title}>EVIDENCE REPOSITORY</Text><View style={styles.back} /></View>
    <View style={styles.caseBanner}><Ionicons name="briefcase" size={18} color="#1976D2" /><Text style={styles.caseText}>CASE: {caseId || 'All cases'}</Text></View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#1976D2" /><Text>Loading evidence…</Text></View> : error ? <View style={styles.center}><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : <FlatList data={items} keyExtractor={(item) => item.evidence_id} contentContainerStyle={items.length ? styles.list : styles.center} ListEmptyComponent={<Text>No evidence has been registered for this case.</Text>} renderItem={({ item }) => <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('EvidenceDetails', { evidence: item })}><View style={styles.icon}><Ionicons name="document-lock" size={24} color="#1976D2" /></View><View style={styles.itemBody}><Text style={styles.name} numberOfLines={1}>{item.original_filename || item.filename}</Text><Text style={styles.meta}>{item.evidence_type || 'Evidence'} · {item.case_id || 'No case'}</Text><Text style={styles.meta}>SHA-256 · {item.status || 'IN_CUSTODY'}</Text></View><Ionicons name="chevron-forward" size={22} color="#1976D2" /></TouchableOpacity>} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', paddingHorizontal: 20 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#E3F2FD' }, title: { fontSize: 17, fontWeight: '800', color: '#1976D2' }, caseBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', padding: 12, borderRadius: 10, marginBottom: 12 }, caseText: { marginLeft: 8, color: '#164E8C', fontWeight: '700' }, list: { paddingBottom: 28 }, center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }, item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 }, icon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F2FD', borderRadius: 10, marginRight: 12 }, itemBody: { flex: 1 }, name: { fontWeight: '700', color: '#1F2937', fontSize: 15 }, meta: { color: '#667085', fontSize: 12, marginTop: 3 }, error: { color: '#B42318', textAlign: 'center' }, retry: { backgroundColor: '#1976D2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }, retryText: { color: '#FFF', fontWeight: '700' },
});
