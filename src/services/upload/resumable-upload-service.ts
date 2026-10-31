import type { ResumableUploader, UploadAdapterOptions } from './types';
import type { UploadConfig, UploadPayload, UploadProgress, UploadResult, UploadSession } from '@/domain/upload/types';
import { UploadServiceError, httpErrorMessage } from '@/domain/upload/upload-errors';

type InitResponse = { uploadId?: unknown; chunkSize?: unknown; uploadedParts?: unknown };
const STORE_KEY = 'excel-uploader:sessions:v1';
type Stored = Record<string, { uploadId: string; chunkSize: number; uploadedParts: number[] }>;
function readStored(): Stored {
  try { const value = JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; }
}
function saveStored(key: string, value: UploadSession): void {
  try { const all = readStored(); all[key] = { uploadId: value.uploadId, chunkSize: value.chunkSize, uploadedParts: value.uploadedParts }; globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* storage may be unavailable or full */ }
}
export class ResumableUploadService implements ResumableUploader {
  private base: string;
  private fetcher: typeof fetch;
  constructor(private options: UploadAdapterOptions = {}) {
    this.base = (options.baseUrl ?? (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') ?? '').replace(/\/$/, '');
    this.fetcher = options.fetchImpl ?? fetch;
  }
  private async headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.options.getAccessToken?.();
    return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }
  private async request(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    try {
      const response = await this.fetcher(`${this.base}${url}`, { ...init, credentials: 'include', signal });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new UploadServiceError(response.status === 422 ? 'SERVER_VALIDATION_ERROR' : 'HTTP_ERROR', httpErrorMessage(response.status, body), response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof UploadServiceError) throw error;
      if (signal.aborted) throw new UploadServiceError('CANCELLED', 'عملیات لغو شد.');
      throw new UploadServiceError('NETWORK_ERROR', 'ارتباط با سرور برقرار نشد.');
    }
  }
  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      const abort = () => { clearTimeout(timer); reject(new UploadServiceError('CANCELLED', 'عملیات لغو شد.')); };
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    });
  }
  private put(url: string, blob: Blob, headers: Record<string, string>, signal: AbortSignal, onLoad: (n: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const cleanup = () => signal.removeEventListener('abort', abort);
      const abort = () => xhr.abort();
      if (signal.aborted) { reject(new UploadServiceError('CANCELLED', 'عملیات لغو شد.')); return; }
      signal.addEventListener('abort', abort, { once: true }); xhr.open('PUT', `${this.base}${url}`); xhr.withCredentials = true;
      for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = event => { if (event.lengthComputable) onLoad(event.loaded); };
      xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new UploadServiceError(xhr.status === 422 ? 'SERVER_VALIDATION_ERROR' : 'HTTP_ERROR', httpErrorMessage(xhr.status, xhr.responseText), xhr.status)); };
      xhr.onerror = () => { cleanup(); reject(new UploadServiceError('NETWORK_ERROR', 'ارتباط هنگام ارسال بخش فایل قطع شد.')); };
      xhr.onabort = () => { cleanup(); reject(new UploadServiceError('CANCELLED', 'عملیات لغو شد.')); };
      xhr.send(blob);
    });
  }
  async upload(payload: UploadPayload, config: UploadConfig, clientFileId: string, signal: AbortSignal, onSession: (s: UploadSession) => void, onProgress: (p: UploadProgress) => void): Promise<UploadResult> {
    if (signal.aborted) throw new UploadServiceError('CANCELLED', 'عملیات لغو شد.');
    const saved = readStored()[clientFileId];
    const initResponse = await this.request('/api/uploads/excel/init', { method: 'POST', headers: await this.headers({ 'Content-Type': 'application/json', 'Idempotency-Key': clientFileId }), body: JSON.stringify({ fileName: payload.file.name, fileSize: payload.file.size, fileType: payload.file.type, lastModified: payload.file.lastModified, chunkSize: config.chunkSizeInBytes, clientFileId, resumeUploadId: saved?.uploadId, knownUploadedParts: saved?.uploadedParts ?? [] }) }, signal);
    let raw: InitResponse;
    try { raw = await initResponse.json() as InitResponse; } catch { throw new UploadServiceError('HTTP_ERROR', 'پاسخ آغاز نشست نامعتبر است.'); }
    if (typeof raw.uploadId !== 'string' || !raw.uploadId || typeof raw.chunkSize !== 'number' || !Number.isFinite(raw.chunkSize) || raw.chunkSize <= 0 || !Array.isArray(raw.uploadedParts)) throw new UploadServiceError('HTTP_ERROR', 'ساختار پاسخ آغاز نشست نامعتبر است.');
    const count = Math.ceil(payload.file.size / raw.chunkSize);
    const parts = new Set<number>((raw.uploadedParts as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < count));
    const session: UploadSession = { uploadId: raw.uploadId, chunkSize: raw.chunkSize, uploadedParts: [...parts].sort((a, b) => a - b) };
    saveStored(clientFileId, session); onSession(session);
    const committed = () => [...parts].reduce((sum, index) => sum + Math.max(0, Math.min(session.chunkSize, payload.file.size - index * session.chunkSize)), 0);
    let live = 0;
    const report = () => { const loaded = Math.min(payload.file.size, committed() + live); onProgress({ loaded, total: payload.file.size, percent: payload.file.size ? Math.floor(100 * loaded / payload.file.size) : 100 }); };
    report();
    for (let index = 0; index < count; index++) {
      if (parts.has(index)) continue;
      if (signal.aborted) throw new UploadServiceError('CANCELLED', 'عملیات لغو شد.');
      const start = index * session.chunkSize, end = Math.min(payload.file.size, start + session.chunkSize), blob = payload.file.slice(start, end);
      let attempt = 0;
      while (true) {
        try {
          await this.put(`/api/uploads/excel/${encodeURIComponent(session.uploadId)}/parts/${index}`, blob, await this.headers({ 'Content-Range': `bytes ${start}-${end - 1}/${payload.file.size}`, 'X-Chunk-Index': String(index) }), signal, n => { live = n; report(); });
          break;
        } catch (error) {
          const failure = error as UploadServiceError;
          if (signal.aborted || failure.code === 'CANCELLED') throw new UploadServiceError('CANCELLED', 'عملیات لغو شد.');
          attempt++; if ((failure.status && failure.status < 500) || attempt >= 4) throw failure;
          await this.delay(500 * 2 ** (attempt - 1), signal);
        }
      }
      live = 0; parts.add(index); session.uploadedParts = [...parts].sort((a, b) => a - b); saveStored(clientFileId, session); onSession({ ...session, uploadedParts: [...session.uploadedParts] }); report();
    }
    const complete = await this.request(`/api/uploads/excel/${encodeURIComponent(session.uploadId)}/complete`, { method: 'POST', headers: await this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ fileName: payload.file.name, fileSize: payload.file.size, headers: payload.headers, totalRows: payload.totalRows, validRows: payload.validRows, invalidRows: payload.invalidRows }) }, signal);
    let result: { uploadId?: string; message?: string } = {};
    try { result = await complete.json() as typeof result; } catch { /* successful empty completion body */ }
    try { const all = readStored(); delete all[clientFileId]; globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* best effort cleanup */ }
    return { uploadId: result.uploadId || session.uploadId, message: result.message || 'بارگذاری با موفقیت تکمیل شد.' };
  }
}
