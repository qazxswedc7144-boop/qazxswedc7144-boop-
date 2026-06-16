// ==========================================
// FILE: src/services/firebase.ts
// ==========================================

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase SDK with provisioned settings
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying the correct custom firestore database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Sign-In helper compliant with iframe redirection limits
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export async function loginWithGoogleFirebase() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error("Firebase Google Login Error: ", err);
    throw err;
  }
}

// ==========================================
// 3. SECURE ERROR HANDLER (MANDATORY PATTERN)
// ==========================================

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  
  console.error("Firestore Error Detailed Object: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// Connection validation
// ==========================================

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // CRITICAL CONSTRAINT: Test Firestore connectivity on boot
    await getDocFromServer(doc(db, "test", "connection"));
    console.info("Firebase Firestore: Handshake validated successfully.");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Firebase Connection Warning: Please check your active Firebase configuration or network link.");
    }
    return false;
  }
}

// Automatically fire connectivity validation
testFirestoreConnection().catch((err) => {
  console.warn("Firestore initialization status:", err);
});
