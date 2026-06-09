import { mutation } from "./_generated/server";

// Short-lived URL the client POSTs the file to; returns the storageId.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
