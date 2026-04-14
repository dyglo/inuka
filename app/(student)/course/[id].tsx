import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  ChevronLeft,
  Bookmark,
  Play,
  ArrowRight,
  Clock,
  FileText,
  CheckCircle,
  Download,
  MoreVertical,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  increment,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/context/AuthContext';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

const { width } = Dimensions.get('window');

export default function CourseDetails() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'materials'>('about');
  const [playing, setPlaying] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  const videoRef = useRef<Video>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!id) return;
    
    const fetchCourse = async () => {
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
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();

    if (user) {
      const enrollmentId = `${user.uid}_${id}`;
      const unsubscribe = onSnapshot(doc(db, 'enrollments', enrollmentId), (doc) => {
        setIsEnrolled(doc.exists());
      });
      return () => unsubscribe();
    }
  }, [id, user]);

  const handleEnroll = async () => {
    if (!user || !course) return;
    
    try {
      const enrollmentId = `${user.uid}_${course.id}`;
      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      
      await setDoc(enrollmentRef, {
        userId: user.uid,
        courseId: course.id,
        enrolledAt: serverTimestamp(),
        progress: 0,
        watchedMinutes: 0,
      });

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        enrolledCourseCount: increment(1)
      });

      Alert.alert('Enrolled!', 'You have successfully enrolled in this course.');
    } catch (error) {
      console.error('Enrollment error:', error);
      Alert.alert('Error', 'Failed to enroll. Please try again.');
    }
  };

  const saveDownloadMetadata = async (type: 'video' | 'pdf') => {
    try {
      const downloadsStr = await AsyncStorage.getItem('course_downloads');
      const downloads = downloadsStr ? JSON.parse(downloadsStr) : {};
      
      const courseId = course?.id || (id as string);
      
      if (!downloads[courseId]) {
        downloads[courseId] = {
          id: courseId,
          title: course?.title || 'Unknown Course',
          category: course?.category || 'General',
          timestamp: Date.now(),
          files: []
        };
      }
      
      if (!downloads[courseId].files.includes(type)) {
        downloads[courseId].files.push(type);
      }
      
      await AsyncStorage.setItem('course_downloads', JSON.stringify(downloads));
      return true;
    } catch (e) {
      console.error('Error saving metadata:', e);
      return false;
    }
  };

  const handleDownload = async () => {
    if (!course) return;
    
    const pdfUri = course.pdfUrl || course.materialUrl; // Flexible for different field names
    if (!pdfUri || !pdfUri.startsWith('http')) {
      Alert.alert('Invalid URL', 'No valid PDF URL found for this course.');
      return;
    }

    if (Platform.OS === 'web') {
      window.open(pdfUri, '_blank');
      return;
    }
    
    const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!docDir) {
      Alert.alert('Storage Error', 'Local file access is completely blocked on this device.');
      return;
    }

    setIsDownloading(true);
    setShowDownloadMenu(false);
    
    try {
      const fileUri = docDir + `course_${id}_material.pdf`;
      console.log('Starting PDF download from:', pdfUri);
      
      const result = await FileSystem.downloadAsync(
        encodeURI(pdfUri),
        fileUri
      );
      
      if (result && (result.status === 200 || result.status === 206)) {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists && fileInfo.size > 0) {
          await saveDownloadMetadata('pdf');
          Alert.alert('✅ Material Saved', 'The PDF has been saved for offline reading.');
          setIsBookmarked(true);
        } else {
          throw new Error('PDF download finished but file is empty or missing.');
        }
      } else {
        throw new Error(`Download failed with status ${result?.status}`);
      }
    } catch (e: any) {
      console.error('PDF Download Error:', e);
      Alert.alert('Download Failed', e.message || 'Failed to download PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!course) return;

    const videoUri = course.videoUrl;
    if (!videoUri.startsWith('http')) {
      Alert.alert('Invalid URL', 'No valid video URL found for this course.');
      return;
    }

    if (Platform.OS === 'web') {
      // On Web, expo-file-system isn't supported, so we pop the URL open
      window.open(videoUri, '_blank');
      return;
    }

    // Safety net: If Expo constants are undefined (rare SDK bug), fallback to standard iOS paths
    let docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    
    if (!docDir && Platform.OS === 'ios') {
      console.log("⚠️ FileSystem constants missing. Attempting iOS hard-coded fallback.");
      docDir = 'file:///var/mobile/Containers/Data/Application/Documents/'; 
      // Note: This is a guess, but better than a crash. 
      // However, usually undefined means the module is broken.
    }
    
    if (!docDir) {
      console.log("CRITICAL ERROR: FileSystem constants:", {
        docDir: FileSystem.documentDirectory,
        cacheDir: FileSystem.cacheDirectory,
      });
      
      // FINAL FALLBACK: If we are truly blocked, use Linking to trigger external browser
      console.log("Attempting Browser-style download fallback on Native...");
      const { Linking } = require('react-native');
      Linking.openURL(videoUri);
      return;
    }

    setIsDownloading(true);
    setShowDownloadMenu(false);
    
    try {
      const fileUri = docDir + `course_${id}_video.mp4`;
      console.log('Starting Video download from:', videoUri);
      
      // Check if already downloaded
      const existingFile = await FileSystem.getInfoAsync(fileUri);
      if (existingFile.exists) {
        Alert.alert(
          'Already Downloaded',
          'This video is already saved offline. Download again?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setIsDownloading(false) },
            { text: 'Re-download', onPress: () => performVideoDownload(videoUri, fileUri) },
          ]
        );
        return;
      }

      await performVideoDownload(videoUri, fileUri);
    } catch (e: any) {
      console.error('Video Download Error:', e);
      Alert.alert('Download Failed', e.message || 'Could not save video offline. Please check your connection.');
      setIsDownloading(false);
    }
  };

  const performVideoDownload = async (videoUri: string, fileUri: string) => {
    try {
      console.log('--- VIDEO DOWNLOAD START ---');
      console.log('URL:', videoUri);
      console.log('Dest:', fileUri);

      // Do not encodeURI here! Firebase URLs already have %2F which would get double-encoded.
      const result = await FileSystem.downloadAsync(videoUri, fileUri);
      
      if (result && (result.status === 200 || result.status === 206)) {
        console.log('Download request successful, status:', result.status);
        
        // Verify file was actually saved
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists && fileInfo.size > 0) {
          console.log('File verified on disk. Size:', fileInfo.size);
          const metaSaved = await saveDownloadMetadata('video');
          if (metaSaved) {
            Alert.alert('✅ Download Complete', 'The video has been saved for offline viewing. You can find it in the Downloads tab.');
          } else {
            throw new Error('Could not save download record, but file is on disk.');
          }
        } else {
          throw new Error('Download finished but file not found on disk or empty.');
        }
      } else {
        throw new Error(`Download failed with status ${result?.status || 'unknown'}`);
      }
    } catch (e: any) {
      console.error('CRITICAL DOWNLOAD ERROR:', e);
      Alert.alert('Download Error', e.message || 'Could not download video. Please check your storage and connection.');
    } finally {
      setIsDownloading(false);
    }
  };

  const onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    if (status.isPlaying) {
      const now = Date.now();
      const diff = now - lastUpdateRef.current;
      
      if (diff >= 30000) {
        lastUpdateRef.current = now;
        if (user && isEnrolled) {
          const enrollmentId = `${user.uid}_${course.id}`;
          const enrollmentRef = doc(db, 'enrollments', enrollmentId);
          const userRef = doc(db, 'users', user.uid);
          
          await updateDoc(enrollmentRef, {
            watchedMinutes: increment(1)
          });
          
          await updateDoc(userRef, {
            totalLearningMinutes: increment(1)
          });
        }
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

  if (!course) return null;

  return (
    <View style={styles.container}>
      <View style={styles.videoHeader}>
        {playing ? (
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ 
                uri: course.videoUrl?.startsWith('http') 
                  ? course.videoUrl 
                  : `https://raw.githubusercontent.com/dyglo/inuka/main/public/videos/${course.videoUrl}` 
              }}
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
              onError={(e) => {
                console.error('Video Error:', e);
                setIsVideoLoading(false);
                Alert.alert('Error', 'Could not play video.');
              }}
              usePoster={true}
              posterSource={{ uri: course.coverImageUrl || course.imageUrl }}
              posterStyle={styles.videoPoster}
            />
            {isVideoLoading && (
              <View style={styles.videoLoadingOverlay}>
                <ActivityIndicator size="large" color={Colors.white} />
                <Text style={styles.loadingText}>Loading Video...</Text>
              </View>
            )}
            
            {!isVideoLoading && (
              <TouchableOpacity 
                style={styles.fullscreenIconButton} 
                onPress={() => videoRef.current?.presentFullscreenPlayer()}
              >
                <View style={styles.fullscreenIconBg}>
                  <Text style={styles.fullscreenText}>⛶</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: course.coverImageUrl || course.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600' }}
              style={styles.headerImage}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay} />
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
          </View>
        )}
        
        {/* Absolute Back Button - moved for better safety */}
        {!isVideoLoading && (
          <View style={styles.headerButtonRow}>
            <TouchableOpacity 
              style={styles.floatingBackButton} 
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ChevronLeft color={Colors.white} size={28} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.downloadButton} 
              onPress={() => setShowDownloadMenu(!showDownloadMenu)}
            >
              <MoreVertical color={Colors.white} size={24} />
            </TouchableOpacity>

            {showDownloadMenu && (
              <View style={styles.downloadMenu}>
                {isDownloading ? (
                  <View style={styles.menuItem}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.menuItemText}>Downloading...</Text>
                  </View>
                ) : (
                  <>
                    {course?.videoUrl && (
                      <TouchableOpacity style={styles.menuItem} onPress={handleDownloadVideo}>
                        <Download size={18} color={Colors.primary} />
                        <Text style={styles.menuItemText}>Save Video Offline</Text>
                      </TouchableOpacity>
                    )}
                    {course?.hasPdfMaterial && course?.pdfUrl && (
                      <TouchableOpacity style={styles.menuItem} onPress={handleDownload}>
                        <FileText size={18} color={Colors.primary} />
                        <Text style={styles.menuItemText}>Save PDF Offline</Text>
                      </TouchableOpacity>
                    )}
                    {!course?.videoUrl && !course?.pdfUrl && (
                      <View style={styles.menuItem}>
                        <Text style={styles.menuItemText}>No files to download</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.infoContent}>
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'about' && styles.activeTab]} 
              onPress={() => setActiveTab('about')}
            >
              <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>About</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'materials' && styles.activeTab]} 
              onPress={() => setActiveTab('materials')}
            >
              <Text style={[styles.tabText, activeTab === 'materials' && styles.activeTabText]}>Materials</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{course.title}</Text>
          
          {activeTab === 'about' ? (
            <View>
              <View style={styles.tagRow}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{course.category || 'General'}</Text>
                </View>
                <View style={[styles.categoryBadge, { backgroundColor: Colors.surfaceLight }]}>
                  <Text style={[styles.categoryText, { color: Colors.textSecondary }]}>Free</Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>About this course</Text>
              <Text style={styles.description}>{course.description}</Text>

              <View style={styles.accessCard}>
                <View style={styles.accessIconBg}>
                  <Clock size={20} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.accessLabel}>Self-Paced Learning</Text>
                  <Text style={styles.accessSub}>Lifetime Access granted</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.materialsSection}>
              {course.hasPdfMaterial ? (
                <View style={styles.materialItem}>
                  <View style={styles.materialIcon}>
                    <FileText size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>Course Material.pdf</Text>
                    <Text style={styles.materialSize}>PDF • 2.4 MB</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.downloadAction} 
                    onPress={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Bookmark size={20} color={isBookmarked ? Colors.success : Colors.primary} fill={isBookmarked ? Colors.success : 'transparent'} />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyMaterials}>
                  <Text style={styles.emptyText}>No reading materials available for this course yet.</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isEnrolled ? (
          <View style={styles.enrolledStatus}>
            <CheckCircle size={20} color={Colors.success} />
            <Text style={styles.enrolledText}>You are enrolled</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.enrollButton} onPress={handleEnroll}>
            <View style={styles.enrollArrowBg}>
              <ArrowRight size={18} color={Colors.white} />
            </View>
            <Text style={styles.enrollBtnText}>Enroll Now</Text>
          </TouchableOpacity>
        )}
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
  videoHeader: {
    height: 300,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }],
    zIndex: 10,
  },
  playIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(26, 115, 232, 0.9)', // Using primary color for a real button look
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
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
  videoPoster: {
    resizeMode: 'cover',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)', // Slightly darker for better visibility
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30, // Extremely High Z-index
  },
  headerActions: {
    display: 'none', // Removed in favor of floatingBackButton
  },
  fullscreenIconButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 25,
  },
  fullscreenIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fullscreenText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtonRow: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 35,
  },
  downloadButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 115, 232, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  downloadMenu: {
    position: 'absolute',
    top: 60,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 8,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  menuItemText: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
  },
  infoContent: {
    padding: Spacing.lg,
    marginTop: -20,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  tab: {
    paddingVertical: 10,
    marginRight: Spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.primary,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    fontSize: 26,
    lineHeight: 34,
    marginBottom: Spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
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
  materialsSection: {
    marginTop: Spacing.sm,
  },
  materialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: Spacing.md,
  },
  materialIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  materialSize: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  downloadAction: {
    padding: 8,
  },
  emptyMaterials: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    elevation: 8,
  },
  enrollButton: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  enrolledStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: Colors.success + '15',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  enrolledText: {
    ...Typography.h3,
    color: Colors.success,
    marginLeft: 10,
  },
  enrollArrowBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enrollBtnText: {
    ...Typography.h3,
    color: Colors.white,
    flex: 1,
    textAlign: 'center',
    marginRight: 36,
  },
});
