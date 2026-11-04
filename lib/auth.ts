import crypto from "crypto";import {cookies} from "next/headers";
const COOKIE="radar_session";
function sig(value:string){return crypto.createHmac("sha256",process.env.SESSION_SECRET||"").update(value).digest("hex")}
export async function createSession(){const value=`admin.${Date.now()+7*86400000}`;const token=`${value}.${sig(value)}`;(await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:604800})}
export async function isAuthed(){const token=(await cookies()).get(COOKIE)?.value;if(!token)return false;const parts=token.split(".");if(parts.length!==3)return false;const value=`${parts[0]}.${parts[1]}`;const a=Buffer.from(parts[2]);const b=Buffer.from(sig(value));return a.length===b.length&&crypto.timingSafeEqual(a,b)&&Number(parts[1])>Date.now()}
export async function clearSession(){(await cookies()).delete(COOKIE)}
