import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useTheme } from "./ThemeContext";
const { width } = Dimensions.get("window");

export default function CalendarScreen() {
  const { isDark } = useTheme();
  const [selected, setSelected] = useState("");
  const [notes, setNotes] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState({ total: 0, thisMonth: 0 });
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const calendarScrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  // Load saved notes
  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const stored = await AsyncStorage.getItem("calendar_notes");
      if (stored) {
        const parsedNotes = JSON.parse(stored);
        setNotes(parsedNotes);
        calculateStats(parsedNotes);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  // Calculate statistics
  const calculateStats = (notesData) => {
    const total = Object.keys(notesData).length;
    const thisMonth = Object.keys(notesData).filter(date => 
      date.startsWith(selectedMonth)
    ).length;
    setStats({ total, thisMonth });
  };

  // Save to storage
  const saveToStorage = async (updated) => {
    try {
      setNotes(updated);
      calculateStats(updated);
      await AsyncStorage.setItem("calendar_notes", JSON.stringify(updated));
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  };

  // When a day is pressed
  const onDayPress = (day) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setSelected(day.dateString);
    setNoteText(notes[day.dateString] || "");
    setModalVisible(true);
    
    // Reset animations
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    slideAnim.setValue(50);
    
    // Smooth iOS-style entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Save note with animation
  const saveNote = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const updated = { ...notes, [selected]: noteText };
    await saveToStorage(updated);
    
    // Smooth exit animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };

  // Delete note
  const deleteNote = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    const updated = { ...notes };
    delete updated[selected];
    await saveToStorage(updated);
    closeModal();
  };

  // Close modal
  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle scroll
  const handleScroll = (event) => {
    calendarScrollY.setValue(event.nativeEvent.contentOffset.y);
  };

  const headerOpacity = calendarScrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Handle month change in calendar
  const handleMonthChange = (month) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth(month.dateString.slice(0, 7));
  };

  // Get marked dates for calendar
  const getMarkedDates = () => {
    const markedDates = {};
    
    // Add marks for all dates with notes
    Object.keys(notes).forEach(date => {
      markedDates[date] = {
        marked: true,
        dotColor: "#007AFF",
        dotScale: 1.2,
      };
    });
    
    // Add selection for currently selected date
    if (selected) {
      markedDates[selected] = {
        ...markedDates[selected],
        selected: true,
        selectedColor: "#007AFF",
        selectedTextColor: "#FFFFFF",
      };
    }
    
    return markedDates;
  };

  // Calendar theme that updates when isDark changes
  const calendarTheme = {
    // Common properties
    todayTextColor: "#007AFF",
    selectedDayBackgroundColor: "#007AFF",
    selectedDayTextColor: "#FFFFFF",
    arrowColor: "#007AFF",
    textSectionTitleColor: "#8e8e93",
    textDayFontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    textMonthFontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    textDayHeaderFontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    textDayFontWeight: '400',
    textMonthFontWeight: '600',
    textDayHeaderFontWeight: '600',
    textDayFontSize: 16,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 13,
    
    // Dynamic properties based on theme
    backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
    calendarBackground: isDark ? "#1c1c1e" : "#ffffff",
    dayTextColor: isDark ? "#ffffff" : "#000000",
    monthTextColor: isDark ? "#ffffff" : "#000000",
    textDisabledColor: isDark ? "#3a3a3c" : "#c7c7cc",
  };

  // Force re-render key for calendar
  const calendarKey = `calendar-${isDark ? 'dark' : 'light'}`;

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDark ? "#000000" : "#F2F2F7" }
    ]}>
      {/* iOS-style Header with scroll animation */}
      <Animated.View style={[
        styles.headerContainer,
        { opacity: headerOpacity },
      ]}>
        <BlurView 
          intensity={isDark ? 50 : 80} 
          tint={isDark ? "dark" : "light"}
          style={styles.headerBlur}
        >
          <View style={styles.headerContent}>
            <Text style={[
              styles.headerText,
              { color: isDark ? "#FFFFFF" : "#000000" }
            ]}>
              Calendar
            </Text>
            <View style={styles.headerSubtitle}>
              <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
              <Text style={styles.subtitleText}>
                {stats.total} notes • {stats.thisMonth} this month
              </Text>
            </View>
          </View>
        </BlurView>
      </Animated.View>

      <ScrollView 
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.content}>
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={[
              styles.statCard,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }
            ]}>
              <LinearGradient
                colors={isDark ? ["#007AFF", "#5856D6"] : ["#007AFF", "#34C759"]}
                style={styles.statIcon}
              >
                <Ionicons name="calendar" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.statInfo}>
                <Text style={[
                  styles.statNumber,
                  { color: isDark ? "#FFFFFF" : "#000000" }
                ]}>
                  {stats.thisMonth}
                </Text>
                <Text style={styles.statLabel}>
                  This Month
                </Text>
              </View>
            </View>

            <View style={[
              styles.statCard,
              { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }
            ]}>
              <LinearGradient
                colors={isDark ? ["#FF9500", "#FF2D55"] : ["#FF9500", "#FF3B30"]}
                style={styles.statIcon}
              >
                <Ionicons name="bookmark" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.statInfo}>
                <Text style={[
                  styles.statNumber,
                  { color: isDark ? "#FFFFFF" : "#000000" }
                ]}>
                  {stats.total}
                </Text>
                <Text style={styles.statLabel}>
                  Total Notes
                </Text>
              </View>
            </View>
          </View>

          {/* Calendar Card */}
          <View style={styles.calendarSection}>
            <Text style={[
              styles.sectionTitle,
              { color: isDark ? "#FFFFFF" : "#000000" }
            ]}>
              Select Date
            </Text>
            <View style={[
              styles.calendarCard,
              { 
                backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                shadowColor: isDark ? "#007AFF" : "#000",
              }
            ]}>
              <Calendar
                key={calendarKey} // Force re-render when theme changes
                onDayPress={onDayPress}
                onMonthChange={handleMonthChange}
                markedDates={getMarkedDates()}
                theme={calendarTheme}
                style={[
                  styles.calendar,
                  { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }
                ]}
                enableSwipeMonths={true}
                // Add inline styles for better theme switching
                renderArrow={(direction) => (
                  <Ionicons
                    name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
                    size={20}
                    color={isDark ? "#FFFFFF" : "#000000"}
                  />
                )}
              />
            </View>
          </View>

          {/* Recent Notes Section */}
          {Object.keys(notes).length > 0 && (
            <View style={styles.notesSection}>
              <Text style={[
                styles.sectionTitle,
                { color: isDark ? "#FFFFFF" : "#000000" }
              ]}>
                Recent Notes
              </Text>
              {Object.entries(notes)
                .slice(0, 3)
                .sort(([a], [b]) => new Date(b) - new Date(a))
                .map(([date, note]) => (
                  <Pressable
                    key={date}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelected(date);
                      setNoteText(note);
                      setModalVisible(true);
                    }}
                    style={[
                      styles.noteCard,
                      { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }
                    ]}
                  >
                    <View style={styles.noteHeader}>
                      <View style={styles.noteDateContainer}>
                        <Ionicons name="time-outline" size={14} color="#8E8E93" />
                        <Text style={styles.noteDate}>
                          {new Date(date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                    </View>
                    <Text 
                      style={[
                        styles.notePreview,
                        { color: isDark ? "#FFFFFF" : "#000000" }
                      ]}
                      numberOfLines={2}
                    >
                      {note || "Empty note"}
                    </Text>
                  </Pressable>
                ))
              }
            </View>
          )}
        </View>
      </ScrollView>

      {/* iOS-style Modal */}
      <Modal visible={modalVisible} transparent animationType="none">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Animated.View style={{ opacity: fadeAnim }}>
              <BlurView
                intensity={isDark ? 50 : 80}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Pressable>

          <Animated.View
            style={[
              styles.modalBox,
              {
                backgroundColor: isDark ? "#1c1c1e" : "#fff",
                transform: [
                  { scale: scaleAnim },
                  { translateY: slideAnim },
                ],
              },
            ]}
          >
            {/* Modal Header */}
            <BlurView 
              intensity={80} 
              tint={isDark ? "dark" : "light"}
              style={styles.modalHeader}
            >
              <Pressable onPress={closeModal} style={styles.modalButton}>
                <Text style={[
                  styles.modalButtonText,
                  { color: isDark ? "#8E8E93" : "#007AFF" }
                ]}>
                  Cancel
                </Text>
              </Pressable>
              <View style={styles.modalTitleContainer}>
                <Text style={[
                  styles.modalTitle,
                  { color: isDark ? "#FFFFFF" : "#000000" },
                ]}>
                  {formatDate(selected)}
                </Text>
              </View>
              <Pressable onPress={saveNote} style={styles.modalButton}>
                <Text style={[
                  styles.modalButtonText,
                  { color: "#007AFF", fontWeight: "600" }
                ]}>
                  Save
                </Text>
              </Pressable>
            </BlurView>

            {/* Input Area */}
            <ScrollView style={styles.inputContainer}>
              <TextInput
                placeholder="Add your note here..."
                value={noteText}
                onChangeText={setNoteText}
                style={[
                  styles.input,
                  {
                    color: isDark ? "#FFFFFF" : "#000000",
                    backgroundColor: "transparent",
                  },
                ]}
                placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
                multiline
                autoFocus
                textAlignVertical="top"
              />
            </ScrollView>

            {/* Delete Button */}
            {notes[selected] && (
              <Pressable 
                onPress={deleteNote} 
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={styles.deleteText}>Delete Note</Text>
              </Pressable>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <View style={styles.modalFooterLine} />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
  },
  headerBlur: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerContent: {
    alignItems: 'flex-start',
  },
  headerText: { 
    fontSize: 34, 
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  subtitleText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
    paddingHorizontal: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  calendarSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  calendarCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  calendar: {
    borderRadius: 16,
    padding: 8,
  },
  notesSection: {
    marginTop: 8,
  },
  noteCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteDate: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  notePreview: {
    fontSize: 15,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBox: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 14,
    overflow: 'hidden',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalButtonText: {
    fontSize: 17,
  },
  inputContainer: {
    maxHeight: 300,
  },
  input: {
    padding: 16,
    fontSize: 17,
    lineHeight: 22,
    minHeight: 150,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(60, 60, 67, 0.29)',
    gap: 8,
  },
  deleteText: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '600',
  },
  modalFooter: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalFooterLine: {
    height: 0.5,
    backgroundColor: 'rgba(60, 60, 67, 0.29)',
  },
});