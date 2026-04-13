import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import { Search, Bell, BookOpen, ArrowRight } from 'lucide-react-native';
import { CourseCard } from '../../../src/components/CourseCard';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [featuredCourse, setFeaturedCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Software', 'Design', 'Business', 'Marketing'];

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const fetchedCourses: any[] = [];
      querySnapshot.forEach((doc) => {
        fetchedCourses.push({ id: doc.id, ...doc.data() });
      });
      setCourses(fetchedCourses);
      if (fetchedCourses.length > 0) {
        setFeaturedCourse(fetchedCourses[0]);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.displayName?.split(' ')[0] || 'Student';
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

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
        <View style={styles.profileRow}>
          <Image
            source={{
              uri:
                user?.photoURL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user?.displayName || 'Student'
                )}&background=5b3cc4&color=fff&size=150`,
            }}
            style={styles.avatar}
          />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Search color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Bell color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.greetingRow}>
          <Text style={styles.greetingText}>{greeting()},</Text>
          <Text style={styles.welcomeTitle}>{firstName}! 👋</Text>
        </View>
      </View>

      {/* Featured Course Banner */}
      {featuredCourse && (
        <TouchableOpacity
          style={styles.featuredCard}
          onPress={() => router.push(`/(student)/course/${featuredCourse.id}`)}
          activeOpacity={0.9}
        >
          <Image
            source={{
              uri:
                featuredCourse.imageUrl ||
                'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600',
            }}
            style={styles.featuredImage}
            resizeMode="cover"
          />
          <View style={styles.featuredOverlay} />
          <View style={styles.featuredContent}>
            <View style={styles.featuredBadge}>
              <BookOpen size={12} color={Colors.white} />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
            <Text style={styles.featuredTitle} numberOfLines={2}>
              {featuredCourse.title}
            </Text>
            <View style={styles.featuredFooter}>
              <Text style={styles.featuredCategory}>{featuredCourse.category || 'Course'}</Text>
              <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => router.push(`/(student)/course/${featuredCourse.id}`)}
              >
                <View style={styles.arrowBg}>
                  <ArrowRight size={16} color={Colors.text} />
                </View>
                <Text style={styles.bookNowText}>Learn More</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Categories */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Choose Category</Text>
        <TouchableOpacity>
          <Text style={styles.seeMore}>See More</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={{ paddingRight: Spacing.lg }}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Course List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Courses</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.coursesScroll}
        contentContainerStyle={{ paddingRight: Spacing.lg }}
      >
        {courses.map((course, index) => (
          <CourseCard
            key={course.id}
            course={course}
            onPress={() => router.push(`/(student)/course/${course.id}`)}
            featured={index === 0}
          />
        ))}
        {courses.length === 0 && (
          <Text style={styles.emptyText}>No courses available yet.</Text>
        )}
      </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  greetingRow: {
    marginBottom: Spacing.sm,
  },
  greetingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  welcomeTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  // Featured card
  featuredCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    borderRadius: 24,
    overflow: 'hidden',
    height: 200,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 15, 30, 0.55)',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: Spacing.sm,
  },
  featuredBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  featuredTitle: {
    ...Typography.h3,
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredCategory: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  bookNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  arrowBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bookNowText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  seeMore: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingLeft: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    marginRight: Spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  categoryText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  coursesScroll: {
    paddingLeft: Spacing.lg,
    marginBottom: Spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    fontStyle: 'italic',
    marginTop: Spacing.md,
  },
});
