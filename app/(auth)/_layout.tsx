import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="login-password" />
      <Stack.Screen name="register" />
      <Stack.Screen name="register-details" />
    </Stack>
  );
}
