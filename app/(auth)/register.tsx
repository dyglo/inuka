import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Colors } from '../../src/theme/colors';
import { Spacing, Typography } from '../../src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const { user } = userCredential;

      // Update display name
      await updateProfile(user, { displayName: fullName.trim() });

      // Create Firestore user document with default role = 'student'
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: 'student',
        createdAt: serverTimestamp(),
      });

      // AuthContext onAuthStateChanged will pick up the new user and route them
    } catch (err: any) {
      console.error('Registration error:', err);
      let msg = 'Failed to create account';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>I</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join INUKA and start your learning journey today
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="Your full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <Input
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerButton}
          />

          <View style={styles.noteCard}>
            <Text style={styles.noteText}>
              🎓 You'll be registered as a <Text style={styles.boldText}>Student</Text>.
              {'\n'}Admin access is granted by an administrator.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: Spacing.lg,
  },
  backText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoMarkText: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    marginTop: Spacing.md,
  },
  registerButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  errorText: {
    color: Colors.error,
    ...Typography.bodySmall,
    textAlign: 'center',
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
  },
  noteCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  noteText: {
    ...Typography.bodySmall,
    color: Colors.text,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  linkText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
});
