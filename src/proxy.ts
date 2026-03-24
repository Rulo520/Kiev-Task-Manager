import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 1. Detect GHL Identities in URL
  const ghlId = (
    searchParams.get('userId') || 
    searchParams.get('user_id') || 
    searchParams.get('contactId') || 
    searchParams.get('contact_id')
  );

  const response = NextResponse.next();

  // 2. If GHL Identity found, sync it to the session cookie immediately
  if (ghlId) {
    // We set it as a first-party cookie if the tab is independent, 
    // or third-party if inside iFrame. Middleware handles this correctly.
    response.cookies.set('kiev_user_id', ghlId, {
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours for better cross-tab experience
      sameSite: 'none',
      secure: true,
    });
  }

  // 3. Add Cache-Control headers to the response to prevent stale UI
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

// Ensure middleware only runs on page routes, not assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
