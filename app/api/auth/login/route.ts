import {NextResponse} from "next/server";import {createSession} from "@/lib/auth";
export async function POST(req:Request){const {password}=await req.json();if(!process.env.ADMIN_PASSWORD||password!==process.env.ADMIN_PASSWORD)return NextResponse.json({error:"Inválido"},{status:401});await createSession();return NextResponse.json({ok:true})}
