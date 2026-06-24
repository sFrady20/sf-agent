import { localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// The default HTTP API (terminal UI, SDK clients, curl). localDev + vercelOidc
// keep it reachable from your own CLI and trusted Vercel deployments only — it
// does NOT admit browser or public traffic. Add real auth (Clerk, Auth.js, an
// API-key verifier) here before exposing a public web UI.
export default eveChannel({
  auth: [localDev(), vercelOidc()],
});
