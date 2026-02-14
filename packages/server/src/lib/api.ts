/**
 * API calls for communicating with clawforge.org.
 * Bot endpoints use token auth; stubs remain for features not yet implemented.
 */

const API_URL =
  process.env.CLAWFORGE_API_URL ?? "http://localhost:4000";
const TOKEN = process.env.CLAWFORGE_TOKEN ?? "";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { ...headers(), ...(opts.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${opts.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

// --- Bot endpoints (token-authenticated) ---

export interface BotData {
  id: string;
  name: string;
  organizationId: string;
  ownerId: string;
  currentProgramId: string | null;
  currentRole: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getBot(nameOrId: string): Promise<BotData | null> {
  try {
    return await apiFetch<BotData>(`/bot/${encodeURIComponent(nameOrId)}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function createBot(data: {
  id?: string;
  name: string;
  programId?: string;
  role?: string;
  ownerId?: string;
}): Promise<BotData> {
  return apiFetch<BotData>("/bot/create", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBot(
  nameOrId: string,
  data: { name?: string; programId?: string; role?: string; status?: string },
): Promise<BotData> {
  return apiFetch<BotData>(
    `/bot/${encodeURIComponent(nameOrId)}/update`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export async function stopBot(nameOrId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    `/bot/${encodeURIComponent(nameOrId)}/stop`,
    { method: "POST" },
  );
}

// --- Stubs for features not yet implemented ---

export async function getTeam(teamSlug: string) {
  console.log(`[api] getTeam("${teamSlug}") — stubbed`);
  return { id: "team_mock", slug: teamSlug };
}

export async function getProgram(programSlug: string) {
  console.log(`[api] getProgram("${programSlug}") — stubbed`);
  return { id: "program_mock", slug: programSlug };
}

export async function getProgramRole(roleSlug: string) {
  console.log(`[api] getProgramRole("${roleSlug}") — stubbed`);
  return { id: "role_mock", slug: roleSlug };
}

export async function getBotCredentials(botId: string) {
  console.log(`[api] getBotCredentials("${botId}") — stubbed`);
  return { token: "mock-token" };
}

export async function registerBotServer(serverId: string, name: string) {
  console.log(
    `[api] registerBotServer("${serverId}", "${name}") — stubbed`,
  );
  return { ok: true };
}
