import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../components/Button';
import { Colors } from '../constants';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { loginWithOAuth, isLoading } = useAuthStore();

  const handleOAuthLogin = async () => {
    try {
      await loginWithOAuth();
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.glow} />

          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Welcome{'\n'}Back 👋</Text>
          <Text style={styles.sub}>Sign in with your Odoo account</Text>

          {/* OAuth2 Card */}
          <View style={styles.oauthCard}>
            <View style={styles.oauthHeader}>
              <LinearGradient colors={[Colors.accent, Colors.accent2]}
                style={styles.oauthIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="shield-checkmark" size={22} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.oauthTitle}>Secure OAuth2 Login</Text>
                <Text style={styles.oauthSub}>Via your Odoo 18 Enterprise account</Text>
              </View>
            </View>

            <View style={styles.oauthFeatures}>
              {[
                'Authorization Code + PKCE flow',
                'Tokens stored in device secure enclave',
                'Auto token refresh — no re-login needed',
              ].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <Button
              title="Sign In with Odoo"
              onPress={handleOAuthLogin}
              loading={isLoading}
              icon={<Ionicons name="log-in-outline" size={18} color="#fff" />}
              style={{ marginTop: 4 }}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>or</Text>
            <View style={styles.divLine} />
          </View>

          <Text style={styles.note}>
            Don't have an Odoo account?{' '}
            <Text
              style={styles.link}
              onPress={() => navigation.navigate('Register')}
            >
              Create one
            </Text>
          </Text>

          {/* Security badge */}
          <View style={styles.secBadge}>
            <Ionicons name="lock-closed-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.secText}>
              Your credentials are never stored in the app. OAuth2 + PKCE (RFC 7636)
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  glow: {
    position: 'absolute', top: -60, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(124,92,252,0.11)',
  },
  backBtn: {
    width: 42, height: 42, backgroundColor: Colors.surface,
    borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, marginTop: 16, marginBottom: 24,
  },
  title: { fontSize: 30, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, lineHeight: 36 },
  sub:   { fontSize: 14, color: Colors.textMuted, marginTop: 6, marginBottom: 28 },

  oauthCard: {
    backgroundColor: Colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, padding: 20,
    borderTopWidth: 2, borderTopColor: Colors.accent,
  },
  oauthHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  oauthIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  oauthTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  oauthSub:   { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  oauthFeatures: { gap: 8, marginBottom: 16 },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText:   { color: Colors.textMuted, fontSize: 12, flex: 1 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { color: Colors.textMuted, fontSize: 13 },

  note: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  link: { color: Colors.accent, fontWeight: '600' },

  secBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 28, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  secText: { color: Colors.textMuted, fontSize: 11, flex: 1, lineHeight: 16 },
});
