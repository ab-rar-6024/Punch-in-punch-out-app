// screens/ThemeContext.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from 'react-native';

export const themes = {
  light: {
    dark: false,
    colors: {
      primary: '#007AFF',
      primaryLight: '#E5F0FF',
      secondary: '#5856D6',
      success: '#34C759',
      warning: '#FF9F0A',
      danger: '#FF3B30',
      
      background: '#F2F2F7',
      card: '#FFFFFF',
      cardSecondary: '#F9F9FB',
      
      text: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C6C6C8',
      
      border: '#E5E5EA',
      borderLight: '#F0F0F5',
      
      separator: '#C6C6C8',
      overlay: 'rgba(0,0,0,0.4)',
      
      statusBar: 'dark',
      keyboardAppearance: 'light',
    },
  },
  dark: {
    dark: true,
    colors: {
      primary: '#0A84FF',
      primaryLight: '#1C3B5C',
      secondary: '#5E5CE6',
      success: '#32D74B',
      warning: '#FF9F0A',
      danger: '#FF453A',
      
      background: '#000000',
      card: '#1C1C1E',
      cardSecondary: '#2C2C2E',
      
      text: '#FFFFFF',
      textSecondary: '#8E8E93',
      textTertiary: '#48484A',
      
      border: '#38383A',
      borderLight: '#2C2C2E',
      
      separator: '#38383A',
      overlay: 'rgba(0,0,0,0.8)',
      
      statusBar: 'light',
      keyboardAppearance: 'dark',
    },
  },
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from storage on startup
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem("themeMode");
      if (saved === "dark") {
        setIsDark(true);
      } else if (saved === "light") {
        setIsDark(false);
      } else {
        // If no saved preference, use system theme
        setIsDark(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error("Failed to load theme:", error);
      // Fallback to system theme
      setIsDark(systemColorScheme === 'dark');
    } finally {
      setIsLoading(false);
    }
  };

  // Save theme whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveTheme();
    }
  }, [isDark]);

  const saveTheme = async () => {
    try {
      await AsyncStorage.setItem("themeMode", isDark ? "dark" : "light");
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  };

  const toggleTheme = () => setIsDark((prev) => !prev);
  
  // Set theme to light
  const setLightTheme = () => setIsDark(false);
  
  // Set theme to dark
  const setDarkTheme = () => setIsDark(true);
  
  // Reset to system theme
  const resetToSystem = async () => {
    try {
      await AsyncStorage.removeItem("themeMode");
      setIsDark(systemColorScheme === 'dark');
    } catch (error) {
      console.error("Failed to reset theme:", error);
    }
  };

  // Get current theme colors based on isDark state
  const theme = isDark ? themes.dark : themes.light;

  return (
    <ThemeContext.Provider 
      value={{ 
        theme,
        isDark, 
        toggleTheme,
        setLightTheme,
        setDarkTheme,
        resetToSystem,
        isLoading,
        colors: theme.colors, // Convenience access to colors
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};