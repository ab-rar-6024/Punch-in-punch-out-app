import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from "expo-linear-gradient";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BASE_URL,
  deleteProfilePicture,
  getEmployeeAttendance,
  getEmployeeProfile,
  getUserPhoto,
  updateProfilePicture
} from "../api";
import { useTheme } from "./ThemeContext";

const { width } = Dimensions.get("window");

export default function ProfileScreen({ navigation, route }) {
  const { isDark, toggleTheme } = useTheme();
  const loginUser = route.params?.user;
  const emp_code = loginUser?.emp_code;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  
  // Report selection states
  const [reportType, setReportType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const scrollY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const photoScaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef(null);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [50, 0],
    extrapolate: 'clamp',
  });

  // SCROLL TO TOP WHEN TAB BECOMES ACTIVE
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
      scrollY.setValue(0);
    });

    return unsubscribe;
  }, [navigation]);

  // RESET SCROLL POSITION WHEN COMPONENT MOUNTS
  React.useEffect(() => {
    scrollY.setValue(0);
  }, []);

  // Check permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        
        if (status !== 'granted') {
          console.log('Gallery permissions not granted');
        }
        if (cameraStatus.status !== 'granted') {
          console.log('Camera permissions not granted');
        }
      }
    })();
  }, []);

  // Fetch attendance data when user is loaded
  useEffect(() => {
    if (user && user.id) {
      fetchAttendanceData();
    }
  }, [user]);

  const fetchAttendanceData = async () => {
    try {
      console.log("Fetching attendance for user:", user.id);
      const data = await getEmployeeAttendance(user.id);
      
      if (data && data.attendance) {
        const transformedData = data.attendance.map(record => ({
          ...record,
          isLeave: record.absent === true,
          leaveType: record.absent ? 'Full Day' : null,
          leaveReason: record.reason || null
        }));
        setAttendanceData(transformedData);
      } else {
        setAttendanceData([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceData([]);
    }
  };

  // Handle scroll
  const handleScroll = Animated.event(
    [
      {
        nativeEvent: {
          contentOffset: { y: scrollY }
        }
      }
    ],
    {
      useNativeDriver: false,
    }
  );

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 200,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handlePhotoPressIn = () => {
    Animated.spring(photoScaleAnim, {
      toValue: 0.95,
      tension: 200,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handlePhotoPressOut = () => {
    Animated.spring(photoScaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  // Calculate duration in hours
  const calculateDurationInHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return 0;
    try {
      const parseTime = (timeStr) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        
        if (modifier) {
          if (modifier === 'PM' && hours < 12) hours += 12;
          if (modifier === 'AM' && hours === 12) hours = 0;
        }
        
        return hours + minutes / 60;
      };
      
      let start = parseTime(timeIn);
      let end = parseTime(timeOut);
      
      if (end < start) end += 24;
      
      return end - start;
    } catch {
      return 0;
    }
  };

  // Format time
  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    return timeStr;
  };

  // Get data for selected month
  const getSelectedMonthData = () => {
    if (!attendanceData || attendanceData.length === 0) {
      return [];
    }
    
    return attendanceData.filter(record => {
      if (!record || !record.date) return false;
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === selectedMonth && 
             recordDate.getFullYear() === selectedYear;
    });
  };

  // Get all data for overall report
  const getAllData = () => {
    return attendanceData || [];
  };

  // Calculate statistics for any data set
  const calculateStats = (data) => {
    const totalDays = data.length;
    const presentDays = data.filter(d => !d.isLeave && d.time_in && d.time_out).length;
    const leaveDays = data.filter(d => d.isLeave).length;
    const totalHours = data.reduce((sum, day) => {
      if (!day.isLeave && day.time_in && day.time_out) {
        return sum + calculateDurationInHours(day.time_in, day.time_out);
      }
      return sum;
    }, 0);
    
    return { totalDays, presentDays, leaveDays, totalHours };
  };

  // Get month name
  const getMonthName = (monthIndex) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthIndex];
  };

  // Get short month name for filename
  const getShortMonthName = (monthIndex) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex];
  };

  // Generate filename based on report type
  const generateFilename = () => {
    const safeName = user?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'employee';
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    if (reportType === 'monthly') {
      const monthName = getMonthName(selectedMonth);
      const shortMonth = getShortMonthName(selectedMonth);
      const year = selectedYear;
      
      // Multiple filename options - choose one that suits you
      return {
        simple: `${safeName}_${shortMonth}_${year}.pdf`,
        detailed: `${safeName}_Monthly_Report_${monthName}_${year}.pdf`,
        withDate: `${safeName}_${monthName}_${year}_Generated_${dateStr}.pdf`,
        formatted: `${monthName}_${year}_Attendance_Report_${safeName}.pdf`
      };
    } else {
      // Overall report filenames
      const totalDays = attendanceData.length;
      
      return {
        simple: `${safeName}_Complete_History.pdf`,
        detailed: `${safeName}_Overall_Attendance_Report.pdf`,
        withDate: `${safeName}_Complete_History_${dateStr}.pdf`,
        formatted: `Complete_Attendance_History_${safeName}_${dateStr}.pdf`
      };
    }
  };

  // Change month
  const changeMonth = (direction) => {
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
  };

  // Generate PDF Report with custom filename
  const generatePDFReport = async () => {
    if (!user) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setDownloading(true);
    setShowReportModal(false);

    try {
      let reportData = [];
      let reportTitle = '';
      let reportPeriod = '';
      let filename = '';
      
      if (reportType === 'monthly') {
        reportData = getSelectedMonthData();
        const monthName = getMonthName(selectedMonth);
        const shortMonth = getShortMonthName(selectedMonth);
        const year = selectedYear;
        reportTitle = `${monthName} ${year} Attendance Report - ${user.name}`;
        reportPeriod = `${monthName} ${year}`;
        filename = `${user.name?.replace(/\s+/g, '_')}_${monthName}_${year}_Report.pdf`;
      } else {
        reportData = getAllData();
        const totalDays = reportData.length;
        reportTitle = `Complete Attendance History - ${user.name}`;
        reportPeriod = 'All Time';
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        filename = `${user.name?.replace(/\s+/g, '_')}_Complete_History_${dateStr}.pdf`;
      }

      const stats = calculateStats(reportData);
      const now = new Date();

      // Create HTML content for PDF (same as before)
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${reportTitle}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 30px;
              background: #ffffff;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #007AFF;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #007AFF;
              margin-bottom: 10px;
            }
            .subtitle {
              font-size: 16px;
              color: #666666;
            }
            .company-name {
              font-size: 14px;
              color: #999999;
              margin-top: 5px;
            }
            .info-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 12px;
              margin-bottom: 30px;
            }
            .info-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
            }
            .info-item {
              flex: 1;
              min-width: 200px;
            }
            .info-label {
              font-size: 12px;
              color: #666666;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 16px;
              font-weight: 600;
              color: #333333;
            }
            .stats-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              margin-bottom: 30px;
            }
            .stat-card {
              flex: 1;
              min-width: 120px;
              background: #f3f4f6;
              padding: 20px;
              border-radius: 12px;
              text-align: center;
            }
            .stat-number {
              font-size: 32px;
              font-weight: bold;
              color: #007AFF;
              margin-bottom: 5px;
            }
            .stat-label {
              font-size: 12px;
              color: #666666;
            }
            .stat-hours {
              font-size: 24px;
              font-weight: bold;
              color: #f59e0b;
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            th {
              background: #007AFF;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            tr:nth-child(even) {
              background: #f9fafb;
            }
            .present-row td {
              color: #10b981;
            }
            .leave-row {
              background: #FEF3C7;
            }
            .leave-row td {
              color: #d97706;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 10px;
              color: #999999;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
            .generated-date {
              font-size: 11px;
              color: #999999;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">InstantLog Attendance Report</div>
            <div class="subtitle">${reportPeriod}</div>
            <div class="company-name">InstantLog Inc.</div>
          </div>

          <div class="info-section">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Employee Name</div>
                <div class="info-value">${user.name || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Employee ID</div>
                <div class="info-value">${user.emp_code || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Department</div>
                <div class="info-value">${user.department || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Designation</div>
                <div class="info-value">${user.designation || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Report Type</div>
                <div class="info-value">${reportType === 'monthly' ? 'Monthly' : 'Overall'} Report</div>
              </div>
              <div class="info-item">
                <div class="info-label">Period</div>
                <div class="info-value">${reportPeriod}</div>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${stats.totalDays}</div>
              <div class="stat-label">Total Days</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" style="color: #10b981;">${stats.presentDays}</div>
              <div class="stat-label">Days Present</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" style="color: #d97706;">${stats.leaveDays}</div>
              <div class="stat-label">Leave Days</div>
            </div>
            <div class="stat-card">
              <div class="stat-hours">${stats.totalHours.toFixed(1)}</div>
              <div class="stat-label">Total Hours</div>
            </div>
            <div class="stat-card">
              <div class="stat-hours">${stats.totalDays > 0 ? (stats.totalHours / stats.totalDays).toFixed(1) : 0}</div>
              <div class="stat-label">Avg Hours/Day</div>
            </div>
          </div>

          <h3 style="margin-bottom: 15px; color: #333;">Daily Attendance Details</h3>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.sort((a, b) => new Date(b.date) - new Date(a.date)).map(record => {
                const date = new Date(record.date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                const hours = !record.isLeave && record.time_in && record.time_out 
                  ? calculateDurationInHours(record.time_in, record.time_out).toFixed(1)
                  : '—';
                const status = record.isLeave ? 'Leave' : (record.time_in ? 'Present' : 'Absent');
                const rowClass = record.isLeave ? 'leave-row' : (record.time_in ? 'present-row' : '');
                
                return `
                  <tr class="${rowClass}">
                    <td>${record.date}</td>
                    <td>${dayName}</td>
                    <td>${formatTime(record.time_in)}</td>
                    <td>${formatTime(record.time_out)}</td>
                    <td>${status}</td>
                    <td>${hours}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          ${reportData.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: #999999;">
              No attendance records found for this period
            </div>
          ` : ''}

          <div class="footer">
            <div>This report was generated automatically by InstantLog Attendance System</div>
            <div class="generated-date">Generated on: ${new Date().toLocaleString()}</div>
            <div>© ${new Date().getFullYear()} InstantLog Inc. All rights reserved.</div>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      // Share the PDF with custom filename
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: reportTitle,
          UTI: 'com.adobe.pdf'
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Success', `PDF generated at: ${uri}`);
      }

    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Photo Upload Functions (keep existing photo functions)
  const pickImage = async (type) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      let result;
      
      if (type === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Sorry, we need camera permissions to take photos.');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        await handleImageUpload(result.assets[0].uri);
      }
      
      setShowPhotoOptions(false);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setShowPhotoOptions(false);
    }
  };

  const handleImageUpload = async (uri) => {
    if (!user || !user.id) {
      Alert.alert('Error', 'User profile not found. Try logging out and back in.');
      return;
    }

    setUploading(true);

    try {
      const response = await updateProfilePicture(user.id, uri);

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const absUrl = response.photoUrl && response.photoUrl.startsWith('http')
          ? response.photoUrl
          : response.photoUrl ? `${BASE_URL}${response.photoUrl}` : null;

        if (absUrl) {
          setProfileImage(absUrl);
        }
        Alert.alert('Success', 'Profile picture updated!');
      } else {
        Alert.alert('Upload Failed', response.msg || 'Check your server connection');
      }
    } catch (error) {
      console.error('Upload component error:', error);
      Alert.alert('Connection Error', 'Could not reach the server');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user || !user.id) {
      Alert.alert('Error', 'User profile not found.');
      return;
    }

    Alert.alert(
      "Remove Profile Photo",
      "Are you sure you want to remove your profile photo?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(true);
            try {
              const response = await deleteProfilePicture(user.id);
              
              if (response.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setProfileImage(null);
                Alert.alert('Success', 'Profile photo removed!');
              } else {
                Alert.alert('Error', response.msg || 'Failed to remove photo');
              }
            } catch (error) {
              console.error('Remove photo error:', error);
              Alert.alert('Error', 'Failed to remove photo');
            } finally {
              setRemoving(false);
              setShowPhotoOptions(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          },
        },
      ]
    );
  };

  const handleContact = (type, value) => {
    if (!value || value === "Not provided") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("No Information", "Contact information not available");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (type) {
      case 'email':
        Linking.openURL(`mailto:${value}`);
        break;
      case 'phone':
        Linking.openURL(`tel:${value}`);
        break;
      case 'sms':
        Linking.openURL(`sms:${value}`);
        break;
    }
  };

  const handleBugReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const email = "support@instantlog.com";
    const subject = "Bug Report - InstantLog App";
    const body = `
Device: ${Platform.OS} ${Platform.Version}
User ID: ${user?.emp_code || "N/A"}
App Version: 2.0.0

Issue Description:
[Please describe the issue here]

Steps to Reproduce:
1. 
2. 
3. 

Expected Behavior:


Actual Behavior:


Screenshots:
[If applicable]

Thank you for your feedback!
    `.trim();

    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  useEffect(() => {
    if (!emp_code) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const data = await getEmployeeProfile(emp_code);
        if (data.success && data.user) {
          setUser(data.user);

          const photoRes = await getUserPhoto(data.user.id);
          if (photoRes.success && photoRes.photoUrl) {
            setProfileImage(photoRes.photoUrl);
          }
        } else {
          Alert.alert("Error", "Failed to load profile data");
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        Alert.alert("Connection Error", "Unable to fetch profile data");
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [emp_code]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? "#000000" : "#F2F2F7" }]}>
        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.loadingBlur}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
            Loading Profile...
          </Text>
        </BlurView>
      </View>
    );
  }

  if (!user && !isConnected) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? "#000000" : "#F2F2F7" }]}>
        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.loadingBlur}>
          <Ionicons name="cloud-offline" size={64} color="#8E8E93" />
          <Text style={[styles.loadingText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
            Connection Lost
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setIsConnected(true);
              setLoading(true);
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </BlurView>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#000000" : "#F2F2F7" }]}>
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.headerContainer,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <BlurView 
          intensity={90} 
          tint={isDark ? "systemThickMaterialDark" : "systemThickMaterialLight"}
          style={styles.headerBlur}
        >
          <Text style={[styles.headerTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
            Profile
          </Text>
        </BlurView>
      </Animated.View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={isDark ? ["#007AFF", "#5856D6"] : ["#007AFF", "#34C759"]}
            style={styles.heroGradient}
          >
            <View style={styles.profileHero}>
              <Pressable
                onPressIn={handlePhotoPressIn}
                onPressOut={handlePhotoPressOut}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowPhotoOptions(true);
                }}
                style={styles.avatarPressable}
              >
                <Animated.View 
                  style={[
                    styles.avatarContainer,
                    { transform: [{ scale: photoScaleAnim }] }
                  ]}
                >
                  <Image
                    source={{
                      uri: profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=007AFF&color=fff&size=128&bold=true`,
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                  </View>
                  
                  {/* Camera Icon Overlay */}
                  <View style={styles.cameraIconContainer}>
                    <View style={styles.cameraIconBackground}>
                      <Ionicons name="camera" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                </Animated.View>
              </Pressable>
              
              <Text style={styles.userName}>{user?.name || "Unknown User"}</Text>
              <Text style={styles.userRole}>{user?.designation || "Employee"}</Text>
              <Text style={styles.userId}>ID: {user?.emp_code || "N/A"}</Text>
              
              <Text style={styles.changePhotoText}>
                Tap photo to {profileImage && !profileImage.includes('ui-avatars.com') ? 'change or remove' : 'upload'}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Personal Information
            </Text>
            <View style={[styles.card, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
              <InfoRow
                icon="mail-outline"
                label="Email Address"
                value={user?.email || "Not provided"}
                isDark={isDark}
                onPress={() => handleContact('email', user?.email)}
                showAction={!!user?.email && user?.email !== "Not provided"}
              />
              <InfoRow
                icon="call-outline"
                label="Phone Number"
                value={user?.phone || "Not provided"}
                isDark={isDark}
                onPress={() => handleContact('phone', user?.phone)}
                showAction={!!user?.phone && user?.phone !== "Not provided"}
              />
            </View>
          </View>

          {/* Work Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Work Information
            </Text>
            <View style={[styles.card, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
              <InfoRow
                icon="business-outline"
                label="Department"
                value={user?.department || "Not assigned"}
                isDark={isDark}
              />
              <InfoRow
                icon="briefcase-outline"
                label="Designation"
                value={user?.designation || "Not assigned"}
                isDark={isDark}
              />
            </View>
          </View>

          {/* Reports Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Reports
            </Text>
            <View style={[styles.card, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
                ]}
                onPress={() => {
                  setReportType('monthly');
                  setShowReportModal(true);
                }}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIcon, { backgroundColor: '#007AFF20' }]}>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  </View>
                  <View>
                    <Text style={[styles.actionLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      Monthly Report
                    </Text>
                    <Text style={styles.preferenceDescription}>
                      Select month to generate report
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
                ]}
                onPress={() => {
                  setReportType('overall');
                  setShowReportModal(true);
                }}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIcon, { backgroundColor: '#34C75920' }]}>
                    <Ionicons name="stats-chart-outline" size={20} color="#34C759" />
                  </View>
                  <View>
                    <Text style={[styles.actionLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      Overall Report
                    </Text>
                    <Text style={styles.preferenceDescription}>
                      Complete attendance history
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
              </Pressable>
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Preferences
            </Text>
            <View style={[styles.card, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.preferenceRow,
                  pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
                ]}
                onPress={toggleTheme}
              >
                <View style={styles.preferenceLeft}>
                  <View style={[styles.preferenceIcon, { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }]}>
                    <Ionicons 
                      name={isDark ? "moon" : "sunny"} 
                      size={20} 
                      color={isDark ? "#5AC8FA" : "#FF9500"} 
                    />
                  </View>
                  <View>
                    <Text style={[styles.preferenceLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      {isDark ? "Dark Mode" : "Light Mode"}
                    </Text>
                    <Text style={styles.preferenceDescription}>
                      Switch light and dark themes
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: "#767577", true: "#34C759" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#3e3e3e"
                />
              </Pressable>
            </View>
          </View>

          {/* Support & About */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Support & About
            </Text>
            <View style={[styles.card, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
              <ActionRow
                icon="bug-outline"
                label="Report a Bug"
                color="#FF3B30"
                onPress={handleBugReport}
                isDark={isDark}
              />
              <ActionRow
                icon="document-text-outline"
                label="Terms of Service"
                color="#8E8E93"
                onPress={() => setShowTermsModal(true)}
                isDark={isDark}
              />
              <ActionRow
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                color="#34C759"
                onPress={() => setShowPrivacyModal(true)}
                isDark={isDark}
              />
              <ActionRow
                icon="information-circle-outline"
                label="About"
                color="#5856D6"
                onPress={() => setShowAboutModal(true)}
                isDark={isDark}
              />
            </View>
          </View>

          {/* Sign Out */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
              style={({ pressed }) => [
                styles.signOutButton,
                { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
                pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
              ]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </Animated.View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appVersion}>InstantLog v2.0.0</Text>
            <Text style={styles.appCopyright}>© 2024 InstantLog Inc.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Report Options Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.modalContainer}>
          <View style={[styles.reportModalContent, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                {reportType === 'monthly' ? 'Monthly Report' : 'Overall Report'}
              </Text>
              <Pressable onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </Pressable>
            </View>
            
            <View style={styles.reportModalBody}>
              <View style={styles.reportInfoSection}>
                <Ionicons 
                  name={reportType === 'monthly' ? "calendar-outline" : "stats-chart-outline"} 
                  size={48} 
                  color={reportType === 'monthly' ? "#007AFF" : "#34C759"} 
                />
                <Text style={[styles.reportInfoTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                  {reportType === 'monthly' 
                    ? `${getMonthName(selectedMonth)} ${selectedYear}`
                    : 'Complete History'}
                </Text>
                <Text style={styles.reportInfoDescription}>
                  {reportType === 'monthly' 
                    ? `Download attendance report for ${getMonthName(selectedMonth)} ${selectedYear}`
                    : `Download complete attendance history (${attendanceData.length} days)`}
                </Text>
                
                <View style={styles.reportFeatures}>
                  <View style={styles.reportFeature}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={[styles.reportFeatureText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      Daily check-in/out times
                    </Text>
                  </View>
                  <View style={styles.reportFeature}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={[styles.reportFeatureText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      Total hours worked
                    </Text>
                  </View>
                  <View style={styles.reportFeature}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={[styles.reportFeatureText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      Leave records
                    </Text>
                  </View>
                  <View style={styles.reportFeature}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={[styles.reportFeatureText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      Complete statistics
                    </Text>
                  </View>
                </View>

                {reportType === 'monthly' && (
                  <View style={styles.monthSelector}>
                    <Pressable 
                      style={styles.monthNavButton}
                      onPress={() => changeMonth('prev')}
                    >
                      <Ionicons name="chevron-back" size={24} color="#007AFF" />
                    </Pressable>
                    
                    <Text style={[styles.monthText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      {getMonthName(selectedMonth)} {selectedYear}
                    </Text>
                    
                    <Pressable 
                      style={styles.monthNavButton}
                      onPress={() => changeMonth('next')}
                    >
                      <Ionicons name="chevron-forward" size={24} color="#007AFF" />
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.reportActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.reportButton,
                    styles.reportButtonPrimary,
                    pressed && styles.reportButtonPressed
                  ]}
                  onPress={generatePDFReport}
                  disabled={downloading}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.reportButtonText}>
                        {reportType === 'monthly' ? 'Download Monthly Report' : 'Download Overall Report'}
                      </Text>
                    </>
                  )}
                </Pressable>
                
                <Pressable
                  style={({ pressed }) => [
                    styles.reportButton,
                    styles.reportButtonSecondary,
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={() => setShowReportModal(false)}
                >
                  <Text style={[styles.reportButtonText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* Photo Upload Options Modal */}
      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.modalContainer}>
          <View style={[styles.photoOptionsContent, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
            <View style={styles.photoOptionsHeader}>
              <Text style={[styles.photoOptionsTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                Change Profile Picture
              </Text>
              <Pressable onPress={() => setShowPhotoOptions(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </Pressable>
            </View>
            
            <View style={styles.photoOptionsBody}>
              <Pressable 
                style={({ pressed }) => [
                  styles.photoOption,
                  pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
                ]}
                onPress={() => pickImage('camera')}
              >
                <View style={[styles.photoOptionIcon, { backgroundColor: '#007AFF20' }]}>
                  <Ionicons name="camera" size={28} color="#007AFF" />
                </View>
                <View style={styles.photoOptionText}>
                  <Text style={[styles.photoOptionLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                    Take Photo
                  </Text>
                  <Text style={styles.photoOptionDescription}>
                    Use camera to take a new photo
                  </Text>
                </View>
              </Pressable>
              
              <Pressable 
                style={({ pressed }) => [
                  styles.photoOption,
                  pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
                ]}
                onPress={() => pickImage('gallery')}
              >
                <View style={[styles.photoOptionIcon, { backgroundColor: '#34C75920' }]}>
                  <Ionicons name="images" size={28} color="#34C759" />
                </View>
                <View style={styles.photoOptionText}>
                  <Text style={[styles.photoOptionLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                    Choose from Gallery
                  </Text>
                  <Text style={styles.photoOptionDescription}>
                    Select photo from your gallery
                  </Text>
                </View>
              </Pressable>
              
              {profileImage && !profileImage.includes('ui-avatars.com') && (
                <Pressable 
                  style={({ pressed }) => [
                    styles.photoOption,
                    pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
                  ]}
                  onPress={handleRemovePhoto}
                  disabled={removing}
                >
                  <View style={[styles.photoOptionIcon, { backgroundColor: '#FF3B3020' }]}>
                    <Ionicons name="trash-outline" size={28} color="#FF3B30" />
                  </View>
                  <View style={styles.photoOptionText}>
                    <Text style={[styles.photoOptionLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                      {removing ? "Removing..." : "Remove Photo"}
                    </Text>
                    <Text style={styles.photoOptionDescription}>
                      Remove current profile picture
                    </Text>
                  </View>
                  {removing && (
                    <ActivityIndicator size="small" color="#FF3B30" style={{ marginLeft: 10 }} />
                  )}
                </Pressable>
              )}
            </View>
            
            <Pressable 
              style={({ pressed }) => [
                styles.photoOptionsCancel,
                pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
              ]}
              onPress={() => setShowPhotoOptions(false)}
            >
              <Text style={[styles.photoOptionsCancelText, { color: isDark ? "#FF3B30" : "#FF3B30" }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </BlurView>
      </Modal>

      {/* Uploading Overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.uploadingBlur}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={[styles.uploadingText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Uploading Photo...
            </Text>
          </BlurView>
        </View>
      )}

      {/* Downloading Overlay */}
      {downloading && (
        <View style={styles.uploadingOverlay}>
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.uploadingBlur}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={[styles.uploadingText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Generating PDF...
            </Text>
          </BlurView>
        </View>
      )}

      {/* Removing Overlay */}
      {removing && (
        <View style={styles.uploadingOverlay}>
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.uploadingBlur}>
            <ActivityIndicator size="large" color="#FF3B30" />
            <Text style={[styles.uploadingText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
              Removing Photo...
            </Text>
          </BlurView>
        </View>
      )}

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                About InstantLog
              </Text>
              <Pressable onPress={() => setShowAboutModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                InstantLog is a modern attendance tracking application designed to simplify employee management. Our mission is to provide seamless biometric attendance tracking with enterprise-grade security.
                
                {'\n\n'}Features:
                • Biometric authentication
                • Real-time location tracking
                • Leave management
                • Detailed reporting
                • iOS & Android support
                
                {'\n\n'}For support, contact us at support@instantlog.com
              </Text>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                Privacy Policy
              </Text>
              <Pressable onPress={() => setShowPrivacyModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                Your privacy is important to us. This privacy policy explains what personal data we collect and how we use it.
                
                {'\n\n'}Data We Collect:
                • Attendance records
                • Location data (for punch verification)
                • Device information
                • Usage statistics
                
                {'\n\n'}How We Use Your Data:
                • To track attendance
                • To verify location
                • To generate reports
                • To improve our services
                
                {'\n\n'}We do not sell your personal data to third parties.
              </Text>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Terms Modal */}
      <Modal
        visible={showTermsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                Terms of Service
              </Text>
              <Pressable onPress={() => setShowTermsModal(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalText, { color: isDark ? "#FFFFFF" : "#000000" }]}>
                By using InstantLog, you agree to these terms of service.
                
                {'\n\n'}User Responsibilities:
                • Provide accurate information
                • Use the app for intended purposes only
                • Keep login credentials secure
                • Report any security issues
                
                {'\n\n'}Company Responsibilities:
                • Maintain service availability
                • Protect user data
                • Provide customer support
                • Regular updates and improvements
                
                {'\n\n'}We reserve the right to modify these terms at any time.
              </Text>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

// Info Row Component
const InfoRow = ({ icon, label, value, isDark, onPress, showAction = false }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.infoRow,
        pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.infoLeft}>
        <View style={[styles.infoIcon, { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }]}>
          <Ionicons name={icon} size={20} color="#007AFF" />
        </View>
        <Text style={[styles.infoLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
          {label}
        </Text>
      </View>
      <View style={styles.infoRight}>
        <Text style={[styles.infoValue, { color: isDark ? "#8E8E93" : "#666666" }]}>
          {value}
        </Text>
        {showAction && (
          <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
        )}
      </View>
    </Pressable>
  );
};

// Action Row Component
const ActionRow = ({ icon, label, color, onPress, isDark }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionRow,
        pressed && { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }
      ]}
      onPress={onPress}
    >
      <View style={styles.actionLeft}>
        <View style={[styles.actionIcon, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.actionLabel, { color: isDark ? "#FFFFFF" : "#000000" }]}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  heroSection: {
    paddingBottom: 24,
  },
  heroGradient: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
  },
  profileHero: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarPressable: {
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  cameraIconBackground: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  userId: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  changePhotoText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
    fontStyle: 'italic',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(142, 142, 147, 0.3)',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '400',
    maxWidth: 150,
    textAlign: 'right',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  preferenceLabel: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 2,
  },
  preferenceDescription: {
    fontSize: 13,
    color: '#8E8E93',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(142, 142, 147, 0.3)',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF3B30',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  appVersion: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 13,
    color: '#8E8E93',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(142, 142, 147, 0.3)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  // Report Modal Styles
  reportModalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  reportModalBody: {
    padding: 20,
  },
  reportInfoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  reportInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  reportInfoDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  reportFeatures: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  reportFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportFeatureText: {
    fontSize: 15,
    fontWeight: '500',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    borderRadius: 12,
    padding: 8,
    width: '100%',
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
  },
  reportActions: {
    gap: 12,
    marginTop: 10,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  reportButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  reportButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8E8E93',
  },
  reportButtonPressed: {
    opacity: 0.7,
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Photo Upload Styles
  photoOptionsContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(142, 142, 147, 0.3)',
  },
  photoOptionsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  photoOptionsBody: {
    paddingVertical: 16,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  photoOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  photoOptionText: {
    flex: 1,
  },
  photoOptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  photoOptionDescription: {
    fontSize: 13,
    color: '#8E8E93',
  },
  photoOptionsCancel: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(142, 142, 147, 0.3)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  photoOptionsCancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  uploadingBlur: {
    width: 200,
    height: 200,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});