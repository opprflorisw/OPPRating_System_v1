import { createContext } from "react";
import type { AppUser } from "../convex/users";

// The signed-in user — the default author on every filing.
export const UserContext = createContext<AppUser>({ email: "", name: "Floris", role: "" });
