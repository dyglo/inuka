import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Crown, GraduationCap, ShieldCheck } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { auth, db } from '../../src/config/firebase';
import type { Role } from '../../src/context/AuthContext';
import { Spacing, Typography } from '../../src/theme';
import { Colors } from '../../src/theme/colors';

// ─── MVP Admin Codes ──────────────────────────────────────────────────────────
const TEACHER_ADMIN_CODE = 'INUKA-TEACH-2024';
const SUPER_ADMIN_CODE = 'INUKA-SUPER-9999';

// ─── Email domain validation ─────────────────────────────────────────────────
// Accept only well-known providers plus any domain with a valid TLD
const VALID_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
// Reject obviously fake/disposable TLDs and single-char domains
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'trashmail.com', 'temp-mail.org',
  'fakeinbox.com', 'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'guerrillamail.info', 'spam4.me', 'throwam.com',
];

function validateEmailDomain(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();

  if (!VALID_EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. you@gmail.com).' };
  }

  const domain = trimmed.split('@')[1];

  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed. Use a real email.' };
  }

  // Ensure domain has at least one dot in the right place (catches "abc@gmail" etc.)
  if (!domain.includes('.')) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const tld = domain.split('.').pop() || '';
  if (tld.length < 2) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  return { valid: true };
}

// ─── Account Type Config ──────────────────────────────────────────────────────
const ACCOUNT_TYPES: {
  label: string;
  role: Role;
  description: string;
  Icon: any;
  color: string;
  bg: string;
  requiresCode: boolean;
}[] = [
    {
      label: 'Student',
      role: 'student',
      description: 'Access courses and track your learning',
      Icon: GraduationCap,
      color: Colors.primary,
      bg: Colors.primaryLight,
      requiresCode: false,
    },
    {
      label: 'Teacher Admin',
      role: 'teacher_admin',
      description: 'Manage courses and learning materials',
      Icon: ShieldCheck,
      color: '#059669',
      bg: '#d1fae5',
      requiresCode: true,
    },
    {
      label: 'Super Admin',
      role: 'super_admin',
      description: 'Full administrative access and user management',
      Icon: Crown,
      color: '#d97706',
      bg: '#fef3c7',
      requiresCode: true,
    },
  ];

export default function RegisterScreen() {
  const router = useRouter();

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('student');

  // Admin-only fields
  const [fullName, setFullName] = useState('');
  const [adminCode, setAdminCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = ACCOUNT_TYPES.find((t) => t.role === selectedRole)!;
  const isAdmin = selectedRole === 'teacher_admin' || selectedRole === 'super_admin';

  const validateAdminCode = (): boolean => {
    if (selectedRole === 'student') return true;
    if (selectedRole === 'teacher_admin' && adminCode !== TEACHER_ADMIN_CODE) {
      setError('Invalid Teacher Admin code. Please contact your Super Admin.');
      return false;
    }
    if (selectedRole === 'super_admin' && adminCode !== SUPER_ADMIN_CODE) {
      setError('Invalid Super Admin code.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    setError(null);

    // Validate shared fields
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    // Validate email domain
    const emailCheck = validateEmailDomain(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error!);
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

    // Admin extra validation
    if (isAdmin) {
      if (!fullName.trim()) {
        setError('Full name is required');
        return;
      }
      if (!validateAdminCode()) return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const { user } = userCredential;

      // For admins set display name immediately; students will set it in onboarding
      if (isAdmin && fullName.trim()) {
        await updateProfile(user, { displayName: fullName.trim() });
      }

      // Create Firestore user document
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: isAdmin ? fullName.trim() : '',
        email: email.trim().toLowerCase(),
        role: selectedRole,
        isDisabled: false,
        avatarUrl: '',
        enrolledCourseCount: 0,
        totalLearningMinutes: 0,
        onboardingComplete: isAdmin ? true : false, // Students go through onboarding
        createdAt: serverTimestamp(),
      });

      // AuthContext onAuthStateChanged will route student → onboarding, admin → dashboard
    } catch (err: any) {
      console.error('Registration error:', err);
      let msg = 'Failed to create account';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak — use at least 6 characters';
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
          {/* ── Account Type Selector ── */}
          <Text style={styles.sectionLabel}>Account Type</Text>
          <View style={styles.roleGrid}>
            {ACCOUNT_TYPES.map((type) => {
              const active = selectedRole === type.role;
              return (
                <TouchableOpacity
                  key={type.role}
                  style={[
                    styles.roleCard,
                    active && { borderColor: type.color, backgroundColor: type.bg },
                  ]}
                  onPress={() => {
                    setSelectedRole(type.role);
                    setAdminCode('');
                    setError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.roleIconBg,
                      { backgroundColor: active ? type.color : Colors.surfaceLight },
                    ]}
                  >
                    <type.Icon
                      size={18}
                      color={active ? Colors.white : Colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.roleLabel, active && { color: type.color }]}>
                    {type.label}
                  </Text>
                  <Text style={styles.roleDesc} numberOfLines={2}>
                    {type.description}
                  </Text>
                  {active && (
                    <View style={[styles.roleDot, { backgroundColor: type.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Admin: Full Name ── */}
          {isAdmin && (
            <>
              <Text style={styles.sectionLabel}>Admin Details</Text>
              <Input
                label="Full Name *"
                placeholder="Your full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </>
          )}

          {/* ── Admin Code Field ── */}
          {selectedType.requiresCode && (
            <View style={styles.adminCodeWrapper}>
              <View style={[styles.adminCodeBadge, { backgroundColor: selectedType.bg }]}>
                <selectedType.Icon size={14} color={selectedType.color} />
                <Text style={[styles.adminCodeBadgeText, { color: selectedType.color }]}>
                  {selectedType.label} Code Required
                </Text>
              </View>
              <Input
                label="Admin Access Code"
                placeholder={`Enter your ${selectedType.label} code`}
                value={adminCode}
                onChangeText={(text) => { setAdminCode(text); setError(null); }}
                autoCapitalize="characters"
                secureTextEntry
              />
            </View>
          )}

          {/* ── Account Details ── */}
          <Text style={styles.sectionLabel}>
            {isAdmin ? 'Login Details' : 'Your Details'}
          </Text>

          {selectedRole === 'student' && (
            <View style={styles.onboardingNotice}>
              <GraduationCap size={16} color={Colors.primary} />
              <Text style={styles.onboardingNoticeText}>
                After creating your account you'll set up your profile and preferences.
              </Text>
            </View>
          )}

          <Input
            label="Email Address"
            placeholder="you@gmail.com"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null); }}
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

          <TouchableOpacity
            style={[
              styles.registerButton,
              { backgroundColor: selectedType.color },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Creating Account…' : `Create ${selectedType.label} Account`}
            </Text>
          </TouchableOpacity>

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
    paddingTop: 52,
    paddingBottom: 40,
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
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.md,
  },
  // ── Role Grid ──
  roleGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  roleCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.surface,
    padding: 10,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  roleIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 9.5,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  roleDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // ── Onboarding notice ──
  onboardingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: Spacing.sm,
  },
  onboardingNoticeText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    lineHeight: 18,
  },
  // ── Admin Code ──
  adminCodeWrapper: {
    marginBottom: Spacing.sm,
  },
  adminCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: Spacing.sm,
    gap: 5,
  },
  adminCodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // ── Form Fields ──
  registerButton: {
    marginTop: Spacing.lg,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonText: {
    color: Colors.white,
    ...Typography.h3,
  },
  errorText: {
    color: Colors.error,
    ...Typography.bodySmall,
    textAlign: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
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
