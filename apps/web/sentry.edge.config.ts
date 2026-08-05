import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

// Edge runtime (middleware/route edge bila ada). Inert bila DSN kosong.
Sentry.init(sentryOptions);
