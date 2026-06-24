import { defineEvalConfig } from "eve/evals";

// Defaults shared by every eval. Deterministic checks only for now (no judge
// model, no reporter). Add `judge` and a `Braintrust` reporter when you want
// fuzzy grading or shared result review.
export default defineEvalConfig({});
