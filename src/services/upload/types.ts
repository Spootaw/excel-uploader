import type { UploadConfig, UploadPayload, UploadProgress, UploadResult, UploadSession, ParseResult } from '@/domain/upload/types';
export interface ExcelParser { parse(file:File,config:UploadConfig,signal?:AbortSignal,onProgress?:(done:number,total:number)=>void):Promise<ParseResult> }
export interface UploadAdapterOptions { baseUrl?:string; getAccessToken?:()=>string|undefined|Promise<string|undefined>; fetchImpl?:typeof fetch }
export interface ResumableUploader { upload(payload:UploadPayload,config:UploadConfig,clientFileId:string,signal:AbortSignal,onSession:(s:UploadSession)=>void,onProgress:(p:UploadProgress)=>void):Promise<UploadResult> }
export interface UploadController { parse(file:File,config:UploadConfig,signal?:AbortSignal,onProgress?:(done:number,total:number)=>void):Promise<ParseResult>; upload(payload:UploadPayload,config:UploadConfig,clientFileId:string,signal:AbortSignal,onSession:(s:UploadSession)=>void,onProgress:(p:UploadProgress)=>void):Promise<UploadResult> }
