/**
 * Stubbed auth for verifying WebSocket client tokens against the Clawforge API.
 */

export async function authenticateProgram(
  apiUrl: string,
  clawforgeToken: string,
  clientToken: string,
): Promise<void> {
  console.log(
    `[auth] authenticateProgram — stubbed (apiUrl=${apiUrl}, clientToken=${clientToken.slice(0, 8)}…)`,
  );

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
}
