import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow external avatars from GHL or Supabase Storage
      },
    ],
  },
};

export default nextConfig;
