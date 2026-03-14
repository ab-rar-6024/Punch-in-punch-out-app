import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
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
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown
} from "react-native-reanimated";

import { getHistory, loginByPin, punchActionMobile } from "../api";

const { width } = Dimensions.get("window");

/* ───────────────────────── Theme Tokens ───────────────────────── */

const palette = {
  // Accent colours (shared)
  accent:      "#2563EB",
  accentLight: "#3B82F6",
  accentMuted: "rgba(37,99,235,0.08)",
  accentBorder:"rgba(37,99,235,0.18)",
  green:       "#059669",
  greenLight:  "#10B981",
  greenMuted:  "rgba(5,150,105,0.08)",
  greenBorder: "rgba(5,150,105,0.16)",
  red:         "#DC2626",
  redLight:    "#EF4444",
  redMuted:    "rgba(220,38,38,0.08)",
  redBorder:   "rgba(220,38,38,0.16)",
  white:       "#FFFFFF",
};

const themes = {
  dark: {
    ...palette,
    scheme:          "dark",
    statusBar:       "light-content",
    bg:              "#000000",
    bgSecondary:     "#0F172A",
    surface:         "#1E293B",
    surfaceElevated: "#1E293B",
    surfaceBorder:   "rgba(255,255,255,0.06)",
    text:            "#F8FAFC",
    textSecondary:   "#94A3B8",
    textTertiary:    "#64748B",
    separator:       "rgba(255,255,255,0.06)",
    pinBg:           "rgba(15,23,42,0.8)",
    pinBorder:       "rgba(100,116,139,0.25)",
    pinDot:          "#FFFFFF",
    avatarBg:        "#2563EB",
    modalBg:         "#0F172A",
    blurTint:        "dark",
    gradientBg:      ["#000000", "#0A0F1E", "#0F172A"],
    punchInColors:   ["#059669", "#047857"],
    punchOutColors:  ["#DC2626", "#B91C1C"],
    accentGradient:  ["#2563EB", "#1D4ED8"],
  },
  light: {
    ...palette,
    scheme:          "light",
    statusBar:       "dark-content",
    bg:              "#FFFFFF",
    bgSecondary:     "#F8FAFC",
    surface:         "#F1F5F9",
    surfaceElevated: "#FFFFFF",
    surfaceBorder:   "rgba(0,0,0,0.06)",
    text:            "#0F172A",
    textSecondary:   "#475569",
    textTertiary:    "#94A3B8",
    separator:       "rgba(0,0,0,0.06)",
    pinBg:           "#F1F5F9",
    pinBorder:       "rgba(0,0,0,0.10)",
    pinDot:          "#0F172A",
    avatarBg:        "#2563EB",
    modalBg:         "#FFFFFF",
    blurTint:        "light",
    gradientBg:      ["#FFFFFF", "#F8FAFC", "#F1F5F9"],
    punchInColors:   ["#059669", "#047857"],
    punchOutColors:  ["#DC2626", "#B91C1C"],
    accentGradient:  ["#2563EB", "#1D4ED8"],
  },
};

/* ──────────────────────── Component ──────────────────────── */

