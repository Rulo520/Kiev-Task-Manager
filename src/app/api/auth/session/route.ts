import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/ghl/resolveUser";

export async function POST(req: Request) {
  try {
    const { userId, locationId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // V20.0 - Trigger immediate sync/context update during handshake
    if (locationId) {
      await resolveUser(userId, undefined, locationId);
    }

    const cookieStore = await cookies();

    // V13.1 - Hardened Session Cookie
    cookieStore.set("kiev_user_id", userId, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      // @ts-ignore - Partitioned is not in standard types but supported by Next.js/Browser
      partitioned: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
