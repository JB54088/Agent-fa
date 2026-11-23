import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function stopChildren(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
}

const docker = spawn("docker", ["start", "school-radar-local-db"], { stdio: "inherit", env: process.env });
docker.on("error", (error) => {
  console.error(`[local-dev] Could not start the local PostgreSQL container: ${error.message}`);
  process.exitCode = 1;
});
docker.on("exit", (code) => {
  if (code !== 0) {
    console.error("[local-dev] Start Docker Desktop and the local PostgreSQL container, then retry.");
    process.exitCode = code ?? 1;
    return;
  }

  const proxy = spawn(process.execPath, ["dev-tools/neon-local-proxy.mjs"], { stdio: "inherit", env: process.env });
  const app = spawn("pnpm", ["dev"], { stdio: "inherit", env: process.env });
  children.push(proxy, app);

  for (const child of children) {
    child.on("error", (error) => {
      console.error(`[local-dev] A child process failed to start: ${error.message}`);
      stopChildren("SIGTERM");
      process.exitCode = 1;
    });
    child.on("exit", (code, signal) => {
      if (!shuttingDown) {
        process.exitCode = code ?? (signal ? 1 : 0);
        stopChildren("SIGTERM");
      }
    });
  }
});

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));
