import type { UploadController } from './types';
import type { UploadConfig } from '@/domain/upload/types';
import { ExcelParserService } from './excel-parser-service';
import { ResumableUploadService } from './resumable-upload-service';
import type { UploadPayload, UploadProgress, UploadResult, UploadSession, ParseResult } from '@/domain/upload/types';
export class UploadControllerService implements UploadController {
 constructor(private parser=new ExcelParserService(),private uploader=new ResumableUploadService()){}
 parse(file:File,config:UploadConfig,signal?:AbortSignal,onProgress?:(done:number,total:number)=>void):Promise<ParseResult>{return this.parser.parse(file,config,signal,onProgress);}
 upload(payload:UploadPayload,config:UploadConfig,clientFileId:string,signal:AbortSignal,onSession:(s:UploadSession)=>void,onProgress:(p:UploadProgress)=>void):Promise<UploadResult>{return this.uploader.upload(payload,config,clientFileId,signal,onSession,onProgress);}
}
