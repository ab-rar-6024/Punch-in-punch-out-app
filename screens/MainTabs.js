import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";

import ApplyLeaveScreen from "./ApplyLeaveScreen";
import CalendarScreen from "./CalendarScreen";
import HistoryScreen from "./HistoryScreen";
import ProfileScreen from "./ProfileScreen";

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get("window");
const TAB_WIDTH = width / 4;

// Icon name helper functions
const getIconName = (routeName) => {
  switch (routeName) {
    case "History":
      return "time-outline";
    case "Calendar":
      return "calendar-outline";
    case "ApplyLeave":
      return "document-text-outline";
    case "Profile":
      return "person-outline";
    default:
      return "help-outline";
  }
};

const getIconNameFilled = (routeName) => {
  switch (routeName) {
    case "History":
      return "time";
    case "Calendar":
      return "calendar";
    case "ApplyLeave":
      return "document-text";
    case "Profile":
      return "person";
    default:
      return "help";
  }
};

// iOS 15+ Tab Button with Scale Animation
const IOS15AnimatedTabButton = ({ route, isFocused, label, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const iconScaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 300,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (isFocused) {
      Animated.spring(iconScaleAnim, {
        toValue: 1.15,
        tension: 280,
        friction: 18,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(iconScaleAnim, {
        toValue: 1,
        tension: 280,
        friction: 18,
        useNativeDriver: true,
      }).start();
    }
  }, [isFocused]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.ios15AnimatedTabButton}
    >
      <Animated.View
        style={[
          styles.ios15AnimatedTabContent,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.ios15AnimatedIconContainer,
            {
              transform: [{ scale: iconScaleAnim }],
            },
          ]}
        >
          <Ionicons
            name={isFocused ? getIconNameFilled(route.name) : getIconName(route.name)}
            size={isFocused ? 22 : 20}
            color={isFocused ? "#007AFF" : "#8E8E93"}
          />
        </Animated.View>
        <Text style={[
          styles.ios15AnimatedLabel,
          {
            color: isFocused ? "#007AFF" : "#8E8E93",
            fontWeight: isFocused ? "600" : "500",
          }
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

// Custom Tab Bar with Pager Integration
const CustomTabBar = ({ currentPage, onTabPress }) => {
  const indicatorPos = useRef(new Animated.Value(currentPage * TAB_WIDTH)).current;
  const tabs = [
    { name: "History", label: "History" },
    { name: "Calendar", label: "Calendar" },
    { name: "ApplyLeave", label: "Leave" },
    { name: "Profile", label: "Profile" },
  ];

  useEffect(() => {
    Animated.spring(indicatorPos, {
      toValue: currentPage * TAB_WIDTH,
      tension: 250,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [currentPage]);

  return (
    <View style={styles.ios15AnimatedContainer}>
      <BlurView intensity={98} tint="systemUltraThinMaterial" style={styles.ios15AnimatedTabBar}>
        <Animated.View
          style={[
            styles.ios15AnimatedIndicator,
            {
              transform: [{ translateX: indicatorPos }],
            },
          ]}
        >
          <View style={styles.ios15AnimatedIndicatorLine} />
        </Animated.View>
        
        {tabs.map((tab, index) => {
          const isFocused = currentPage === index;

          const onPress = () => {
            if (Platform.OS === "ios") {
              Haptics.impactAsync(Haptics.ImpactFeedbackType.Light);
            }
            onTabPress(index);
          };

          return (
            <IOS15AnimatedTabButton
              key={tab.name}
              route={{ name: tab.name }}
              isFocused={isFocused}
              label={tab.label}
              onPress={onPress}
            />
          );
        })}
      </BlurView>
    </View>
  );
};

// Main Container with PagerView
const SwipeableTabContainer = ({ user, hist, navigation }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef(null);

  const handlePageSelected = (e) => {
    const position = e.nativeEvent.position;
    setCurrentPage(position);
  };

  const handleTabPress = (index) => {
    pagerRef.current?.setPage(index);
  };

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
        overdrag={Platform.OS === "android"}
        pageMargin={0}
      >
        <View key="1" style={styles.page}>
          <HistoryScreen navigation={navigation} route={{ params: { user, hist } }} />
        </View>
        <View key="2" style={styles.page}>
          <CalendarScreen navigation={navigation} route={{ params: { user } }} />
        </View>
        <View key="3" style={styles.page}>
          <ApplyLeaveScreen navigation={navigation} route={{ params: { user } }} />
        </View>
        <View key="4" style={styles.page}>
          <ProfileScreen navigation={navigation} route={{ params: { user } }} />
        </View>
      </PagerView>

      <CustomTabBar currentPage={currentPage} onTabPress={handleTabPress} />
    </View>
  );
};

export default function MainTabs({ route }) {
  const user = route?.params?.user || null;
  const hist = route?.params?.hist || [];

  return (
    <Tab.Navigator
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Main">
        {(props) => <SwipeableTabContainer {...props} user={user} hist={hist} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  // iOS 15+ Animated Tab Bar Styles
  ios15AnimatedContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 45 : 50,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 0,
    zIndex: 999,
  },
  ios15AnimatedTabBar: {
    flexDirection: "row",
    height: "100%",
    backgroundColor: Platform.OS === "ios" 
      ? "rgba(249, 249, 249, 0.94)" 
      : "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 0,
    borderTopWidth: Platform.OS === "ios" ? 0.33 : 0.5,
    borderTopColor: Platform.OS === "ios" 
      ? "rgba(60, 60, 67, 0.29)" 
      : "rgba(0, 0, 0, 0.1)",
  },
  ios15AnimatedTabButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  ios15AnimatedTabContent: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    paddingTop: Platform.OS === "ios" ? 6 : 8,
  },
  ios15AnimatedIconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Platform.OS === "ios" ? 2 : 3,
  },
  ios15AnimatedLabel: {
    fontSize: Platform.OS === "ios" ? 10 : 11,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
    letterSpacing: Platform.OS === "ios" ? 0.1 : 0.07,
  },
  ios15AnimatedIndicator: {
    position: "absolute",
    top: 0,
    width: TAB_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    height: 2,
  },
  ios15AnimatedIndicatorLine: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
});