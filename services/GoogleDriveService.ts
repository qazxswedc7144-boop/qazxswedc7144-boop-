
/**
 * GoogleDriveService - Handles Google Drive backup operations.
 */
export class GoogleDriveService {
  private static readonly DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  private static readonly SCOPES = 'https://www.googleapis.com/auth/drive.file';
  
  private static accessToken: string | null = null;
  private static tokenClient: any = null;

  /**
   * Initializes the Google Identity Services client.
   * This should be called once, e.g., in a useEffect or on first use.
   */
  static async init(clientId: string): Promise<void> {
    if (this.tokenClient) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        try {
          this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: this.SCOPES,
            callback: (response: any) => {
              if (response.error) {
                reject(response);
              }
              this.accessToken = response.access_token;
              resolve();
            },
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Requests an access token from the user.
   */
  static async authenticate(): Promise<string> {
    if (!this.tokenClient) {
      throw new Error('Google Drive client not initialized.');
    }

    return new Promise((resolve, reject) => {
      // Override callback to resolve the promise
      const oldCallback = this.tokenClient.callback;
      this.tokenClient.callback = (response: any) => {
        if (response.error) {
          reject(new Error(`Authentication failed: ${response.error}`));
        } else {
          this.accessToken = response.access_token;
          resolve(response.access_token);
        }
        this.tokenClient.callback = oldCallback;
      };
      
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /**
   * Uploads a file to Google Drive.
   */
  static async uploadFile(content: string | Blob, fileName: string, mimeType: string = 'application/octet-stream'): Promise<string> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const metadata = {
      name: fileName,
      mimeType: mimeType,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', content instanceof Blob ? content : new Blob([content], { type: mimeType }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Upload failed: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  }

  /**
   * Lists backup files in Google Drive.
   */
  static async listBackups(): Promise<any[]> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files?q=name contains "backup.enc" or name contains "PharmaFlow_Backup"&fields=files(id,name,createdTime,size)', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Listing failed: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.files || [];
  }

  /**
   * Downloads a file from Google Drive.
   */
  static async downloadFile(fileId: string): Promise<string> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Download failed: ${error.error?.message || response.statusText}`);
    }

    return await response.text();
  }
}
