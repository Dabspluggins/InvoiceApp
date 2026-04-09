import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Public invoice pages are accessible without authentication
  return NextResponse.next()
}

export const config = {
  // Only run middleware on protected routes; /i/* is intentionally excluded
  matcher: ['/dashboard/:path*', '/invoice/:path*', '/clients/:path*', '/analytics/:path*'],
}
