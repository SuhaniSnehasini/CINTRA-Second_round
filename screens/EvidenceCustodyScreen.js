import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getEvidenceCustody } from '../services/api';

export default function EvidenceCustodyScreen({ navigation, route }) {
  const evidence = route?.params?.evidence || {};

  const evidenceId =
    evidence.evidence_id ||
    evidence.evidenceId ||
    evidence.id;

  const [custodyData, setCustodyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCustody();
  }, [evidenceId]);

  const loadCustody = async () => {
    if (!evidenceId) {
      setError('Evidence ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getEvidenceCustody(evidenceId);

      console.log(
        '[CINTRA] Custody response:',
        JSON.stringify(data, null, 2)
      );

      setCustodyData(data);
    } catch (err) {
      console.error('[CINTRA] Custody error:', err);

      setError(
        err?.message || 'Unable to load custody history.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getEvents = () => {
    if (!custodyData) {
      return [];
    }

    if (Array.isArray(custodyData)) {
      return custodyData;
    }

    if (Array.isArray(custodyData.events)) {
      return custodyData.events;
    }

    if (Array.isArray(custodyData.custody_events)) {
      return custodyData.custody_events;
    }

    if (Array.isArray(custodyData.history)) {
      return custodyData.history;
    }

    return [];
  };

  const events = getEvents();

  const getEvidenceStatus = () => {
    return (
      custodyData?.status ||
      custodyData?.evidence_status ||
      evidence?.status ||
      'UNKNOWN'
    );
  };

  const getCurrentCustodian = () => {
    return (
      custodyData?.current_custodian ||
      custodyData?.currentCustodian ||
      evidence?.current_custodian ||
      evidence?.currentCustodian ||
      'Unknown'
    );
  };

  const formatDate = (value) => {
    if (!value) {
      return 'Timestamp unavailable';
    }

    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return String(value);
    }
  };

  const getAction = (event) => {
    return (
      event?.action ||
      event?.event_type ||
      event?.eventType ||
      event?.type ||
      'UNKNOWN'
    );
  };

  const getActor = (event) => {
    return (
      event?.actor_badge_id ||
      event?.actorBadgeId ||
      event?.badge_id ||
      event?.badgeId ||
      event?.actor ||
      'Unknown'
    );
  };

  const getFromBadge = (event) => {
    return (
      event?.from_badge_id ||
      event?.fromBadgeId ||
      event?.from_badge ||
      event?.fromBadge ||
      null
    );
  };

  const getToBadge = (event) => {
    return (
      event?.to_badge_id ||
      event?.toBadgeId ||
      event?.to_badge ||
      event?.toBadge ||
      null
    );
  };

  const getReason = (event) => {
    return (
      event?.reason ||
      event?.transfer_reason ||
      event?.access_reason ||
      null
    );
  };

  const getTimestamp = (event) => {
    return (
      event?.timestamp ||
      event?.created_at ||
      event?.createdAt ||
      event?.event_timestamp ||
      null
    );
  };

  const getBlockchainStatus = (event) => {
    return (
      event?.blockchain_status ||
      event?.blockchainStatus ||
      event?.fabric_status ||
      event?.fabricStatus ||
      'UNKNOWN'
    );
  };

  const getTransactionId = (event) => {
    return (
      event?.blockchain_tx_id ||
      event?.blockchainTxId ||
      event?.transaction_id ||
      event?.transactionId ||
      event?.tx_id ||
      event?.txId ||
      null
    );
  };

  const renderEvent = (event, index) => {
    const action = getAction(event);
    const actor = getActor(event);
    const fromBadge = getFromBadge(event);
    const toBadge = getToBadge(event);
    const reason = getReason(event);
    const timestamp = getTimestamp(event);
    const blockchainStatus = getBlockchainStatus(event);
    const transactionId = getTransactionId(event);

    return (
      <View
        key={`${action}-${index}`}
        style={styles.eventCard}
      >
        <View style={styles.eventHeader}>
          <View style={styles.eventNumber}>
            <Text style={styles.eventNumberText}>
              {index + 1}
            </Text>
          </View>

          <View style={styles.eventHeaderText}>
            <Text style={styles.eventAction}>
              {String(action).toUpperCase()}
            </Text>

            <Text style={styles.eventTimestamp}>
              {formatDate(timestamp)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <InfoRow
          label="Actor"
          value={actor}
        />

        {fromBadge && (
          <InfoRow
            label="From"
            value={fromBadge}
          />
        )}

        {toBadge && (
          <InfoRow
            label="To"
            value={toBadge}
          />
        )}

        {reason && (
          <InfoRow
            label="Reason"
            value={reason}
          />
        )}

        <View style={styles.blockchainBox}>
          <Text style={styles.blockchainTitle}>
            BLOCKCHAIN RECORD
          </Text>

          <InfoRow
            label="Status"
            value={blockchainStatus}
          />

          {transactionId && (
            <InfoRow
              label="Transaction"
              value={transactionId}
              mono
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>
            Chain of Custody
          </Text>

          <Text style={styles.headerSubtitle}>
            Evidence movement history
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />

          <Text style={styles.loadingText}>
            Loading custody history...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            Unable to Load History
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadCustody}
          >
            <Text style={styles.retryText}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.sectionLabel}>
              EVIDENCE ID
            </Text>

            <Text style={styles.evidenceId}>
              {evidenceId || 'Unknown'}
            </Text>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>
                  STATUS
                </Text>

                <Text style={styles.summaryValue}>
                  {getEvidenceStatus()}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>
                  CUSTODIAN
                </Text>

                <Text style={styles.summaryValue}>
                  {getCurrentCustodian()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineHeader}>
            <Text style={styles.sectionTitle}>
              Custody Events
            </Text>

            <Text style={styles.eventCount}>
              {events.length} event
              {events.length === 1 ? '' : 's'}
            </Text>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No Custody Events
              </Text>

              <Text style={styles.emptyText}>
                No custody history was returned for this
                evidence item.
              </Text>
            </View>
          ) : (
            events.map(renderEvent)
          )}

          <View style={styles.footerCard}>
            <Text style={styles.footerIcon}>
              ✓
            </Text>

            <View style={styles.footerTextContainer}>
              <Text style={styles.footerTitle}>
                Tamper-Evident Audit Trail
              </Text>

              <Text style={styles.footerText}>
                Custody events are recorded by CINTRA and
                anchored to the Hyperledger Fabric ledger.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text
        style={[
          styles.infoValue,
          mono && styles.monoValue,
        ]}
      >
        {String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  header: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: '#0B1F3A',
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    marginTop: -4,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
  },

  headerSubtitle: {
    color: '#B8C7DA',
    fontSize: 13,
    marginTop: 3,
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#DDE5EF',
  },

  sectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  evidenceId: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: '#E5EAF0',
    marginVertical: 15,
  },

  summaryRow: {
    flexDirection: 'row',
  },

  summaryItem: {
    flex: 1,
  },

  summaryLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 5,
  },

  summaryValue: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },

  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },

  eventCount: {
    color: '#64748B',
    fontSize: 12,
  },

  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDE5EF',
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  eventNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  eventNumberText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },

  eventHeaderText: {
    flex: 1,
  },

  eventAction: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },

  eventTimestamp: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#E8EDF3',
    marginVertical: 14,
  },

  infoRow: {
    marginBottom: 9,
  },

  infoLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },

  infoValue: {
    color: '#1E293B',
    fontSize: 13,
    lineHeight: 18,
  },

  monoValue: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
  },

  blockchainBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },

  blockchainTitle: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE5EF',
  },

  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },

  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 19,
  },

  footerCard: {
    marginTop: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 15,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  footerIcon: {
    color: '#15803D',
    fontSize: 20,
    fontWeight: '800',
    marginRight: 11,
  },

  footerTextContainer: {
    flex: 1,
  },

  footerTitle: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },

  footerText: {
    color: '#166534',
    fontSize: 11,
    lineHeight: 16,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 13,
  },

  errorTitle: {
    color: '#991B1B',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  errorText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  retryButton: {
    marginTop: 18,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 9,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});