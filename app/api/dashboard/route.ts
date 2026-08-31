import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiItem = Record<string, unknown>;

const text = (value: unknown) => (value == null ? "" : String(value).trim());
const number = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(text(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная ${name}`);
  return value.replace(/\/+$/, "");
}

function toRussianDate(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

async function api(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(path, `${required("FINTABLO_API_BASE_URL")}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${required("FINTABLO_API_TOKEN")}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Fintablo ${path}: HTTP ${response.status}${body ? ` — ${body.slice(0, 180)}` : ""}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.items) ? (payload.items as ApiItem[]) : [];
}

async function optional(path: string) {
  try {
    return await api(path, { pageSize: 1000 });
  } catch {
    return [];
  }
}

async function paged(path: string, params: Record<string, string | number | undefined>) {
  const result: ApiItem[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const items = await api(path, { ...params, page, pageSize: 1000 });
    result.push(...items);
    if (items.length < 1000) break;
  }
  return result;
}

function monthsBetween(start: string, end: string) {
  const months: string[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const limit = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  while (cursor <= limit && months.length < 120) {
    months.push(`${String(cursor.getUTCMonth() + 1).padStart(2, "0")}.${cursor.getUTCFullYear()}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export async function GET(request: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const end = request.nextUrl.searchParams.get("end") || today;
    const start = request.nextUrl.searchParams.get("start") || `${end.slice(0, 4)}-01-01`;

    const [moneybags, transactions, pnlCategories, transactionCategories, partners] = await Promise.all([
      api("/v1/moneybag"),
      paged("/v1/transaction", { dateFrom: toRussianDate(start), dateTo: toRussianDate(end) }),
      api("/v1/pnl-category"),
      optional("/v1/category"),
      optional("/v1/partner"),
    ]);

    const pnlChunks = await Promise.all(
      monthsBetween(start, end).map((month) => paged("/v1/pnl-item", { date: month })),
    );
    const pnlItems = pnlChunks.flat();

    const moneybagById = new Map(moneybags.map((item) => [number(item.id), item]));
    const categoryById = new Map(transactionCategories.map((item) => [number(item.id), text(item.name)]));
    const partnerById = new Map(partners.map((item) => [number(item.id), text(item.name)]));
    const pnlCategoryById = new Map(pnlCategories.map((item) => [number(item.id), item]));

    const accounts = moneybags
      .map((item) => ({
        id: number(item.id),
        name: text(item.name) || `Счёт ${text(item.id)}`,
        type: text(item.type),
        number: text(item.number),
        currency: text(item.currency) || "RUB",
        balance: number(item.balance),
        surplus: number(item.surplus),
        groupId: number(item.groupId),
        archived: Boolean(number(item.archived)),
        hideInTotal: Boolean(number(item.hideInTotal)),
      }))
      .filter((item) => !item.archived);

    const normalizedTransactions = transactions.map((item) => {
      const group = text(item.group);
      const accountId = number(item.moneybagId);
      const targetAccountId = number(item.moneybag2Id);
      const account = moneybagById.get(accountId);
      const targetAccount = moneybagById.get(targetAccountId);
      const rawValue = number(item.value);
      const amount = group === "outcome" ? -Math.abs(rawValue) : group === "income" ? Math.abs(rawValue) : 0;
      return {
        id: number(item.id),
        date: text(item.date).split(".").reverse().join("-"),
        amount,
        value: rawValue,
        group,
        description: text(item.description),
        accountId,
        account: text(account?.name) || `Счёт ${accountId}`,
        accountType: text(account?.type),
        targetAccountId,
        targetAccount: text(targetAccount?.name),
        targetValue: number(item.value2),
        categoryId: number(item.categoryId),
        category: categoryById.get(number(item.categoryId)) || `Статья ${text(item.categoryId)}`,
        partnerId: number(item.partnerId),
        partner: partnerById.get(number(item.partnerId)) || "",
        directionId: number(item.directionId),
      };
    });

    const pnl = pnlItems.map((item) => {
      const category = pnlCategoryById.get(number(item.categoryId));
      return {
        id: number(item.id),
        date: text(item.date),
        value: number(item.value),
        nds: number(item.nds),
        categoryId: number(item.categoryId),
        category: text(category?.name) || `Статья ${text(item.categoryId)}`,
        type: text(category?.type),
        pnlType: text(category?.pnlType),
        directionId: number(item.directionId),
        comment: text(item.comment),
      };
    });

    return NextResponse.json(
      {
        source: "fintablo",
        updatedAt: new Date().toISOString(),
        period: { start, end },
        accounts,
        transactions: normalizedTransactions,
        pnl,
        dictionaries: { pnlCategories, transactionCategories, partners },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Fintablo API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка чтения Fintablo" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
