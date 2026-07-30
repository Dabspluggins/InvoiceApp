import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://526433595a30e25a1f84633657a161f4@o4511363596222464.ingest.us.sentry.io/4511363612409856",

  tracesSampleRate: 0.2,

  enableLogs: true,

  sendDefaultPii: false,
});
