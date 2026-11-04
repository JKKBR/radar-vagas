import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function DELETE() {
  if (!(await isAuthed())) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const { error } = await db()
    .from("jobs")
    .delete()
    .gte("id", 0);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Buscas apagadas com sucesso."
  });
}
