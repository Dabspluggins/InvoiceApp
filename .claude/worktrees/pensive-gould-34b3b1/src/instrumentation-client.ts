import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://526433595a30e25a1f84633657a161f4@o4511363596222464.ingest.us.sentry.io/4511363612409856",

  integrations: [Sentry.replayIntegration()],

  // Sample 20% of transactions for performance monitoring
  tracesSampleRate: 0.2,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Session replay disabled — invoicing data is sensitive (client names, amounts)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
