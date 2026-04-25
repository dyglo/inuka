import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { Colors } from '../../../src/theme/colors';
import { Spacing, Typography } from '../../../src/theme';
import {
  collection, getDocs, deleteDoc, doc, orderBy, query, addDoc, where,
  serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../src/config/firebase';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus, Trash2, X, BookOpen, ChevronDown, ChevronRight,
  Layers, FileText, Video, Image as ImageIcon, CheckCircle, ClipboardList, Pencil,
} from 'lucide-react-native';

interface Course { id: string; title: string; category: string; [k: string]: any; }
interface Module { id: string; title: string; description: string; courseId: string; order: number; videoUrl?: string | null; youtubeUrl?: string | null; }
interface Lesson { id: string; title: string; description: string; moduleId: string; courseId: string; order: number; videoUrl?: string; pdfUrl?: string; youtubeUrl?: string; }
interface Quiz {
  id: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  passMark: number;
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

type ModalType = 'course' | 'module' | 'lesson' | 'quiz' | null;

export default function ManageCoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [parentId, setParentId] = useState('');
  const [parentCourseId, setParentCourseId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // non-null = edit mode

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formPdfUrl, setFormPdfUrl] = useState('');
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('');
  const [formPassMark, setFormPassMark] = useState('60');
  const [formQuestions, setFormQuestions] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [selectedPdf, setSelectedPdf] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cSnap, mSnap, lSnap, qSnap] = await Promise.all([
        getDocs(query(collection(db, 'courses'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'modules'), orderBy('order', 'asc'))),
        getDocs(query(collection(db, 'lessons'), orderBy('order', 'asc'))),
        getDocs(collection(db, 'quizzes')),
      ]);
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module)));
      setLessons(lSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));
      setQuizzes(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormTitle(''); setFormDesc('');
    setFormVideoUrl(''); setFormPdfUrl(''); setFormYoutubeUrl('');
    setFormPassMark('60'); setFormQuestions([]);
    setSelectedVideo(null); setSelectedPdf(null); setSelectedImage(null);
    setEditingId(null);
  };

  const openModal = (type: ModalType, pId = '', pCourseId = '') => {
    resetForm(); setParentId(pId); setParentCourseId(pCourseId); setModalType(type);
  };

  const openEditModal = (type: ModalType, item: any, pId = '', pCourseId = '') => {
    resetForm();
    setEditingId(item.id);
    setParentId(pId);
    setParentCourseId(pCourseId);
    setFormTitle(item.title || '');
    setFormDesc(item.description || '');
    setFormVideoUrl(item.videoUrl || '');
    setFormPdfUrl(item.pdfUrl || '');
    setFormYoutubeUrl(item.youtubeUrl || '');
    if (type === 'quiz') {
      setFormPassMark(String(item.passMark || 60));
      setFormQuestions(item.questions || []);
    }
    setModalType(type);
  };

  const uploadFile = async (uri: string, path: string) => {
    const r = await fetch(uri); const b = await r.blob();
    const sRef = ref(storage, path); await uploadBytes(sRef, b);
    return getDownloadURL(sRef);
  };

  const pickVideo = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (!r.canceled) setSelectedVideo(r.assets[0]);
  };
  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!r.canceled) setSelectedPdf(r.assets[0]);
  };
  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!r.canceled) setSelectedImage(r.assets[0]);
  };

  // ─── Save Handlers (create + edit) ────────────────────────────────────────
  const handleSaveCourse = async () => {
    if (!formTitle || !formDesc) { Alert.alert('Missing Fields', 'Title and Description are required'); return; }
    setSubmitting(true);
    try {
      const ts = Date.now();
      let videoUrl = formVideoUrl || '';
      let pdfUrl = formPdfUrl || '';
      let coverUrl = editingId
        ? (courses.find(c => c.id === editingId)?.coverImageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600')
        : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600';
      if (selectedVideo) videoUrl = await uploadFile(selectedVideo.uri, `courses/videos/${ts}_${selectedVideo.name || 'v.mp4'}`);
      if (selectedPdf) pdfUrl = await uploadFile(selectedPdf.uri, `courses/materials/${ts}_${selectedPdf.name || 'm.pdf'}`);
      if (selectedImage) coverUrl = await uploadFile(selectedImage.uri, `courses/covers/${ts}_cover.jpg`);
      const data: any = {
        title: formTitle, description: formDesc,
        coverImageUrl: coverUrl, hasPdfMaterial: !!(pdfUrl), pdfUrl,
        updatedAt: serverTimestamp(),
      };
      if (videoUrl) data.videoUrl = videoUrl;
      if (editingId) {
        await updateDoc(doc(db, 'courses', editingId), data);
        Alert.alert('Updated', 'Course updated!');
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'courses'), data);
        Alert.alert('Success', 'Course created! You can add videos later by editing.');
      }
      setModalType(null); resetForm(); fetchAll();
    } catch (e) { console.error(e); Alert.alert('Error', 'Failed to save course'); }
    finally { setSubmitting(false); }
  };

  const handleSaveModule = async () => {
    if (!formTitle) { Alert.alert('Missing', 'Enter a module title'); return; }
    setSubmitting(true);
    try {
      let uploadedVideoUrl = formVideoUrl;
      if (selectedVideo) uploadedVideoUrl = await uploadFile(selectedVideo.uri, `modules/videos/${Date.now()}_${selectedVideo.name || 'v.mp4'}`);
      if (editingId) {
        await updateDoc(doc(db, 'modules', editingId), {
          title: formTitle, description: formDesc,
          videoUrl: uploadedVideoUrl || null, youtubeUrl: formYoutubeUrl || null, updatedAt: serverTimestamp(),
        });
        Alert.alert('Updated', 'Module updated!');
      } else {
        const existing = modules.filter(m => m.courseId === parentId);
        await addDoc(collection(db, 'modules'), {
          title: formTitle, description: formDesc, courseId: parentId,
          order: existing.length + 1, createdAt: serverTimestamp(),
          videoUrl: uploadedVideoUrl || null, youtubeUrl: formYoutubeUrl || null,
        });
        Alert.alert('Success', 'Module added!');
      }
      setModalType(null); resetForm(); fetchAll();
    } catch (e) { console.error(e); Alert.alert('Error', 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleSaveLesson = async () => {
    if (!formTitle) { Alert.alert('Missing', 'Enter a lesson title'); return; }
    setSubmitting(true);
    try {
      let videoUrl = formVideoUrl;
      let pdfUrl = formPdfUrl;
      if (selectedVideo) videoUrl = await uploadFile(selectedVideo.uri, `lessons/videos/${Date.now()}_${selectedVideo.name || 'v.mp4'}`);
      if (selectedPdf) pdfUrl = await uploadFile(selectedPdf.uri, `lessons/pdfs/${Date.now()}_${selectedPdf.name || 'm.pdf'}`);
      if (editingId) {
        await updateDoc(doc(db, 'lessons', editingId), {
          title: formTitle, description: formDesc, videoUrl, pdfUrl,
          youtubeUrl: formYoutubeUrl || null, updatedAt: serverTimestamp(),
        });
        Alert.alert('Updated', 'Lesson updated!');
      } else {
        const existing = lessons.filter(l => l.moduleId === parentId);
        await addDoc(collection(db, 'lessons'), {
          title: formTitle, description: formDesc, moduleId: parentId, courseId: parentCourseId,
          order: existing.length + 1, videoUrl, pdfUrl, youtubeUrl: formYoutubeUrl || null, createdAt: serverTimestamp(),
        });
        Alert.alert('Success', 'Lesson added!');
      }
      setModalType(null); resetForm(); fetchAll();
    } catch (e) { console.error(e); Alert.alert('Error', 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleCreateQuiz = async () => {
    if (formQuestions.length === 0) { Alert.alert('Empty Quiz', 'Add at least one question'); return; }
    setSubmitting(true);
    try {
      // Check if quiz already exists for this target
      const qRef = collection(db, 'quizzes');
      const q = parentCourseId ? query(qRef, where('moduleId', '==', parentId)) : query(qRef, where('lessonId', '==', parentId));
      const snap = await getDocs(q);
      
      const quizData = {
        courseId: parentCourseId || parentId, // if adding to course, parentId is courseId
        passMark: parseInt(formPassMark) || 60,
        questions: formQuestions,
        createdAt: serverTimestamp(),
      };

      if (modalType === 'quiz' && parentCourseId) {
        // Module level quiz
        (quizData as any).moduleId = parentId;
      } else if (modalType === 'quiz') {
        // Lesson level quiz
        (quizData as any).lessonId = parentId;
      }

      if (!snap.empty) {
        await updateDoc(doc(db, 'quizzes', snap.docs[0].id), quizData);
      } else {
        await addDoc(collection(db, 'quizzes'), quizData);
      }

      Alert.alert('Success', 'Quiz saved!');
      setModalType(null); resetForm(); fetchAll();
    } catch (e) { console.error(e); Alert.alert('Error', 'Failed to save quiz'); }
    finally { setSubmitting(false); }
  };

  const addQuestion = () => {
    setFormQuestions([...formQuestions, {
      id: `q${Date.now()}`,
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: '',
    }]);
  };

  const updateQuestion = (index: number, key: string, value: any) => {
    const newQs = [...formQuestions];
    newQs[index] = { ...newQs[index], [key]: value };
    setFormQuestions(newQs);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const newQs = [...formQuestions];
    newQs[qIndex].options[optIndex] = value;
    setFormQuestions(newQs);
  };

  const handleDelete = (colName: string, id: string, label: string) => {
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, colName, id)); fetchAll();
      }},
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading && courses.length === 0) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const renderCourse = ({ item }: { item: Course }) => {
    const open = expandedCourse === item.id;
    const courseMods = modules.filter(m => m.courseId === item.id);
    const hasCourseQuiz = quizzes.some(q => q.courseId === item.id && !q.moduleId && !q.lessonId);

    return (
      <View style={s.courseCard}>
        <TouchableOpacity style={s.courseRow} onPress={() => setExpandedCourse(open ? null : item.id)} activeOpacity={0.7}>
          <View style={s.courseIconBg}><BookOpen size={18} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.courseTitle} numberOfLines={1}>{item.title}</Text>
            <View style={s.courseBadgeRow}>
              <Text style={s.courseSub}>{courseMods.length} module{courseMods.length !== 1 ? 's' : ''}{item.videoUrl ? '' : ' · No video yet'}</Text>
              {hasCourseQuiz && (
                <View style={s.quizBadge}>
                  <ClipboardList size={10} color={Colors.white} />
                  <Text style={s.quizBadgeText}>Final Quiz</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => openEditModal('course', item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 8 }}>
            <Pencil size={15} color={Colors.primary} />
          </TouchableOpacity>
          {open ? <ChevronDown size={18} color={Colors.primary} /> : <ChevronRight size={18} color={Colors.textMuted} />}
        </TouchableOpacity>

        {open && (
          <View style={s.expanded}>
            {/* Add Module button */}
            <View style={s.courseActionRow}>
              <TouchableOpacity style={s.addRowBtn} onPress={() => openModal('module', item.id)}>
                <Plus size={14} color={Colors.primary} /><Text style={s.addRowText}>Add Module</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.addRowBtn, { backgroundColor: '#fef3c7' }]} onPress={() => {
                const existing = quizzes.find(q => q.courseId === item.id && !q.moduleId && !q.lessonId);
                if (existing) {
                  setFormPassMark(existing.passMark.toString());
                  setFormQuestions(existing.questions);
                }
                openModal('quiz', item.id);
              }}>
                <ClipboardList size={14} color="#d97706" /><Text style={[s.addRowText, { color: '#d97706' }]}>Final Quiz</Text>
              </TouchableOpacity>
            </View>

            {courseMods.map(mod => {
              const modOpen = expandedModule === mod.id;
              const modLessons = lessons.filter(l => l.moduleId === mod.id);
              const hasModQuiz = quizzes.some(q => q.moduleId === mod.id);
              return (
                <View key={mod.id} style={s.moduleCard}>
                  <TouchableOpacity style={s.moduleRow} onPress={() => setExpandedModule(modOpen ? null : mod.id)}>
                    <Layers size={15} color={Colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.moduleTitle}>{mod.title}</Text>
                        {hasModQuiz && <ClipboardList size={12} color={Colors.primary} />}
                      </View>
                      <Text style={s.moduleSub}>{modLessons.length} lessons</Text>
                    </View>
                    <TouchableOpacity onPress={() => openEditModal('module', mod, item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 10 }}>
                      <Pencil size={13} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete('modules', mod.id, mod.title)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Trash2 size={14} color={Colors.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {modOpen && (
                    <View style={s.lessonList}>
                      <View style={s.modActionRow}>
                        <TouchableOpacity style={s.addRowBtnSm} onPress={() => openModal('lesson', mod.id, item.id)}>
                          <Plus size={12} color={Colors.primary} /><Text style={s.addRowTextSm}>Add Lesson</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.addRowBtnSm} onPress={() => {
                          const existing = quizzes.find(q => q.moduleId === mod.id);
                          if (existing) {
                            setFormPassMark(existing.passMark.toString());
                            setFormQuestions(existing.questions);
                          }
                          openModal('quiz', mod.id, item.id);
                        }}>
                          <ClipboardList size={12} color={Colors.primary} /><Text style={s.addRowTextSm}>Module Quiz</Text>
                        </TouchableOpacity>
                      </View>
                      {modLessons.map(les => {
                         const hasLesQuiz = quizzes.some(q => q.lessonId === les.id);
                         const lesQuiz = quizzes.find(q => q.lessonId === les.id);
                         return (
                          <View key={les.id} style={s.lessonRow}>
                            <View style={s.lessonDot} />
                            <Text style={s.lessonTitle} numberOfLines={1}>{les.title}</Text>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                              {hasLesQuiz && <ClipboardList size={12} color={Colors.primary} />}
                              <TouchableOpacity onPress={() => openEditModal('lesson', les, mod.id, item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Pencil size={12} color={Colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => {
                                if (lesQuiz) openEditModal('quiz', lesQuiz, les.id, item.id);
                                else openModal('quiz', les.id, item.id);
                              }}>
                                <Plus size={12} color={Colors.textMuted} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDelete('lessons', les.id, les.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Trash2 size={13} color={Colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Course actions */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[s.deleteCourseBtn, { flex: 1, backgroundColor: Colors.primaryLight }]} onPress={() => openEditModal('course', item)}>
                <Pencil size={14} color={Colors.primary} /><Text style={[s.deleteCourseText, { color: Colors.primary }]}>Edit Course</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.deleteCourseBtn, { flex: 1 }]} onPress={() => handleDelete('courses', item.id, item.title)}>
                <Trash2 size={14} color={Colors.error} /><Text style={s.deleteCourseText}>Delete Course</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const modalTitle = editingId
    ? (modalType === 'course' ? 'Edit Course' : modalType === 'module' ? 'Edit Module' : modalType === 'lesson' ? 'Edit Lesson' : 'Edit Quiz')
    : (modalType === 'course' ? 'New Course' : modalType === 'module' ? 'New Module' : modalType === 'lesson' ? 'New Lesson' : 'New Quiz');

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Manage</Text>
          <Text style={s.headerSub}>{courses.length} course{courses.length !== 1 ? 's' : ''} · {modules.length} modules · {lessons.length} lessons</Text>
        </View>
        <TouchableOpacity style={s.addButton} onPress={() => openModal('course')}>
          <Plus size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={courses}
        keyExtractor={i => i.id}
        renderItem={renderCourse}
        refreshing={loading}
        onRefresh={fetchAll}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <BookOpen size={48} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No Courses Yet</Text>
            <Text style={s.emptySub}>Tap + to create your first course</Text>
          </View>
        }
      />

      {/* ─── Unified Modal ─── */}
      <Modal animationType="slide" transparent visible={!!modalType} onRequestClose={() => setModalType(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => { setModalType(null); resetForm(); }}>
                <View style={s.closeBtn}><X size={18} color={Colors.textSecondary} /></View>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalForm} showsVerticalScrollIndicator={false}>
              {modalType !== 'quiz' && (
                <Input label="Title *" placeholder="Enter title" value={formTitle} onChangeText={setFormTitle} />
              )}

              {(modalType === 'course' || modalType === 'module' || modalType === 'lesson') && (
                <Input label="Description" placeholder="Enter description" value={formDesc} onChangeText={setFormDesc} multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top', paddingTop: 12 }} />
              )}

              {/* Quiz specific fields */}
              {modalType === 'quiz' && (
                <View style={{ marginBottom: 20 }}>
                  <Input label="Pass Mark (%)" keyboardType="numeric" value={formPassMark} onChangeText={setFormPassMark} />
                  
                  <View style={{ marginTop: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                      <Text style={s.pickersLabel}>Questions ({formQuestions.length})</Text>
                      <TouchableOpacity style={s.addQBtn} onPress={addQuestion}>
                        <Plus size={14} color={Colors.primary} />
                        <Text style={s.addQBtnText}>Add Question</Text>
                      </TouchableOpacity>
                    </View>

                    {formQuestions.map((q, qIdx) => (
                      <View key={q.id} style={s.qCard}>
                        <View style={s.qHeader}>
                          <Text style={s.qIndex}>Question {qIdx + 1}</Text>
                          <TouchableOpacity onPress={() => setFormQuestions(formQuestions.filter((_, i) => i !== qIdx))}>
                            <Trash2 size={16} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                        
                        <TextInput
                          style={s.qInput}
                          placeholder="Question text"
                          value={q.question}
                          onChangeText={(v) => updateQuestion(qIdx, 'question', v)}
                          multiline
                        />

                        <Text style={s.optLabel}>Options (Select Correct)</Text>
                        {q.options.map((opt: string, oIdx: number) => (
                          <View key={oIdx} style={s.optRow}>
                            <TouchableOpacity 
                              style={[s.optRadio, q.correctIndex === oIdx && s.optRadioActive]} 
                              onPress={() => updateQuestion(qIdx, 'correctIndex', oIdx)}
                            >
                              {q.correctIndex === oIdx && <View style={s.optRadioInner} />}
                            </TouchableOpacity>
                            <TextInput
                              style={s.optInput}
                              placeholder={`Option ${oIdx + 1}`}
                              value={opt}
                              onChangeText={(v) => updateOption(qIdx, oIdx, v)}
                            />
                          </View>
                        ))}

                        <TextInput
                          style={[s.qInput, { marginTop: 10, fontSize: 12 }]}
                          placeholder="Explanation (shown after answer)"
                          value={q.explanation}
                          onChangeText={(v) => updateQuestion(qIdx, 'explanation', v)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Course-specific media pickers */}
              {modalType === 'course' && (
                <View style={s.pickersSection}>
                  <Text style={s.pickersLabel}>Media (all optional — add video later)</Text>
                  <Input label="Video URL (optional)" placeholder="Leave blank to add later" value={formVideoUrl} onChangeText={setFormVideoUrl} />
                  {[
                    { label: selectedImage ? 'Cover Image ✓' : 'Upload Cover Image', fn: pickImage, active: !!selectedImage },
                    { label: selectedVideo ? 'Video File ✓' : 'Upload Video File', fn: pickVideo, active: !!selectedVideo },
                    { label: selectedPdf ? 'PDF ✓' : 'Upload PDF (opt)', fn: pickPdf, active: !!selectedPdf },
                  ].map((p, i) => (
                    <TouchableOpacity key={i} style={[s.pickerRow, p.active && s.pickerRowActive]} onPress={p.fn}>
                      <Text style={[s.pickerRowText, p.active && { color: Colors.white }]}>{p.label}</Text>
                      {p.active && <CheckCircle size={16} color={Colors.white} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Module-specific media fields */}
              {modalType === 'module' && (
                <>
                  <Input label="YouTube URL (optional)" placeholder="https://youtube.com/..." value={formYoutubeUrl} onChangeText={setFormYoutubeUrl} />
                  <Input label="Video URL (optional)" placeholder="Direct video URL or upload below" value={formVideoUrl} onChangeText={setFormVideoUrl} />
                  <View style={s.pickersSection}>
                    <Text style={s.pickersLabel}>Or Upload Video</Text>
                    <TouchableOpacity style={[s.pickerRow, !!selectedVideo && s.pickerRowActive]} onPress={pickVideo}>
                      <Text style={[s.pickerRowText, !!selectedVideo && { color: Colors.white }]}>{selectedVideo ? 'Video ✓' : 'Upload Video'}</Text>
                      {!!selectedVideo && <CheckCircle size={16} color={Colors.white} />}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Lesson-specific URL fields */}
              {modalType === 'lesson' && (
                <>
                  <Input label="YouTube URL (optional)" placeholder="https://youtube.com/..." value={formYoutubeUrl} onChangeText={setFormYoutubeUrl} />
                  <Input label="Video URL (optional)" placeholder="https://... or upload below" value={formVideoUrl} onChangeText={setFormVideoUrl} />
                  <Input label="PDF URL (optional)" placeholder="https://..." value={formPdfUrl} onChangeText={setFormPdfUrl} />
                  <View style={s.pickersSection}>
                    <Text style={s.pickersLabel}>Or Upload Files</Text>
                    {[
                      { label: selectedVideo ? 'Video ✓' : 'Upload Video', fn: pickVideo, active: !!selectedVideo },
                      { label: selectedPdf ? 'PDF ✓' : 'Upload PDF', fn: pickPdf, active: !!selectedPdf },
                    ].map((p, i) => (
                      <TouchableOpacity key={i} style={[s.pickerRow, p.active && s.pickerRowActive]} onPress={p.fn}>
                        <Text style={[s.pickerRowText, p.active && { color: Colors.white }]}>{p.label}</Text>
                        {p.active && <CheckCircle size={16} color={Colors.white} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Button
                title={editingId
                  ? (modalType === 'course' ? 'Update Course' : modalType === 'module' ? 'Update Module' : modalType === 'lesson' ? 'Update Lesson' : 'Update Quiz')
                  : (modalType === 'course' ? 'Create Course' : modalType === 'module' ? 'Add Module' : modalType === 'lesson' ? 'Add Lesson' : 'Save Quiz')
                }
                onPress={() => {
                  if (modalType === 'course') handleSaveCourse();
                  else if (modalType === 'module') handleSaveModule();
                  else if (modalType === 'lesson') handleSaveLesson();
                  else if (modalType === 'quiz') handleCreateQuiz();
                }}
                loading={submitting}
                style={s.submitBtn}
              />
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  headerTitle: { ...Typography.h1, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  addButton: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },

  list: { padding: Spacing.lg, paddingBottom: 100 },

  // Course card
  courseCard: {
    backgroundColor: Colors.surface, borderRadius: 20, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  courseRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12,
  },
  courseIconBg: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  courseTitle: { ...Typography.body, fontWeight: '700', color: Colors.text },
  courseSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  // Expanded area
  expanded: {
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.glassBorder, backgroundColor: Colors.background + '60',
  },
  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10,
    paddingHorizontal: 14, backgroundColor: Colors.primaryLight, borderRadius: 12,
    alignSelf: 'flex-start', marginTop: Spacing.sm, marginBottom: Spacing.sm,
  },
  addRowText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },

  // Module card
  moduleCard: {
    backgroundColor: Colors.surface, borderRadius: 14, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden',
  },
  moduleRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
  },
  moduleTitle: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  moduleSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 1 },

  // Lesson list
  lessonList: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: Colors.surfaceLight },
  addRowBtnSm: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8,
    paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 6,
  },
  addRowTextSm: { ...Typography.caption, color: Colors.primary, fontWeight: '600', fontSize: 11 },
  lessonRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  lessonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  lessonTitle: { ...Typography.bodySmall, color: Colors.text, flex: 1 },

  deleteCourseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: Spacing.sm,
    borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.06)',
  },
  deleteCourseText: { ...Typography.caption, color: Colors.error, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { ...Typography.h2, color: Colors.text, marginTop: Spacing.lg },
  emptySub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.sm },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { ...Typography.h2, color: Colors.text },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  modalForm: {},
  submitBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.primary, height: 54, borderRadius: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  pickersSection: { marginBottom: Spacing.md },
  pickersLabel: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceLight, padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.glassBorder, marginBottom: Spacing.xs,
  },
  pickerRowActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerRowText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },

  courseBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  quizBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#d97706', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  quizBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },

  courseActionRow: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  modActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  // Quiz Editor Styles
  addQBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, backgroundColor: Colors.primaryLight, borderRadius: 8 },
  addQBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  qCard: { backgroundColor: Colors.surfaceLight, padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: Colors.glassBorder },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  qIndex: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary },
  qInput: { backgroundColor: Colors.white, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.glassBorder, color: Colors.text, marginBottom: 10 },
  optLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  optRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.glassBorder, justifyContent: 'center', alignItems: 'center' },
  optRadioActive: { borderColor: Colors.primary },
  optRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  optInput: { flex: 1, backgroundColor: Colors.white, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.glassBorder, fontSize: 13, color: Colors.text },
});
