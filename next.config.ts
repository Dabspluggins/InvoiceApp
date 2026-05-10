import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default withSentryConfig(nextConfig, {
  org: "dabsplugginsco",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  automaticVercelMonitors: true,
});
