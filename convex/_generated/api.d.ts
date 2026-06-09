/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as deals from "../deals.js";
import type * as derive from "../derive.js";
import type * as extract from "../extract.js";
import type * as files from "../files.js";
import type * as gemini from "../gemini.js";
import type * as guide from "../guide.js";
import type * as library from "../library.js";
import type * as pipeline from "../pipeline.js";
import type * as scenarioData from "../scenarioData.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  deals: typeof deals;
  derive: typeof derive;
  extract: typeof extract;
  files: typeof files;
  gemini: typeof gemini;
  guide: typeof guide;
  library: typeof library;
  pipeline: typeof pipeline;
  scenarioData: typeof scenarioData;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
