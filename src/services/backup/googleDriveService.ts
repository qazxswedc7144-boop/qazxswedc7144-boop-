import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');

let cachedAccessToken: string | null = null;

export const GoogleDriveService = {
  async signIn(): Promise<{ user: User; accessToken: string }> {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to retrieve access token from Google sign-in.');
      }
      cachedAccessToken = credential.accessToken;
      localStorage.setItem('gdrive_access_token', cachedAccessToken);
      localStorage.setItem('gdrive_user_email', result.user.email || '');
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (e) {
      console.error('Sign-in failed:', e);
      throw e;
    }
  },

  getAccessToken(): string | null {
    if (!cachedAccessToken) {
      cachedAccessToken = localStorage.getItem('gdrive_access_token');
    }
    return cachedAccessToken;
  },

  getUserEmail(): string | null {
    return localStorage.getItem('gdrive_user_email');
  },

  async signOut(): Promise<void> {
    await signOut(auth);
    cachedAccessToken = null;
    localStorage.removeItem('gdrive_access_token');
    localStorage.removeItem('gdrive_user_email');
  },

  async listBackups(token: string): Promise<any[]> {
    const url = 'https://www.googleapis.com/drive/v3/files?q=name contains "PharmaFlow_" and trashed = false&fields=files(id, name, mimeType, size, createdTime)&orderBy=createdTime desc';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list backups from Google Drive: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  },

  async uploadBackup(name: string, contentBlob: Blob, token: string): Promise<any> {
    const metadata = {
      name: name,
      mimeType: 'application/octet-stream',
      description: 'PharmaFlow PRO ERP encrypted system backup'
    };

    const boundary = 'PharmaFlow_Boundary_998822';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--\r\n`;

    const metadataPart = JSON.stringify(metadata);
    const arrayBuffer = await contentBlob.arrayBuffer();
    const blobView = new Uint8Array(arrayBuffer);

    const encoder = new TextEncoder();
    const header = encoder.encode(
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}${delimiter}Content-Type: application/octet-stream\r\n\r\n`
    );
    const footer = encoder.encode(closeDelimiter);

    const body = new Uint8Array(header.length + blobView.length + footer.length);
    body.set(header, 0);
    body.set(blobView, header.length);
    body.set(footer, header.length + blobView.length);

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body: body
    });

    if (!response.ok) {
      throw new Error(`Failed to upload to Google Drive: ${response.statusText}`);
    }

    return await response.json();
  },

  async downloadBackup(fileId: string, token: string): Promise<Blob> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download backup file: ${response.statusText}`);
    }

    return await response.blob();
  },

  async deleteBackup(fileId: string, token: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete Google Drive backup: ${response.statusText}`);
    }
  }
};
