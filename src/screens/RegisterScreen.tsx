import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { Button }  from '../components/Button';
import { Input  }  from '../components/Input';
import { Colors }  from '../constants';
import { useAuthStore } from '../store/authStore';

// ─── Validation ───────────────────────────────────────────────────────────────
const schema = z.object({
  first_name: z.string().min(2, 'At least 2 characters'),
  last_name:  z.string().min(2, 'At least 2 characters'),
  phone: z.string()
    .min(7, 'Enter a valid phone number')
    .regex(/^\+?[\d\s\-()]{7,}$/, 'Invalid phone format — include country code (e.g. +1 234...)'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[0-9]/, 'Must include a number'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type FormData = z.infer<typeof schema>;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register, isLoading } = useAuthStore();

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '',
      phone: '', email: '',
      password: '', confirm_password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await register({
        first_name: data.first_name,
        last_name:  data.last_name,
        phone:      data.phone,
        email:      data.email || '',
        password:   data.password,
      });
      // Auth store sets isAuthenticated → navigator shows Home
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.glow} />

          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Create your{'\n'}Account ✨</Text>
          <Text style={styles.sub}>Register to link your social profiles</Text>

          {/* ── Name row ── */}
          <View style={styles.row}>
            <Controller control={control} name="first_name" render={({ field: { onChange, value, onBlur } }) => (
              <Input label="First Name" placeholder="John" value={value}
                onChangeText={onChange} onBlur={onBlur}
                error={errors.first_name?.message}
                containerStyle={styles.half} autoCapitalize="words" />
            )} />
            <Controller control={control} name="last_name" render={({ field: { onChange, value, onBlur } }) => (
              <Input label="Last Name" placeholder="Doe" value={value}
                onChangeText={onChange} onBlur={onBlur}
                error={errors.last_name?.message}
                containerStyle={styles.half} autoCapitalize="words" />
            )} />
          </View>

          {/* ── Phone ── */}
          <Controller control={control} name="phone" render={({ field: { onChange, value, onBlur } }) => (
            <Input
              label="Mobile Number *"
              placeholder="+1 234 567 8900"
              value={value} onChangeText={onChange} onBlur={onBlur}
              error={errors.phone?.message}
              icon="phone-portrait-outline"
              keyboardType="phone-pad"
              hint="Include country code. Used for WhatsApp lookup."
            />
          )} />

          {/* ── Email ── */}
          <Controller control={control} name="email" render={({ field: { onChange, value, onBlur } }) => (
            <Input
              label="Email Address (optional)"
              placeholder="john@example.com"
              value={value} onChangeText={onChange} onBlur={onBlur}
              error={errors.email?.message}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              hint="Used for Facebook & LinkedIn lookup."
            />
          )} />

          {/* ── Password ── */}
          <Controller control={control} name="password" render={({ field: { onChange, value, onBlur } }) => (
            <Input label="Password" placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={value} onChangeText={onChange} onBlur={onBlur}
              error={errors.password?.message}
              icon="lock-closed-outline" isPassword />
          )} />

          {/* ── Confirm ── */}
          <Controller control={control} name="confirm_password" render={({ field: { onChange, value, onBlur } }) => (
            <Input label="Confirm Password" placeholder="Re-enter password"
              value={value} onChangeText={onChange} onBlur={onBlur}
              error={errors.confirm_password?.message}
              icon="lock-closed-outline" isPassword />
          )} />

          <Text style={styles.terms}>
            By registering you agree to our{' '}
            <Text style={styles.link}>Terms</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>

          <Button
            title="Create Account"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={{ marginBottom: 20 }}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchTxt}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.switchLink}>Sign In</Text>
            </TouchableOpacity>
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
  row:   { flexDirection: 'row', gap: 12 },
  half:  { flex: 1 },
  terms: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginVertical: 16, lineHeight: 18 },
  link:  { color: Colors.accent },
  switchRow: { flexDirection: 'row', justifyContent: 'center' },
  switchTxt: { color: Colors.textMuted, fontSize: 14 },
  switchLink:{ color: Colors.accent, fontSize: 14, fontWeight: '600' },
});
