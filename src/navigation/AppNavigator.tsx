import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import WelcomeScreen  from '../screens/WelcomeScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen    from '../screens/LoginScreen';
import HomeScreen     from '../screens/HomeScreen';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants';

export type RootStack = {
  Welcome:  undefined;
  Register: undefined;
  Login:    undefined;
  Home:     undefined;
};

const Stack = createNativeStackNavigator<RootStack>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading, initializeSession } = useAuthStore();

  useEffect(() => { initializeSession(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {isAuthenticated ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <>
            <Stack.Screen name="Welcome"  component={WelcomeScreen}  />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Login"    component={LoginScreen}    />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
