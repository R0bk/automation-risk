import { z } from "zod";

export const runRequestSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters")
    .max(50, "Company name must be 50 characters or fewer"),
  hqCountry: z
    .string()
    .trim()
    .max(80, "Headquarters country must be 80 characters or fewer")
    .optional(),
  industry: z
    .string()
    .trim()
    .max(128, "Industry must be 128 characters or fewer")
    .optional(),
  refresh: z.boolean().optional(),
  chatId: z.string().uuid().optional(),
  userApiKey: z
    .string()
    .trim()
    .min(1)
    .optional(),
  message: z
    .object({
      id: z.string().uuid(),
      role: z.literal("user"),
      parts: z.array(z.object({ type: z.string() }).passthrough()),
      metadata: z
        .object({
          createdAt: z.string().datetime().optional(),
        })
        .partial()
        .optional(),
    })
    .optional(),
});

export type RunRequest = z.infer<typeof runRequestSchema>;
