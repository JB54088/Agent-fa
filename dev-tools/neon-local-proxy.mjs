import http from "node:http";
import { Pool, types } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL to the dedicated local PostgreSQL database.");

const database = new URL(databaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(database.hostname)) {
  throw new Error("The local Neon bridge refuses non-loopback database hosts.");
}

// Keep PostgreSQL values in text format. The Neon client applies its own parsers
// using each field's dataTypeID, matching the hosted Neon HTTP response behavior.
for (const oid of Object.values(types.builtins)) {
  types.setTypeParser(oid, "text", (value) => value);
}

const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const host = "127.0.0.1";
const port = Number(process.env.NEON_LOCAL_PROXY_PORT ?? 55433);
const maxBodyBytes = 2 * 1024 * 1024;

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function runQuery(client, query) {
  if (!query || typeof query.query !== "string" || !Array.isArray(query.params ?? [])) {
    throw new Error("Invalid Neon query payload.");
  }
  const result = await client.query({ text: query.query, values: query.params ?? [], rowMode: "array" });
  return {
    command: result.command,
    rowCount: result.rowCount,
    fields: result.fields.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID })),
    rows: result.rows,
  };
}

async function runBatch(request, queries) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const isolation = request.headers["neon-batch-isolation-level"];
    if (isolation && ["read committed", "repeatable read", "serializable"].includes(String(isolation).toLowerCase())) {
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${String(isolation).toUpperCase()}`);
    }
    if (request.headers["neon-batch-read-only"] === "true") await client.query("SET TRANSACTION READ ONLY");
    if (request.headers["neon-batch-deferrable"] === "true") await client.query("SET TRANSACTION DEFERRABLE");
    const results = [];
    for (const query of queries) results.push(await runQuery(client, query));
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    try {
      await pool.query("SELECT 1");
      return sendJson(response, 200, { ok: true });
    } catch {
      return sendJson(response, 503, { ok: false });
    }
  }
  if (request.method !== "POST" || request.url !== "/sql") return sendJson(response, 404, { message: "Not found" });

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > maxBodyBytes) return sendJson(response, 413, { message: "Request too large" });
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (Array.isArray(payload?.queries)) {
      return sendJson(response, 200, { results: await runBatch(request, payload.queries) });
    }

    const client = await pool.connect();
    try {
      return sendJson(response, 200, await runQuery(client, payload));
    } finally {
      client.release();
    }
  } catch (error) {
    const pgError = error && typeof error === "object" ? error : {};
    // Do not log SQL, parameters, credentials, or result values.
    console.error("[local-neon-proxy] query failed", { code: pgError.code ?? "LOCAL_QUERY_ERROR" });
    return sendJson(response, 400, {
      message: pgError.message ?? "Local database query failed",
      code: pgError.code,
      severity: pgError.severity,
      schema: pgError.schema,
      table: pgError.table,
      column: pgError.column,
      constraint: pgError.constraint,
    });
  }
});

server.listen(port, host, () => console.log(`[local-neon-proxy] listening on http://${host}:${port}`));

async function shutdown() {
  server.close();
  await pool.end();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
