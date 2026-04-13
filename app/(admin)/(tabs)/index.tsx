import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import { Users, BookOpen, TrendingUp, Plus, ChevronRight } from 'lucide-react-native';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeCourses: 0,
    completionRate: '82%',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      const studentsSnapshot = await getCountFromServer(studentsQuery);

      const coursesQuery = query(collection(db, 'courses'));
      const coursesSnapshot = await getCountFromServer(coursesQuery);

      setStats((prev) => ({
        ...prev,
        totalStudents: studentsSnapshot.data().count,
        activeCourses: coursesSnapshot.data().count,
      }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const STATS_DATA = [
    {
      label: 'Total Students',
      value: stats.totalStudents.toString(),
      icon: Users,
      color: Colors.primary,
      bg: Colors.primaryLight,
    },
    {
      label: 'Active Courses',
      value: stats.activeCourses.toString(),
      icon: BookOpen,
      color: Colors.success,
      bg: '#d1fae5',
    },
    {
      label: 'Completion',
      value: stats.completionRate,
      icon: TrendingUp,
      color: '#f59e0b',
      bg: '#fef3c7',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Admin Panel</Text>
          <Text style={styles.title}>Welcome, {user?.displayName?.split(' ')[0] || 'Admin'} 👋</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {STATS_DATA.map((stat, index) => (
          <View key={index} style={[styles.statCard, { borderTopColor: stat.color, borderTopWidth: 3 }]}>
            <View style={[styles.iconContainer, { backgroundColor: stat.bg }]}>
              <stat.icon size={22} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionPrimary]}
          onPress={() => router.push('/(admin)/(tabs)/manage')}
          activeOpacity={0.85}
        >
          <View style={styles.actionIconBg}>
            <Plus size={24} color={Colors.white} />
          </View>
          <Text style={styles.actionText}>Manage Courses</Text>
          <ChevronRight size={16} color={Colors.white} style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionSecondary]}
          onPress={() => router.push('/(admin)/(tabs)/students')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBg, { backgroundColor: Colors.success + '20' }]}>
            <Users size={24} color={Colors.success} />
          </View>
          <Text style={[styles.actionText, { color: Colors.text }]}>View Students</Text>
          <ChevronRight size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>System Status</Text>
      <View style={styles.activityCard}>
        <View style={styles.activityItem}>
          <View style={[styles.activityDot, { backgroundColor: Colors.success }]} />
          <View style={styles.activityBody}>
            <Text style={styles.activityTitle}>Firebase Connected</Text>
            <Text style={styles.activitySub}>Firestore is live and syncing</Text>
          </View>
        </View>
        <View style={styles.activityItem}>
          <View style={[styles.activityDot, { backgroundColor: Colors.primary }]} />
          <View style={styles.activityBody}>
            <Text style={styles.activityTitle}>Auth Active</Text>
            <Text style={styles.activitySub}>Firebase Authentication enabled</Text>
          </View>
        </View>
        <View style={[styles.activityItem, { borderBottomWidth: 0 }]}>
          <View style={[styles.activityDot, { backgroundColor: '#f59e0b' }]} />
          <View style={styles.activityBody}>
            <Text style={styles.activityTitle}>Storage Ready</Text>
            <Text style={styles.activitySub}>Firebase Storage configured</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  greeting: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 12,
  },
  logoutText: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...Typography.h2,
    color: Colors.text,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  actionsGrid: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionSecondary: {
    backgroundColor: Colors.surface,
    borderColor: Colors.glassBorder,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  actionText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
    flex: 1,
  },
  activityCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  activityBody: {
    flex: 1,
  },
  activityTitle: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
  },
  activitySub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
