import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import { ChevronLeft, Bookmark, Star, BookOpen, Play, ArrowRight, Clock } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';

export default function CourseDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'courses', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCourse({ id: docSnap.id, ...docSnap.data() });
        } else {
          Alert.alert('Error', 'Course not found');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching course:', error);
        Alert.alert('Error', 'Failed to load course details');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseDetails();
  }, [id, router]);

  const handleDownload = async () => {
    if (!course) return;
    // @ts-ignore
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      Alert.alert('Error', 'Filesystem is not available');
      return;
    }

    setIsDownloading(true);
    try {
      const fileUrl =
        course.fileUrl ||
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
      const fileUri = docDir + `course_${id}_material.pdf`;

      // @ts-ignore
      const downloadResumable = FileSystem.createDownloadResumable(
        fileUrl,
        fileUri,
        {},
        (downloadProgress: any) => {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          console.log(`Download progress: ${(progress * 100).toFixed(0)}%`);
        }
      );

      // @ts-ignore
      const result = await downloadResumable.downloadAsync();
      if (result) {
        Alert.alert('Downloaded!', 'Material saved for offline use. Find it in the Downloads tab.');
        setIsBookmarked(true);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to download material.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!course) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Image Section */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                course.imageUrl ||
                'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600',
            }}
            style={styles.headerImage}
            resizeMode="cover"
          />
          <View style={styles.imageOverlay} />

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.back()}>
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, isBookmarked && styles.activeActionButton]}
              onPress={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Bookmark
                  color={Colors.white}
                  size={22}
                  fill={isBookmarked ? Colors.white : 'transparent'}
                />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.playButton}>
            <Play color={Colors.white} size={28} fill={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Course Info */}
        <View style={styles.infoContent}>
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <BookOpen size={12} color={Colors.textSecondary} />
              <Text style={styles.statText}>12 Lectures</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statText}>150 Enrolled</Text>
            </View>
            <View style={styles.ratingChip}>
              <Star size={12} color={Colors.accent} fill={Colors.accent} />
              <Text style={styles.ratingText}>4.8</Text>
            </View>
          </View>

          {course.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{course.category}</Text>
            </View>
          )}

          <Text style={styles.title}>{course.title}</Text>

          <View style={styles.instructorSection}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/150?u=inuka' }}
              style={styles.instructorAvatar}
            />
            <View>
              <Text style={styles.instructorName}>Inuka Team</Text>
              <Text style={styles.instructorTitle}>Expert Instructor</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>About this course</Text>
          <Text style={styles.description}>{course.description}</Text>

          <View style={styles.accessCard}>
            <View style={styles.accessIconBg}>
              <Clock size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.accessLabel}>Self-Paced</Text>
              <Text style={styles.accessSub}>Lifetime Access</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer Enroll Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.enrollButton}>
          <View style={styles.enrollArrowBg}>
            <ArrowRight size={18} color={Colors.white} />
          </View>
          <Text style={styles.enrollText}>Enroll Now</Text>
        </TouchableOpacity>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>Free</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  imageContainer: {
    height: 320,
    width: '100%',
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,15,30,0.3)',
  },
  headerActions: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeActionButton: {
    backgroundColor: Colors.primary,
  },
  playButton: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  infoContent: {
    padding: Spacing.lg,
    marginTop: -20,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefce8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  ratingText: {
    ...Typography.caption,
    color: '#92400e',
    fontWeight: '700',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: Spacing.sm,
  },
  categoryText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    fontSize: 26,
    lineHeight: 34,
    marginBottom: Spacing.lg,
  },
  instructorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  instructorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  instructorName: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  instructorTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  accessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  accessIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  accessLabel: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  accessSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  enrollButton: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginRight: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  enrollArrowBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enrollText: {
    ...Typography.h3,
    color: Colors.white,
    flex: 1,
    textAlign: 'center',
    marginRight: 36,
  },
  priceTag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
  },
  priceText: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: '800',
  },
});
