/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as blueprint from "../blueprint.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as deals from "../deals.js";
import type * as derive from "../derive.js";
import type * as extract from "../extract.js";
import type * as files from "../files.js";
import type * as gemini from "../gemini.js";
import type * as guide from "../guide.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeExtract from "../knowledgeExtract.js";
import type * as knowledgeModel from "../knowledgeModel.js";
import type * as knowledgePromote from "../knowledgePromote.js";
import type * as knowledgeSeed from "../knowledgeSeed.js";
import type * as library from "../library.js";
import type * as migrations from "../migrations.js";
import type * as pipeline from "../pipeline.js";
import type * as scenarioData from "../scenarioData.js";
import type * as users from "../users.js";
import type * as verticals from "../verticals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  blueprint: typeof blueprint;
  chat: typeof chat;
  crons: typeof crons;
  deals: typeof deals;
  derive: typeof derive;
  extract: typeof extract;
  files: typeof files;
  gemini: typeof gemini;
  guide: typeof guide;
  knowledge: typeof knowledge;
  knowledgeExtract: typeof knowledgeExtract;
  knowledgeModel: typeof knowledgeModel;
  knowledgePromote: typeof knowledgePromote;
  knowledgeSeed: typeof knowledgeSeed;
  library: typeof library;
  migrations: typeof migrations;
  pipeline: typeof pipeline;
  scenarioData: typeof scenarioData;
  users: typeof users;
  verticals: typeof verticals;
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
