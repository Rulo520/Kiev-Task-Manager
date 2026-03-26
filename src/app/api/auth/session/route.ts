import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const cookieStore = await cookies();

    // V13.1 - Hardened Session Cookie
    // Use Partitioned to work inside iFrames in modern Chrome
    // SameSite=None + Secure is mandatory for iFrame cross-site context
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
