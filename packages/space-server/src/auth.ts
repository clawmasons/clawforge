/**
 * Stubbed auth for verifying WebSocket client tokens against the Clawforge API.
 */

export interface AuthResult {
  permissions: string[];
}

export async function authenticateProgram(
  apiUrl: string,
  clawforgeToken: string,
  clientToken: string,
): Promise<AuthResult> {
  console.log(
    `[auth] authenticateProgram — stubbed (apiUrl=${apiUrl}, clientToken=${clientToken.slice(0, 8)}…)`,
  );

  // Stub: root document read-only
  return { permissions: [":read"] };

  // TODO: uncomment when API endpoint is ready
  // const res = await fetch(`${apiUrl}/authenticate_program`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${clawforgeToken}`,
  //   },
  //   body: JSON.stringify({ token: clientToken }),
  // });
  // if (!res.ok) {
  //   throw new Error(`Authentication failed: ${res.status}`);
  // }
  // const data = await res.json();
  // return { permissions: data.permissions ?? [":read"] };
}
