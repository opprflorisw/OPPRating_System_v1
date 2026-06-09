// ============================================================================
// Users & login. Demo-grade auth: a fixed roster, one shared password,
// session kept client-side. Replace with Convex Auth / SSO before any
// external exposure beyond the team.
// ============================================================================

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export interface AppUser {
  email: string;
  name: string;
  role: string;
}

export const USERS: AppUser[] = [
  { email: "floris@oppr.ai", name: "Floris", role: "CEO" },
  { email: "lars@oppr.ai", name: "Lars", role: "Sales Leader" },
  { email: "sales1@oppr.ai", name: "Sales Exec 1", role: "Sales" },
  { email: "sales2@oppr.ai", name: "Sales Exec 2", role: "Sales" },
];

const PASSWORD = "12345678";

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (_ctx, { email, password }) => {
    const user = USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || password !== PASSWORD) {
      return { ok: false as const, error: "Unknown email or wrong password." };
    }
    return { ok: true as const, user };
  },
});
