import type { DealEvent } from "../convex/pipeline";

export interface StoredEvent extends DealEvent {
  _id: string;
  dealId: string;
}

export interface Deal {
  _id: string;
  workspace?: string;
  clientId?: string;
  slug: string;
  account: string;
  site: string;
  region: string;
  throughput: string;
  capability: string;
  hook: string;
  acv: number;
  pocFee?: number;
  owner: string;
  events: StoredEvent[];
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_CONVEX_URL: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
