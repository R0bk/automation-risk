import { NextResponse } from "next/server";
import { z } from "zod";

import { findJobRoleByCode, searchJobRolesByPrefix } from "@/lib/db/queries";
import type { JobRole } from "@/lib/db/schema";

const querySchema = z.object({
  code: z.string().trim().min(1).optional(),
  prefix: z.string().trim().min(1).optional(),
  limit: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || (Number.isInteger(value) && value > 0), {
      message: "limit must be a positive integer",
    })
    .transform((value) => value ?? 10),
});

function normalizeJobRole(role: JobRole) {
  return {
    code: role.onetCode,
    title: role.title,
    normalizedTitle: role.normalizedTitle,
    parentCluster: role.parentCluster ?? null,
    metadata: role.metadata ?? null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parseResult = querySchema.safeParse({
    code: url.searchParams.get("code") ?? undefined,
    prefix: url.searchParams.get("prefix") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { code: "bad_request:validation", errors: parseResult.error.issues },
      { status: 400 }
    );
  }

  const { code, prefix, limit } = parseResult.data;

  if (!code && !prefix) {
    return NextResponse.json(
      { code: "bad_request:missing_query", message: "Provide either ?code= or ?prefix=" },
      { status: 400 }
    );
  }

  if (code && prefix) {
    return NextResponse.json(
      { code: "bad_request:ambiguous_query", message: "Use either code or prefix, not both" },
      { status: 400 }
    );
  }

  if (code) {
    const role = await findJobRoleByCode(code);
    if (!role) {
      return NextResponse.json({ code: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ role: normalizeJobRole(role) }, { status: 200 });
  }

  const roles = await searchJobRolesByPrefix(prefix!, limit);
  return NextResponse.json(
    {
      roles: roles.map(normalizeJobRole),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=86400",
      },
    }
  );
}
