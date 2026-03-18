import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  Animated, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Colors } from '../constants';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { loginWithOAuth, isLoading } = useAuthStore();

  const logoScale = useRef(new Animated.Value(0)).current;
  const fadeIn    = useRef(new Animated.Value(0)).current;
  const floatY    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -10, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatY, { toValue:   0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleOAuthLogin = async () => {
    try {
      await loginWithOAuth();
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0a0a0f', '#0f0f1a', '#0a0a0f']} style={styles.container}>
        <View style={styles.glow1} />
        <View style={styles.glow2} />

        <View style={styles.center}>
          {/* Logo */}
          <Animated.View style={{ transform: [{ scale: logoScale }, { translateY: floatY }] }}>
            <LinearGradient
              colors={[Colors.accent, Colors.accent2]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.logo}
            >
              <Text style={styles.logoEmoji}>🔗</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={{ opacity: fadeIn, alignItems: 'center', marginTop: 28 }}>
            <Text style={styles.appName}>SocialConnect</Text>
            <Text style={styles.tagline}>
              One identity.{'\n'}All your social profiles.
            </Text>

            {/* Social platform pills */}
            <View style={styles.pillRow}>
              {[
                { label: 'Facebook',  color: Colors.facebook  },
                { label: 'Instagram', color: Colors.instagram },
                { label: 'WhatsApp',  color: Colors.whatsapp  },
                { label: 'LinkedIn',  color: Colors.linkedin  },
              ].map((p) => (
                <View key={p.label} style={[styles.pill, { borderColor: `${p.color}40`, backgroundColor: `${p.color}12` }]}>
                  <Text style={[styles.pillText, { color: p.color }]}>{p.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

        {/* CTA Buttons */}
        <Animated.View style={[styles.actions, { opacity: fadeIn }]}>
          {/* Primary: OAuth2 Login via Odoo 18 */}
          <Button
            title="Sign In with Odoo"
            onPress={handleOAuthLogin}
            loading={isLoading}
            icon={<Ionicons name="shield-checkmark-outline" size={18} color="#fff" />}
            style={styles.btn}
          />

          {/* Secondary: Manual Registration */}
          <Button
            title="Create Account"
            variant="secondary"
            onPress={() => navigation.navigate('Register')}
            style={styles.btn}
          />

          <Text style={styles.footNote}>
            Secured by Odoo 18 Enterprise · OAuth2 + PKCE
          </Text>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, paddingHorizontal: 28 },
  glow1: {
    position: 'absolute', top: -100, right: -100,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(124,92,252,0.14)',
  },
  glow2: {
    position: 'absolute', bottom: 160, left: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(252,92,125,0.09)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 90, height: 90, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5, shadowRadius: 28, elevation: 18,
  },
  logoEmoji: { fontSize: 42 },
  appName: {
    fontSize: 36, fontWeight: '800', color: Colors.text,
    letterSpacing: -1.2, textAlign: 'center',
  },
  tagline: {
    fontSize: 16, color: Colors.textMuted,
    textAlign: 'center', lineHeight: 24, marginTop: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 28 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '600' },
  actions: { paddingBottom: 44, gap: 12 },
  btn:     { marginBottom: 0 },
  footNote: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 4 },
});
