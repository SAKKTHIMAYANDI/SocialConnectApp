import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Linking,
} from 'react-native';
import { Colors } from '../constants';
import { SocialProfile } from '../services/apiService';

interface SocialCardProps {
  profile: SocialProfile;
  isLoading?: boolean;
}

const PLATFORM_META = {
  facebook:  { label: 'Facebook',  icon: 'f', color: Colors.facebook,  bg: 'rgba(24,119,242,0.12)' },
  instagram: { label: 'Instagram', icon: '◈', color: Colors.instagram, bg: 'rgba(225,48,108,0.12)'  },
  whatsapp:  { label: 'WhatsApp',  icon: '●', color: Colors.whatsapp,  bg: 'rgba(37,211,102,0.12)'  },
  linkedin:  { label: 'LinkedIn',  icon: 'in',color: Colors.linkedin,  bg: 'rgba(10,102,194,0.12)'  },
};

export const SocialCard: React.FC<SocialCardProps> = ({ profile, isLoading }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const slideAnim    = useRef(new Animated.Value(0)).current;
  const meta         = PLATFORM_META[profile.platform];

  useEffect(() => {
    if (isLoading) {
      progressAnim.setValue(0);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      Animated.parallel([
        Animated.timing(progressAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.spring(slideAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [isLoading]);

  const handleOpen = () => {
    if (profile.url && profile.found) Linking.openURL(profile.url);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={profile.found ? 0.78 : 1}
      onPress={handleOpen}
    >
      {/* Platform icon */}
      <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
        <Text style={[styles.icon, { color: meta.color }]}>{meta.icon}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.platformName}>{meta.label}</Text>
        <Animated.Text style={[styles.handle, { opacity: isLoading ? pulseAnim : 1 }]} numberOfLines={1}>
          {isLoading
            ? 'Searching with your details...'
            : profile.found
            ? profile.handle || profile.url || 'Profile found'
            : 'Not found on this platform'}
        </Animated.Text>
      </View>

      {/* Status badge */}
      <View style={[
        styles.badge,
        isLoading    ? styles.badgeChecking :
        profile.found? styles.badgeFound    : styles.badgeNot,
      ]}>
        <Text style={[
          styles.badgeText,
          isLoading    ? { color: Colors.accent }   :
          profile.found? { color: Colors.whatsapp } : { color: Colors.textMuted },
        ]}>
          {isLoading ? '···' : profile.found ? '✓ Found' : '✗ None'}
        </Text>
      </View>

      {/* Progress bar */}
      <Animated.View style={[styles.progress, { backgroundColor: meta.color, width: progressWidth }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    gap: 14, overflow: 'hidden', marginBottom: 12,
  },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20, fontWeight: '800' },
  info: { flex: 1 },
  platformName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  handle: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  badgeChecking: { backgroundColor: 'rgba(124,92,252,0.15)' },
  badgeFound:    { backgroundColor: 'rgba(37,211,102,0.15)' },
  badgeNot:      { backgroundColor: 'rgba(107,107,138,0.1)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  progress: { position: 'absolute', bottom: 0, left: 0, height: 2 },
});
