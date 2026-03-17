import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "./ThemeContext";
dayjs.extend(customParseFormat);

const { width } = Dimensions.get("window");
const CALENDAR_WIDTH = width - 40;
const DAY_SIZE = Math.floor((CALENDAR_WIDTH - 64) / 7);

// ─── HistoryScreen ────────────────────────────────────────────────────────────
// isActive: passed from MainTabs — true when this page is the visible tab.
// Every time isActive flips true (tab switch, swipe back, app resume),
// loadData() is called automatically. No React Navigation hooks needed
// because this screen lives inside PagerView, not a real nav stack.
// ─────────────────────────────────────────────────────────────────────────────
export default function HistoryScreen({ route, navigation, isActive }) {
  const { isDark } = useTheme();
  const { user = {} } = route.params || {};

  // ── state ─────────────────────────────────────────────────────────
  const [histData,    setHistData]   = useState(route.params?.hist || []);
  const [autoLoading, setAutoLoading] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);

  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  const [selectedMonth, setSelectedMonth] = useState(dayjs().month());
  const [selectedYear,  setSelectedYear]  = useState(dayjs().year());
  const [selectedDay,   setSelectedDay]   = useState(null);
  const [selectedWeek,  setSelectedWeek]  = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalData,    setModalData]    = useState([]);
  const [modalTitle,   setModalTitle]   = useState("");
  const [modalType,    setModalType]    = useState("");

  // ─────────────────────────────────────────────────────────────────
  // loadData
  // ─────────────────────────────────────────────────────────────────
  const loadData = async ({ isPullRefresh = false } = {}) => {
    const uid = user?.id;
    if (!uid) return;
    if (!isPullRefresh) setAutoLoading(true);
    try {
      const { getHistory } = require("../api");
      const result = await getHistory(uid);
      if (result) setHistData(result);
    } catch (e) {
      console.error("HistoryScreen loadData error:", e);
    } finally {
      setAutoLoading(false);
      setRefreshing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Fade in once on mount
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start();
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // THE FIX — watch isActive prop.
  //
  // MainTabs.js passes isActive={currentPage === 0} to this component.
  // PagerView updates currentPage on every tab press or swipe.
  // So whenever the user comes to the History tab from anywhere:
  //   ✅ Tap History in bottom tab bar
  //   ✅ Swipe to History page
  //   ✅ Come back from ApplyLeaveScreen
  //   ✅ First app open
  //
  // isActive flips from false → true, this effect fires, loadData runs.
  // Plain React useEffect — no navigation hooks, no stale closures.
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      loadData();
    }
  }, [isActive]); // re-runs every time isActive changes to true

  // Reset week on month change
  useEffect(() => {
    setSelectedWeek(0);
  }, [selectedMonth, selectedYear]);

  // ─────────────────────────────────────────────────────────────────
  // Process raw history into flat records
  // ─────────────────────────────────────────────────────────────────
  const processHistory = () => {
    if (!histData) return [];

    let data = [];

    if (histData.attendance && Array.isArray(histData.attendance)) {
      data = histData.attendance;
      if (histData.leaves && Array.isArray(histData.leaves)) {
        data = [...data, ...histData.leaves];
      }
    } else if (Array.isArray(histData)) {
      data = histData;
    } else {
      return [];
    }

    const processedData = data
      .map((record) => {
        const isLeave =
          record.absent === true ||
          record.status === "absent" ||
          record.status === "leave" ||
          record.type === "leave" ||
          (record.reason && !record.time_in && !record.time_out) ||
          (record.from_date && record.to_date) ||
          record.is_leave === true ||
          record.leave === true;

        let date = record.date;
        if (!date && record.from_date) date = record.from_date;

        let leaveReason = "";
        if (isLeave) {
          leaveReason =
            record.reason || record.leave_reason || record.remarks || "Leave";
        }

        let leaveType = "Full Day";
        if (record.leave_type) leaveType = record.leave_type;
        else if (record.half_day) leaveType = "Half Day";
        else if (record.short_leave) leaveType = "Short Leave";

        return {
          ...record,
          date,
          isLeave,
          leaveType,
          leaveReason,
          time_in: isLeave ? null : record.time_in,
          time_out: isLeave ? null : record.time_out,
        };
      })
      .filter((r) => r.date);

    // De-duplicate: prefer attendance over leave for the same date
    const uniqueData = [];
    const dateMap = new Map();

    processedData.forEach((record) => {
      const existing = dateMap.get(record.date);
      if (!existing) {
        dateMap.set(record.date, record);
        uniqueData.push(record);
      } else if (existing.isLeave && !record.isLeave) {
        const idx = uniqueData.indexOf(existing);
        uniqueData[idx] = record;
        dateMap.set(record.date, record);
      }
    });

    return uniqueData;
  };

  const historyData = processHistory();

  const todayStr = dayjs().format("YYYY-MM-DD");
  const yesterdayStr = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  const todayRec = historyData.find((d) => d.date === todayStr) || {};
  const yesterdayRec = historyData.find((d) => d.date === yesterdayStr) || {};

  const filteredHistory = historyData.filter((record) => {
    if (!record.date) return false;
    const rd = dayjs(record.date);
    return rd.month() === selectedMonth && rd.year() === selectedYear;
  });

  // ─────────────────────────────────────────────────────────────────
  // Pull-to-refresh
  // ─────────────────────────────────────────────────────────────────
  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    loadData({ isPullRefresh: true });
  };

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────
  const getWeekData = (weekIndex) => {
    const start = weekIndex * 7;
    return filteredHistory.slice(start, start + 7);
  };

  const getWeekRange = (weekIndex) => {
    const wd = getWeekData(weekIndex);
    if (!wd.length) return "";
    const first = dayjs(wd[0].date);
    const last = dayjs(wd[wd.length - 1].date);
    return `${first.format("MMM DD")} - ${last.format("MMM DD, YYYY")}`;
  };

  const calculateStats = () => {
    const totalDays = filteredHistory.length;
    const presentDays = filteredHistory.filter(
      (d) => d.time_in && d.time_out
    ).length;
    const leaveDays = filteredHistory.filter(
      (d) => d.isLeave === true
    ).length;
    const totalHours = filteredHistory.reduce((sum, day) => {
      return sum + calculateDurationInHours(day.time_in, day.time_out);
    }, 0);
    const avgHours =
      totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0;
    return { totalDays, presentDays, leaveDays, totalHours, avgHours };
  };

  const calculateDurationInHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return 0;
    try {
      const parseTime = (t) => {
        t = t.trim();
        if (t.includes("AM") || t.includes("PM"))
          return dayjs(`2000-01-01 ${t}`, "YYYY-MM-DD h:mm A");
        return dayjs(`2000-01-01 ${t}`, "YYYY-MM-DD HH:mm");
      };
      const start = parseTime(timeIn);
      const end = parseTime(timeOut);
      if (!start.isValid() || !end.isValid()) return 0;
      let diff = end.diff(start, "minute");
      if (diff < 0) diff += 24 * 60;
      return diff / 60;
    } catch {
      return 0;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === "—") return "—";
    try {
      timeStr = timeStr.trim();
      if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
      const t = dayjs(`2000-01-01 ${timeStr}`, "YYYY-MM-DD HH:mm");
      return t.isValid() ? t.format("h:mm A") : "—";
    } catch {
      return "—";
    }
  };

  const calculateDuration = (timeIn, timeOut) => {
    const h = calculateDurationInHours(timeIn, timeOut);
    if (h === 0) return "—";
    const wh = Math.floor(h);
    const m = Math.round((h - wh) * 60);
    return `${wh}h ${m}m`;
  };

  const changeMonth = (direction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (direction === "prev") {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
    setSelectedDay(null);
  };

  const getMonthName = (m) => dayjs().month(m).format("MMMM");

  const getAttendanceForDate = (dateStr) =>
    historyData.find((d) => d.date === dateStr);

  const generateCalendarDays = () => {
    const daysInMonth = dayjs(
      `${selectedYear}-${selectedMonth + 1}-01`
    ).daysInMonth();
    const firstDay = dayjs(
      `${selectedYear}-${selectedMonth + 1}-01`
    ).day();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(
        2,
        "0"
      )}-${String(i).padStart(2, "0")}`;
      const attendance = getAttendanceForDate(dateStr);
      days.push({
        date: dateStr,
        day: i,
        attendance,
        isToday: dateStr === todayStr,
        isYesterday: dateStr === yesterdayStr,
        isSelected: selectedDay === dateStr,
        isLeave: attendance?.isLeave === true,
        leaveType: attendance?.leaveType || "Full Day",
        leaveReason: attendance?.leaveReason || attendance?.reason || "",
      });
    }
    return days;
  };

  // Stat card press → modal
  const handleStatPress = (type, data) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!data.length) return;
    const titles = {
      total: `Working Days - ${getMonthName(selectedMonth)} ${selectedYear}`,
      present: `Days Present - ${getMonthName(selectedMonth)} ${selectedYear}`,
      leave: `Leave Days - ${getMonthName(selectedMonth)} ${selectedYear}`,
      hours: `Hours Summary - ${getMonthName(selectedMonth)} ${selectedYear}`,
    };
    setModalTitle(titles[type]);
    setModalType(type === "total" ? "working" : type);
    setModalData(data);
    setModalVisible(true);
  };

  const getWorkingDaysData = () =>
    filteredHistory.filter((d) => d.time_in && d.time_out);
  const getPresentDaysData = () =>
    filteredHistory.filter((d) => d.time_in && d.time_out);
  const getLeaveDaysData = () =>
    filteredHistory.filter((d) => d.isLeave === true);
  const getHoursData = () =>
    filteredHistory
      .filter((d) => d.time_in && d.time_out)
      .map((day) => ({
        ...day,
        hours: calculateDurationInHours(day.time_in, day.time_out),
      }));

  const calendarDays = generateCalendarDays();
  const stats = calculateStats();
  const selectedDayData = selectedDay
    ? getAttendanceForDate(selectedDay)
    : null;

  const getLeaveTypeColor = (leaveType) => {
    switch (leaveType) {
      case "Half Day":
        return isDark ? "#6b21a8" : "#f3e8ff";
      case "Short Leave":
        return isDark ? "#581c87" : "#fae8ff";
      default:
        return isDark ? "#7e22ce" : "#e9d5ff";
    }
  };

  const getLeaveDotColor = (leaveType) => {
    switch (leaveType) {
      case "Half Day":
        return "#c084fc";
      case "Short Leave":
        return "#e879f9";
      default:
        return "#a855f7";
    }
  };

  // Modal list item renderer
  const renderModalItem = ({ item }) => {
    switch (modalType) {
      case "working":
      case "present":
        return (
          <View
            style={[
              styles.modalItem,
              {
                borderBottomColor: isDark ? "#334155" : "#e5e7eb",
              },
            ]}
          >
            <View style={styles.modalItemHeader}>
              <MaterialCommunityIcons
                name="calendar-check"
                size={20}
                color="#10b981"
              />
              <Text
                style={[
                  styles.modalItemDate,
                  { color: isDark ? "#fff" : "#1e293b" },
                ]}
              >
                {dayjs(item.date).format("dddd, MMM DD, YYYY")}
              </Text>
            </View>
            <View style={styles.modalItemDetails}>
              {[
                ["Check In", formatTime(item.time_in)],
                ["Check Out", formatTime(item.time_out)],
                [
                  "Duration",
                  calculateDuration(item.time_in, item.time_out),
                ],
              ].map(([label, value]) => (
                <View key={label} style={styles.modalDetailRow}>
                  <Text
                    style={[
                      styles.modalDetailLabel,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    {label}:
                  </Text>
                  <Text
                    style={[
                      styles.modalDetailValue,
                      { color: isDark ? "#fff" : "#1e293b" },
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      case "leave":
        return (
          <View
            style={[
              styles.modalItem,
              { borderBottomColor: isDark ? "#334155" : "#e5e7eb" },
            ]}
          >
            <View style={styles.modalItemHeader}>
              <MaterialCommunityIcons
                name="umbrella-beach"
                size={20}
                color="#a855f7"
              />
              <Text
                style={[
                  styles.modalItemDate,
                  { color: isDark ? "#fff" : "#1e293b" },
                ]}
              >
                {dayjs(item.date).format("dddd, MMM DD, YYYY")}
              </Text>
            </View>
            <View style={styles.modalItemDetails}>
              <View style={styles.modalDetailRow}>
                <Text
                  style={[
                    styles.modalDetailLabel,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  Leave Type:
                </Text>
                <Text
                  style={[
                    styles.modalDetailValue,
                    { color: isDark ? "#fff" : "#1e293b" },
                  ]}
                >
                  {item.leaveType}
                </Text>
              </View>
              {item.leaveReason ? (
                <View style={styles.modalDetailRow}>
                  <Text
                    style={[
                      styles.modalDetailLabel,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    Reason:
                  </Text>
                  <Text
                    style={[
                      styles.modalDetailValue,
                      { color: isDark ? "#fff" : "#1e293b", flex: 1 },
                    ]}
                  >
                    {item.leaveReason}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );

      case "hours":
        return (
          <View
            style={[
              styles.modalItem,
              { borderBottomColor: isDark ? "#334155" : "#e5e7eb" },
            ]}
          >
            <View style={styles.modalItemHeader}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={20}
                color="#f59e0b"
              />
              <Text
                style={[
                  styles.modalItemDate,
                  { color: isDark ? "#fff" : "#1e293b" },
                ]}
              >
                {dayjs(item.date).format("dddd, MMM DD, YYYY")}
              </Text>
            </View>
            <View style={styles.modalItemDetails}>
              {[
                ["Hours Worked", `${item.hours.toFixed(1)} hours`],
                ["Check In", formatTime(item.time_in)],
                ["Check Out", formatTime(item.time_out)],
              ].map(([label, value]) => (
                <View key={label} style={styles.modalDetailRow}>
                  <Text
                    style={[
                      styles.modalDetailLabel,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    {label}:
                  </Text>
                  <Text
                    style={[
                      styles.modalDetailValue,
                      { color: isDark ? "#fff" : "#1e293b" },
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
      ]}
    >
      {/* Header */}
      <LinearGradient
        colors={
          isDark ? ["#1e293b", "#334155"] : ["#3b82f6", "#2563eb"]
        }
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={["#10b981", "#059669"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              </LinearGradient>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
              </View>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user.name || "Unknown User"}
              </Text>
              <View style={styles.idRow}>
                <MaterialCommunityIcons
                  name="badge-account-outline"
                  size={14}
                  color="rgba(255,255,255,0.8)"
                />
                <Text style={styles.userId}>
                  ID: {user.emp_code || user.id || "N/A"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Auto-reload banner: visible whenever the screen re-focuses ── */}
      {autoLoading && (
        <View
          style={[
            styles.autoLoadBar,
            {
              backgroundColor: isDark
                ? "rgba(59,130,246,0.12)"
                : "rgba(59,130,246,0.08)",
              borderBottomColor: isDark
                ? "rgba(59,130,246,0.25)"
                : "rgba(59,130,246,0.18)",
            },
          ]}
        >
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text
            style={[
              styles.autoLoadText,
              { color: isDark ? "#60a5fa" : "#2563eb" },
            ]}
          >
            Syncing latest data…
          </Text>
          {/* live dot */}
          <View style={styles.liveDot} />
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Today */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="calendar-today"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? "#e2e8f0" : "#1e293b" },
              ]}
            >
              Today's Attendance
            </Text>
          </View>

          <View
            style={[
              styles.todayCard,
              {
                backgroundColor: isDark ? "#1e293b" : "#fff",
                borderColor: isDark ? "#334155" : "#e5e7eb",
              },
            ]}
          >
            <View style={styles.todayHeader}>
              <Text
                style={[
                  styles.todayDate,
                  { color: isDark ? "#fff" : "#111" },
                ]}
              >
                {dayjs().format("dddd, MMM DD, YYYY")}
              </Text>
              <View
                style={[
                  styles.statusChip,
                  todayRec.isLeave
                    ? styles.statusLeave
                    : todayRec.time_in
                    ? styles.statusActive
                    : styles.statusInactive,
                ]}
              >
                <View
                  style={[
                    styles.statusChipDot,
                    {
                      backgroundColor: todayRec.isLeave
                        ? "#a855f7"
                        : todayRec.time_in
                        ? "#10b981"
                        : "#64748b",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusChipText,
                    {
                      color: todayRec.isLeave
                        ? "#a855f7"
                        : todayRec.time_in
                        ? "#10b981"
                        : "#64748b",
                    },
                  ]}
                >
                  {todayRec.isLeave
                    ? "On Leave"
                    : todayRec.time_in
                    ? "Active"
                    : "Not Checked In"}
                </Text>
              </View>
            </View>

            {todayRec.isLeave ? (
              <View style={styles.leaveContainer}>
                <View
                  style={[
                    styles.leaveIconContainer,
                    {
                      backgroundColor: isDark ? "#7e22ce" : "#e9d5ff",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="umbrella-beach"
                    size={32}
                    color="#a855f7"
                  />
                </View>
                <View style={styles.leaveInfo}>
                  <Text
                    style={[
                      styles.leaveTitle,
                      { color: isDark ? "#fff" : "#1e293b" },
                    ]}
                  >
                    {todayRec.leaveType || "Full Day"} Leave
                  </Text>
                  {todayRec.leaveReason ? (
                    <Text
                      style={[
                        styles.leaveReason,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                    >
                      Reason: {todayRec.leaveReason}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.todayGrid}>
                {[
                  {
                    icon: "clock-in",
                    color: "#10b981",
                    bg: isDark ? "#064e3b" : "#d1fae5",
                    label: "Check In",
                    value: formatTime(todayRec.time_in),
                  },
                  {
                    icon: "clock-out",
                    color: "#ef4444",
                    bg: isDark ? "#7f1d1d" : "#fee2e2",
                    label: "Check Out",
                    value: formatTime(todayRec.time_out),
                  },
                  {
                    icon: "timer-outline",
                    color: "#3b82f6",
                    bg: isDark ? "#1e3a8a" : "#dbeafe",
                    label: "Duration",
                    value: calculateDuration(
                      todayRec.time_in,
                      todayRec.time_out
                    ),
                  },
                ].map((item) => (
                  <View key={item.label} style={styles.timeBlock}>
                    <View
                      style={[
                        styles.timeIcon,
                        { backgroundColor: item.bg },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={24}
                        color={item.color}
                      />
                    </View>
                    <Text
                      style={[
                        styles.timeLabel,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.timeValue,
                        { color: isDark ? "#fff" : "#111" },
                      ]}
                    >
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Yesterday */}
          {yesterdayRec && Object.keys(yesterdayRec).length > 0 && (
            <View
              style={[
                styles.yesterdayCard,
                {
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                  borderColor: isDark ? "#334155" : "#e5e7eb",
                },
              ]}
            >
              <View style={styles.yesterdayHeader}>
                <MaterialCommunityIcons
                  name="calendar-arrow-left"
                  size={18}
                  color={yesterdayRec.isLeave ? "#a855f7" : "#3b82f6"}
                />
                <Text
                  style={[
                    styles.yesterdayTitle,
                    { color: isDark ? "#fff" : "#1e293b" },
                  ]}
                >
                  Yesterday's Summary
                </Text>
              </View>
              <View style={styles.yesterdayContent}>
                {yesterdayRec.isLeave ? (
                  <>
                    <View
                      style={[
                        styles.leaveBadge,
                        {
                          backgroundColor: isDark
                            ? "#7e22ce"
                            : "#e9d5ff",
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="umbrella-beach"
                        size={14}
                        color="#a855f7"
                      />
                      <Text
                        style={[
                          styles.leaveBadgeText,
                          {
                            color: isDark ? "#fff" : "#7e22ce",
                          },
                        ]}
                      >
                        {yesterdayRec.leaveType || "Full Day"} Leave
                      </Text>
                    </View>
                    {yesterdayRec.leaveReason ? (
                      <Text
                        style={[
                          styles.yesterdayReason,
                          { color: isDark ? "#94a3b8" : "#64748b" },
                        ]}
                      >
                        {yesterdayRec.leaveReason}
                      </Text>
                    ) : null}
                  </>
                ) : yesterdayRec.time_in ? (
                  <View style={styles.yesterdayAttendance}>
                    {[
                      {
                        icon: "clock-in",
                        color: "#10b981",
                        text: `In: ${formatTime(yesterdayRec.time_in)}`,
                      },
                      {
                        icon: "clock-out",
                        color: "#ef4444",
                        text: `Out: ${formatTime(yesterdayRec.time_out)}`,
                      },
                      {
                        icon: "timer-outline",
                        color: "#3b82f6",
                        text: `Duration: ${calculateDuration(
                          yesterdayRec.time_in,
                          yesterdayRec.time_out
                        )}`,
                      },
                    ].map((row) => (
                      <View key={row.text} style={styles.yesterdayTimeRow}>
                        <MaterialCommunityIcons
                          name={row.icon}
                          size={14}
                          color={row.color}
                        />
                        <Text
                          style={[
                            styles.yesterdayTime,
                            { color: isDark ? "#fff" : "#1e293b" },
                          ]}
                        >
                          {row.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.yesterdayNoData,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    No attendance record for yesterday
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Monthly Overview */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="chart-box"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? "#e2e8f0" : "#1e293b" },
              ]}
            >
              Monthly Overview
            </Text>
          </View>

          <View style={styles.monthSelector}>
            <Pressable
              style={styles.monthNavButton}
              onPress={() => changeMonth("prev")}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={24}
                color={isDark ? "#60a5fa" : "#3b82f6"}
              />
            </Pressable>
            <View style={styles.monthDisplay}>
              <Text
                style={[
                  styles.monthText,
                  { color: isDark ? "#fff" : "#1e293b" },
                ]}
              >
                {getMonthName(selectedMonth)} {selectedYear}
              </Text>
            </View>
            <Pressable
              style={styles.monthNavButton}
              onPress={() => changeMonth("next")}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={isDark ? "#60a5fa" : "#3b82f6"}
              />
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            {[
              {
                type: "total",
                icon: "calendar-multiselect",
                color: "#3b82f6",
                bg: isDark
                  ? "rgba(59,130,246,0.1)"
                  : "#dbeafe",
                value: stats.totalDays,
                label: "Working Days",
                data: getWorkingDaysData(),
              },
              {
                type: "present",
                icon: "check-circle",
                color: "#10b981",
                bg: isDark
                  ? "rgba(16,185,129,0.1)"
                  : "#d1fae5",
                value: stats.presentDays,
                label: "Days Present",
                data: getPresentDaysData(),
              },
              {
                type: "leave",
                icon: "umbrella-beach",
                color: "#a855f7",
                bg: isDark
                  ? "rgba(168,85,247,0.1)"
                  : "#f3e8ff",
                value: stats.leaveDays,
                label: "Leave Days",
                data: getLeaveDaysData(),
              },
              {
                type: "hours",
                icon: "clock",
                color: "#f59e0b",
                bg: isDark
                  ? "rgba(245,158,11,0.1)"
                  : "#fef3c7",
                value: stats.totalHours.toFixed(1),
                label: "Total Hours",
                data: getHoursData(),
              },
            ].map((card) => (
              <Pressable
                key={card.type}
                style={[
                  styles.statCard,
                  { backgroundColor: card.bg },
                ]}
                onPress={() => handleStatPress(card.type, card.data)}
              >
                <MaterialCommunityIcons
                  name={card.icon}
                  size={24}
                  color={card.color}
                />
                <Text
                  style={[
                    styles.statNumber,
                    { color: isDark ? "#fff" : "#1e293b" },
                  ]}
                >
                  {card.value}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {card.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Calendar */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="calendar-heart"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? "#e2e8f0" : "#1e293b" },
              ]}
            >
              Attendance Calendar
            </Text>
          </View>

          <View
            style={[
              styles.calendarContainer,
              { backgroundColor: isDark ? "#1e293b" : "#fff" },
            ]}
          >
            <View style={styles.weekDays}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.weekDayText,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (!day)
                  return (
                    <View
                      key={`empty-${index}`}
                      style={styles.emptyDay}
                    />
                  );

                const hasAtt =
                  day.attendance?.time_in && day.attendance?.time_out;
                const isLeave = day.isLeave === true;
                const hours = hasAtt
                  ? calculateDurationInHours(
                      day.attendance.time_in,
                      day.attendance.time_out
                    )
                  : 0;

                let cellStyle = {};
                let dotColor = "";
                let textColor = "";

                if (isLeave) {
                  cellStyle = {
                    backgroundColor: getLeaveTypeColor(day.leaveType),
                  };
                  dotColor = getLeaveDotColor(day.leaveType);
                  textColor = isDark ? "#fff" : "#7e22ce";
                } else if (hasAtt) {
                  if (hours >= 8) {
                    cellStyle = {
                      backgroundColor: isDark ? "#15803d" : "#4ade80",
                    };
                    dotColor = "#10b981";
                    textColor = isDark ? "#fff" : "#15803d";
                  } else if (hours >= 4) {
                    cellStyle = {
                      backgroundColor: isDark ? "#166534" : "#86efac",
                    };
                    dotColor = "#22c55e";
                    textColor = isDark ? "#fff" : "#166534";
                  } else if (hours > 0) {
                    cellStyle = {
                      backgroundColor: isDark ? "#14532d" : "#bbf7d0",
                    };
                    dotColor = "#4ade80";
                    textColor = isDark ? "#fff" : "#14532d";
                  }
                }

                return (
                  <Pressable
                    key={day.date}
                    style={[
                      styles.dayCell,
                      day.isToday && styles.todayCell,
                      day.isSelected && styles.selectedCell,
                      (hasAtt || isLeave) && styles.attendanceCell,
                      cellStyle,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      setSelectedDay(
                        day.isSelected ? null : day.date
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        {
                          color: day.isSelected
                            ? "#fff"
                            : day.isToday
                            ? "#3b82f6"
                            : textColor ||
                              (isDark ? "#94a3b8" : "#64748b"),
                        },
                      ]}
                    >
                      {day.day}
                    </Text>
                    {(hasAtt || isLeave) && (
                      <View
                        style={[
                          styles.attendanceDot,
                          {
                            backgroundColor:
                              dotColor || "#10b981",
                          },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              {[
                {
                  color: isDark ? "#374151" : "#e5e7eb",
                  label: "No Data",
                },
                {
                  color: isDark ? "#14532d" : "#bbf7d0",
                  label: "Short Day",
                },
                {
                  color: isDark ? "#166534" : "#86efac",
                  label: "Half Day",
                },
                {
                  color: isDark ? "#15803d" : "#4ade80",
                  label: "Full Day",
                },
                {
                  color: isDark ? "#7e22ce" : "#e9d5ff",
                  label: "Leave",
                },
              ].map((item) => (
                <View key={item.label} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendColor,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.legendText,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Selected Day Details */}
          {selectedDayData && (
            <View
              style={[
                styles.detailCard,
                {
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                },
              ]}
            >
              <View style={styles.detailHeader}>
                <MaterialCommunityIcons
                  name={
                    selectedDayData.isLeave
                      ? "umbrella-beach"
                      : "calendar-star"
                  }
                  size={20}
                  color={
                    selectedDayData.isLeave ? "#a855f7" : "#3b82f6"
                  }
                />
                <Text
                  style={[
                    styles.detailTitle,
                    { color: isDark ? "#fff" : "#1e293b" },
                  ]}
                >
                  {dayjs(selectedDay).format("dddd, MMM DD, YYYY")}
                </Text>
              </View>

              {selectedDayData.isLeave ? (
                <View style={styles.detailLeaveContainer}>
                  <View
                    style={[
                      styles.leaveBadge,
                      {
                        backgroundColor: isDark
                          ? "#7e22ce"
                          : "#e9d5ff",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="umbrella-beach"
                      size={16}
                      color="#a855f7"
                    />
                    <Text
                      style={[
                        styles.leaveBadgeText,
                        {
                          color: isDark ? "#fff" : "#7e22ce",
                        },
                      ]}
                    >
                      {selectedDayData.leaveType || "Full Day"} Leave
                    </Text>
                  </View>
                  {selectedDayData.leaveReason ? (
                    <Text
                      style={[
                        styles.leaveReasonText,
                        { color: isDark ? "#e2e8f0" : "#1e293b" },
                      ]}
                    >
                      Reason: {selectedDayData.leaveReason}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.detailContent}>
                  {[
                    {
                      icon: "clock-in",
                      color: "#10b981",
                      label: "Check In",
                      value: formatTime(selectedDayData.time_in),
                    },
                    {
                      icon: "clock-out",
                      color: "#ef4444",
                      label: "Check Out",
                      value: formatTime(selectedDayData.time_out),
                    },
                    {
                      icon: "timer-outline",
                      color: "#3b82f6",
                      label: "Duration",
                      value: calculateDuration(
                        selectedDayData.time_in,
                        selectedDayData.time_out
                      ),
                    },
                  ].map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                      <View style={styles.detailIconContainer}>
                        <MaterialCommunityIcons
                          name={row.icon}
                          size={18}
                          color={row.color}
                        />
                      </View>
                      <Text
                        style={[
                          styles.detailLabel,
                          { color: isDark ? "#94a3b8" : "#64748b" },
                        ]}
                      >
                        {row.label}
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: isDark ? "#fff" : "#1e293b" },
                        ]}
                      >
                        {row.value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Weekly Bar Chart */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="chart-bar"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? "#e2e8f0" : "#1e293b" },
              ]}
            >
              Weekly Activity Breakdown
            </Text>
          </View>

          <View
            style={[
              styles.chartContainer,
              { backgroundColor: isDark ? "#1e293b" : "#fff" },
            ]}
          >
            {filteredHistory.length > 0 ? (
              <>
                <View style={styles.weekNavigation}>
                  <Pressable
                    style={styles.weekNavButton}
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      setSelectedWeek(Math.max(0, selectedWeek - 1));
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={24}
                      color={isDark ? "#60a5fa" : "#3b82f6"}
                    />
                  </Pressable>
                  <Text
                    style={[
                      styles.weekText,
                      { color: isDark ? "#fff" : "#1e293b" },
                    ]}
                  >
                    Week {selectedWeek + 1} of{" "}
                    {Math.max(
                      1,
                      Math.ceil(filteredHistory.length / 7)
                    )}
                  </Text>
                  <Pressable
                    style={styles.weekNavButton}
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      setSelectedWeek(
                        Math.min(
                          Math.ceil(filteredHistory.length / 7) - 1,
                          selectedWeek + 1
                        )
                      );
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={24}
                      color={isDark ? "#60a5fa" : "#3b82f6"}
                    />
                  </Pressable>
                </View>

                {getWeekData(selectedWeek).length > 0 && (
                  <Text
                    style={[
                      styles.weekRange,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    {getWeekRange(selectedWeek)}
                  </Text>
                )}

                <View style={styles.chartBars}>
                  {getWeekData(selectedWeek).map((day, index) => {
                    const hours = calculateDurationInHours(
                      day.time_in,
                      day.time_out
                    );
                    const isLeave = day.isLeave === true;
                    const barHeight = isLeave
                      ? 40
                      : Math.min((hours / 12) * 120, 120);

                    let gradientColors = ["#94a3b8", "#64748b"];
                    if (isLeave)
                      gradientColors = ["#a855f7", "#7e22ce"];
                    else if (hours >= 8)
                      gradientColors = ["#10b981", "#059669"];
                    else if (hours >= 4)
                      gradientColors = ["#f59e0b", "#d97706"];
                    else if (hours > 0)
                      gradientColors = ["#3b82f6", "#2563eb"];

                    return (
                      <View key={index} style={styles.chartColumn}>
                        <View style={styles.barContainer}>
                          {isLeave ? (
                            <View
                              style={[
                                styles.leaveBar,
                                { height: barHeight },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name="umbrella-beach"
                                size={20}
                                color="#a855f7"
                              />
                            </View>
                          ) : (
                            <LinearGradient
                              colors={gradientColors}
                              style={[
                                styles.bar,
                                { height: barHeight },
                              ]}
                              start={{ x: 0, y: 1 }}
                              end={{ x: 0, y: 0 }}
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.barLabel,
                            {
                              color: isDark
                                ? "#94a3b8"
                                : "#64748b",
                            },
                          ]}
                        >
                          {dayjs(day.date).format("DD")}
                        </Text>
                        <Text
                          style={[
                            styles.barValue,
                            {
                              color: isDark
                                ? "#fff"
                                : "#1e293b",
                            },
                          ]}
                        >
                          {isLeave
                            ? "Leave"
                            : `${hours.toFixed(1)}h`}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.chartLegend}>
                  {[
                    { color: "#3b82f6", label: "Short Day" },
                    { color: "#f59e0b", label: "Half Day" },
                    { color: "#10b981", label: "Full Day" },
                    { color: "#a855f7", label: "Leave" },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={styles.chartLegendItem}
                    >
                      <View
                        style={[
                          styles.chartLegendColor,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.chartLegendText,
                          {
                            color: isDark
                              ? "#94a3b8"
                              : "#64748b",
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.emptyChart}>
                <MaterialCommunityIcons
                  name="chart-line-variant"
                  size={48}
                  color={isDark ? "#475569" : "#cbd5e1"}
                />
                <Text
                  style={[
                    styles.emptyChartText,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  No attendance data for this month
                </Text>
              </View>
            )}
          </View>

          {/* Logout */}
          <Pressable
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && styles.logoutBtnPressed,
            ]}
            onPress={() => navigation.replace("Login")}
          >
            <MaterialCommunityIcons
              name="logout"
              size={20}
              color="#ef4444"
            />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "#1e293b" : "#fff",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? "#fff" : "#1e293b" },
                ]}
              >
                {modalTitle}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </Pressable>
            </View>

            {modalData.length > 0 ? (
              <FlatList
                data={modalData}
                renderItem={renderModalItem}
                keyExtractor={(_, i) => i.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalList}
              />
            ) : (
              <View style={styles.modalEmpty}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={48}
                  color={isDark ? "#475569" : "#cbd5e1"}
                />
                <Text
                  style={[
                    styles.modalEmptyText,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  No data available
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* auto-reload banner */
  autoLoadBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  autoLoadText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
    opacity: 0.85,
  },

  headerGradient: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  headerContent: { gap: 20 },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  statusBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 3,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userId: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 24,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  todayCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  yesterdayCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  yesterdayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  yesterdayTitle: { fontSize: 14, fontWeight: "600" },
  yesterdayContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  yesterdayAttendance: { flex: 1, gap: 8 },
  yesterdayTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  yesterdayTime: { fontSize: 13, fontWeight: "500" },
  yesterdayNoData: { fontSize: 13, fontStyle: "italic" },
  yesterdayReason: { fontSize: 13, flex: 1 },
  todayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)",
  },
  todayDate: { fontSize: 16, fontWeight: "600" },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: { backgroundColor: "rgba(16,185,129,0.1)" },
  statusInactive: { backgroundColor: "rgba(100,116,139,0.1)" },
  statusLeave: { backgroundColor: "rgba(168,85,247,0.1)" },
  statusChipDot: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { fontSize: 12, fontWeight: "600" },
  todayGrid: { flexDirection: "row", gap: 12 },
  timeBlock: { flex: 1, alignItems: "center", gap: 8 },
  timeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  timeLabel: { fontSize: 12, fontWeight: "500" },
  timeValue: { fontSize: 14, fontWeight: "700" },
  leaveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  leaveIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  leaveInfo: { flex: 1, gap: 4 },
  leaveTitle: { fontSize: 18, fontWeight: "700" },
  leaveReason: { fontSize: 14 },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  monthDisplay: { flex: 1, alignItems: "center" },
  monthText: { fontSize: 18, fontWeight: "600" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (width - 52) / 2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  statNumber: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  calendarContainer: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  weekDayText: {
    fontSize: 14,
    fontWeight: "500",
    width: Math.floor((CALENDAR_WIDTH - 64) / 7),
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 16,
  },
  emptyDay: { width: DAY_SIZE, height: DAY_SIZE },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  todayCell: { borderWidth: 2, borderColor: "#3b82f6" },
  selectedCell: { backgroundColor: "#3b82f6" },
  attendanceCell: { borderRadius: 8 },
  dayText: { fontSize: 14, fontWeight: "500" },
  attendanceDot: {
    position: "absolute",
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.2)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendColor: { width: 12, height: 12, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: "500" },
  detailCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)",
  },
  detailTitle: { fontSize: 16, fontWeight: "600" },
  detailContent: { gap: 12 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.1)",
  },
  detailLabel: { fontSize: 14, fontWeight: "500", flex: 1 },
  detailValue: { fontSize: 14, fontWeight: "600" },
  detailLeaveContainer: { gap: 12, paddingVertical: 8 },
  leaveBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  leaveBadgeText: { fontSize: 14, fontWeight: "600" },
  leaveReasonText: { fontSize: 14, lineHeight: 20 },
  chartContainer: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  weekNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  weekNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  weekText: { fontSize: 16, fontWeight: "600" },
  weekRange: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    fontStyle: "italic",
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 160,
    marginBottom: 20,
  },
  chartColumn: { alignItems: "center", gap: 8 },
  barContainer: { height: 120, justifyContent: "flex-end" },
  bar: { width: 24, borderRadius: 6 },
  leaveBar: {
    width: 24,
    borderRadius: 6,
    backgroundColor: "rgba(168,85,247,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a855f7",
    borderStyle: "dashed",
  },
  barLabel: { fontSize: 12, fontWeight: "500" },
  barValue: { fontSize: 12, fontWeight: "600" },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.2)",
  },
  chartLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartLegendColor: { width: 12, height: 12, borderRadius: 4 },
  chartLegendText: { fontSize: 12, fontWeight: "500" },
  emptyChart: { alignItems: "center", padding: 40, gap: 12 },
  emptyChartText: { fontSize: 15, textAlign: "center" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  logoutBtnPressed: { opacity: 0.7 },
  logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalList: { paddingBottom: 20 },
  modalItem: { paddingVertical: 16, borderBottomWidth: 1 },
  modalItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  modalItemDate: { fontSize: 15, fontWeight: "600" },
  modalItemDetails: { marginLeft: 28, gap: 8 },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalDetailLabel: {
    fontSize: 13,
    fontWeight: "500",
    width: 80,
  },
  modalDetailValue: { fontSize: 13, fontWeight: "600" },
  modalEmpty: { alignItems: "center", padding: 40, gap: 12 },
  modalEmptyText: { fontSize: 15, textAlign: "center" },
});