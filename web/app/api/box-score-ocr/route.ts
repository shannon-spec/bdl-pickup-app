import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readSession } from "@/lib/auth/session";
import { canManageGame } from "@/lib/auth/perms";
import { STAT_FIELDS } from "@/lib/stats";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";
const MAX_IMAGES = 8;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB per image (API base64 ceiling ~5MB after encode is higher; keep margin)
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await req.formData();
  const gameId = form.get("gameId");
  if (typeof gameId !== "string" || !gameId)
    return NextResponse.json({ error: "Missing game." }, { status: 400 });
  if (!(await canManageGame(session, gameId)))
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json(
      { error: "Image conversion isn't configured (missing ANTHROPIC_API_KEY)." },
      { status: 503 },
    );

  // Roster names we expect to map stats onto.
  let roster: { id: string; name: string }[] = [];
  try {
    roster = JSON.parse((form.get("roster") as string) ?? "[]");
  } catch {
    roster = [];
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0)
    return NextResponse.json({ error: "No images uploaded." }, { status: 400 });
  if (files.length > MAX_IMAGES)
    return NextResponse.json({ error: `Up to ${MAX_IMAGES} images.` }, { status: 400 });

  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  for (const f of files) {
    if (!ALLOWED.has(f.type))
      return NextResponse.json(
        { error: `Unsupported image type: ${f.type || "unknown"}.` },
        { status: 400 },
      );
    if (f.size > MAX_BYTES)
      return NextResponse.json({ error: "An image is too large (8MB max)." }, { status: 400 });
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    imageBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: f.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: b64,
      },
    });
  }

  const rosterList =
    roster.length > 0
      ? `\n\nMatch each player to one of these exact roster names when possible (use the roster name verbatim):\n${roster.map((r) => `- ${r.name}`).join("\n")}`
      : "";

  const statTool: Anthropic.Tool = {
    name: "record_box_score",
    description:
      "Record the per-player basketball box score read from the image(s).",
    input_schema: {
      type: "object",
      properties: {
        players: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Player name as best read." },
              minutes: { type: "number" },
              points: { type: "number" },
              rebounds: { type: "number", description: "Total rebounds" },
              oreb: { type: "number", description: "Offensive rebounds" },
              dreb: { type: "number", description: "Defensive rebounds" },
              assists: { type: "number" },
              steals: { type: "number" },
              blocks: { type: "number" },
              turnovers: { type: "number" },
              fouls: { type: "number" },
              fgm: { type: "number" },
              fga: { type: "number" },
              tpm: { type: "number", description: "3-point makes" },
              tpa: { type: "number", description: "3-point attempts" },
              ftm: { type: "number" },
              fta: { type: "number" },
            },
            required: ["name"],
          },
        },
      },
      required: ["players"],
    },
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let toolInput: { players?: Record<string, unknown>[] } | null = null;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [statTool],
      tool_choice: { type: "tool", name: "record_box_score" },
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text:
                "These image(s) are a basketball box score / stat sheet for one game. " +
                "Extract every player's stats and call record_box_score. " +
                "Only include numbers you can actually read; omit a field if it's blank or unreadable (do not guess). " +
                "If multiple images are pages of the same sheet, merge them into one set of players." +
                rosterList,
            },
          ],
        },
      ],
    });
    const block = msg.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use")
      toolInput = block.input as { players?: Record<string, unknown>[] };
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Conversion failed." },
      { status: 502 },
    );
  }

  const extracted = Array.isArray(toolInput?.players) ? toolInput!.players! : [];

  // Match extracted names to roster ids (exact normalized, then last-name).
  const byNorm = new Map(roster.map((r) => [norm(r.name), r.id]));
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

  const matched: Record<string, Record<string, number | null>> = {};
  const unmatched: string[] = [];
  for (const row of extracted) {
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    let id = byNorm.get(norm(name));
    if (!id) {
      // last-name fallback: unique last-name match
      const lastNeedle = norm(name).split(" ").slice(-1)[0];
      const hits = roster.filter(
        (r) => norm(r.name).split(" ").slice(-1)[0] === lastNeedle,
      );
      if (hits.length === 1) id = hits[0].id;
    }
    if (!id) {
      unmatched.push(name);
      continue;
    }
    const stats: Record<string, number | null> = {};
    for (const f of STAT_FIELDS) stats[f] = num(row[f]);
    matched[id] = stats;
  }

  return NextResponse.json({
    matched,
    unmatched,
    count: extracted.length,
  });
}
