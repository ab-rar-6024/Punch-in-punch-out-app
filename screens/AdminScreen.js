// screens/AdminScreen.js
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { getAdminAttendance, getHistory } from '../api';
import { useTheme } from './ThemeContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

function fmtDate(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return String(val); }
}

export default function AdminScreen({ navigation, route }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const c = theme.colors; // shorthand

  const fromLogin = !!route?.params?.user;
  const adminUser = route?.params?.user || null;

  const [adminVerified, setAdminVerified] = useState(fromLogin);
  const [records,       setRecords]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');

  // Modal state
  const [modalVisible,   setModalVisible]   = useState(false);
  const [selectedUser,   setSelectedUser]   = useState(null);
  const [attendance,     setAttendance]     = useState([]);
  const [leaves,         setLeaves]         = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab,      setActiveTab]      = useState('attendance');

  useEffect(() => {
    if (adminVerified && adminUser?.id) fetchAttendance();
  }, []);

  /* ── Logout ── */
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => navigation.replace('Login') },
    ]);
  };

  /* ── Today's attendance ── */
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
        setErrorMsg(result.msg || 'Failed to load.');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchAttendance(); };

  /* ── Open detail modal ── */
  const openDetail = async (item) => {
    setSelectedUser(item);
    setActiveTab('attendance');
    setAttendance([]);
    setLeaves([]);
    setHistoryLoading(true);
    setModalVisible(true);

    try {
      const hist = await getHistory(item.id);
      console.log('History:', JSON.stringify(hist).slice(0, 200));

      const att = Array.isArray(hist?.attendance) ? hist.attendance : [];
      const lv  = Array.isArray(hist?.leaves)     ? hist.leaves     : [];

      // Sort newest first
      att.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      lv.sort((a, b)  => new Date(b.from_date || 0) - new Date(a.from_date || 0));

      setAttendance(att);
      setLeaves(lv);
    } catch (err) {
      Alert.alert('Error', 'Could not load history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedUser(null);
    setAttendance([]);
    setLeaves([]);
  };

  const presentDays = attendance.filter(r => !r.absent && r.time_in).length;
  const absentDays  = attendance.filter(r => r.absent).length;

  /* ── NOT VERIFIED ── */
  if (!adminVerified) {
    return (
      <SafeAreaView style={[s.flex, { backgroundColor: c.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={s.center}>
          <MaterialCommunityIcons name="shield-lock-outline" size={48} color={c.primary} />
          <Text style={[s.pinTitle, { color: c.text }]}>Admin Access</Text>
          <Text style={[s.pinSub, { color: c.textSecondary }]}>Sign in to access admin panel</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]}
            onPress={() => navigation.replace('Login')}>
            <Text style={s.btnTxt}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── MAIN SCREEN ── */
  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <View style={s.headerLeft}>
          <Text style={[s.heading, { color: c.text }]}>Attendance</Text>
          <Text style={[s.subDate, { color: c.textSecondary }]}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </Text>
          {adminUser?.name && <Text style={[s.adminLabel, { color: c.primary }]}>{adminUser.name}</Text>}
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: c.card }]} onPress={toggleTheme}>
            <MaterialCommunityIcons name={isDark ? 'weather-sunny' : 'weather-night'} size={20} color={c.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: c.card }]} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={c.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stats bar ── */}
      <View style={[s.statsBar, { borderBottomColor: c.border }]}>
        {[
          { val: records.length,                        lbl: 'Total Staff', col: c.text    },
          { val: records.filter(r => r.time_in).length, lbl: 'Present',     col: c.success },
          { val: records.filter(r => r.absent).length,  lbl: 'Absent',      col: c.danger  },
        ].map(({ val, lbl, col }, i, arr) => (
          <View key={lbl} style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: col }]}>{val}</Text>
              <Text style={[s.statLbl, { color: c.textSecondary }]}>{lbl}</Text>
            </View>
            {i < arr.length - 1 && <View style={[s.statDiv, { backgroundColor: c.border }]} />}
          </View>
        ))}
      </View>

      {/* ── Error ── */}
      {errorMsg ? (
        <View style={[s.errorBar, { backgroundColor: c.warning + '18' }]}>
          <MaterialCommunityIcons name="alert-circle" size={18} color={c.warning} />
          <Text style={[s.errorTxt, { color: c.warning }]} numberOfLines={2}>{errorMsg}</Text>
          <TouchableOpacity onPress={fetchAttendance}>
            <Text style={[s.retryTxt, { color: c.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Loading ── */}
      {loading && !refreshing && (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      )}

      {/* ── List ── */}
      <FlatList
        data={records}
        keyExtractor={(item, idx) => String(item.id || idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        contentContainerStyle={s.listPad}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading && (
            <Animated.View entering={FadeInUp} style={s.emptyWrap}>
              <MaterialCommunityIcons name="account-group-outline" size={60} color={c.textTertiary} />
              <Text style={[s.emptyTxt, { color: c.textSecondary }]}>No records for today</Text>
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: c.card }]} onPress={fetchAttendance}>
                <Text style={[s.emptyBtnTxt, { color: c.primary }]}>Refresh</Text>
              </TouchableOpacity>
            </Animated.View>
          )
        }
        renderItem={({ item, index }) => {
          const isAbsent  = item.absent === true || item.absent === 'Yes' || item.absent === 1;
          const isPresent = !isAbsent && item.time_in;
          const badgeBg   = isAbsent ? c.danger + '20' : isPresent ? c.success + '20' : c.textTertiary + '20';
          const badgeTxt  = isAbsent ? c.danger         : isPresent ? c.success         : c.textSecondary;
          const badgeLabel= isAbsent ? 'Absent'         : isPresent ? 'Present'         : 'Not In';

          return (
            <Animated.View entering={FadeInDown.delay(index * 40)}>
              <TouchableOpacity style={[s.card, { backgroundColor: c.card }]}
                onPress={() => openDetail(item)} activeOpacity={0.75}>

                {/* Name row */}
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: c.primary }]}>
                    <Text style={s.avatarTxt}>
                      {(item.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.nameCol}>
                    <Text style={[s.nameText, { color: c.text }]}>{item.name || 'Unknown'}</Text>
                    <Text style={[s.codeText, { color: c.textSecondary }]}>{item.emp_code || '—'}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[s.badgeTxt, { color: badgeTxt }]}>{badgeLabel}</Text>
                  </View>
                </View>

                {/* Times */}
                <View style={s.timeRow}>
                  <View style={[s.timeBox, { backgroundColor: c.background }]}>
                    <MaterialCommunityIcons name="login" size={15} color={c.success} />
                    <Text style={[s.timeLbl, { color: c.textSecondary }]}>In</Text>
                    <Text style={[s.timeVal, { color: c.text }]}>{item.time_in || '—'}</Text>
                  </View>
                  <View style={[s.timeDiv, { backgroundColor: c.border }]} />
                  <View style={[s.timeBox, { backgroundColor: c.background }]}>
                    <MaterialCommunityIcons name="logout" size={15} color={c.danger} />
                    <Text style={[s.timeLbl, { color: c.textSecondary }]}>Out</Text>
                    <Text style={[s.timeVal, { color: c.text }]}>{item.time_out || '—'}</Text>
                  </View>
                </View>

                {/* Location */}
                {item.location_in && item.location_in !== '—' && (
                  <View style={s.locRow}>
                    <MaterialCommunityIcons name="map-marker" size={13} color={c.primary} />
                    <Text style={[s.locTxt, { color: c.textSecondary }]} numberOfLines={1}>
                      {item.location_in.split('|')[0] || item.location_in}
                    </Text>
                  </View>
                )}

                <View style={s.tapRow}>
                  <Text style={[s.tapTxt, { color: c.textTertiary }]}>Tap to view full history</Text>
                  <MaterialCommunityIcons name="chevron-right" size={13} color={c.textTertiary} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />

      {/* ══════════════════════════════════
          MODAL — clean bottom sheet
      ══════════════════════════════════ */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={[s.modalRoot, { backgroundColor: c.background }]}>

          {/* Modal Header */}
          {selectedUser && (
            <View style={[s.mHeader, { borderBottomColor: c.border }]}>
              <View style={[s.mAvatar, { backgroundColor: c.primary }]}>
                <Text style={s.mAvatarTxt}>
                  {(selectedUser.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={s.mNameCol}>
                <Text style={[s.mName, { color: c.text }]}>{selectedUser.name}</Text>
                <Text style={[s.mCode, { color: c.textSecondary }]}>
                  {selectedUser.emp_code || '—'} • PIN: {selectedUser.pin || '—'}
                </Text>
              </View>
              <TouchableOpacity style={[s.closeBtn, { backgroundColor: c.card }]} onPress={closeModal}>
                <MaterialCommunityIcons name="close" size={20} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Stats row */}
          <View style={s.mStatsRow}>
            {[
              { val: attendance.length, lbl: 'Total',   col: c.text    },
              { val: presentDays,       lbl: 'Present', col: c.success },
              { val: absentDays,        lbl: 'Absent',  col: c.danger  },
              { val: leaves.length,     lbl: 'Leaves',  col: c.warning },
            ].map(({ val, lbl, col }) => (
              <View key={lbl} style={[s.mStatBox,
                { backgroundColor: col === c.text ? c.card : col + '15' }]}>
                <Text style={[s.mStatVal, { color: col }]}>{val}</Text>
                <Text style={[s.mStatLbl,
                  { color: col === c.text ? c.textSecondary : col }]}>{lbl}</Text>
              </View>
            ))}
          </View>

          {/* Tabs */}
          <View style={[s.tabBar, { backgroundColor: c.card }]}>
            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'attendance' && { backgroundColor: c.background }]}
              onPress={() => setActiveTab('attendance')}
            >
              <MaterialCommunityIcons name="calendar-month" size={17}
                color={activeTab === 'attendance' ? c.primary : c.textSecondary} />
              <Text style={[s.tabTxt,
                { color: activeTab === 'attendance' ? c.primary : c.textSecondary }]}>
                Attendance ({attendance.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'leaves' && { backgroundColor: c.background }]}
              onPress={() => setActiveTab('leaves')}
            >
              <MaterialCommunityIcons name="calendar-remove" size={17}
                color={activeTab === 'leaves' ? c.primary : c.textSecondary} />
              <Text style={[s.tabTxt,
                { color: activeTab === 'leaves' ? c.primary : c.textSecondary }]}>
                Leaves ({leaves.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Tab Content ── */}
          {historyLoading ? (
            <View style={s.mLoadWrap}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={[s.mLoadTxt, { color: c.textSecondary }]}>Loading history...</Text>
            </View>
          ) : (
            <ScrollView
              style={s.mScroll}
              contentContainerStyle={s.mScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── ATTENDANCE TAB ── */}
              {activeTab === 'attendance' && (
                attendance.length === 0 ? (
                  <View style={s.emptyTab}>
                    <MaterialCommunityIcons name="calendar-blank" size={48} color={c.textTertiary} />
                    <Text style={[s.emptyTabTxt, { color: c.textSecondary }]}>No attendance records</Text>
                  </View>
                ) : (
                  attendance.map((rec, idx) => {
                    const abs = rec.absent === true || rec.absent === 1 || rec.absent === 'true';
                    return (
                      <View key={idx} style={[s.histCard, { backgroundColor: c.card }]}>
                        {/* Date + status */}
                        <View style={s.histTop}>
                          <View style={s.histDateRow}>
                            <MaterialCommunityIcons name="calendar" size={14} color={c.textSecondary} />
                            <Text style={[s.histDate, { color: c.text }]}>{fmtDate(rec.date)}</Text>
                          </View>
                          {abs ? (
                            <View style={[s.hBadge, { backgroundColor: c.danger + '15' }]}>
                              <Text style={[s.hBadgeTxt, { color: c.danger }]}>Absent</Text>
                            </View>
                          ) : rec.time_in ? (
                            <View style={[s.hBadge, { backgroundColor: c.success + '15' }]}>
                              <Text style={[s.hBadgeTxt, { color: c.success }]}>Present</Text>
                            </View>
                          ) : (
                            <View style={[s.hBadge, { backgroundColor: c.textTertiary + '15' }]}>
                              <Text style={[s.hBadgeTxt, { color: c.textSecondary }]}>No Record</Text>
                            </View>
                          )}
                        </View>

                        {/* Punch times */}
                        <View style={[s.histTimes, { backgroundColor: c.background }]}>
                          <View style={s.histTimeItem}>
                            <MaterialCommunityIcons name="login" size={14} color={c.success} />
                            <Text style={[s.histTimeLbl, { color: c.textSecondary }]}>In  </Text>
                            <Text style={[s.histTimeVal, { color: c.text }]}>{rec.time_in || '—'}</Text>
                          </View>
                          <View style={[s.histTimeDiv, { backgroundColor: c.border }]} />
                          <View style={s.histTimeItem}>
                            <MaterialCommunityIcons name="logout" size={14} color={c.danger} />
                            <Text style={[s.histTimeLbl, { color: c.textSecondary }]}>Out </Text>
                            <Text style={[s.histTimeVal, { color: c.text }]}>{rec.time_out || '—'}</Text>
                          </View>
                        </View>

                        {/* Location */}
                        {rec.location_in && rec.location_in !== '—' && (
                          <View style={s.histLocRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={13} color={c.primary} />
                            <Text style={[s.histLocTxt, { color: c.textSecondary }]} numberOfLines={1}>
                              {rec.location_in.split('|')[0] || rec.location_in}
                            </Text>
                          </View>
                        )}

                        {/* Absent reason */}
                        {abs && rec.reason ? (
                          <View style={[s.reasonBox, { backgroundColor: c.warning + '10' }]}>
                            <MaterialCommunityIcons name="information" size={13} color={c.warning} />
                            <Text style={[s.reasonTxt, { color: c.warning }]}>{rec.reason}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )
              )}

              {/* ── LEAVES TAB ── */}
              {activeTab === 'leaves' && (
                leaves.length === 0 ? (
                  <View style={s.emptyTab}>
                    <MaterialCommunityIcons name="calendar-remove" size={48} color={c.textTertiary} />
                    <Text style={[s.emptyTabTxt, { color: c.textSecondary }]}>No leave requests found</Text>
                  </View>
                ) : (
                  leaves.map((lv, idx) => {
                    const statusColor =
                      lv.status === 'Approved' ? c.success :
                      lv.status === 'Rejected' ? c.danger  : c.warning;
                    return (
                      <View key={idx} style={[s.leaveCard, { backgroundColor: c.card }]}>
                        <View style={s.leaveTop}>
                          <View style={[s.leaveIconBox, { backgroundColor: c.warning + '15' }]}>
                            <MaterialCommunityIcons name="calendar-remove" size={20} color={c.warning} />
                          </View>
                          <View style={s.leaveInfo}>
                            <Text style={[s.leaveType, { color: c.text }]}>
                              {lv.leave_type || lv.type || 'Leave'}
                            </Text>
                            <Text style={[s.leaveDates, { color: c.textSecondary }]}>
                              {fmtDate(lv.from_date)} → {fmtDate(lv.to_date)}
                            </Text>
                          </View>
                          {lv.status && (
                            <View style={[s.leaveStatus, { backgroundColor: statusColor + '15' }]}>
                              <Text style={[s.leaveStatusTxt, { color: statusColor }]}>{lv.status}</Text>
                            </View>
                          )}
                        </View>
                        {lv.reason ? (
                          <Text style={[s.leaveReason, { color: c.textSecondary }]}>{lv.reason}</Text>
                        ) : null}
                      </View>
                    );
                  })
                )
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

/* ─────────── Styles ─────────── */
const s = StyleSheet.create({
  flex:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 },

  pinTitle: { fontSize: 22, fontWeight: '700', marginTop: 12 },
  pinSub:   { fontSize: 14, textAlign: 'center' },
  btn:      { height: 50, paddingHorizontal: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnTxt:   { color: '#fff', fontWeight: '700', fontSize: 16 },

  /* Header */
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerLeft:  { flex: 1 },
  heading:     { fontSize: 30, fontWeight: '700', marginBottom: 2 },
  subDate:     { fontSize: 14, marginBottom: 2 },
  adminLabel:  { fontSize: 13, fontWeight: '500' },
  headerRight: { flexDirection: 'row', gap: 10 },
  iconBtn:     { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  /* Stats bar */
  statsBar: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  statLbl:  { fontSize: 12, fontWeight: '500' },
  statDiv:  { width: 1, height: 28, marginHorizontal: 4 },

  /* Error */
  errorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 10 },
  errorTxt: { flex: 1, fontSize: 13 },
  retryTxt: { fontSize: 13, fontWeight: '700' },

  loadingWrap: { paddingTop: 40, alignItems: 'center' },
  listPad:     { padding: 16, paddingTop: 10 },

  emptyWrap:   { alignItems: 'center', paddingTop: 60, gap: 14 },
  emptyTxt:    { fontSize: 15, textAlign: 'center' },
  emptyBtn:    { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnTxt: { fontSize: 15, fontWeight: '600' },

  /* Card */
  card:     { borderRadius: 18, padding: 16, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar:   { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTxt:{ fontSize: 16, fontWeight: '700', color: '#fff' },
  nameCol:  { flex: 1 },
  nameText: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  codeText: { fontSize: 13 },
  badge:    { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeTxt: { fontSize: 12, fontWeight: '600' },

  timeRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timeBox:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10 },
  timeDiv:  { width: 1, height: 22, marginHorizontal: 8 },
  timeLbl:  { fontSize: 12, fontWeight: '500' },
  timeVal:  { fontSize: 13, fontWeight: '700', marginLeft: 'auto' },

  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  locTxt: { fontSize: 12, flex: 1 },
  tapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 2 },
  tapTxt: { fontSize: 11 },

  /* ── Modal ── */
  modalRoot: { flex: 1 },

  mHeader:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderBottomWidth: 1 },
  mAvatar:   { width: 54, height: 54, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  mAvatarTxt:{ fontSize: 18, fontWeight: '700', color: '#fff' },
  mNameCol:  { flex: 1 },
  mName:     { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  mCode:     { fontSize: 13 },
  closeBtn:  { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  mStatsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  mStatBox:  { flex: 1, alignItems: 'center', padding: 12, borderRadius: 14 },
  mStatVal:  { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  mStatLbl:  { fontSize: 11, fontWeight: '600' },

  tabBar:    { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, padding: 4, borderRadius: 14 },
  tabBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabTxt:    { fontSize: 13, fontWeight: '600' },

  mLoadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  mLoadTxt:  { fontSize: 14 },

  /* ✅ KEY: ScrollView takes all remaining space */
  mScroll:        { flex: 1 },
  mScrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 60 },

  emptyTab:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTabTxt: { fontSize: 15 },

  /* History card */
  histCard:     { borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  histTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  histDateRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  histDate:     { fontSize: 14, fontWeight: '600' },
  hBadge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  hBadgeTxt:    { fontSize: 12, fontWeight: '600' },
  histTimes:    { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 10, marginBottom: 6 },
  histTimeItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  histTimeDiv:  { width: 1, height: 20, marginHorizontal: 8 },
  histTimeLbl:  { fontSize: 12, fontWeight: '500' },
  histTimeVal:  { fontSize: 13, fontWeight: '700' },
  histLocRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  histLocTxt:   { fontSize: 12, flex: 1 },
  reasonBox:    { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, marginTop: 7 },
  reasonTxt:    { fontSize: 12, flex: 1 },

  /* Leave card */
  leaveCard:      { borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  leaveTop:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  leaveIconBox:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  leaveInfo:      { flex: 1 },
  leaveType:      { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  leaveDates:     { fontSize: 13 },
  leaveStatus:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  leaveStatusTxt: { fontSize: 12, fontWeight: '600' },
  leaveReason:    { fontSize: 13, lineHeight: 20 },
});