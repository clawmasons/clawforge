"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  plugins: [organizationClient()],
});

export const { signIn, signOut, useSession } = authClient;
