import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Mark a Lesson as Complete ───────────────────────────────────────────────
export async function markLessonComplete(
  userId: string,
  lessonId: string,
  courseId: string,
) {
  const progressId = `${userId}_${lessonId}`;
  const progressRef = doc(db, 'lessonProgress', progressId);

  const existing = await getDoc(progressRef);
  if (existing.exists() && existing.data()?.completed) return; // already done

  await setDoc(progressRef, {
    userId,
    lessonId,
    courseId,
    completed: true,
    completedAt: serverTimestamp(),
  });

  // Recalculate course progress
  await updateCourseProgress(userId, courseId);
}

// ─── Update Course Progress % ────────────────────────────────────────────────
export async function updateCourseProgress(
  userId: string,
  courseId: string,
) {
  // 1. Count total lessons for this course
  const lessonsSnap = await getDocs(
    query(collection(db, 'lessons'), where('courseId', '==', courseId)),
  );
  const totalLessons = lessonsSnap.size;
  if (totalLessons === 0) return;

  // 2. Count completed lessons for this user+course
  const progressSnap = await getDocs(
    query(
      collection(db, 'lessonProgress'),
      where('userId', '==', userId),
      where('courseId', '==', courseId),
      where('completed', '==', true),
    ),
  );
  const completedLessons = progressSnap.size;

  // 3. Check quiz status — do any quizzes exist for this course?
  const quizzesSnap = await getDocs(
    query(collection(db, 'quizzes'), where('courseId', '==', courseId)),
  );
  let allQuizzesPassed = true;
  const totalQuizzes = quizzesSnap.size;

  if (totalQuizzes > 0) {
    for (const quizDoc of quizzesSnap.docs) {
      const quizData = quizDoc.data();
      const lessonId = quizData.lessonId;
      const resultId = `${userId}_${lessonId}`;
      const resultRef = doc(db, 'quizResults', resultId);
      const resultSnap = await getDoc(resultRef);

      if (!resultSnap.exists() || !resultSnap.data()?.passed) {
        allQuizzesPassed = false;
        break;
      }
    }
  }

  // 4. Calculate percentage (lessons are 100% weight if no quizzes, or 80/20 split)
  let progress: number;
  if (totalQuizzes > 0) {
    const lessonPct = (completedLessons / totalLessons) * 80;
    const quizPct = allQuizzesPassed ? 20 : 0;
    progress = Math.round(lessonPct + quizPct);
  } else {
    progress = Math.round((completedLessons / totalLessons) * 100);
  }

  // 5. Determine if course is fully complete
  const courseComplete =
    completedLessons >= totalLessons && allQuizzesPassed;

  // 6. Update enrollment doc
  const enrollmentId = `${userId}_${courseId}`;
  const enrollmentRef = doc(db, 'enrollments', enrollmentId);
  const enrollSnap = await getDoc(enrollmentRef);

  if (enrollSnap.exists()) {
    const updateData: any = {
      progress,
      completedLessonsCount: completedLessons,
      totalLessonsCount: totalLessons,
    };

    if (courseComplete && !enrollSnap.data()?.completedAt) {
      updateData.completedAt = serverTimestamp();
    }

    await updateDoc(enrollmentRef, updateData);
  }

  return { progress, courseComplete, completedLessons, totalLessons };
}

// ─── Check if a specific lesson is completed ────────────────────────────────
export async function isLessonCompleted(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  const progressId = `${userId}_${lessonId}`;
  const progressRef = doc(db, 'lessonProgress', progressId);
  const snap = await getDoc(progressRef);
  return snap.exists() && snap.data()?.completed === true;
}

// ─── Get all completed lesson IDs for a course ──────────────────────────────
export async function getCompletedLessonIds(
  userId: string,
  courseId: string,
): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, 'lessonProgress'),
      where('userId', '==', userId),
      where('courseId', '==', courseId),
      where('completed', '==', true),
    ),
  );
  return snap.docs.map((d) => d.data().lessonId);
}
