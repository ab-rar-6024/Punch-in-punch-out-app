// screens/AdminScreen.js
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAdminAttendance, getHistory } from '../api';

export default function AdminScreen({ navigation, route }) {

  const fromLogin = !!route?.params?.user;
  const adminUser = route?.params?.user || null;

  const [adminVerified, setAdminVerified] = useState(fromLogin);
  const [records, setRecords]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');

  // ── Detail modal state ──
  const [modalVisible, setModalVisible]   = useState(false);
  const [selectedUser, setSelectedUser]   = useState(null);
  const [userHistory, setUserHistory]     = useState({ attendance: [], leaves: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab]       = useState('attendance'); // 'attendance' | 'leaves'

  useEffect(() => {
    if (adminVerified && adminUser?.id) fetchAttendance();
  }, []);

  /* ── Logout ── */
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => navigation.replace('Login') },
    ]);
  };

  /* ── Fetch today's attendance list ── */
  const fetchAttendance = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await getAdminAttendance(adminUser?.id);
      if (result.success) {
        const list = result.records || result.attendance || result.data || [];
        setRecords(Array.isArray(list) ? list : []);
        if (list.length === 0) setErrorMsg('No attendance records for today.');
      } else {
        setErrorMsg(result.msg || 'Failed to load attendance.');
        Alert.alert('Error', result.msg || 'Failed to load attendance.', [
          { text: 'Retry', onPress: fetchAttendance }, { text: 'OK' },
        ]);
      }
    } catch (err) {
      const msg = err?.message || 'Network error';
      setErrorMsg(msg);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchAttendance(); };

  /* ── Open employee detail modal ── */
  const openUserDetail = async (item) => {
    setSelectedUser(item);
    setModalVisible(true);
    setHistoryTab('attendance');
    setHistoryLoading(true);
    setUserHistory({ attendance: [], leaves: [] });
    try {
      const hist = await getHistory(item.id);
      setUserHistory({
        attendance: hist.attendance || [],
        leaves:     hist.leaves     || [],
      });
    } catch (err) {
      Alert.alert('Error', 'Could not load employee history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedUser(null);
    setUserHistory({ attendance: [], leaves: [] });
  };

  /* ── Helpers ── */
  const fmtDate = (val) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch { return val; }
  };

  const presentDays = userHistory.attendance.filter(r => !r.absent && r.time_in).length;
  const absentDays  = userHistory.attendance.filter(r => r.absent).length;
  const totalDays   = userHistory.attendance.length;

  /* ─────────────────────────────────────────
     NOT VERIFIED SCREEN
  ───────────────────────────────────────── */
  if (!adminVerified) {
    return (
      <View style={styles.center}>
        <View style={styles.pinCard}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="shield-lock-outline" size={36} color="#2563EB" />
          </View>
          <Text style={styles.pinHeading}>Admin Panel</Text>
          <Text style={styles.pinSub}>Login from the main screen to access admin</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.replace('Login')}>
            <Text style={styles.btnText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ─────────────────────────────────────────
     MAIN ATTENDANCE SCREEN
  ───────────────────────────────────────── */
  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Today's Attendance</Text>
          <Text style={styles.subheading}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
          {adminUser?.name && <Text style={styles.adminName}>👤 {adminUser.name}</Text>}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{records.length} staff</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error bar */}
      {errorMsg ? (
        <View style={styles.errorBar}>
          <MaterialCommunityIcons name="alert-circle-outline" size={15} color="#F59E0B" />
          <Text style={styles.errorBarText} numberOfLines={2}>{errorMsg}</Text>
          <TouchableOpacity onPress={fetchAttendance}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Loading */}
      {loading && !refreshing && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading attendance...</Text>
        </View>
      )}

      {/* Attendance List */}
      <FlatList
        data={records}
        keyExtractor={(item, index) => String(item.id || index)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={['#2563EB']} tintColor="#2563EB" />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No attendance records for today</Text>
              <TouchableOpacity style={styles.retryBigBtn} onPress={fetchAttendance}>
                <Text style={styles.retryBigText}>Tap to Retry</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          // ✅ Tap card → open detail modal
          <TouchableOpacity style={styles.card} onPress={() => openUserDetail(item)} activeOpacity={0.75}>

            {/* Name + Status */}
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.name}>{item.name || 'Unknown'}</Text>
                <Text style={styles.empCode}>{item.emp_code || '—'}</Text>
              </View>
              {(item.absent === true || item.absent === 'Yes' || item.absent === 1) ? (
                <View style={styles.badgeAbsent}><Text style={styles.badgeAbsentText}>Absent</Text></View>
              ) : item.time_in ? (
                <View style={styles.badgePresent}><Text style={styles.badgePresentText}>Present</Text></View>
              ) : (
                <View style={styles.badgePending}><Text style={styles.badgePendingText}>Not In</Text></View>
              )}
            </View>

            {/* Time In / Out */}
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <MaterialCommunityIcons name="login-variant" size={14} color="#059669" />
                <Text style={styles.timeLabel}>In</Text>
                <Text style={styles.timeValue}>{item.time_in || '—'}</Text>
              </View>
              <View style={styles.timeSep} />
              <View style={styles.timeBox}>
                <MaterialCommunityIcons name="logout-variant" size={14} color="#DC2626" />
                <Text style={styles.timeLabel}>Out</Text>
                <Text style={styles.timeValue}>{item.time_out || '—'}</Text>
              </View>
            </View>

            {/* Location */}
            {item.location_in && item.location_in !== '—' && (
              <View style={styles.locationRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={13} color="#60A5FA" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.location_in.split('|')[0] || item.location_in}
                </Text>
              </View>
            )}

            {/* Absent reason */}
            {(item.absent === true || item.absent === 'Yes' || item.absent === 1) && item.reason ? (
              <View style={styles.reasonRow}>
                <MaterialCommunityIcons name="information-outline" size={13} color="#F59E0B" />
                <Text style={styles.reasonText}>{item.reason}</Text>
              </View>
            ) : null}

            {/* Tap hint */}
            <View style={styles.tapHint}>
              <Text style={styles.tapHintText}>Tap to view full history</Text>
              <MaterialCommunityIcons name="chevron-right" size={14} color="#3d4f6e" />
            </View>

          </TouchableOpacity>
        )}
      />

      {/* ═══════════════════════════════════════
          EMPLOYEE DETAIL MODAL
      ═══════════════════════════════════════ */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />

          <View style={styles.modalSheet}>

            {/* Modal handle */}
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            {selectedUser && (
              <View style={styles.modalHeader}>
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>
                    {(selectedUser.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalName}>{selectedUser.name}</Text>
                  <Text style={styles.modalEmpCode}>{selectedUser.emp_code || '—'}</Text>
                  {selectedUser.pin && (
                    <Text style={styles.modalPin}>PIN: {selectedUser.pin}</Text>
                  )}
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
                  <MaterialCommunityIcons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{totalDays}</Text>
                <Text style={styles.statLbl}>Total</Text>
              </View>
              <View style={[styles.statBox, { borderColor: 'rgba(5,150,105,0.2)' }]}>
                <Text style={[styles.statNum, { color: '#10B981' }]}>{presentDays}</Text>
                <Text style={styles.statLbl}>Present</Text>
              </View>
              <View style={[styles.statBox, { borderColor: 'rgba(239,68,68,0.2)' }]}>
                <Text style={[styles.statNum, { color: '#EF4444' }]}>{absentDays}</Text>
                <Text style={styles.statLbl}>Absent</Text>
              </View>
              <View style={[styles.statBox, { borderColor: 'rgba(201,168,76,0.2)' }]}>
                <Text style={[styles.statNum, { color: '#F59E0B' }]}>{userHistory.leaves.length}</Text>
                <Text style={styles.statLbl}>Leaves</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, historyTab === 'attendance' && styles.tabActive]}
                onPress={() => setHistoryTab('attendance')}
              >
                <MaterialCommunityIcons name="calendar-clock" size={14}
                  color={historyTab === 'attendance' ? '#2563EB' : '#64748B'} />
                <Text style={[styles.tabText, historyTab === 'attendance' && styles.tabTextActive]}>
                  Attendance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, historyTab === 'leaves' && styles.tabActive]}
                onPress={() => setHistoryTab('leaves')}
              >
                <MaterialCommunityIcons name="umbrella-beach-outline" size={14}
                  color={historyTab === 'leaves' ? '#2563EB' : '#64748B'} />
                <Text style={[styles.tabText, historyTab === 'leaves' && styles.tabTextActive]}>
                  Leave Requests
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {historyLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#2563EB" />
                <Text style={styles.modalLoadingText}>Loading history...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>

                {/* ── ATTENDANCE TAB ── */}
                {historyTab === 'attendance' && (
                  userHistory.attendance.length === 0 ? (
                    <View style={styles.emptyTab}>
                      <MaterialCommunityIcons name="calendar-blank-outline" size={36} color="#64748B" />
                      <Text style={styles.emptyTabText}>No attendance records found</Text>
                    </View>
                  ) : (
                    userHistory.attendance.map((rec, idx) => (
                      <View key={idx} style={styles.histCard}>
                        {/* Date + status */}
                        <View style={styles.histTop}>
                          <View style={styles.histDateBox}>
                            <MaterialCommunityIcons name="calendar" size={13} color="#94A3B8" />
                            <Text style={styles.histDate}>{fmtDate(rec.date)}</Text>
                          </View>
                          {rec.absent ? (
                            <View style={styles.badgeAbsent}>
                              <Text style={styles.badgeAbsentText}>Absent</Text>
                            </View>
                          ) : rec.time_in ? (
                            <View style={styles.badgePresent}>
                              <Text style={styles.badgePresentText}>Present</Text>
                            </View>
                          ) : (
                            <View style={styles.badgePending}>
                              <Text style={styles.badgePendingText}>—</Text>
                            </View>
                          )}
                        </View>

                        {/* Punch times */}
                        <View style={styles.histTimeRow}>
                          <View style={styles.histTimeBox}>
                            <MaterialCommunityIcons name="login-variant" size={13} color="#059669" />
                            <Text style={styles.histTimeLabel}>In</Text>
                            <Text style={styles.histTimeValue}>{rec.time_in || '—'}</Text>
                          </View>
                          <View style={styles.timeSep} />
                          <View style={styles.histTimeBox}>
                            <MaterialCommunityIcons name="logout-variant" size={13} color="#DC2626" />
                            <Text style={styles.histTimeLabel}>Out</Text>
                            <Text style={styles.histTimeValue}>{rec.time_out || '—'}</Text>
                          </View>
                        </View>

                        {/* Location */}
                        {rec.location_in && rec.location_in !== '—' && (
                          <View style={styles.histLocRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={12} color="#60A5FA" />
                            <Text style={styles.histLocText} numberOfLines={1}>
                              {rec.location_in.split('|')[0] || rec.location_in}
                            </Text>
                          </View>
                        )}

                        {/* Absent reason */}
                        {rec.absent && rec.reason ? (
                          <View style={styles.histReasonRow}>
                            <MaterialCommunityIcons name="information-outline" size={12} color="#F59E0B" />
                            <Text style={styles.histReasonText}>{rec.reason}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))
                  )
                )}

                {/* ── LEAVES TAB ── */}
                {historyTab === 'leaves' && (
                  userHistory.leaves.length === 0 ? (
                    <View style={styles.emptyTab}>
                      <MaterialCommunityIcons name="umbrella-beach-outline" size={36} color="#64748B" />
                      <Text style={styles.emptyTabText}>No leave requests found</Text>
                    </View>
                  ) : (
                    userHistory.leaves.map((lv, idx) => (
                      <View key={idx} style={styles.leaveCard}>
                        <View style={styles.leaveTop}>
                          <View style={styles.leaveIconWrap}>
                            <MaterialCommunityIcons name="umbrella-beach-outline" size={18} color="#F59E0B" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.leaveType}>
                              {lv.leave_type || lv.type || 'Leave'}
                            </Text>
                            <Text style={styles.leaveReason} numberOfLines={2}>
                              {lv.reason || '—'}
                            </Text>
                          </View>
                          {lv.status && (
                            <View style={[
                              styles.leaveStatus,
                              lv.status === 'Approved' && { borderColor: 'rgba(5,150,105,0.3)', backgroundColor: 'rgba(5,150,105,0.1)' },
                              lv.status === 'Rejected' && { borderColor: 'rgba(239,68,68,0.3)',  backgroundColor: 'rgba(239,68,68,0.1)'  },
                            ]}>
                              <Text style={[
                                styles.leaveStatusText,
                                lv.status === 'Approved' && { color: '#10B981' },
                                lv.status === 'Rejected' && { color: '#EF4444'  },
                              ]}>{lv.status}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.leaveDates}>
                          <MaterialCommunityIcons name="calendar-range" size={13} color="#94A3B8" />
                          <Text style={styles.leaveDateText}>
                            {fmtDate(lv.from_date)} → {fmtDate(lv.to_date)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )
                )}

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

/* ─────────── Styles ─────────── */
const styles = StyleSheet.create({

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', padding: 24 },
  pinCard: { width: '100%', maxWidth: 340, backgroundColor: '#1E293B', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(37,99,235,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' },
  pinHeading: { fontSize: 20, fontWeight: '700', color: '#F8FAFC', marginBottom: 6 },
  pinSub: { fontSize: 13, color: '#94A3B8', marginBottom: 24, textAlign: 'center' },
  btn: { width: '100%', height: 52, borderRadius: 14, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  heading: { fontSize: 22, fontWeight: '700', color: '#F8FAFC' },
  subheading: { fontSize: 12, color: '#64748B', marginTop: 2 },
  adminName: { fontSize: 12, color: '#3B82F6', marginTop: 3 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  countBadge: { backgroundColor: 'rgba(37,99,235,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' },
  countText: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
  logoutBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },

  errorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.08)', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  errorBarText: { flex: 1, fontSize: 11, color: '#F59E0B', lineHeight: 16 },
  retryText: { fontSize: 12, color: '#3B82F6', fontWeight: '700' },

  loadingWrap: { paddingTop: 40, alignItems: 'center', gap: 10 },
  loadingText: { color: '#64748B', fontSize: 13 },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#64748B', fontSize: 14 },
  retryBigBtn: { backgroundColor: 'rgba(37,99,235,0.12)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' },
  retryBigText: { color: '#3B82F6', fontWeight: '700', fontSize: 13 },

  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#F8FAFC' },
  empCode: { fontSize: 12, color: '#64748B', marginTop: 1 },

  badgePresent: { backgroundColor: 'rgba(5,150,105,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)' },
  badgePresentText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  badgeAbsent: { backgroundColor: 'rgba(220,38,38,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)' },
  badgeAbsentText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  badgePending: { backgroundColor: 'rgba(100,116,139,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgePendingText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },

  timeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  timeBox: { flex: 1, alignItems: 'center', flexDirection: 'row', gap: 5 },
  timeSep: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  timeLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  timeValue: { fontSize: 13, color: '#F8FAFC', fontWeight: '600' },

  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 5 },
  locationText: { fontSize: 12, color: '#60A5FA', flex: 1 },

  reasonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5, backgroundColor: 'rgba(245,158,11,0.08)', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  reasonText: { fontSize: 12, color: '#F59E0B', flex: 1 },

  tapHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 3 },
  tapHintText: { fontSize: 10, color: '#3d4f6e' },

  /* ── Modal ── */
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0F172A', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 0, maxHeight: '88%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalHandle: { width: 36, height: 4, backgroundColor: 'rgba(148,163,184,0.3)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  modalAvatar: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  modalAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalName: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  modalEmpCode: { fontSize: 12, color: '#64748B', marginTop: 1 },
  modalPin: { fontSize: 11, color: '#3B82F6', marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statNum: { fontSize: 20, fontWeight: '700', color: '#F8FAFC' },
  statLbl: { fontSize: 10, color: '#64748B', marginTop: 2, fontWeight: '600' },

  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 14 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 9 },
  tabActive: { backgroundColor: '#1E293B' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#2563EB' },

  modalLoading: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  modalLoadingText: { color: '#64748B', fontSize: 13 },
  modalScroll: { flex: 1 },

  emptyTab: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTabText: { color: '#64748B', fontSize: 13 },

  histCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  histDateBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  histDate: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  histTimeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 8, padding: 8 },
  histTimeBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  histTimeLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  histTimeValue: { fontSize: 12, color: '#F8FAFC', fontWeight: '600' },
  histLocRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7, gap: 4 },
  histLocText: { fontSize: 11, color: '#60A5FA', flex: 1 },
  histReasonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4, backgroundColor: 'rgba(245,158,11,0.08)', padding: 6, borderRadius: 6 },
  histReasonText: { fontSize: 11, color: '#F59E0B', flex: 1 },

  leaveCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  leaveTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  leaveIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  leaveType: { fontSize: 13, fontWeight: '700', color: '#F8FAFC', marginBottom: 2 },
  leaveReason: { fontSize: 12, color: '#64748B' },
  leaveStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: 'rgba(201,168,76,0.1)' },
  leaveStatusText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  leaveDates: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leaveDateText: { fontSize: 12, color: '#94A3B8' },
});