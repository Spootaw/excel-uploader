import type { ResumableUploader } from './types';
import type { UploadConfig, UploadPayload, UploadProgress, UploadResult, UploadSession } from '@/domain/upload/types';
import { UploadServiceError } from '@/domain/upload/upload-errors';

const STORE_KEY = 'excel-uploader:mock-sessions:v1';
type StoredSession = { uploadId: string; chunkSize: number; uploadedParts: number[] };
type StoredSessions = Record<string, StoredSession>;

function readStored(): StoredSessions {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) || '{}');
    return value && typeof value === 'object' ? value as StoredSessions : {};
  } catch {
    return {};
  }
}

function saveStored(clientFileId: string, session: UploadSession): void {
  try {
    const sessions = readStored();
    sessions[clientFileId] = { ...session, uploadedParts: [...session.uploadedParts] };
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(sessions));
  } catch { /* Storage is optional in mock/test environments. */ }
}

function removeStored(clientFileId: string): void {
  try {
    const sessions = readStored();
    delete sessions[clientFileId];
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(sessions));
  } catch { /* Best-effort cleanup. */ }
}

function createUploadId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `mock-${Date.now().toString(36)}-${random}`;
}

/** A local, deterministic-in-shape stand-in for the server's resumable API. */
export class MockResumableUploadService implements ResumableUploader {
  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new UploadServiceError('CANCELLED', 'عملیات لغو شد.'));
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, ms);
      const abort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        reject(new UploadServiceError('CANCELLED', 'عملیات لغو شد.'));
      };
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  async upload(
    payload: UploadPayload,
    config: UploadConfig,
    clientFileId: string,
    signal: AbortSignal,
    onSession: (session: UploadSession) => void,
    onProgress: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    if (signal.aborted) throw new UploadServiceError('CANCELLED', 'عملیات لغو شد.');

    const chunkSize = Math.max(1, Math.floor(config.chunkSizeInBytes) || 1);
    const partCount = Math.ceil(payload.file.size / chunkSize);
    const saved = readStored()[clientFileId];
    const canResume = !!saved
      && typeof saved.uploadId === 'string'
      && typeof saved.chunkSize === 'number'
      && Array.isArray(saved.uploadedParts)
      && saved.chunkSize === chunkSize;
    const completed = new Set<number>(
      canResume
        ? saved.uploadedParts.filter(index => Number.isInteger(index) && index >= 0 && index < partCount)
        : [],
    );
    const session: UploadSession = {
      uploadId: canResume ? saved.uploadId : createUploadId(),
      chunkSize,
      uploadedParts: [...completed].sort((a, b) => a - b),
    };
    const reportProgress = () => {
      const loaded = Math.min(payload.file.size, [...completed].reduce((total, index) =>
        total + Math.max(0, Math.min(chunkSize, payload.file.size - index * chunkSize)), 0));
      onProgress({ loaded, total: payload.file.size, percent: payload.file.size === 0 ? 100 : Math.floor(100 * loaded / payload.file.size) });
    };

    saveStored(clientFileId, session);
    onSession({ ...session, uploadedParts: [...session.uploadedParts] });
    reportProgress();

    for (let index = 0; index < partCount; index++) {
      if (completed.has(index)) continue;
      await this.delay(20, signal);
      completed.add(index);
      session.uploadedParts = [...completed].sort((a, b) => a - b);
      saveStored(clientFileId, session);
      onSession({ ...session, uploadedParts: [...session.uploadedParts] });
      reportProgress();
    }

    await this.delay(20, signal);
    removeStored(clientFileId);
    return { uploadId: session.uploadId, message: 'بارگذاری آزمایشی با موفقیت تکمیل شد.' };
  }
}
