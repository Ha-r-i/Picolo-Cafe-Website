import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAeQwnIAER5o3fAwn9_flNiX0i9EwES1Pc",
  authDomain: "piccolo-cafe-b9b2a.firebaseapp.com",
  projectId: "piccolo-cafe-b9b2a",
  storageBucket: "piccolo-cafe-b9b2a.appspot.com", // FIXED
  messagingSenderId: "673319553168",
  appId: "1:673319553168:web:51bd55459618a821bd3015",
  measurementId: "G-2BDDZM50TK"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
