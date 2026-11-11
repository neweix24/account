import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://4a80e5b20d5f93801845e87071a1e612@o4512412827058176.ingest.us.sentry.io/4512412888530944",
  sendDefaultPii: false,
  initialScope: { tags: { service: "neweix-account" } },
  tracesSampleRate: 0,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
