import React from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function EvidenceDetailsScreen({
  navigation,
  route,
}) {
  const evidence = route?.params?.evidence;

  if (!evidence) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#1976D2"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            EVIDENCE DETAILS
          </Text>

          <View style={{ width: 42 }} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={55}
            color="#1976D2"
          />

          <Text style={styles.emptyTitle}>
            Evidence information unavailable
          </Text>

          <Text style={styles.emptyText}>
            No evidence record was provided to this screen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const evidenceId =
    evidence.evidence_id ||
    evidence.evidenceId ||
    'Unavailable';

  const caseId =
    evidence.case_id ||
    evidence.caseId ||
    'Not assigned';

  const filename =
    evidence.original_filename ||
    evidence.originalFilename ||
    evidence.filename ||
    'Unknown';

  const evidenceType =
    evidence.evidence_type ||
    evidence.evidenceType ||
    evidence.type ||
    'Evidence';

  const mimeType =
    evidence.mime_type ||
    evidence.mimeType ||
    'Unknown';

  const sizeBytes =
    evidence.size_bytes ??
    evidence.sizeBytes ??
    0;

  const sha256 =
    evidence.sha256 ||
    'Unavailable';

  const originalBadge =
    evidence.original_badge_id ||
    evidence.originalBadgeId ||
    evidence.badge_id ||
    evidence.badgeId ||
    'Unknown';

  const currentCustodian =
    evidence.current_custodian ||
    evidence.currentCustodian ||
    originalBadge;

  const status =
    evidence.status ||
    'IN_CUSTODY';

  const registeredAt =
    evidence.registered_at ||
    evidence.registeredAt ||
    evidence.created_at ||
    evidence.createdAt ||
    null;

  const blockchainStatus =
    evidence.blockchain_status ||
    evidence.blockchainStatus ||
    'RECORDED';

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) {
      return '0 KB';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) {
      return 'Unavailable';
    }

    try {
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return timestamp;
    }
  };

  const shortHash = (hash) => {
    if (!hash || hash.length < 20) {
      return hash;
    }

    return `${hash.substring(0, 20)}...`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#1976D2"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          EVIDENCE DETAILS
        </Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusIcon}>
            <Ionicons
              name="shield-checkmark"
              size={28}
              color="#2E7D32"
            />
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              EVIDENCE REGISTERED
            </Text>

            <Text style={styles.statusSubtitle}>
              Evidence record is stored and tracked by CINTRA.
            </Text>
          </View>
        </View>

        {/* Evidence ID */}
        <View style={styles.idCard}>
          <Text style={styles.idLabel}>
            EVIDENCE ID
          </Text>

          <Text style={styles.idValue} selectable>
            {evidenceId}
          </Text>
        </View>

        {/* Evidence Information */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="document-text"
              size={21}
              color="#1976D2"
            />

            <Text style={styles.cardTitle}>
              EVIDENCE INFORMATION
            </Text>
          </View>

          <InfoRow
            label="Case ID"
            value={caseId}
          />

          <InfoRow
            label="Filename"
            value={filename}
          />

          <InfoRow
            label="Evidence Type"
            value={evidenceType}
          />

          <InfoRow
            label="MIME Type"
            value={mimeType}
          />

          <InfoRow
            label="File Size"
            value={formatSize(sizeBytes)}
          />

          <InfoRow
            label="Registered"
            value={formatTimestamp(registeredAt)}
          />
        </View>

        {/* Custody Information */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="people"
              size={21}
              color="#1976D2"
            />

            <Text style={styles.cardTitle}>
              CUSTODY STATUS
            </Text>
          </View>

          <InfoRow
            label="Original Custodian"
            value={originalBadge}
          />

          <InfoRow
            label="Current Custodian"
            value={currentCustodian}
          />

          <InfoRow
            label="Evidence Status"
            value={status}
          />

          <InfoRow
            label="Blockchain"
            value={blockchainStatus}
          />
        </View>

        {/* SHA-256 */}
        <View style={styles.hashCard}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="finger-print"
              size={21}
              color="#1976D2"
            />

            <Text style={styles.cardTitle}>
              SHA-256 INTEGRITY
            </Text>
          </View>

          <Text style={styles.hashLabel}>
            ORIGINAL FILE HASH
          </Text>

          <Text
            style={styles.hashValue}
            selectable
          >
            {sha256}
          </Text>

          <Text style={styles.hashDescription}>
            This cryptographic hash uniquely represents
            the uploaded evidence file.
          </Text>
        </View>

        {/* Chain of Custody Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate(
              'EvidenceCustody',
              {
                evidenceId,
                evidence,
              }
            )
          }
        >
          <Ionicons
            name="git-branch"
            size={22}
            color="#FFFFFF"
          />

          <Text style={styles.primaryButtonText}>
            VIEW CHAIN OF CUSTODY
          </Text>
        </TouchableOpacity>

        {/* Integrity Button */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate(
              'EvidenceVerify',
              {
                evidenceId,
                evidence,
              }
            )
          }
        >
          <Ionicons
            name="shield-checkmark"
            size={22}
            color="#1976D2"
          />

          <Text style={styles.secondaryButtonText}>
            VERIFY INTEGRITY
          </Text>
        </TouchableOpacity>

        <View style={styles.footerNote}>
          <Ionicons
            name="lock-closed"
            size={15}
            color="#777"
          />

          <Text style={styles.footerText}>
            Evidence custody events are recorded locally
            and anchored to the Hyperledger Fabric ledger.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text
        style={styles.infoValue}
        selectable
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
    paddingHorizontal: 22,
    paddingTop: 15,
    marginBottom: 15,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.8,
  },

  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 35,
  },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },

  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },

  statusSubtitle: {
    fontSize: 11,
    color: '#4E6B50',
    marginTop: 3,
    lineHeight: 16,
  },

  idCard: {
    backgroundColor: '#1976D2',
    borderRadius: 14,
    padding: 18,
    marginBottom: 15,
  },

  idLabel: {
    color: '#BBDEFB',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },

  idValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 17,
    marginBottom: 15,
    elevation: 2,
  },

  hashCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 17,
    marginBottom: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 7,
    letterSpacing: 0.5,
  },

  infoRow: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  infoLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 13,
    color: '#222',
    lineHeight: 18,
  },

  hashLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: 'bold',
    marginBottom: 6,
  },

  hashValue: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 17,
  },

  hashDescription: {
    fontSize: 11,
    color: '#777',
    marginTop: 10,
    lineHeight: 16,
  },

  primaryButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 9,
    letterSpacing: 0.4,
  },

  secondaryButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  secondaryButtonText: {
    color: '#1976D2',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 9,
    letterSpacing: 0.4,
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  footerText: {
    flex: 1,
    fontSize: 10,
    color: '#777',
    lineHeight: 15,
    marginLeft: 6,
    textAlign: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 13,
    color: '#777',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
});