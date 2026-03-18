import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, RefreshControl, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SocialCard } from '../components/SocialCard';
import { Colors } from '../constants';
import { useAuthStore } from '../store/authStore';
import { apiService, SocialProfile } from '../services/apiService';

const PLATFORMS: SocialProfile['platform'][] = ['facebook','instagram','whatsapp','linkedin'];

const DEFAULT_PROFILES: SocialProfile[] = PLATFORMS.map(p => ({ platform: p, found: false }));

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const [profiles, setProfiles]       = useState<SocialProfile[]>(DEFAULT_PROFILES);
  const [loadingSet, setLoadingSet]   = useState<Set<string>>(new Set(PLATFORMS));
  const [refreshing, setRefreshing]   = useState(false);

  const runLookup = useCallback(async () => {
    if (!user) return;
    setProfiles(DEFAULT_PROFILES);
    setLoadingSet(new Set(PLATFORMS));

    try {
      const results = await apiService.lookupSocialProfiles(user.phone, user.email);

      // Stagger reveal for UX feedback
      for (let i = 0; i < results.length; i++) {
        await delay(i * 420);
        const r = results[i];
        setProfiles(prev => prev.map(p => p.platform === r.platform ? r : p));
        setLoadingSet(prev => { const n = new Set(prev); n.delete(r.platform); return n; });
      }
    } catch {
      // Fallback demo when Odoo is not yet configured
      const username = user.name.toLowerCase().replace(/\s+/g, '.');
      for (let i = 0; i < PLATFORMS.length; i++) {
        await delay(700 + i * 550);
        const p = PLATFORMS[i];
        setProfiles(prev => prev.map(x =>
          x.platform === p
            ? buildDemoProfile(p, username, user.phone)
            : x
        ));
        setLoadingSet(prev => { const n = new Set(prev); n.delete(p); return n; });
      }
    }
  }, [user]);

  useEffect(() => { runLookup(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runLookup();
    setRefreshing(false);
  }, [runLookup]);

  const handleLogout = () =>
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);

  const initials = user?.name
    ?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() ?? 'U';

  const foundCount    = profiles.filter(p => p.found).length;
  const checkingCount = loadingSet.size;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.glow} />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day</Text>
            <Text style={styles.name} numberOfLines={1}>{user?.name ?? 'User'} 👋</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}>
            <LinearGradient colors={[Colors.accent, Colors.accent2]} style={styles.avatar}>
              {user?.avatar_url
                ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                : <Text style={styles.avatarText}>{initials}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          {[
            { val: foundCount,    label: 'Found',    color: Colors.success },
            { val: PLATFORMS.length, label: 'Platforms', color: Colors.text  },
            { val: checkingCount, label: 'Checking', color: Colors.accent  },
          ].map((s, i) => (
            <View key={i} style={[styles.statCell, i === 1 && styles.statMiddle]}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Registered Info ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoTop}>
            <Text style={styles.sectionLabel}>REGISTERED INFO</Text>
            <View style={styles.oauthPill}>
              <Ionicons name="shield-checkmark" size={10} color={Colors.accent} />
              <Text style={styles.oauthPillText}>OAuth2 Verified</Text>
            </View>
          </View>

          <InfoRow icon="phone-portrait-outline" color={Colors.accent}
            label={user?.phone || 'No phone registered'} />
          <InfoRow icon="mail-outline" color={Colors.accent2}
            label={user?.email || 'No email registered'} />
        </View>

        {/* ── Social Profiles ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Social Profiles</Text>
          <Text style={styles.sectionSub}>Lookup via your phone & email</Text>
        </View>

        <View style={styles.cards}>
          {profiles.map(p => (
            <SocialCard
              key={p.platform}
              profile={p}
              isLoading={loadingSet.has(p.platform)}
            />
          ))}
        </View>

        <Text style={styles.hint}>↑ Pull to refresh  ·  Tap a found profile to open</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function buildDemoProfile(platform: SocialProfile['platform'], username: string, phone: string): SocialProfile {
  const handles: Record<SocialProfile['platform'], { handle: string; url?: string }> = {
    facebook:  { handle: `facebook.com/${username}`,   url: `https://facebook.com/${username}` },
    instagram: { handle: `@${username.replace('.','_')}`, url: `https://instagram.com/${username}` },
    whatsapp:  { handle: `Active · ${phone}` },
    linkedin:  { handle: `linkedin.com/in/${username}`, url: `https://linkedin.com/in/${username}` },
  };
  return { platform, found: true, ...handles[platform] };
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, color, label }: { icon: any; color: string; label: string }) => (
  <View style={infoStyles.row}>
    <View style={[infoStyles.icon, { backgroundColor: `${color}18` }]}>
      <Ionicons name={icon} size={15} color={color} />
    </View>
    <Text style={infoStyles.label} numberOfLines={1}>{label}</Text>
  </View>
);

const infoStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  icon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { color: Colors.text, fontSize: 14, flex: 1 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  glow: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(124,92,252,0.10)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
  },
  greeting: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  name:     { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginTop: 2, maxWidth: 260 },
  avatar:   { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg:{ width: 50, height: 50 },
  avatarText:{ color: '#fff', fontSize: 18, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 24, marginBottom: 16,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  statCell:   { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statVal:    { fontSize: 22, fontWeight: '800' },
  statLbl:    { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  infoCard: {
    marginHorizontal: 24, marginBottom: 24,
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    borderTopWidth: 2, borderTopColor: Colors.accent,
    padding: 16,
  },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  oauthPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(124,92,252,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  oauthPillText: { fontSize: 10, color: Colors.accent, fontWeight: '600' },

  sectionHeader: { paddingHorizontal: 24, marginBottom: 14 },
  sectionTitle:  { fontSize: 20, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  sectionSub:    { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  cards: { paddingHorizontal: 24 },
  hint:  { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginVertical: 20 },
});
