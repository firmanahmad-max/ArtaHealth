import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

// Error monitoring sisi browser — permukaan error utama karena app ini PWA
// client-side (CONTEXT §2). Inert bila DSN kosong.
Sentry.init(sentryOptions);
