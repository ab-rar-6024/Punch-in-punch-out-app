import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from 'react-native-safe-area-context';
import { applyLeave as applyLeaveAPI } from "../api";
import { useTheme } from "./ThemeContext";

const { width } = Dimensions.get("window");

export default function ApplyLeaveScreen({ route, navigation }) {
  const { isDark } = useTheme();
  const user = route.params?.user;
  const emp_id = user?.id;

  const [modalVisible, setModalVisible] = useState(false);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [reason, setReason] = useState("");
  const [showPicker, setShowPicker] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refs
  const scrollViewRef = useRef(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Reset scroll position when component mounts or navigates back
  useEffect(() => {
    // Reset scroll position to top when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
    });

    // Also reset on initial mount
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: false });
    }

    return unsubscribe;
  }, [navigation]);

  // Reset scroll when modal closes
  useEffect(() => {
    if (!modalVisible && scrollViewRef.current) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    }
  }, [modalVisible]);

  // Date formatter
  const formatDate = (date) => {
    try {
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  // Format date for display
  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Apply Leave Function
  const applyLeave = async (reason, from = null, to = null) => {
    if (!emp_id) {
      Alert.alert("Error", "User not found!");
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let response;

      if (!from && !to) {
        // QUICK LEAVE
        response = await applyLeaveAPI(emp_id, "quick", reason);
      } else {
        // CUSTOM LEAVE
        response = await applyLeaveAPI(emp_id, "custom", reason, from, to);
      }

      setLoading(false);

      if (response?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Leave applied successfully!");

        // Reset form
        setReason("");
        setFromDate(new Date());
        setToDate(new Date());
        setModalVisible(false);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", response?.msg || "Invalid request");
      }
    } catch (e) {
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Unable to connect to server");
    }
  };

  // Submit Custom Leave
  const submitCustomLeave = () => {
    if (!reason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Error", "Please enter reason");
      return;
    }

    if (toDate < fromDate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Error", "To Date cannot be before From Date");
      return;
    }

    applyLeave(reason, formatDate(fromDate), formatDate(toDate));
  };

  // Open Modal with Animation
  const openModal = () => {
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

  // Close Modal
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

  // Quick Leave Options
  const quickLeaveOptions = [
    {
      id: 1,
      title: "Fever Leave",
      description: "Leave due to medical issue",
      icon: "medical-outline",
      color: "#FF9500",
    },
    {
      id: 2,
      title: "Emergency Leave",
      description: "Sudden emergency leave",
      icon: "alert-circle-outline",
      color: "#FF3B30",
    },
    {
      id: 3,
      title: "Personal Leave",
      description: "Personal or family matter",
      icon: "person-outline",
      color: "#34C759",
    },
    {
      id: 4,
      title: "Vacation Leave",
      description: "Planned vacation time",
      icon: "airplane-outline",
      color: "#007AFF",
    },
  ];

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDark ? "#000000" : "#F2F2F7" },
    ]}>
      {/* iOS-style Header */}
      <View style={styles.headerContainer}>
        <Text style={[
          styles.headerTitle,
          { color: isDark ? "#FFFFFF" : "#000000" }
        ]}>
          Apply Leave
        </Text>
        <Text style={styles.headerSubtitle}>
          Select a quick leave option or create custom leave
        </Text>
      </View>

      <ScrollView 
        ref={scrollViewRef} // Add ref here
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        contentOffset={{ x: 0, y: 0 }} // Ensure initial offset is 0
        scrollsToTop={true} // Enable tap on status bar to scroll to top
      >
        {/* Quick Leave Cards */}
        <View style={styles.section}>
          <Text style={[
            styles.sectionTitle,
            { color: isDark ? "#FFFFFF" : "#000000" }
          ]}>
            Quick Leave Options
          </Text>
          
          <View style={styles.quickLeaveGrid}>
            {quickLeaveOptions.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.quickLeaveCard,
                  { 
                    backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                    transform: [{ scale: pressed ? 0.98 : 1 }]
                  }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  applyLeave(option.title);
                }}
              >
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: option.color + "20" }
                ]}>
                  <Ionicons name={option.icon} size={28} color={option.color} />
                </View>
                <Text style={[
                  styles.quickLeaveTitle,
                  { color: isDark ? "#FFFFFF" : "#000000" }
                ]}>
                  {option.title}
                </Text>
                <Text style={styles.quickLeaveDescription}>
                  {option.description}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Custom Leave Card */}
        <View style={styles.section}>
          <Text style={[
            styles.sectionTitle,
            { color: isDark ? "#FFFFFF" : "#000000" }
          ]}>
            Custom Leave
          </Text>
          
          <Pressable
            style={({ pressed }) => [
              styles.customLeaveCard,
              { 
                backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                transform: [{ scale: pressed ? 0.98 : 1 }]
              }
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              openModal();
            }}
          >
            <View style={styles.customLeaveContent}>
              <View style={styles.customLeaveIcon}>
                <Ionicons name="calendar-outline" size={32} color="#007AFF" />
              </View>
              <View style={styles.customLeaveText}>
                <Text style={[
                  styles.customLeaveTitle,
                  { color: isDark ? "#FFFFFF" : "#000000" }
                ]}>
                  Custom Leave Request
                </Text>
                <Text style={styles.customLeaveDescription}>
                  Choose specific dates and provide detailed reason
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </View>
          </Pressable>
        </View>

        {/* Information Section */}
        <View style={[
          styles.infoCard,
          { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }
        ]}>
          <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
          <View style={styles.infoContent}>
            <Text style={[
              styles.infoTitle,
              { color: isDark ? "#FFFFFF" : "#000000" }
            ]}>
              Leave Application Guidelines
            </Text>
            <Text style={styles.infoText}>
              • Apply leave at least 24 hours in advance{'\n'}
              • Provide valid reason for emergency leaves{'\n'}
              • Check your remaining leave balance{'\n'}
              • Contact HR for special cases
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.loadingBlur}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={[
              styles.loadingText,
              { color: isDark ? "#FFFFFF" : "#000000" }
            ]}>
              Submitting Leave Request...
            </Text>
          </BlurView>
        </View>
      )}

      {/* iOS-style Modal */}
      <Modal visible={modalVisible} transparent animationType="none">
        <View style={styles.modalContainer}>
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
                  Custom Leave
                </Text>
              </View>
              <Pressable onPress={submitCustomLeave} style={styles.modalButton}>
                <Text style={[
                  styles.modalButtonText,
                  { color: "#007AFF", fontWeight: "600" }
                ]}>
                  Submit
                </Text>
              </Pressable>
            </BlurView>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent}>
              {/* Date Selection */}
              <View style={styles.dateSelection}>
                <Pressable
                  style={({ pressed }) => [
                    styles.dateButton,
                    { 
                      backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                      transform: [{ scale: pressed ? 0.98 : 1 }]
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowPicker("from");
                  }}
                >
                  <View style={styles.dateButtonContent}>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    <View style={styles.dateButtonText}>
                      <Text style={[
                        styles.dateLabel,
                        { color: isDark ? "#8E8E93" : "#000000" }
                      ]}>
                        From Date
                      </Text>
                      <Text style={[
                        styles.dateValue,
                        { color: isDark ? "#FFFFFF" : "#000000" }
                      ]}>
                        {formatDisplayDate(fromDate)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </Pressable>

                <View style={styles.dateSeparator}>
                  <View style={styles.separatorLine} />
                  <Ionicons name="arrow-forward" size={16} color="#8E8E93" />
                  <View style={styles.separatorLine} />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.dateButton,
                    { 
                      backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                      transform: [{ scale: pressed ? 0.98 : 1 }]
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowPicker("to");
                  }}
                >
                  <View style={styles.dateButtonContent}>
                    <Ionicons name="calendar-outline" size={20} color="#FF9500" />
                    <View style={styles.dateButtonText}>
                      <Text style={[
                        styles.dateLabel,
                        { color: isDark ? "#8E8E93" : "#000000" }
                      ]}>
                        To Date
                      </Text>
                      <Text style={[
                        styles.dateValue,
                        { color: isDark ? "#FFFFFF" : "#000000" }
                      ]}>
                        {formatDisplayDate(toDate)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </Pressable>
              </View>

              {/* Reason Input */}
              <View style={styles.reasonSection}>
                <Text style={[
                  styles.reasonLabel,
                  { color: isDark ? "#FFFFFF" : "#000000" }
                ]}>
                  Reason for Leave
                </Text>
                <TextInput
                  placeholder="Enter your reason here..."
                  placeholderTextColor={isDark ? "#8E8E93" : "#8E8E93"}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  style={[
                    styles.reasonInput,
                    {
                      backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7",
                      color: isDark ? "#FFFFFF" : "#000000",
                    }
                  ]}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text style={styles.charCount}>
                  {reason.length}/500 characters
                </Text>
              </View>
            </ScrollView>

            {/* Date Picker Modal */}
            <DateTimePickerModal
              isVisible={showPicker !== null}
              mode="date"
              onConfirm={(date) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (showPicker === "from") setFromDate(date);
                if (showPicker === "to") setToDate(date);
                setShowPicker(null);
              }}
              onCancel={() => setShowPicker(null)}
              display={Platform.OS === "ios" ? "spinner" : "default"}
            />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  quickLeaveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickLeaveCard: {
    width: (width - 52) / 2,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickLeaveTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickLeaveDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 16,
  },
  customLeaveCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  customLeaveContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customLeaveIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customLeaveText: {
    flex: 1,
  },
  customLeaveTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  customLeaveDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBlur: {
    width: 200,
    height: 200,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
  modalContent: {
    maxHeight: 400,
  },
  dateSelection: {
    padding: 16,
    gap: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateButtonText: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(142, 142, 147, 0.3)',
  },
  reasonSection: {
    padding: 16,
    paddingTop: 0,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  reasonInput: {
    minHeight: 120,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 8,
  },
});