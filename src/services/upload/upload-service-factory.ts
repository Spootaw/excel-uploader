import { UploadControllerService } from './upload-controller';
import { ExcelParserService } from './excel-parser-service';
import { ResumableUploadService } from './resumable-upload-service';
import { MockResumableUploadService } from './mock-resumable-upload-service';
import type { UploadAdapterOptions, UploadController } from './types';

/** Read the optional public API URL without requiring Node.js global typings. */
function getEnvironmentBaseUrl(): string {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: { NEXT_PUBLIC_API_URL?: string } };
  };
  return runtime.process?.env?.NEXT_PUBLIC_API_URL ?? '';
}

export function createUploadService(options: UploadAdapterOptions = {}): UploadController {
  const baseUrl = (options.baseUrl ?? getEnvironmentBaseUrl()).trim();
  const uploader = !baseUrl || baseUrl.toLowerCase() === 'mock'
    ? new MockResumableUploadService()
    : new ResumableUploadService({ ...options, baseUrl });

  return new UploadControllerService(new ExcelParserService(), uploader);
}

export const uploadService = createUploadService();
