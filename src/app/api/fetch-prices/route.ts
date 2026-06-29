/**
 * POST /api/fetch-prices
 * 管理者のみ: watchlist_items 全件の楽天・Yahoo最安値を自動取得して更新
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const ADMIN_UID = (process.env.NEXT_PUBLIC_ADMIN_UID ?? "").trim().replace(/^"|"$/g, "");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://otoquest-uiov.vercel.app";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJstDateStr(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const decoded = await getAuth().verifyIdToken(auth.slice(7));
    return decoded.uid === ADMIN_UID;
  } catch {
    return false;
  }
}

interface SearchResult { itemName: string; shop: string; price: number; }

async function fetchRakuten(keyword: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(`${APP_URL}/api/rakuten/search?${new URLSearchParams({ keyword, hits: "30" })}`);
    if (!res.ok) return null;
    const data = await res.json() as { results?: SearchResult[] };
    const items = (data.results ?? []).filter((r) => r.price > 0);
    return items.length ? items.reduce((min, r) => r.price < min.price ? r : min) : null;
  } catch { return null; }
}

async function fetchYahoo(keyword: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(`${APP_URL}/api/yahoo/search?${new URLSearchParams({ keyword, hits: "30" })}`);
    if (!res.ok) return null;
    const data = await res.json() as { results?: SearchResult[] };
    const items = (data.results ?? []).filter((r) => r.price > 0);
    return items.length ? items.reduce((min, r) => r.price < min.price ? r : min) : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  if (!adminDb) return NextResponse.json({ error: "Admin SDK未設定" }, { status: 503 });
  if (!await verifyAdmin(req)) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  try {
    const snap = await adminDb.collection("watchlist_items").get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      id: string; keyword: string; currentPrice: number;
      priceHistory: Array<{ date: string; price: number; shop: string }>;
    }>;

    const results = await Promise.allSettled(
      items.map(async (item) => {
        if (!item.keyword) return { id: item.id, status: "skipped" };
        const [rakuten, yahoo] = await Promise.all([fetchRakuten(item.keyword), fetchYahoo(item.keyword)]);
        const candidates = [rakuten, yahoo].filter(Boolean) as SearchResult[];
        if (!candidates.length) return { id: item.id, status: "no_result" };
        const best = candidates.reduce((min, r) => r.price < min.price ? r : min);
        const priceHistory = [
          { date: toJstDateStr(new Date()), price: best.price, shop: best.shop },
          ...(item.priceHistory ?? []),
        ].slice(0, 50);
        await adminDb!.collection("watchlist_items").doc(item.id).set(
          { previousPrice: item.currentPrice ?? 0, currentPrice: best.price, currentShop: best.shop, priceHistory, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return { id: item.id, status: "updated", price: best.price };
      })
    );

    const updated = results.filter((r) => r.status === "fulfilled" && (r.value as {status:string}).status === "updated").length;
    const failed  = results.filter((r) => r.status === "rejected").length;
    return NextResponse.json({ ok: true, total: items.length, updated, failed });
  } catch (e) {
    console.error("[POST /api/fetch-prices]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
