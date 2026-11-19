import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

function start(args: string[], env: Record<string, string> = {}) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ENABLE_ANALYTICS: "false", ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output = (output + chunk).slice(-4000); });
  child.stderr.on("data", (chunk) => { output = (output + chunk).slice(-4000); });
  child.on("error", (error) => { output += error.message; });
  return {
    async ready(url: string) {
      const deadline = Date.now() + 40000;
      while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
        const response = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
        if (response) {
          await response.body?.cancel().catch(() => {});
          if (response.ok) return;
        }
        await delay(200);
      }
      throw new Error(`Test server failed to start at ${url}\n${output}`);
    },
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit").catch(() => {});
      child.kill();
      await Promise.race([exited, delay(3000, null, { ref: false })]);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    },
  };
}

export default async function setup() {
  const next = "node_modules/next/dist/bin/next";
  const storage = start(["tests/storage-fixture.mjs"]);
  const publicSite = start([next, "start", "-H", "127.0.0.1", "-p", "3210"], {
    SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", SHOW_DEMO_WHEN_EMPTY: "true",
  });
  const adminSite = start([next, "start", "-H", "127.0.0.1", "-p", "3211"], {
    SUPABASE_URL: "http://127.0.0.1:3212", SUPABASE_PUBLISHABLE_KEY: "fixture-anon", SUPABASE_SECRET_KEY: "fixture-secret",
    ADMIN_USERNAME: "test-author", ADMIN_PASSWORD: "local-fixture-password", ADMIN_SESSION_SECRET: "local-fixture-secret-for-testing-only",
  });
  const invalidKeySite = start([next, "start", "-H", "127.0.0.1", "-p", "3213"], {
    SUPABASE_URL: "http://127.0.0.1:3212", SUPABASE_PUBLISHABLE_KEY: "fixture-invalid",
    SUPABASE_SECRET_KEY: "fixture-secret", SHOW_DEMO_WHEN_EMPTY: "true",
  });
  const stop = async () => { await Promise.all([storage.stop(), publicSite.stop(), adminSite.stop(), invalidKeySite.stop()]); };
  try {
    await Promise.all([
      storage.ready("http://127.0.0.1:3212/health"),
      publicSite.ready("http://127.0.0.1:3210/robots.txt"),
      adminSite.ready("http://127.0.0.1:3211/robots.txt"),
      invalidKeySite.ready("http://127.0.0.1:3213/robots.txt"),
    ]);
    return stop;
  } catch (error) { await stop(); throw error; }
}
