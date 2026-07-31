import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

// Next.js runtime (rendering statis V1). Permukaan kecil, tapi tetap dipantau.
Sentry.init(sentryOptions);
