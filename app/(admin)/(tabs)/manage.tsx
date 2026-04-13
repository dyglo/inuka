import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import { Plus, Trash2, X, BookOpen } from 'lucide-react-native';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';

export default function ManageCoursesScreen() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedCourses: any[] = [];
      querySnapshot.forEach((doc) => {
        fetchedCourses.push({ id: doc.id, ...doc.data() });
      });
      setCourses(fetchedCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
      Alert.alert('Error', 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = async () => {
    if (!title || !category || !description) {
      Alert.alert('Missing Fields', 'Please fill in Title, Category, and Description');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'courses'), {
        title,
        category,
        description,
        imageUrl:
          imageUrl ||
          'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Course added successfully');
      setModalVisible(false);
      resetForm();
      fetchCourses();
    } catch (error) {
      console.error('Error adding course:', error);
      Alert.alert('Error', 'Failed to add course');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('');
    setDescription('');
    setImageUrl('');
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Course', 'Are you sure you want to delete this course?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'courses', id));
            setCourses((prev) => prev.filter((c) => c.id !== id));
          } catch (error) {
            console.error('Error deleting course:', error);
            Alert.alert('Error', 'Failed to delete course');
          }
        },
      },
    ]);
  };

  if (loading && courses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Manage Courses</Text>
          <Text style={styles.subtitle}>{courses.length} course{courses.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Plus size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchCourses}
        renderItem={({ item }) => (
          <View style={styles.courseRow}>
            <View style={styles.courseIconBg}>
              <BookOpen size={20} color={Colors.primary} />
            </View>
            <View style={styles.courseInfo}>
              <Text style={styles.courseName} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.courseDetail}>{item.category || 'Uncategorized'}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id)}
            >
              <Trash2 size={17} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <BookOpen size={56} color={Colors.surfaceBorder} />
            <Text style={styles.emptyTitle}>No Courses Yet</Text>
            <Text style={styles.emptySubtitle}>Tap the + button to add a course.</Text>
          </View>
        }
      />

      {/* Add Course Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Course</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <View style={styles.closeButton}>
                  <X size={20} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Input
                label="Course Title *"
                placeholder="e.g. Introduction to React Native"
                value={title}
                onChangeText={setTitle}
                autoCapitalize="words"
              />
              <Input
                label="Category *"
                placeholder="e.g. Software, Design, Business"
                value={category}
                onChangeText={setCategory}
                autoCapitalize="words"
              />
              <Input
                label="Image URL (Optional)"
                placeholder="https://images.unsplash.com/..."
                value={imageUrl}
                onChangeText={setImageUrl}
                keyboardType="url"
              />
              <Input
                label="Description *"
                placeholder="Brief overview of the course..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: 'top', paddingTop: 12 }}
              />

              <Button
                title="Create Course"
                onPress={handleAddCourse}
                loading={submitting}
                style={styles.createButton}
              />
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  courseIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  courseDetail: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.glassBorder,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {},
  createButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
});
