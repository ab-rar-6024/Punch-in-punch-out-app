import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from 'expo-blur';
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
} from "react-native-reanimated";

import { getHistory, loginByPin, punchActionMobile } from "../api";

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState("");
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const boxes = useRef([]);
  const loginBoxes = useRef([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    checkBiometrics();
    loadRegisteredUsers();
    requestLocationPermission();
    return () => clearInterval(timer);
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') getCurrentLocation();
    } catch (error) {}
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced 
      });
      const address = await Location.reverseGeocodeAsync({ 
        latitude: location.coords.latitude, 
        longitude: location.coords.longitude 
      });
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address[0] 
          ? `${address[0].city || ''}, ${address[0].region || ''}` 
          : 'Location Active',
      };
      setCurrentLocation(locationData);
    } catch (error) {}
  };

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (compatible && enrolled) {
      setBiometricAvailable(true);
      setBiometricType(
        types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) 
          ? "Face ID" 
          : "Touch ID"
      );
    }
  };

  const loadRegisteredUsers = async () => {
    try {
      const data = await AsyncStorage.getItem("registered_users");
      if (data) setRegisteredUsers(JSON.parse(data));
    } catch (error) {}
  };

  const removeUser = async (userId) => {
    Alert.alert(
      "Remove User",
      "Are you sure you want to remove this user?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const newUsers = registeredUsers.filter(u => u.id !== userId);
            await AsyncStorage.setItem("registered_users", JSON.stringify(newUsers));
            setRegisteredUsers(newUsers);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  const onDigit = (idx, v, isLogin = false) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...pin];
    next[idx] = v;
    setPin(next);
    
    if (v && idx < 3) {
      const nextRef = isLogin ? loginBoxes.current[idx + 1] : boxes.current[idx + 1];
      nextRef?.focus();
    } else if (v && idx === 3 && isLogin) {
      loginWithPin(next.join(""));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loginWithPin = async (finalPin = pin.join("")) => {
    if (finalPin.length < 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Incomplete PIN", "Please enter your 4-digit PIN.");
      return;
    }
    try {
      setBusy(true);
      const auth = await loginByPin(finalPin);
      if (!auth?.success) throw new Error(auth.msg || "Invalid PIN entered.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPinModal(false);
      setPin(["", "", "", ""]);
      
      const role = (auth.role || "").toLowerCase();
      if (role === "employee") {
        const hist = await getHistory(auth.user.id);
        navigation.replace("MainTabs", { user: auth.user, hist: hist });
      } else if (role === "admin") {
        navigation.replace("Admin", { user: auth.user });
      }
      setBusy(false);
    } catch (e) {
      setBusy(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Login Failed", e.message);
      setPin(["", "", "", ""]);
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricAvailable || registeredUsers.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Setup Required", 
        "Please register your biometric first."
      );
      return;
    }

    try {
      setBusy(true);
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to login",
        fallbackLabel: "Use PIN",
        cancelLabel: "Cancel"
      });
      
      if (!result.success) {
        setBusy(false);
        return;
      }

      // Try to login with each registered user's PIN
      let loggedIn = false;
      for (const user of registeredUsers) {
        try {
          const auth = await loginByPin(user.pin);
          if (auth?.success) {
            loggedIn = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            const role = (auth.role || "").toLowerCase();
            if (role === "employee") {
              const hist = await getHistory(auth.user.id);
              navigation.replace("MainTabs", { user: auth.user, hist: hist });
            } else if (role === "admin") {
              navigation.replace("Admin", { user: auth.user });
            }
            break;
          }
        } catch (error) {
          continue; // Try next user
        }
      }
      
      if (!loggedIn) {
        throw new Error("No matching user found. Please login with PIN.");
      }
      
      setBusy(false);
    } catch (error) {
      setBusy(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Login Failed", error.message);
    }
  };

  const registerNewUser = async () => {
    if (pin.some(d => d === "")) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Incomplete PIN", "Please enter your 4-digit PIN.");
      return;
    }
    try {
      setBusy(true);
      const auth = await loginByPin(pin.join(""));
      if (!auth?.success) throw new Error("Verification Failed");
      
      // Check if user already registered
      if (registeredUsers.some(u => u.id === auth.user.id)) {
        setBusy(false);
        Alert.alert("Already Registered", "This user is already registered.");
        setPin(["", "", "", ""]);
        return;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Link ${biometricType} for ${auth.user.name}`,
      });
      
      if (result.success) {
        const newUser = { 
          id: auth.user.id, 
          name: auth.user.name, 
          emp_code: auth.user.emp_code, 
          pin: pin.join(""),
          role: auth.role || "employee"
        };
        const newUsers = [...registeredUsers, newUser];
        await AsyncStorage.setItem("registered_users", JSON.stringify(newUsers));
        setRegisteredUsers(newUsers);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNote(`${biometricType} successfully linked for ${auth.user.name}`);
        setPin(["", "", "", ""]);
        
        setTimeout(() => setNote(""), 4000);
      }
      setBusy(false);
    } catch (e) {
      setBusy(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Registration Failed", e.message);
    }
  };

  const biometricPunch = async (type) => {
    if (!biometricAvailable || registeredUsers.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Setup Required", 
        `Please register your ${biometricType || "biometric"} first.`
      );
      return;
    }
    
    try {
      setBusy(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const res = await LocalAuthentication.authenticateAsync({ 
        promptMessage: `Authenticate to punch ${type.toUpperCase()}`,
        fallbackLabel: "Use PIN"
      });
      
      if (!res.success) { 
        setBusy(false); 
        return; 
      }

      const location = currentLocation || await getCurrentLocation();
      let punched = false;
      
      for (const user of registeredUsers) {
        try {
          const punchRes = await punchActionMobile(user.pin, type, location);
          if (punchRes.success) {
            punched = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              "Success", 
              `${user.name} checked ${type.toUpperCase()} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            );
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (!punched) throw new Error("No matching user found.");
      setBusy(false);
    } catch (e) {
      setBusy(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Failed", e.message);
    }
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient 
        colors={["#0a0a0a", "#1a1a2e", "#16213e"]} 
        style={styles.page}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          
          {/* Time Display - Top Center */}
          <Animated.View 
            entering={FadeInDown.delay(100).springify()} 
            style={styles.timeSection}
          >
            <Text style={styles.currentTime}>{formatTime()}</Text>
            <Text style={styles.currentDate}>{formatDate()}</Text>
            <Text style={styles.greeting}>Good {
              currentTime.getHours() < 12 ? 'Morning' : 
              currentTime.getHours() < 18 ? 'Afternoon' : 'Evening'
            }</Text>
          </Animated.View>

          {/* Location Info */}
          {currentLocation && (
            <Animated.View 
              entering={FadeIn.delay(200)} 
              style={styles.locationCard}
            >
              <View style={styles.locationIconWrapper}>
                <MaterialCommunityIcons name="map-marker-radius" size={18} color="#10b981" />
              </View>
              <View style={styles.locationTextWrapper}>
                <Text style={styles.locationLabel}>Current Location</Text>
                <Text style={styles.locationValue}>{currentLocation.address}</Text>
              </View>
            </Animated.View>
          )}

          {/* Brand */}
          <Animated.View 
            entering={FadeInDown.delay(250).springify()} 
            style={styles.brandSection}
          >
            <Text style={styles.brandTitle}>InstantLog</Text>
            <Text style={styles.brandSubtitle}>Biometric Attendance System</Text>
          </Animated.View>

          {/* Punch Actions - Side by Side */}
          <Animated.View 
            entering={FadeInDown.delay(300).springify()} 
            style={styles.punchContainer}
          >
            <Pressable
              style={({ pressed }) => [
                styles.punchButton,
                pressed && styles.punchButtonPressed
              ]}
              onPress={() => biometricPunch("in")}
              disabled={busy}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.punchGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.punchIconCircle}>
                  <MaterialCommunityIcons name="login-variant" size={32} color="#fff" />
                </View>
                <Text style={styles.punchLabel}>Punch In</Text>
                <Text style={styles.punchSubLabel}>Start Day</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.punchButton,
                pressed && styles.punchButtonPressed
              ]}
              onPress={() => biometricPunch("out")}
              disabled={busy}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={styles.punchGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.punchIconCircle}>
                  <MaterialCommunityIcons name="logout-variant" size={32} color="#fff" />
                </View>
                <Text style={styles.punchLabel}>Punch Out</Text>
                <Text style={styles.punchSubLabel}>End Day</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Biometric Registration Section */}
          <Animated.View 
            entering={FadeInDown.delay(350).springify()} 
            style={styles.registrationSection}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.biometricBadge}>
                <MaterialCommunityIcons 
                  name={biometricType === "Face ID" ? "face-recognition" : "fingerprint"} 
                  size={16} 
                  color="#3b82f6" 
                />
                <Text style={styles.biometricBadgeText}>Register New User</Text>
              </View>
            </View>
            
            <Text style={styles.sectionTitle}>Add Biometric Login</Text>
            <Text style={styles.sectionDescription}>
              Enter your PIN to link biometric authentication for login and punch
            </Text>

            <View style={styles.pinRow}>
              {pin.map((digit, index) => (
                <View key={index} style={styles.pinWrapper}>
                  <TextInput
                    ref={ref => boxes.current[index] = ref}
                    style={[
                      styles.pinBox,
                      digit && styles.pinBoxFilled
                    ]}
                    value={digit}
                    onChangeText={v => onDigit(index, v)}
                    keyboardType="number-pad"
                    maxLength={1}
                    secureTextEntry
                    textContentType="oneTimeCode"
                  />
                  {digit && <View style={styles.pinIndicator} />}
                </View>
              ))}
            </View>

            {note ? (
              <Animated.View entering={FadeIn} style={styles.successMessage}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" />
                <Text style={styles.successText}>{note}</Text>
              </Animated.View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.registerBtn,
                pressed && styles.registerBtnPressed,
                busy && styles.registerBtnDisabled
              ]}
              onPress={registerNewUser}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color="#fff" />
                  <Text style={styles.registerBtnText}>Register {biometricType || "Biometric"}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Registered Users List */}
          {registeredUsers.length > 0 && (
            <Animated.View 
              entering={FadeInDown.delay(400).springify()} 
              style={styles.usersSection}
            >
              <View style={styles.usersSectionHeader}>
                <Text style={styles.usersSectionTitle}>Registered Users</Text>
                <View style={styles.usersCount}>
                  <Text style={styles.usersCountText}>{registeredUsers.length}</Text>
                </View>
              </View>
              
              {registeredUsers.map((user, idx) => (
                <Animated.View 
                  key={idx} 
                  entering={FadeIn.delay(450 + idx * 50)}
                  style={styles.userItem}
                >
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userCode}>ID: {user.emp_code}</Text>
                    <View style={styles.userRoleBadge}>
                      <Text style={styles.userRoleText}>{user.role || 'employee'}</Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.removeBtn,
                      pressed && styles.removeBtnPressed
                    ]}
                    onPress={() => removeUser(user.id)}
                  >
                    <MaterialCommunityIcons name="close" size={18} color="#ef4444" />
                  </Pressable>
                </Animated.View>
              ))}
            </Animated.View>
          )}

          {/* Login Options - Moved below Registered Users */}
          <Animated.View 
            entering={FadeInDown.delay(500).springify()} 
            style={styles.loginOptionsContainer}
          >
            {/* Biometric Login - Clean Button without count */}
            <Pressable
              style={({ pressed }) => [
                styles.biometricLoginButton,
                pressed && styles.biometricLoginButtonPressed,
                (!biometricAvailable || registeredUsers.length === 0) && styles.biometricLoginButtonDisabled
              ]}
              onPress={handleBiometricLogin}
              disabled={busy || !biometricAvailable || registeredUsers.length === 0}
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.biometricLoginGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons 
                  name={biometricType === "Face ID" ? "face-recognition" : "fingerprint"} 
                  size={24} 
                  color="#fff" 
                />
                <Text style={styles.biometricLoginText}>
                  Login with {biometricType || "Biometric"}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* PIN Login - Text Link */}
            <Pressable
              style={({ pressed }) => [
                styles.pinLoginLink,
                pressed && styles.pinLoginLinkPressed
              ]}
              onPress={() => {
                setPin(["", "", "", ""]);
                setShowPinModal(true);
              }}
            >
              <MaterialCommunityIcons name="lock-outline" size={16} color="#94a3b8" />
              <Text style={styles.pinLoginText}>Login with PIN</Text>
            </Pressable>
          </Animated.View>

          <View style={{ height: 40 }} />

        </ScrollView>

        {/* PIN Login Modal - Fallback */}
        <Modal
          visible={showPinModal}
          animationType="fade"
          transparent
          statusBarTranslucent
        >
          <BlurView intensity={100} style={styles.modalOverlay}>
            <Pressable 
              style={styles.modalBackdrop} 
              onPress={() => {
                setShowPinModal(false);
                setPin(["", "", "", ""]);
              }} 
            />
            
            <Animated.View 
              entering={SlideInDown.springify().damping(20)} 
              style={styles.modalContent}
            >
              <View style={styles.modalHandle} />
              
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrapper}>
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    style={styles.modalIconGradient}
                  >
                    <MaterialCommunityIcons name="lock-outline" size={36} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.modalTitle}>Login with PIN</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your 4-digit PIN to continue
                </Text>
              </View>

              <View style={styles.modalPinRow}>
                {pin.map((digit, index) => (
                  <View key={index} style={styles.modalPinWrapper}>
                    <TextInput
                      ref={ref => loginBoxes.current[index] = ref}
                      style={[
                        styles.modalPinBox,
                        digit && styles.modalPinBoxFilled
                      ]}
                      value={digit}
                      onChangeText={v => onDigit(index, v, true)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      textContentType="oneTimeCode"
                      autoFocus={index === 0}
                    />
                    {digit && <View style={styles.modalPinIndicator} />}
                  </View>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.modalSubmitBtn,
                  pressed && styles.modalSubmitBtnPressed,
                  busy && styles.modalSubmitBtnDisabled
                ]}
                onPress={() => loginWithPin()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.modalSubmitBtnText}>Continue</Text>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowPinModal(false);
                  setPin(["", "", "", ""]);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          </BlurView>
        </Modal>

      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  page: { 
    flex: 1,
  },
  scrollContainer: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // Time Section
  timeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  currentTime: {
    fontSize: 50,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: -3,
  },
  currentDate: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '400',
    marginTop: 4,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 8,
    letterSpacing: 0.5,
  },

  // Location Card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  locationIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTextWrapper: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },

  // Brand Section
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -1,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 4,
  },

  // Punch Actions
  punchContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  punchButton: {
    flex: 1,
    height: 160,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  punchButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  punchGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  punchIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  punchLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  punchSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },

  // Registration Section
  registrationSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  biometricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  biometricBadgeText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  pinWrapper: {
    position: 'relative',
  },
  pinBox: {
    width: 60,
    height: 68,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    fontSize: 28,
    fontWeight: '700',
    color: 'transparent',
    textAlign: 'center',
  },
  pinBoxFilled: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  pinIndicator: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    top: 27,
    left: 23,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    gap: 8,
  },
  successText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  registerBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  registerBtnPressed: {
    backgroundColor: '#2563eb',
    transform: [{ scale: 0.98 }],
  },
  registerBtnDisabled: {
    opacity: 0.6,
  },
  registerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // Users Section
  usersSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  usersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usersSectionTitle: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  usersCount: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  usersCountText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '700',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  userCode: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  userRoleBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  userRoleText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  removeBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    transform: [{ scale: 0.95 }],
  },

  // Login Options Container
  loginOptionsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },

  // Biometric Login Button - Clean version without count
  biometricLoginButton: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 12,
  },
  biometricLoginButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  biometricLoginButtonDisabled: {
    opacity: 0.5,
  },
  biometricLoginGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  biometricLoginText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },

  // PIN Login - Text Link
  pinLoginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  pinLoginLinkPressed: {
    opacity: 0.7,
  },
  pinLoginText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // Modal Styles (unchanged)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  modalIconWrapper: {
    marginBottom: 16,
  },
  modalIconGradient: {
    width: 88,
    height: 88,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalPinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  modalPinWrapper: {
    position: 'relative',
  },
  modalPinBox: {
    width: 68,
    height: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    fontSize: 36,
    fontWeight: '700',
    color: 'transparent',
    textAlign: 'center',
  },
  modalPinBoxFilled: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  modalPinIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    top: 30,
    left: 26,
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalSubmitBtnPressed: {
    backgroundColor: '#2563eb',
    transform: [{ scale: 0.98 }],
  },
  modalSubmitBtnDisabled: {
    opacity: 0.6,
  },
  modalSubmitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalCancelBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
});