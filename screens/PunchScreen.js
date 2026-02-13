import { AntDesign } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLayoutEffect } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { punchActionMobile } from "../api"; // returns {success,msg,time,location}

export default function PunchScreen({ route, navigation }) {
  const { pin, name } = route.params;

  // ⛔ Logout logic – resets to Login screen
  const logout = () => {
    Haptics.selectionAsync();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  // ⛳ Set header title and logout icon
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: `Punch – ${name}`,
      headerRight: () => (
        <Pressable onPress={logout} style={styles.logoutIcon}>
          <AntDesign name="logout" size={22} color="#0f172a" />
        </Pressable>
      ),
    });
  }, [navigation, name]);

  // ✅ Punch handler
  const punch = async (type) => {
    try {
      const { success, msg, time, location } = await punchActionMobile(pin, type);

      if (!success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return Alert.alert("⚠️  Failed", msg || "Unknown error");
      }

      Haptics.selectionAsync();
      Alert.alert(
        "✅  Success",
        `You punched ${type.toUpperCase()} at ${time}\n📍 ${location}`
      );
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("❌  Error", "Network error or server not available");
    }
  };

  // ⬇️ UI Layout
  return (
    <View style={styles.container}>
      <Text style={styles.greet}>Hi, {name}</Text>

      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.in]} onPress={() => punch("in")}>
          <Text style={styles.txt}>PUNCH IN</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.out]} onPress={() => punch("out")}>
          <Text style={styles.txt}>PUNCH OUT</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────── */

const baseBtn = {
  flex: 1,
  marginHorizontal: 8,
  paddingVertical: 18,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  elevation: 6,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  logoutIcon: {
    padding: 6,
    marginRight: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 24,
    elevation: 3,
  },
  greet: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 50,
  },
  row: {
    flexDirection: "row",
  },
  btn: baseBtn,
  in: {
    ...baseBtn,
    backgroundColor: "#16a34a",
  },
  out: {
    ...baseBtn,
    backgroundColor: "#dc2626",
  },
  txt: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 18,
  },
});
