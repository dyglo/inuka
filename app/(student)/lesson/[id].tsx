import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  ChevronLeft,
  Play,
  FileText,
  CheckCircle,
  Download,
  ClipboardList,
  BookOpen,
  Award,
} from 'lucide-react-native';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { markLessonComplete, isLessonCompleted } from '../../../src/services/progressService';

const { width } = Dimensions.get('window');

export default function LessonDetail() {
  const { id, courseId: paramCourseId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'quiz'>('notes');
  const [markingComplete, setMarkingComplete] = useState(false);

  const videoRef = useRef<Video>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const watchedSecondsRef = useRef<number>(0);
  const videoDurationRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;
    loadLesson();
  }, [id]);

  const loadLesson = async () => {
    try {
      const docRef = doc(db, 'lessons', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const lessonData = { id: docSnap.id, ...docSnap.data() };
        setLesson(lessonData);

        // Check if quiz exists for this lesson
        const quizSnap = await getDocs(
          query(collection(db, 'quizzes'), where('lessonId', '==', id)),
        );
        setHasQuiz(!quizSnap.empty);

        // Check if quiz already passed
        if (user && !quizSnap.empty) {
          const resultId = `${user.uid}_${id}`;
          const resultRef = doc(db, 'quizResults', resultId);
          const resultSnap = await getDoc(resultRef);
          if (resultSnap.exists() && resultSnap.data()?.passed) {
            setQuizPassed(true);
          }
        }

        // Check completion status
        if (user) {
          const done = await isLessonCompleted(user.uid, id as string);
          setCompleted(done);
        }
      } else {
        Alert.alert('Error', 'Lesson not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!user || !lesson || completed) return;
    setMarkingComplete(true);
    try {
      const courseId = (paramCourseId as string) || lesson.courseId;
      await markLessonComplete(user.uid, lesson.id, courseId);
      setCompleted(true);
      Alert.alert('✅ Lesson Complete!', 'Great work! Your progress has been updated.');
    } catch (error) {
      console.error('Error marking complete:', error);
      Alert.alert('Error', 'Could not mark lesson as complete.');
    } finally {
      setMarkingComplete(false);
    }
  };

  const onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    // Track total duration
    if (status.durationMillis) {
      videoDurationRef.current = status.durationMillis / 1000;
    }

    if (status.isPlaying) {
      const now = Date.now();
      const diff = now - lastUpdateRef.current;

      if (diff >= 1000) {
        lastUpdateRef.current = now;
        watchedSecondsRef.current += 1;

        // Auto-mark complete at 80% watch threshold
        if (
          !completed &&
          videoDurationRef.current > 0 &&
          watchedSecondsRef.current / videoDurationRef.current >= 0.8
        ) {
          handleMarkComplete();
        }
      }

      // Update user learning time every 30s
      if (diff >= 30000 && user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          totalLearningMinutes: increment(1),
        });
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!lesson) return null;

  return (
    <View style={styles.container}>
      {/* Video Header */}
      <View style={styles.videoHeader}>
        {playing ? (
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: lesson.videoUrl }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              progressUpdateIntervalMillis={500}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  setIsVideoLoading(status.isBuffering);
                }
                onPlaybackStatusUpdate(status);
              }}
              onLoadStart={() => setIsVideoLoading(true)}
              onLoad={() => setIsVideoLoading(false)}
              onError={() => {
                setIsVideoLoading(false);
                Alert.alert('Error', 'Could not play video.');
              }}
            />
            {isVideoLoading && (
              <View style={styles.videoLoadingOverlay}>
                <ActivityIndicator size="large" color={Colors.white} />
                <Text style={styles.loadingText}>Loading Video...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <View style={styles.placeholderInner}>
              <BookOpen size={48} color={Colors.primary} />
              <Text style={styles.placeholderTitle} numberOfLines={2}>
                {lesson.title}
              </Text>
            </View>
            {lesson.videoUrl && (
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => {
                  setPlaying(true);
                  setIsVideoLoading(true);
                }}
              >
                <View style={styles.playIconBg}>
                  <Play color={Colors.white} size={32} fill={Colors.white} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft color={Colors.white} size={28} />
        </TouchableOpacity>

        {/* Completion badge overlay */}
        {completed && (
          <View style={styles.completedBadge}>
            <CheckCircle size={16} color={Colors.white} />
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notes' && styles.activeTab]}
          onPress={() => setActiveTab('notes')}
        >
          <FileText
            size={16}
            color={activeTab === 'notes' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'notes' && styles.activeTabText]}>
            Notes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'quiz' && styles.activeTab]}
          onPress={() => setActiveTab('quiz')}
        >
          <ClipboardList
            size={16}
            color={activeTab === 'quiz' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'quiz' && styles.activeTabText]}>
            Quiz
          </Text>
          {hasQuiz && (
            <View
              style={[
                styles.quizDot,
                quizPassed && { backgroundColor: Colors.success },
              ]}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'notes' ? (
          <View style={styles.notesContent}>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <Text style={styles.lessonDescription}>{lesson.description}</Text>

            {/* PDF Material */}
            {lesson.pdfUrl && (
              <TouchableOpacity
                style={styles.materialCard}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open(lesson.pdfUrl, '_blank');
                  } else {
                    Linking.openURL(lesson.pdfUrl);
                  }
                }}
              >
                <View style={styles.materialIconBg}>
                  <FileText size={22} color={Colors.primary} />
                </View>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialName}>Course Material</Text>
                  <Text style={styles.materialType}>PDF Document</Text>
                </View>
                <Download size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}

            {/* YouTube Link */}
            {lesson.youtubeUrl && (
              <TouchableOpacity
                style={styles.materialCard}
                onPress={() => Linking.openURL(lesson.youtubeUrl)}
              >
                <View style={[styles.materialIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <Play size={22} color="#EF4444" />
                </View>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialName}>Additional Video</Text>
                  <Text style={styles.materialType}>YouTube Link</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.quizContent}>
            {hasQuiz ? (
              <View style={styles.quizCard}>
                <View style={styles.quizIconBg}>
                  <ClipboardList size={32} color={Colors.primary} />
                </View>
                <Text style={styles.quizTitle}>Lesson Assessment</Text>
                <Text style={styles.quizSubtitle}>
                  Test your understanding of this lesson with a short quiz.
                </Text>

                {quizPassed ? (
                  <View style={styles.passedCard}>
                    <Award size={24} color={Colors.success} />
                    <Text style={styles.passedText}>You've passed this quiz!</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.quizButton, quizPassed && styles.quizButtonRetake]}
                  onPress={() =>
                    router.push({
                      pathname: '/(student)/quiz/[lessonId]',
                      params: {
                        lessonId: lesson.id,
                        courseId: lesson.courseId,
                      },
                    })
                  }
                >
                  <Text
                    style={[
                      styles.quizButtonText,
                      quizPassed && styles.quizButtonRetakeText,
                    ]}
                  >
                    {quizPassed ? 'Retake Quiz' : 'Take Quiz'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noQuizCard}>
                <ClipboardList size={40} color={Colors.textMuted} />
                <Text style={styles.noQuizText}>
                  No quiz available for this lesson yet.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer — Mark Complete */}
      <View style={styles.footer}>
        {completed ? (
          <View style={styles.completedFooter}>
            <CheckCircle size={22} color={Colors.success} />
            <Text style={styles.completedFooterText}>Lesson Completed</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleMarkComplete}
            disabled={markingComplete}
          >
            {markingComplete ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <CheckCircle size={20} color={Colors.white} />
                <Text style={styles.completeButtonText}>Mark as Complete</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ─── Video Header ──────────────────
  videoHeader: {
    height: 260,
    backgroundColor: '#0f0f1e',
    position: 'relative',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  video: { width: '100%', height: '100%' },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingText: {
    color: Colors.white,
    marginTop: 10,
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#0f0f1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderInner: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  placeholderTitle: {
    ...Typography.h3,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  playButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    zIndex: 10,
  },
  playIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  completedBadge: {
    position: 'absolute',
    top: 52,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    zIndex: 30,
  },
  completedBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '700',
  },
  // ─── Tab Bar ──────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    paddingHorizontal: Spacing.lg,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginRight: Spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  activeTab: { borderBottomColor: Colors.primary },
  tabText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: { color: Colors.primary },
  quizDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
    marginLeft: 4,
  },
  // ─── Content ──────────────────
  scrollContent: { paddingBottom: 120 },
  notesContent: { padding: Spacing.lg },
  lessonTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  lessonDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: 14,
  },
  materialIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  materialInfo: { flex: 1 },
  materialName: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
  },
  materialType: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // ─── Quiz Tab ──────────────────
  quizContent: { padding: Spacing.lg },
  quizCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  quizIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  quizTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  quizSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  passedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
    marginBottom: Spacing.md,
    width: '100%',
  },
  passedText: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: '600',
  },
  quizButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  quizButtonRetake: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  quizButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '700',
  },
  quizButtonRetakeText: { color: Colors.primary },
  noQuizCard: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  noQuizText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // ─── Footer ──────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  completeButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  completeButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '700',
  },
  completedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    gap: 10,
  },
  completedFooterText: {
    ...Typography.body,
    color: Colors.success,
    fontWeight: '700',
  },
});
