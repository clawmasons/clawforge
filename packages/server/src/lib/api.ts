/**
 * Stubbed API calls for communicating with clawforge.org.
 * All functions log what they would do and return mock data.
 */

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

export async function stopBot(botId: string) {
  console.log(`[api] stopBot("${botId}") — stubbed`);
  return { ok: true };
}