export default function LoginScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const t = themes[colorScheme === "light" ? "light" : "dark"];

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

  /* ── Lifecycle ── */

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    checkBiometrics();
    loadRegisteredUsers();
    requestLocationPermission();
    return () => clearInterval(timer);
  }, []);

  /* ── Location ── */

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") getCurrentLocation();
    } catch (error) {}
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address[0]
          ? `${address[0].city || ""}, ${address[0].region || ""}`
          : "Location Active",
      };
      setCurrentLocation(locationData);
    } catch (error) {}
  };

  /* ── Biometrics ── */

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (compatible && enrolled) {
      setBiometricAvailable(true);
      setBiometricType(
        types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
        )
          ? "Face ID"
          : "Touch ID"
      );
    }
  };

  /* ── Users ── */

  const loadRegisteredUsers = async () => {
    try {
      const data = await AsyncStorage.getItem("registered_users");
      if (data) setRegisteredUsers(JSON.parse(data));
    } catch (error) {}
  };

  const removeUser = async (userId) => {
    Alert.alert("Remove User", "Are you sure you want to remove this user?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const newUsers = registeredUsers.filter((u) => u.id !== userId);
          await AsyncStorage.setItem(
            "registered_users",
            JSON.stringify(newUsers)
          );
          setRegisteredUsers(newUsers);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  /* ── PIN Input ── */

  const onDigit = (idx, v, isLogin = false) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...pin];
    next[idx] = v;
    setPin(next);

    if (v && idx < 3) {
      const nextRef = isLogin
        ? loginBoxes.current[idx + 1]
        : boxes.current[idx + 1];
      nextRef?.focus();
    } else if (v && idx === 3 && isLogin) {
      loginWithPin(next.join(""));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  /* ── Auth ── */

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
      Alert.alert("Setup Required", "Please register your biometric first.");
      return;
    }

    try {
      setBusy(true);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to login",
        fallbackLabel: "Use PIN",
        cancelLabel: "Cancel",
      });

      if (!result.success) {
        setBusy(false);
        return;
      }

      let loggedIn = false;
      for (const user of registeredUsers) {
        try {
          const auth = await loginByPin(user.pin);
          if (auth?.success) {
            loggedIn = true;
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );

            const role = (auth.role || "").toLowerCase();
            if (role === "employee") {
              const hist = await getHistory(auth.user.id);
              navigation.replace("MainTabs", {
                user: auth.user,
                hist: hist,
              });
            } else if (role === "admin") {
              navigation.replace("Admin", { user: auth.user });
            }
            break;
          }
        } catch (error) {
          continue;
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
    if (pin.some((d) => d === "")) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Incomplete PIN", "Please enter your 4-digit PIN.");
      return;
    }
    try {
      setBusy(true);
      const auth = await loginByPin(pin.join(""));
      if (!auth?.success) throw new Error("Verification Failed");

      if (registeredUsers.some((u) => u.id === auth.user.id)) {
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
          role: auth.role || "employee",
        };
        const newUsers = [...registeredUsers, newUser];
        await AsyncStorage.setItem(
          "registered_users",
          JSON.stringify(newUsers)
        );
        setRegisteredUsers(newUsers);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNote(
          `${biometricType} successfully linked for ${auth.user.name}`
        );
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

  /* ── Punch ── */

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
        fallbackLabel: "Use PIN",
      });

      if (!res.success) {
        setBusy(false);
        return;
      }

      const location = currentLocation || (await getCurrentLocation());
      let punched = false;

      for (const user of registeredUsers) {
        try {
          const punchRes = await punchActionMobile(user.pin, type, location);
          if (punchRes.success) {
            punched = true;
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            Alert.alert(
              "Success",
              `${user.name} checked ${type.toUpperCase()} at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
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

  /* ── Formatters ── */

  const formatTime = () =>
    currentTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const formatDate = () =>
    currentTime.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  const greeting =
    currentTime.getHours() < 12
      ? "Good Morning"
      : currentTime.getHours() < 18
        ? "Good Afternoon"
        : "Good Evening";

  /* ── Dynamic styles (theme-aware) ── */

  const ds = dynamicStyles(t);

  /* ─────────────────────── Render ─────────────────────── */

  return (
    <>
      <StatusBar barStyle={t.statusBar} />
      <LinearGradient colors={t.gradientBg} style={s.page}>
        <ScrollView
          contentContainerStyle={s.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Clock ── */}
          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={s.clockSection}
          >
            <Text style={[s.clockTime, { color: t.text }]}>
              {formatTime()}
            </Text>
            <Text style={[s.clockDate, { color: t.textSecondary }]}>
              {formatDate()}
            </Text>
            <View style={ds.greetingPill}>
              <Text style={[s.greetingText, { color: t.textTertiary }]}>
                {greeting}
              </Text>
            </View>
          </Animated.View>

          {/* ── Location ── */}
          {currentLocation && (
            <Animated.View entering={FadeIn.delay(180)} style={ds.locationRow}>
              <View style={ds.locationIcon}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={15}
                  color={t.greenLight}
                />
              </View>
              <Text
                style={[s.locationText, { color: t.textSecondary }]}
                numberOfLines={1}
              >
                {currentLocation.address}
              </Text>
            </Animated.View>
          )}

          {/* ── Brand ── */}
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={s.brandSection}
          >
            <Text style={[s.brandName, { color: t.text }]}>InstantLog</Text>
            <Text style={[s.brandTag, { color: t.textTertiary }]}>
              Biometric Attendance System
            </Text>
          </Animated.View>

          {/* ── Punch In / Out ── */}
          <Animated.View
            entering={FadeInDown.delay(280).springify()}
            style={s.punchRow}
          >
            {/* Punch In */}
            <Pressable
              style={({ pressed }) => [
                s.punchCard,
                pressed && s.punchCardPressed,
              ]}
              onPress={() => biometricPunch("in")}
              disabled={busy}
            >
              <LinearGradient
                colors={t.punchInColors}
                style={s.punchGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={s.punchIconWrap}>
                  <MaterialCommunityIcons
                    name="login-variant"
                    size={28}
                    color="#fff"
                  />
                </View>
                <Text style={s.punchTitle}>Punch In</Text>
                <Text style={s.punchSub}>Start your day</Text>
              </LinearGradient>
            </Pressable>

            {/* Punch Out */}
            <Pressable
              style={({ pressed }) => [
                s.punchCard,
                pressed && s.punchCardPressed,
              ]}
              onPress={() => biometricPunch("out")}
              disabled={busy}
            >
              <LinearGradient
                colors={t.punchOutColors}
                style={s.punchGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={s.punchIconWrap}>
                  <MaterialCommunityIcons
                    name="logout-variant"
                    size={28}
                    color="#fff"
                  />
                </View>
                <Text style={s.punchTitle}>Punch Out</Text>
                <Text style={s.punchSub}>End your day</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ── Register Biometric ── */}
          <Animated.View
            entering={FadeInDown.delay(340).springify()}
            style={ds.card}
          >
            <View style={s.cardHeaderRow}>
              <View style={ds.chipBadge}>
                <MaterialCommunityIcons
                  name={
                    biometricType === "Face ID"
                      ? "face-recognition"
                      : "fingerprint"
                  }
                  size={14}
                  color={t.accent}
                />
                <Text style={[s.chipText, { color: t.accent }]}>
                  Register New User
                </Text>
              </View>
            </View>

            <Text style={[s.cardTitle, { color: t.text }]}>
              Add Biometric Login
            </Text>
            <Text style={[s.cardDesc, { color: t.textSecondary }]}>
              Enter your PIN to link {biometricType || "biometric"}{" "}
              authentication
            </Text>

            {/* PIN Row */}
            <View style={s.pinRow}>
              {pin.map((digit, index) => (
                <View key={index} style={s.pinSlot}>
                  <TextInput
                    ref={(ref) => (boxes.current[index] = ref)}
                    style={[
                      ds.pinBox,
                      digit && ds.pinBoxActive,
                    ]}
                    value={digit}
                    onChangeText={(v) => onDigit(index, v)}
                    keyboardType="number-pad"
                    maxLength={1}
                    secureTextEntry
                    textContentType="oneTimeCode"
                  />
                  {digit ? (
                    <View
                      style={[s.pinDot, { backgroundColor: t.pinDot }]}
                    />
                  ) : null}
                </View>
              ))}
            </View>

            {/* Success Note */}
            {note ? (
              <Animated.View entering={FadeIn} style={ds.successBox}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={t.greenLight}
                />
                <Text style={[s.successText, { color: t.greenLight }]}>
                  {note}
                </Text>
              </Animated.View>
            ) : null}

            {/* Register Button */}
            <Pressable
              style={({ pressed }) => [
                s.primaryBtn,
                { backgroundColor: t.accent },
                pressed && { opacity: 0.85 },
                busy && { opacity: 0.5 },
              ]}
              onPress={registerNewUser}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={s.primaryBtnText}>
                    Register {biometricType || "Biometric"}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* ── Registered Users ── */}
          {registeredUsers.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(400).springify()}
              style={ds.card}
            >
              <View style={s.usersHeader}>
                <Text style={[s.usersTitle, { color: t.textSecondary }]}>
                  Registered Users
                </Text>
                <View style={ds.countBadge}>
                  <Text style={[s.countText, { color: t.accent }]}>
                    {registeredUsers.length}
                  </Text>
                </View>
              </View>

              {registeredUsers.map((user, idx) => (
                <Animated.View
                  key={idx}
                  entering={FadeIn.delay(440 + idx * 40)}
                  style={ds.userRow}
                >
                  <View style={[s.avatar, { backgroundColor: t.avatarBg }]}>
                    <Text style={s.avatarText}>
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={s.userMeta}>
                    <Text style={[s.userName, { color: t.text }]}>
                      {user.name}
                    </Text>
                    <Text
                      style={[s.userCode, { color: t.textTertiary }]}
                    >
                      ID: {user.emp_code}
                    </Text>
                    <View style={ds.roleBadge}>
                      <Text style={[s.roleText, { color: t.accent }]}>
                        {user.role || "employee"}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      ds.removeBtn,
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => removeUser(user.id)}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={16}
                      color={t.redLight}
                    />
                  </Pressable>
                </Animated.View>
              ))}
            </Animated.View>
          )}

          {/* ── Login Actions ── */}
          <Animated.View
            entering={FadeInDown.delay(480).springify()}
            style={s.loginActions}
          >
            {/* Biometric Login */}
            <Pressable
              style={({ pressed }) => [
                s.biometricBtn,
                (!biometricAvailable || registeredUsers.length === 0) && {
                  opacity: 0.4,
                },
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleBiometricLogin}
              disabled={
                busy || !biometricAvailable || registeredUsers.length === 0
              }
            >
              <LinearGradient
                colors={t.accentGradient}
                style={s.biometricBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons
                  name={
                    biometricType === "Face ID"
                      ? "face-recognition"
                      : "fingerprint"
                  }
                  size={22}
                  color="#fff"
                />
                <Text style={s.biometricBtnText}>
                  Login with {biometricType || "Biometric"}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* PIN Login Link */}
            <Pressable
              style={({ pressed }) => [
                s.pinLink,
                pressed && { opacity: 0.6 },
              ]}
              onPress={() => {
                setPin(["", "", "", ""]);
                setShowPinModal(true);
              }}
            >
              <MaterialCommunityIcons
                name="lock-outline"
                size={15}
                color={t.textTertiary}
              />
              <Text style={[s.pinLinkText, { color: t.textTertiary }]}>
                Login with PIN
              </Text>
            </Pressable>
          </Animated.View>

          <View style={{ height: 48 }} />
        </ScrollView>

        {/* ─── PIN Modal ─── */}
        <Modal
          visible={showPinModal}
          animationType="fade"
          transparent
          statusBarTranslucent
        >
          <BlurView intensity={90} tint={t.blurTint} style={s.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setShowPinModal(false);
                setPin(["", "", "", ""]);
              }}
            />

            <Animated.View
              entering={SlideInDown.springify().damping(20)}
              style={[s.modalSheet, { backgroundColor: t.modalBg }]}
            >
              <View style={s.modalHandle} />

              {/* Modal Header */}
              <View style={s.modalHeader}>
                <LinearGradient
                  colors={t.accentGradient}
                  style={s.modalIconBg}
                >
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={32}
                    color="#fff"
                  />
                </LinearGradient>
                <Text style={[s.modalTitle, { color: t.text }]}>
                  Login with PIN
                </Text>
                <Text
                  style={[s.modalSubtitle, { color: t.textSecondary }]}
                >
                  Enter your 4-digit PIN to continue
                </Text>
              </View>

              {/* Modal PIN Row */}
              <View style={s.pinRow}>
                {pin.map((digit, index) => (
                  <View key={index} style={s.pinSlot}>
                    <TextInput
                      ref={(ref) => (loginBoxes.current[index] = ref)}
                      style={[
                        ds.modalPinBox,
                        digit && ds.modalPinBoxActive,
                      ]}
                      value={digit}
                      onChangeText={(v) => onDigit(index, v, true)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      textContentType="oneTimeCode"
                      autoFocus={index === 0}
                    />
                    {digit ? (
                      <View
                        style={[
                          s.modalPinDot,
                          { backgroundColor: t.pinDot },
                        ]}
                      />
                    ) : null}
                  </View>
                ))}
              </View>

              {/* Continue */}
              <Pressable
                style={({ pressed }) => [
                  s.primaryBtn,
                  { backgroundColor: t.accent },
                  pressed && { opacity: 0.85 },
                  busy && { opacity: 0.5 },
                ]}
                onPress={() => loginWithPin()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={s.primaryBtnText}>Continue</Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={18}
                      color="#fff"
                    />
                  </>
                )}
              </Pressable>

              {/* Cancel */}
              <Pressable
                style={({ pressed }) => [
                  s.cancelBtn,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => {
                  setShowPinModal(false);
                  setPin(["", "", "", ""]);
                }}
              >
                <Text style={[s.cancelText, { color: t.textTertiary }]}>
                  Cancel
                </Text>
              </Pressable>
            </Animated.View>
          </BlurView>
        </Modal>
      </LinearGradient>
    </>
  );
}

/* ─────────── Dynamic (theme-aware) style factories ─────────── */

function dynamicStyles(t) {
  return StyleSheet.create({
    greetingPill: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: t.surfaceBorder,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: t.greenMuted,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 28,
      borderWidth: 1,
      borderColor: t.greenBorder,
    },
    locationIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.greenMuted,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
    },
    card: {
      backgroundColor: t.surface,
      borderRadius: 20,
      padding: 22,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: t.surfaceBorder,
    },
    chipBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.accentMuted,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.accentBorder,
    },
    pinBox: {
      width: 56,
      height: 64,
      borderRadius: 14,
      backgroundColor: t.pinBg,
      borderWidth: 1.5,
      borderColor: t.pinBorder,
      fontSize: 26,
      fontWeight: "700",
      color: "transparent",
      textAlign: "center",
    },
    pinBoxActive: {
      borderColor: t.accent,
      backgroundColor: t.accentMuted,
    },
    successBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.greenMuted,
      padding: 10,
      borderRadius: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: t.greenBorder,
      gap: 6,
    },
    countBadge: {
      backgroundColor: t.accentMuted,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.accentBorder,
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.scheme === "dark" ? "rgba(15,23,42,0.5)" : "rgba(0,0,0,0.02)",
      padding: 12,
      borderRadius: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.surfaceBorder,
    },
    roleBadge: {
      backgroundColor: t.accentMuted,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: t.accentBorder,
    },
    removeBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: t.redMuted,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.redBorder,
    },
    modalPinBox: {
      width: 62,
      height: 70,
      borderRadius: 16,
      backgroundColor: t.pinBg,
      borderWidth: 1.5,
      borderColor: t.pinBorder,
      fontSize: 30,
      fontWeight: "700",
      color: "transparent",
      textAlign: "center",
    },
    modalPinBoxActive: {
      borderColor: t.accent,
      backgroundColor: t.accentMuted,
    },
  });
}

/* ─────────── Static styles ─────────── */

const s = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContainer: {
    paddingTop: Platform.OS === "ios" ? 64 : 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  /* Clock */
  clockSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  clockTime: {
    fontSize: 54,
    fontWeight: "200",
    letterSpacing: -4,
  },
  clockDate: {
    fontSize: 15,
    fontWeight: "400",
    marginTop: 2,
  },
  greetingText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  /* Location */
  locationText: {
    fontSize: 13,
    fontWeight: "500",
  },

  /* Brand */
  brandSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  brandName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  brandTag: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 3,
    letterSpacing: 0.3,
  },

  /* Punch */
  punchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  punchCard: {
    flex: 1,
    height: 148,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  punchCardPressed: {
    opacity: 0.88,
  },
  punchGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
  },
  punchIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  punchTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  punchSub: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  /* Card common */
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 14,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 19,
  },

  /* PIN */
  pinRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 18,
  },
  pinSlot: {
    position: "relative",
  },
  pinDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 26,
    left: 22,
  },
  modalPinDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: 28,
    left: 24,
  },

  successText: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* Primary button */
  primaryBtn: {
    flexDirection: "row",
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },

  /* Users */
  usersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  usersTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 1,
  },
  userCode: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 3,
  },
  roleText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  /* Login section */
  loginActions: {
    marginTop: 4,
    marginBottom: 8,
  },
  biometricBtn: {
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    marginBottom: 12,
  },
  biometricBtnGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 8,
  },
  biometricBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  pinLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 5,
  },
  pinLinkText: {
    fontSize: 13,
    fontWeight: "500",
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(148,163,184,0.35)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 22,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  modalIconBg: {
    width: 76,
    height: 76,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  cancelBtn: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
