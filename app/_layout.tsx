import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Colors } from '../src/theme/colors';

// Custom light theme matching INUKA's color palette
const InukaLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.glassBorder,
    primary: Colors.primary,
    notification: Colors.primary,
  },
};

function RootLayoutNav() {
  const { user, loading, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inStudentGroup = segments[0] === '(student)';
    const inAdminGroup = segments[0] === '(admin)';
    const onOnboarding = segments.length === 0 || segments[0] === undefined;

    if (!user && !inAuthGroup && !onOnboarding) {
      // Not authenticated and trying to access protected routes → go to login
      router.replace('/login');
    } else if (user && (inAuthGroup || onOnboarding)) {
      // Authenticated and on auth or onboarding screen → redirect to dashboard
      if (role === 'admin') {
        router.replace('/(admin)/(tabs)');
      } else if (role === 'student') {
        router.replace('/(student)/(tabs)');
      }
      // If role is null (still loading from Firestore), stay put
    } else if (user && role === 'student' && inAdminGroup) {
      router.replace('/(student)/(tabs)');
    } else if (user && role === 'admin' && inStudentGroup) {
      router.replace('/(admin)/(tabs)');
    }
  }, [user, loading, role, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(student)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={InukaLightTheme}>
        <RootLayoutNav />
        <StatusBar style="dark" />
      </ThemeProvider>
    </AuthProvider>
  );
}
