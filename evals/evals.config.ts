import { defineEvalConfig } from "eve/evals";

// Defaults shared by every eval. The judge model (for `t.judge.*` assertions)
// routes through the Vercel AI Gateway and needs AI_GATEWAY_API_KEY or
// VERCEL_OIDC_TOKEN — judge-backed evals skip visibly when it's absent, so this
// never breaks a deterministic run. Add a Braintrust reporter for shared review.
export default defineEvalConfig({
  judge: { model: "anthropic/claude-haiku-4.5" },
});
