import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreenExpo from "expo-splash-screen";
import { useEffect, useState } from "react";

// Screens
import AdminScreen from "./screens/AdminScreen";
import LoginScreen from "./screens/LoginScreen";
import MainTabs from "./screens/MainTabs";
import AnimatedSplash from "./screens/SplashScreen";

// Theme Context
import { ThemeProvider, useTheme } from "./screens/ThemeContext";

// ✅ Keep native splash visible until we manually hide it
SplashScreenExpo.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

// ── Navigation (unchanged) ──────────────────────────────────
function AppNavigator() {
  const { isDark } = useTheme();

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login"     component={LoginScreen} />
        <Stack.Screen name="MainTabs"  component={MainTabs} />
        <Stack.Screen name="Admin"     component={AdminScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Root Component ──────────────────────────────────────────
export default function App() {
  const [appReady,   setAppReady]   = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    prepareApp();
  }, []);

  const prepareApp = async () => {
    try {
      // Add any async startup tasks here (fonts, tokens, etc.)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      console.warn('App prepare error:', e);
    } finally {
      setAppReady(true);
      // ✅ Hide native splash — our animated one takes over immediately
      await SplashScreenExpo.hideAsync();
    }
  };

  // Wait until app is ready
  if (!appReady) return null;

  // Show animated splash first
  if (!splashDone) {
    return <AnimatedSplash onFinish={() => setSplashDone(true)} />;
  }

  // Main app with theme
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}