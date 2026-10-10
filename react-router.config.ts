import type { Config } from "@react-router/dev/config";
import { resolveAllowedActionOrigins } from "./config/allowed-action-origins";

const allowedActionOrigins = resolveAllowedActionOrigins(process.env);

if (allowedActionOrigins) {
  console.log(
    `[react-router.config] allowedActionOrigins: ${allowedActionOrigins.join(", ")}`,
  );
} else if (process.env.RAILWAY_ENVIRONMENT) {
  console.warn(
    "[react-router.config] WARNING: no allowedActionOrigins on Railway. Form " +
      "submissions (including login) will fail with 400 Bad Request. Set " +
      "ALLOWED_ACTION_ORIGINS to the app's public host and redeploy.",
  );
}

export default {
  ssr: true,
  allowedActionOrigins,
} satisfies Config;
