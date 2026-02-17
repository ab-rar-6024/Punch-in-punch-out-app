import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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
const DAY_SIZE = (CALENDAR_WIDTH - 48) / 7;

export default function HistoryScreen({ route, navigation }) {
  const { isDark } = useTheme();
  const { user = {}, hist = [] } = route.params || {};

  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month());
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Reset selected week when month changes
  useEffect(() => {
    setSelectedWeek(0);
  }, [selectedMonth, selectedYear]);

  const processHistory = () => {
    if (!hist) return [];
    
    let data = [];
    
    // Handle different API response structures
    if (hist.attendance && Array.isArray(hist.attendance)) {
      data = hist.attendance;
      // If there's a separate leaves array, include it
      if (hist.leaves && Array.isArray(hist.leaves)) {
        data = [...data, ...hist.leaves];
      }
    } else if (Array.isArray(hist)) {
      data = hist;
    } else {
      return [];
    }
    
    // Process each record
    const processedData = data.map(record => {
      // Check if this is a leave record based on your actual data structure
      const isLeave = 
        record.absent === true || 
        record.status === 'absent' ||
        record.status === 'leave' ||
        record.type === 'leave' ||
        (record.reason && !record.time_in && !record.time_out) ||
        (record.from_date && record.to_date) ||
        record.is_leave === true ||
        record.leave === true;
      
      // For leave records, create a proper date field
      let date = record.date;
      if (!date && record.from_date) {
        date = record.from_date;
      }
      
      // Get leave reason
      let leaveReason = '';
      if (isLeave) {
        leaveReason = record.reason || record.leave_reason || record.remarks || 'Leave';
      }
      
      // Get leave type
      let leaveType = 'Full Day';
      if (record.leave_type) {
        leaveType = record.leave_type;
      } else if (record.half_day) {
        leaveType = 'Half Day';
      } else if (record.short_leave) {
        leaveType = 'Short Leave';
      }
      
      return {
        ...record,
        date: date,
        isLeave: isLeave,
        leaveType: leaveType,
        leaveReason: leaveReason,
        // Ensure time_in/time_out are null for leave records
        time_in: isLeave ? null : record.time_in,
        time_out: isLeave ? null : record.time_out
      };
    }).filter(record => record.date); // Only keep records with a valid date
    
    // Remove duplicates (keep attendance over leave if both exist)
    const uniqueData = [];
    const dateMap = new Map();
    
    processedData.forEach(record => {
      const existing = dateMap.get(record.date);
      if (!existing) {
        dateMap.set(record.date, record);
        uniqueData.push(record);
      } else {
        // If we have both attendance and leave for same date, keep attendance
        if (!existing.isLeave && record.isLeave) {
          // Keep existing attendance, ignore leave
        } else if (existing.isLeave && !record.isLeave) {
          // Replace leave with attendance
          const index = uniqueData.indexOf(existing);
          uniqueData[index] = record;
          dateMap.set(record.date, record);
        }
      }
    });
    
    
    return uniqueData;
  };

  const historyData = processHistory();
  
  const todayStr = dayjs().format("YYYY-MM-DD");
  const yesterdayStr = dayjs().subtract(1, 'day').format("YYYY-MM-DD");
  const todayRec = historyData.find((d) => d.date === todayStr) || {};
  const yesterdayRec = historyData.find((d) => d.date === yesterdayStr) || {};


  // Filter history for selected month
  const filteredHistory = historyData.filter(record => {
    if (!record.date) return false;
    const recordDate = dayjs(record.date);
    return recordDate.month() === selectedMonth && 
           recordDate.year() === selectedYear;
  });

  // Helper function to get week data
  const getWeekData = (weekIndex) => {
    const startIndex = weekIndex * 7;
    return filteredHistory.slice(startIndex, startIndex + 7);
  };

  // Helper function to get week range display
  const getWeekRange = (weekIndex) => {
    const weekData = getWeekData(weekIndex);
    if (weekData.length === 0) return '';
    
    const firstDay = dayjs(weekData[0].date);
    const lastDay = dayjs(weekData[weekData.length - 1].date);
    
    return `${firstDay.format('MMM DD')} - ${lastDay.format('MMM DD, YYYY')}`;
  };

  // Calculate stats including leaves
  const calculateStats = () => {
    const totalDays = filteredHistory.length;
    const presentDays = filteredHistory.filter(d => d.time_in && d.time_out).length;
    const leaveDays = filteredHistory.filter(d => d.isLeave === true).length;
    const totalHours = filteredHistory.reduce((sum, day) => {
      const duration = calculateDurationInHours(day.time_in, day.time_out);
      return sum + duration;
    }, 0);
    const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0;
  
    
    return { totalDays, presentDays, leaveDays, totalHours, avgHours };
  };

  const calculateDurationInHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return 0;
    try {
      const parseTime = (timeStr) => {
        timeStr = timeStr.trim();
        if (timeStr.includes("AM") || timeStr.includes("PM")) {
          return dayjs(`2000-01-01 ${timeStr}`, "YYYY-MM-DD h:mm A");
        } else {
          return dayjs(`2000-01-01 ${timeStr}`, "YYYY-MM-DD HH:mm");
        }
      };
      
      const start = parseTime(timeIn);
      const end = parseTime(timeOut);
      
      if (!start || !end || !start.isValid() || !end.isValid()) return 0;
      
      let duration = end.diff(start, "minute");
      if (duration < 0) duration += (24 * 60);
      
      return duration / 60;
    } catch (error) {
      return 0;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === "—") return "—";
    try {
      timeStr = timeStr.trim();
      if (timeStr.includes("AM") || timeStr.includes("PM")) {
        return timeStr;
      }
      const time = dayjs(`2000-01-01 ${timeStr}`, "YYYY-MM-DD HH:mm");
      return time.isValid() ? time.format("h:mm A") : "—";
    } catch (error) {
      return "—";
    }
  };

  const calculateDuration = (timeIn, timeOut) => {
    const hours = calculateDurationInHours(timeIn, timeOut);
    if (hours === 0) return "—";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      const { getHistory } = require("../api");
      const newHist = await getHistory(user.id);
      navigation.setParams({ hist: newHist });
    } catch (error) {
      console.error("Refresh error:", error);
    }
    setTimeout(() => setRefreshing(false), 1500);
  };

  const changeMonth = (direction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (direction === 'prev') {
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

  const getMonthName = (monthIndex) => {
    return dayjs().month(monthIndex).format('MMMM');
  };

  const getAttendanceForDate = (dateStr) => {
    return historyData.find(d => d.date === dateStr);
  };

  // Generate calendar days for selected month
  const generateCalendarDays = () => {
    const daysInMonth = dayjs(`${selectedYear}-${selectedMonth + 1}-01`).daysInMonth();
    const firstDayOfMonth = dayjs(`${selectedYear}-${selectedMonth + 1}-01`).day();
    
    const days = [];
    
    // Add empty days for padding
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const attendance = getAttendanceForDate(dateStr);
      const isToday = dateStr === todayStr;
      const isYesterday = dateStr === yesterdayStr;
      const isSelected = selectedDay === dateStr;
      
      // Check if it's a leave
      const isLeave = attendance?.isLeave === true;
      const leaveType = attendance?.leaveType || 'Full Day';
      const leaveReason = attendance?.leaveReason || attendance?.reason || '';
      
      days.push({
        date: dateStr,
        day: i,
        attendance,
        isToday,
        isYesterday,
        isSelected,
        isLeave,
        leaveType,
        leaveReason
      });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const stats = calculateStats();
  const selectedDayData = selectedDay ? getAttendanceForDate(selectedDay) : null;

  const getLeaveTypeColor = (leaveType, isDark) => {
    switch(leaveType) {
      case 'Full Day':
        return isDark ? '#7e22ce' : '#e9d5ff';
      case 'Half Day':
        return isDark ? '#6b21a8' : '#f3e8ff';
      case 'Short Leave':
        return isDark ? '#581c87' : '#fae8ff';
      default:
        return isDark ? '#7e22ce' : '#e9d5ff';
    }
  };

  const getLeaveDotColor = (leaveType) => {
    switch(leaveType) {
      case 'Full Day':
        return '#a855f7';
      case 'Half Day':
        return '#c084fc';
      case 'Short Leave':
        return '#e879f9';
      default:
        return '#a855f7';
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
      ]}
    >
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1e293b", "#334155"] : ["#3b82f6", "#2563eb"]}
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
              <Text style={styles.userName}>{user.name || "Unknown User"}</Text>
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
          {/* Today's Attendance Card */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="calendar-today"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[styles.sectionTitle, { color: isDark ? "#e2e8f0" : "#1e293b" }]}
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
              <Text style={[styles.todayDate, { color: isDark ? "#fff" : "#111" }]}>
                {dayjs().format("dddd, MMM DD, YYYY")}
              </Text>
              <View
                style={[
                  styles.statusChip,
                  todayRec.isLeave ? styles.statusLeave :
                  todayRec.time_in ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <View
                  style={[
                    styles.statusChipDot,
                    {
                      backgroundColor: todayRec.isLeave ? "#a855f7" :
                                      todayRec.time_in ? "#10b981" : "#64748b",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusChipText,
                    {
                      color: todayRec.isLeave ? "#a855f7" :
                             todayRec.time_in ? "#10b981" : "#64748b",
                    },
                  ]}
                >
                  {todayRec.isLeave ? "On Leave" : 
                   todayRec.time_in ? "Active" : "Not Checked In"}
                </Text>
              </View>
            </View>

            {todayRec.isLeave ? (
              <View style={styles.leaveContainer}>
                <View style={[styles.leaveIconContainer, { backgroundColor: isDark ? '#7e22ce' : '#e9d5ff' }]}>
                  <MaterialCommunityIcons name="beach" size={32} color="#a855f7" />
                </View>
                <View style={styles.leaveInfo}>
                  <Text style={[styles.leaveTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                    {todayRec.leaveType || 'Full Day'} Leave
                  </Text>
                  {todayRec.leaveReason && (
                    <Text style={[styles.leaveReason, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Reason: {todayRec.leaveReason}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.todayGrid}>
                <View style={styles.timeBlock}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: isDark ? "#064e3b" : "#d1fae5" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="clock-in"
                      size={24}
                      color="#10b981"
                    />
                  </View>
                  <Text
                    style={[styles.timeLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}
                  >
                    Check In
                  </Text>
                  <Text
                    style={[
                      styles.timeValue,
                      { color: isDark ? "#fff" : "#111" },
                    ]}
                  >
                    {formatTime(todayRec.time_in)}
                  </Text>
                </View>

                <View style={styles.timeBlock}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: isDark ? "#7f1d1d" : "#fee2e2" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="clock-out"
                      size={24}
                      color="#ef4444"
                    />
                  </View>
                  <Text
                    style={[styles.timeLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}
                  >
                    Check Out
                  </Text>
                  <Text
                    style={[
                      styles.timeValue,
                      { color: isDark ? "#fff" : "#111" },
                    ]}
                  >
                    {formatTime(todayRec.time_out)}
                  </Text>
                </View>

                <View style={styles.timeBlock}>
                  <View
                    style={[
                      styles.timeIcon,
                      { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="timer-outline"
                      size={24}
                      color="#3b82f6"
                    />
                  </View>
                  <Text
                    style={[styles.timeLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}
                  >
                    Duration
                  </Text>
                  <Text
                    style={[
                      styles.timeValue,
                      { color: isDark ? "#fff" : "#111" },
                    ]}
                  >
                    {calculateDuration(todayRec.time_in, todayRec.time_out)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Yesterday's Summary - Always show if we have data for yesterday */}
          {yesterdayRec && Object.keys(yesterdayRec).length > 0 && (
            <View style={[styles.yesterdayCard, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e5e7eb' }]}>
              <View style={styles.yesterdayHeader}>
                <MaterialCommunityIcons name="calendar-arrow-left" size={18} color={yesterdayRec.isLeave ? "#a855f7" : "#3b82f6"} />
                <Text style={[styles.yesterdayTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                  Yesterday's Summary
                </Text>
              </View>
              <View style={styles.yesterdayContent}>
                {yesterdayRec.isLeave ? (
                  <>
                    <View style={[styles.leaveBadge, { backgroundColor: isDark ? '#7e22ce' : '#e9d5ff' }]}>
                      <MaterialCommunityIcons name="beach" size={14} color="#a855f7" />
                      <Text style={[styles.leaveBadgeText, { color: isDark ? '#fff' : '#7e22ce' }]}>
                        {yesterdayRec.leaveType || 'Full Day'} Leave
                      </Text>
                    </View>
                    {yesterdayRec.leaveReason && (
                      <Text style={[styles.yesterdayReason, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                        {yesterdayRec.leaveReason}
                      </Text>
                    )}
                  </>
                ) : yesterdayRec.time_in ? (
                  <View style={styles.yesterdayAttendance}>
                    <View style={styles.yesterdayTimeRow}>
                      <MaterialCommunityIcons name="clock-in" size={14} color="#10b981" />
                      <Text style={[styles.yesterdayTime, { color: isDark ? '#fff' : '#1e293b' }]}>
                        In: {formatTime(yesterdayRec.time_in)}
                      </Text>
                    </View>
                    <View style={styles.yesterdayTimeRow}>
                      <MaterialCommunityIcons name="clock-out" size={14} color="#ef4444" />
                      <Text style={[styles.yesterdayTime, { color: isDark ? '#fff' : '#1e293b' }]}>
                        Out: {formatTime(yesterdayRec.time_out)}
                      </Text>
                    </View>
                    <View style={styles.yesterdayTimeRow}>
                      <MaterialCommunityIcons name="timer-outline" size={14} color="#3b82f6" />
                      <Text style={[styles.yesterdayTime, { color: isDark ? '#fff' : '#1e293b' }]}>
                        Duration: {calculateDuration(yesterdayRec.time_in, yesterdayRec.time_out)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.yesterdayNoData, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    No attendance record for yesterday
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Monthly Statistics Cards */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="chart-box"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[styles.sectionTitle, { color: isDark ? "#e2e8f0" : "#1e293b" }]}
            >
              Monthly Overview
            </Text>
          </View>

          <View style={styles.monthSelector}>
            <Pressable 
              style={styles.monthNavButton}
              onPress={() => changeMonth('prev')}
            >
              <MaterialCommunityIcons 
                name="chevron-left" 
                size={24} 
                color={isDark ? "#60a5fa" : "#3b82f6"} 
              />
            </Pressable>
            
            <View style={styles.monthDisplay}>
              <Text style={[styles.monthText, { color: isDark ? "#fff" : "#1e293b" }]}>
                {getMonthName(selectedMonth)} {selectedYear}
              </Text>
            </View>
            
            <Pressable 
              style={styles.monthNavButton}
              onPress={() => changeMonth('next')}
            >
              <MaterialCommunityIcons 
                name="chevron-right" 
                size={24} 
                color={isDark ? "#60a5fa" : "#3b82f6"} 
              />
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#dbeafe' }]}>
              <MaterialCommunityIcons name="calendar-multiselect" size={24} color="#3b82f6" />
              <Text style={[styles.statNumber, { color: isDark ? '#fff' : '#1e293b' }]}>
                {stats.totalDays}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Working Days
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#d1fae5' }]}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
              <Text style={[styles.statNumber, { color: isDark ? '#fff' : '#1e293b' }]}>
                {stats.presentDays}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Days Present
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : '#f3e8ff' }]}>
              <MaterialCommunityIcons name="beach" size={24} color="#a855f7" />
              <Text style={[styles.statNumber, { color: isDark ? '#fff' : '#1e293b' }]}>
                {stats.leaveDays}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Leave Days
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fef3c7' }]}>
              <MaterialCommunityIcons name="clock" size={24} color="#f59e0b" />
              <Text style={[styles.statNumber, { color: isDark ? '#fff' : '#1e293b' }]}>
                {stats.totalHours.toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Total Hours
              </Text>
            </View>
          </View>

          {/* Calendar Heatmap */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="calendar-heart"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[styles.sectionTitle, { color: isDark ? "#e2e8f0" : "#1e293b" }]}
            >
              Attendance Calendar
            </Text>
          </View>

          <View style={[styles.calendarContainer, { backgroundColor: isDark ? "#1e293b" : "#fff" }]}>
            <View style={styles.weekDays}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <Text key={idx} style={[styles.weekDayText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.emptyDay} />;
                }
                
                const hasAttendance = day.attendance && day.attendance.time_in && day.attendance.time_out;
                const isLeave = day.isLeave === true;
                const hours = hasAttendance ? 
                  calculateDurationInHours(day.attendance.time_in, day.attendance.time_out) : 0;
                
                let cellStyle = {};
                let dotColor = '';
                let textColor = '';
                
                if (isLeave) {
                  cellStyle = { backgroundColor: getLeaveTypeColor(day.leaveType, isDark) };
                  dotColor = getLeaveDotColor(day.leaveType);
                  textColor = isDark ? '#fff' : '#7e22ce';
                } else if (hasAttendance) {
                  if (hours >= 8) {
                    cellStyle = { backgroundColor: isDark ? '#15803d' : '#4ade80' };
                    dotColor = '#10b981';
                    textColor = isDark ? '#fff' : '#15803d';
                  } else if (hours >= 4) {
                    cellStyle = { backgroundColor: isDark ? '#166534' : '#86efac' };
                    dotColor = '#22c55e';
                    textColor = isDark ? '#fff' : '#166534';
                  } else if (hours > 0) {
                    cellStyle = { backgroundColor: isDark ? '#14532d' : '#bbf7d0' };
                    dotColor = '#4ade80';
                    textColor = isDark ? '#fff' : '#14532d';
                  }
                }
                
                return (
                  <Pressable
                    key={day.date}
                    style={[
                      styles.dayCell,
                      day.isToday && styles.todayCell,
                      day.isSelected && styles.selectedCell,
                      (hasAttendance || isLeave) && styles.attendanceCell,
                      cellStyle,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDay(day.isSelected ? null : day.date);
                    }}
                  >
                    <Text style={[
                      styles.dayText,
                      { 
                        color: day.isSelected ? '#fff' :
                              day.isToday ? '#3b82f6' :
                              textColor || (isDark ? '#94a3b8' : '#64748b')
                      }
                    ]}>
                      {day.day}
                    </Text>
                    {(hasAttendance || isLeave) && (
                      <View style={[
                        styles.attendanceDot,
                        { backgroundColor: dotColor || '#10b981' }
                      ]} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
                <Text style={[styles.legendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>No Data</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: isDark ? '#14532d' : '#bbf7d0' }]} />
                <Text style={[styles.legendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Short Day</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: isDark ? '#166534' : '#86efac' }]} />
                <Text style={[styles.legendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Half Day</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: isDark ? '#15803d' : '#4ade80' }]} />
                <Text style={[styles.legendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Full Day</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: isDark ? '#7e22ce' : '#e9d5ff' }]} />
                <Text style={[styles.legendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Leave</Text>
              </View>
            </View>
          </View>

          {/* Selected Day Details */}
          {selectedDayData && (
            <View style={[styles.detailCard, { backgroundColor: isDark ? "#1e293b" : "#fff" }]}>
              <View style={styles.detailHeader}>
                <MaterialCommunityIcons 
                  name={selectedDayData.isLeave ? "beach" : "calendar-star"} 
                  size={20} 
                  color={selectedDayData.isLeave ? "#a855f7" : "#3b82f6"} 
                />
                <Text style={[styles.detailTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                  {dayjs(selectedDay).format("dddd, MMM DD, YYYY")}
                </Text>
              </View>
              
              {selectedDayData.isLeave ? (
                <View style={styles.detailLeaveContainer}>
                  <View style={[styles.leaveBadge, { backgroundColor: isDark ? '#7e22ce' : '#e9d5ff' }]}>
                    <MaterialCommunityIcons name="beach" size={16} color="#a855f7" />
                    <Text style={[styles.leaveBadgeText, { color: isDark ? '#fff' : '#7e22ce' }]}>
                      {selectedDayData.leaveType || 'Full Day'} Leave
                    </Text>
                  </View>
                  {selectedDayData.leaveReason && (
                    <Text style={[styles.leaveReasonText, { color: isDark ? '#e2e8f0' : '#1e293b' }]}>
                      Reason: {selectedDayData.leaveReason}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.detailContent}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <MaterialCommunityIcons name="clock-in" size={18} color="#10b981" />
                    </View>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Check In</Text>
                    <Text style={[styles.detailValue, { color: isDark ? '#fff' : '#1e293b' }]}>
                      {formatTime(selectedDayData.time_in)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <MaterialCommunityIcons name="clock-out" size={18} color="#ef4444" />
                    </View>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Check Out</Text>
                    <Text style={[styles.detailValue, { color: isDark ? '#fff' : '#1e293b' }]}>
                      {formatTime(selectedDayData.time_out)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <MaterialCommunityIcons name="timer-outline" size={18} color="#3b82f6" />
                    </View>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Duration</Text>
                    <Text style={[styles.detailValue, { color: isDark ? '#fff' : '#1e293b' }]}>
                      {calculateDuration(selectedDayData.time_in, selectedDayData.time_out)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Bar Chart Visualization with Leaves */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="chart-bar"
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[styles.sectionTitle, { color: isDark ? "#e2e8f0" : "#1e293b" }]}
            >
              Weekly Activity Breakdown
            </Text>
          </View>

          <View style={[styles.chartContainer, { backgroundColor: isDark ? "#1e293b" : "#fff" }]}>
            {filteredHistory.length > 0 ? (
              <>
                {/* Week Navigation */}
                <View style={styles.weekNavigation}>
                  <Pressable 
                    style={styles.weekNavButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedWeek(Math.max(0, selectedWeek - 1));
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="chevron-left" 
                      size={24} 
                      color={isDark ? "#60a5fa" : "#3b82f6"} 
                    />
                  </Pressable>
                  
                  <Text style={[styles.weekText, { color: isDark ? "#fff" : "#1e293b" }]}>
                    Week {selectedWeek + 1} of {Math.max(1, Math.ceil(filteredHistory.length / 7))}
                  </Text>
                  
                  <Pressable 
                    style={styles.weekNavButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedWeek(Math.min(Math.ceil(filteredHistory.length / 7) - 1, selectedWeek + 1));
                    }}
                  >
                    <MaterialCommunityIcons 
                      name="chevron-right" 
                      size={24} 
                      color={isDark ? "#60a5fa" : "#3b82f6"} 
                    />
                  </Pressable>
                </View>

                {/* Week Range Display */}
                {getWeekData(selectedWeek).length > 0 && (
                  <Text style={[styles.weekRange, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    {getWeekRange(selectedWeek)}
                  </Text>
                )}

                {/* Chart Bars */}
                <View style={styles.chartBars}>
                  {getWeekData(selectedWeek).map((day, index) => {
                    const hours = calculateDurationInHours(day.time_in, day.time_out);
                    const isLeave = day.isLeave === true;
                    const maxHours = 12;
                    const barHeight = isLeave ? 40 : Math.min((hours / maxHours) * 120, 120);
                    
                    let gradientColors = ['#94a3b8', '#64748b'];
                    if (isLeave) {
                      gradientColors = ['#a855f7', '#7e22ce'];
                    } else if (hours >= 8) {
                      gradientColors = ['#10b981', '#059669'];
                    } else if (hours >= 4) {
                      gradientColors = ['#f59e0b', '#d97706'];
                    } else if (hours > 0) {
                      gradientColors = ['#3b82f6', '#2563eb'];
                    }
                    
                    return (
                      <View key={index} style={styles.chartColumn}>
                        <View style={styles.barContainer}>
                          {isLeave ? (
                            <View style={[styles.leaveBar, { height: barHeight }]}>
                              <MaterialCommunityIcons name="beach" size={20} color="#a855f7" />
                            </View>
                          ) : (
                            <LinearGradient
                              colors={gradientColors}
                              style={[styles.bar, { height: barHeight }]}
                              start={{ x: 0, y: 1 }}
                              end={{ x: 0, y: 0 }}
                            />
                          )}
                        </View>
                        <Text style={[styles.barLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                          {dayjs(day.date).format('DD')}
                        </Text>
                        <Text style={[styles.barValue, { color: isDark ? '#fff' : '#1e293b' }]}>
                          {isLeave ? 'Leave' : `${hours.toFixed(1)}h`}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Empty days placeholder if week has less than 7 days */}
                {getWeekData(selectedWeek).length < 7 && getWeekData(selectedWeek).length > 0 && (
                  <View style={styles.emptyDaysMessage}>
                    <Text style={[styles.emptyDaysText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {7 - getWeekData(selectedWeek).length} more day(s) in this week
                    </Text>
                  </View>
                )}

                <View style={styles.chartLegend}>
                  <View style={styles.chartLegendItem}>
                    <View style={[styles.chartLegendColor, { backgroundColor: '#3b82f6' }]} />
                    <Text style={[styles.chartLegendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Short Day
                    </Text>
                  </View>
                  <View style={styles.chartLegendItem}>
                    <View style={[styles.chartLegendColor, { backgroundColor: '#f59e0b' }]} />
                    <Text style={[styles.chartLegendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Half Day
                    </Text>
                  </View>
                  <View style={styles.chartLegendItem}>
                    <View style={[styles.chartLegendColor, { backgroundColor: '#10b981' }]} />
                    <Text style={[styles.chartLegendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Full Day
                    </Text>
                  </View>
                  <View style={styles.chartLegendItem}>
                    <View style={[styles.chartLegendColor, { backgroundColor: '#a855f7' }]} />
                    <Text style={[styles.chartLegendText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Leave
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyChart}>
                <MaterialCommunityIcons name="chart-line-variant" size={48} color={isDark ? "#475569" : "#cbd5e1"} />
                <Text style={[styles.emptyChartText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  No attendance data for this month
                </Text>
              </View>
            )}
          </View>

          {/* Logout Button */}
          <Pressable
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && styles.logoutBtnPressed,
            ]}
            onPress={() => navigation.replace("Login")}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerContent: {
    gap: 20,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userId: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  yesterdayTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  yesterdayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  yesterdayAttendance: {
    flex: 1,
    gap: 8,
  },
  yesterdayTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yesterdayTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  yesterdayNoData: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  yesterdayReason: {
    fontSize: 13,
    flex: 1,
  },
  todayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  todayDate: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  statusInactive: {
    backgroundColor: "rgba(100, 116, 139, 0.1)",
  },
  statusLeave: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
  },
  statusChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  todayGrid: {
    flexDirection: "row",
    gap: 12,
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  timeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  leaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  leaveIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveInfo: {
    flex: 1,
    gap: 4,
  },
  leaveTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  leaveReason: {
    fontSize: 14,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (width - 52) / 2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  calendarContainer: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  weekDayText: {
    fontSize: 14,
    fontWeight: '500',
    width: DAY_SIZE,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 16,
  },
  emptyDay: {
    width: DAY_SIZE,
    height: DAY_SIZE,
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  selectedCell: {
    backgroundColor: '#3b82f6',
  },
  attendanceCell: {
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  attendanceDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailContent: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailLeaveContainer: {
    gap: 12,
    paddingVertical: 8,
  },
  leaveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  leaveBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  leaveReasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chartContainer: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  weekText: {
    fontSize: 16,
    fontWeight: '600',
  },
  weekRange: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  emptyDaysMessage: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  emptyDaysText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    marginBottom: 20,
  },
  chartColumn: {
    alignItems: 'center',
    gap: 8,
  },
  barContainer: {
    height: 120,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    borderRadius: 6,
  },
  leaveBar: {
    width: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a855f7',
    borderStyle: 'dashed',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  chartLegendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyChart: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyChartText: {
    fontSize: 15,
    textAlign: 'center',
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutBtnPressed: {
    opacity: 0.7,
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
});