import type { ExcelParser } from './types';
import type { UploadConfig, ParseResult } from '@/domain/upload/types';
import { UploadServiceError } from '@/domain/upload/upload-errors';
export class ExcelParserService implements ExcelParser {
 async parse(file:File,config:UploadConfig,signal?:AbortSignal,onProgress?:(done:number,total:number)=>void):Promise<ParseResult>{
  if(signal?.aborted)throw new UploadServiceError('CANCELLED','عملیات لغو شد.');
  const buffer=await file.arrayBuffer(); if(signal?.aborted)throw new UploadServiceError('CANCELLED','عملیات لغو شد.');
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL('../../workers/excel-parser.worker.ts',import.meta.url),{type:'module'});let settled=false;const clean=()=>{signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.terminate();};const done=(fn:()=>void)=>{if(settled)return;settled=true;clean();fn();};const abort=()=>done(()=>reject(new UploadServiceError('CANCELLED','عملیات لغو شد.')));signal?.addEventListener('abort',abort,{once:true});worker.onerror=ev=>done(()=>reject(new UploadServiceError('PARSING_ERROR',ev.message||'خطا در worker پردازش فایل.')));worker.onmessage=(ev:MessageEvent<{id:number;type:string;result?:ParseResult;done?:number;total?:number;code?:string;message?:string}>)=>{const m=ev.data;if(m.id!==1)return;if(m.type==='progress'){onProgress?.(m.done||0,m.total||0);return;}if(m.type==='result'&&m.result)done(()=>resolve(m.result!));else done(()=>reject(new UploadServiceError((m.code||'PARSING_ERROR') as never,m.message||'پردازش فایل ناموفق بود.')));};worker.postMessage({id:1,buffer,config},[buffer]);});
 }
}
