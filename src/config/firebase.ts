import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { 
  initializeAuth, 
  getAuth, 
  browserLocalPersistence, 
  // @ts-ignore
  getReactNativePersistence 
} from 'firebase/auth';
import { Platform } from 'react-native';

// Firebase configuration for inuka-db project
const firebaseConfig = {
  apiKey: 'AIzaSyB4RcbpaALO4m45G9Wwi95fcBKCHjV3uiw',
  authDomain: 'inuka-db.firebaseapp.com',
  databaseURL: 'https://inuka-db-default-rtdb.firebaseio.com',
  projectId: 'inuka-db',
  storageBucket: 'inuka-db.firebasestorage.app',
  messagingSenderId: '149150941197',
  appId: '1:149150941197:web:05903ad0f63a087bfe1544',
};

// Prevent re-initialization in hot-reload / Fast Refresh environments
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with cross-platform persistence
let auth: ReturnType<typeof getAuth>;

if (getApps().length > 0) {
  try {
    auth = getAuth(app);
  } catch (e) {
    // If not yet initialized, use initializeAuth below
    auth = initAuth();
  }
} else {
  auth = initAuth();
}

function initAuth() {
  const persistence = Platform.OS === 'web' 
    ? browserLocalPersistence 
    : getReactNativePersistence(AsyncStorage);
    
  return initializeAuth(app, {
    persistence,
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
