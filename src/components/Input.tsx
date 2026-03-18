import React, { useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, ViewStyle, TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label, error, icon, isPassword, containerStyle, hint, ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.wrap,
        focused && styles.wrapFocused,
        !!error && styles.wrapError,
      ]}>
        {icon && (
          <Ionicons
            name={icon}
            size={17}
            color={focused ? Colors.accent : Colors.textMuted}
            style={styles.iconLeft}
          />
        )}
        <TextInput
          style={[styles.input, icon && { paddingLeft: 4 }]}
          placeholderTextColor={Colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPassword && !showPwd}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.iconRight}>
            <Ionicons
              name={showPwd ? 'eye-off-outline' : 'eye-outline'}
              size={17}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, height: 54, paddingHorizontal: 16,
  },
  wrapFocused: { borderColor: `${Colors.accent}70`, backgroundColor: Colors.surface2 },
  wrapError: { borderColor: `${Colors.error}60` },
  input: { flex: 1, color: Colors.text, fontSize: 15 },
  iconLeft: { marginRight: 8 },
  iconRight: { padding: 4, marginLeft: 4 },
  error: { color: Colors.error, fontSize: 12, marginTop: 5, marginLeft: 2 },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 5, marginLeft: 2 },
});
