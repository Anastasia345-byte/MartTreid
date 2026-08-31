import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = unknown[];

const SHEETS = {
  cash: {
    name: "ДДС недельный - по статьям",
    range: "A2:N200",
  },
  orders: {
    name: "техн.лист плита - заказы",
    range: "A2:X200",
  },
  debtor: {
    name: "дебиторка (расчет)",
    range: "A1:C30",
  },
  factory: {
    name: "Кредиторка по Заводу (1с)",
    range: "A4:O200",
  },
  wallet: {
    name: "Техн.Лист (кошелек)",
    range: "A2:J200",
  },
  account: {
    name: "техн р\\с остатки",
    range: "A2:B200",
  },
} as const;

const text = (value: unknown) =>
  value == null ? "" : String(value).trim();

const number = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = text(value)
    .replace(/\s/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
};

const date = (value: unknown) => {
  const raw = text(value);

  if (!raw) return "";

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return raw.slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
};

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Не задана переменная ${name}`);
  }

  return value.replace(/\/+$/, "");
}

async function readSheet(
  baseUrl: string,
  sheetName: string,
  cellRange: string,
): Promise<Row[]> {
  const url = new URL(baseUrl);

  url.searchParams.set("sheet", sheetName);
  url.searchParams.set("range", cellRange);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Лист «${sheetName}»: HTTP ${response.status}`,
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      `Лист «${sheetName}»: ${
        result.error || "ошибка Apps Script"
      }`,
    );
  }

  const headers = Array.isArray(result.data?.headers)
    ? result.data.headers
    : [];

  const rows = Array.isArray(result.data?.rows)
    ? result.data.rows
    : [];

  return headers.length ? [headers, ...rows] : rows;
}

function latestBalance(
  rows: Row[],
  end: string,
  balanceColumn: number,
) {
  return (
    rows
      .map((row) => ({
        date: date(row[0]),
        value: number(row[balanceColumn]),
      }))
      .filter((row) => row.date && row.date <= end)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? 0
  );
}

export async function GET(request: NextRequest) {
  try {
    const end =
      request.nextUrl.searchParams.get("end") ||
      new Date().toISOString().slice(0, 10);

    const baseUrl = required("GOOGLE_SHEETS_API_URL");

    const byRange = {} as Record<keyof typeof SHEETS, Row[]
