import { env } from 'cloudflare:workers';
import { ZodError } from 'zod';
import type { ZodTypeAny, output } from 'zod';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
// PoC：线上由 nginx 注入 oai-authenticated-user-id，本地 dev 由 mock 登录注入。
// 两者都没有时按默认房主进入（免登录），避免保存被「请先登录」拦住。
const DEFAULT_USER='local_seedy';
export function userId(request:Request){return request.headers.get('oai-authenticated-user-id')||DEFAULT_USER;}
export function requireUser(request:Request){const id=userId(request);if(!id)throw new ApiError(401,'请先登录，再保存你的家。');return id;}
export const aiSettings = ()=>{const settings=env as unknown as Record<string,string|undefined>;return {key:settings.OPENAI_API_KEY,model:settings.OPENAI_MODEL||'gpt-5-mini'};};
export async function readBody<T extends ZodTypeAny>(request:Request,schema:T):Promise<output<T>>{
  if(Number(request.headers.get('content-length')||0)>12000)throw new ApiError(413,'内容太长，请精简后重试。');
  const text=await request.text();if(text.length>12000)throw new ApiError(413,'内容太长，请精简后重试。');
  const origin=request.headers.get('origin');
  // PoC: 443 反代下容器内 request.url 是 http://127.0.0.1:10101，与浏览器 Origin(https://域名) 不等；
  // 优先用 nginx 传来的 X-Forwarded-Proto + Host 拼期望值，没有该头时（本地 dev）退回原逻辑。
  const forwardedProto=request.headers.get('x-forwarded-proto');
  const expectedOrigin=forwardedProto?`${forwardedProto}://${request.headers.get('host')}`:new URL(request.url).origin;
  if(origin&&origin!==expectedOrigin)throw new ApiError(403,'请从当前网站提交。');
  try{return schema.parse(JSON.parse(text));}catch(error){if(error instanceof ZodError)throw new ApiError(400,'内容格式不正确，请检查字数和选项。');throw new ApiError(400,'无法读取提交内容。');}
}
export function handleError(error:unknown){
  if(error instanceof ApiError)return json({error:error.message},error.status);
  console.error('Site API error',error instanceof Error?error.message:'unknown');
  return json({error:'暂时无法完成操作，请稍后重试。'},503);
}
