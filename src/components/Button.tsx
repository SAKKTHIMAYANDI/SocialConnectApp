import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title, onPress, variant = 'primary', loading, disabled, icon, style, textStyle,
}) => {
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.82}
        style={[styles.wrapper, isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={isDisabled ? ['#3a3a4a', '#3a3a4a'] : [Colors.accent, Colors.accentLight]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.row}>
              {icon && <View style={styles.iconWrap}>{icon}</View>}
              <Text style={[styles.primaryText, textStyle]}>{title}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.7} style={style}>
        {loading ? (
          <ActivityIndicator color={Colors.accent} size="small" />
        ) : (
          <Text style={[styles.ghostText, textStyle]}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
      style={[styles.secondary, isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.text} size="small" />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[styles.secondaryText, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: { borderRadius: 18, overflow: 'hidden' },
  gradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { marginRight: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  secondary: {
    height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  secondaryText: { color: Colors.text, fontSize: 16, fontWeight: '500' },
  ghostText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
