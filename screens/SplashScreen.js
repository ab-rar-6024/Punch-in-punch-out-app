// screens/SplashScreen.js
// ✅ Custom animated splash — shown AFTER native splash hides

import { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Image,
    StyleSheet,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function AnimatedSplash({ onFinish }) {

  // ── Animation values ──
  const logoScale     = useRef(new Animated.Value(0.3)).current;
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoY         = useRef(new Animated.Value(40)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textY         = useRef(new Animated.Value(20)).current;
  const tagOpacity    = useRef(new Animated.Value(0)).current;
  const ring1Scale    = useRef(new Animated.Value(0)).current;
  const ring1Opacity  = useRef(new Animated.Value(0.6)).current;
  const ring2Scale    = useRef(new Animated.Value(0)).current;
  const ring2Opacity  = useRef(new Animated.Value(0.4)).current;
  const ring3Scale    = useRef(new Animated.Value(0)).current;
  const ring3Opacity  = useRef(new Animated.Value(0.2)).current;
  const barWidth      = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const dotScale1     = useRef(new Animated.Value(0.6)).current;
  const dotScale2     = useRef(new Animated.Value(0.6)).current;
  const dotScale3     = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    runAnimations();
  }, []);

  const runAnimations = () => {
    // ── Phase 1: Ripple rings burst out ──
    Animated.parallel([
      Animated.timing(ring1Scale, {
        toValue: 3.5, duration: 900,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(ring1Opacity, {
        toValue: 0, duration: 900,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(ring2Scale, {
        toValue: 2.8, duration: 1100, delay: 120,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(ring2Opacity, {
        toValue: 0, duration: 1100, delay: 120,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(ring3Scale, {
        toValue: 2.2, duration: 1300, delay: 240,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(ring3Opacity, {
        toValue: 0, duration: 1300, delay: 240,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();

    // ── Phase 2: Logo spring in ──
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1, friction: 6, tension: 80, useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0, duration: 500,
          easing: Easing.out(Easing.back(1.5)), useNativeDriver: true,
        }),
      ]),
    ]).start();

    // ── Phase 3: App name fades + slides in ──
    Animated.sequence([
      Animated.delay(550),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
        Animated.timing(textY, {
          toValue: 0, duration: 400,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
    ]).start();

    // ── Phase 4: Tagline fades in ──
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(tagOpacity, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
    ]).start();

    // ── Phase 5: Progress bar fills ──
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(barWidth, {
        toValue: 1, duration: 1400,
        easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
      }),
    ]).start();

    // ── Phase 6: Dot pulse loop ──
    const pulseDot = (anim, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.3, duration: 350, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.6, duration: 350, useNativeDriver: true }),
        ])
      ).start();
    };

    setTimeout(() => {
      pulseDot(dotScale1, 0);
      pulseDot(dotScale2, 180);
      pulseDot(dotScale3, 360);
    }, 800);

    // ── Phase 7: Fade out entire screen → call onFinish ──
    Animated.sequence([
      Animated.delay(2600),
      Animated.timing(screenOpacity, {
        toValue: 0, duration: 500,
        easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }),
    ]).start(() => onFinish && onFinish());
  };

  const barInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>

      {/* Background glow */}
      <View style={styles.glowCenter} />

      {/* Ripple rings */}
      <Animated.View style={[styles.ring, {
        transform: [{ scale: ring1Scale }],
        opacity: ring1Opacity,
        borderColor: 'rgba(201,168,76,0.6)',
      }]} />
      <Animated.View style={[styles.ring, {
        transform: [{ scale: ring2Scale }],
        opacity: ring2Opacity,
        borderColor: 'rgba(201,168,76,0.4)',
      }]} />
      <Animated.View style={[styles.ring, {
        transform: [{ scale: ring3Scale }],
        opacity: ring3Opacity,
        borderColor: 'rgba(201,168,76,0.25)',
      }]} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, {
        opacity: logoOpacity,
        transform: [{ scale: logoScale }, { translateY: logoY }],
      }]}>
        <Image
          source={require('../assets/images/new-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App name */}
      <Animated.Text style={[styles.appName, {
        opacity: textOpacity,
        transform: [{ translateY: textY }],
      }]}>
        ATTENDIFY
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
        Smart Attendance System
      </Animated.Text>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barInterpolated }]} />
      </View>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { transform: [{ scale: dotScale1 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ scale: dotScale2 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ scale: dotScale3 }] }]} />
      </View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999,
  },

  /* Soft radial glow behind logo */
  glowCenter: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(201,168,76,0.06)',
  },

  /* Ripple rings */
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
  },

  /* Logo */
  logoWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#c9a84c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  logo: {
    width: 68,
    height: 68,
  },

  /* Text */
  appName: {
    fontSize: 30,
    fontWeight: '700',
    color: '#e8eaf0',
    letterSpacing: 6,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#6b7a99',
    letterSpacing: 1.5,
    fontWeight: '500',
    marginBottom: 52,
  },

  /* Progress bar */
  barTrack: {
    width: 180,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#c9a84c',
    borderRadius: 2,
  },

  /* Dots */
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#c9a84c',
  },
});