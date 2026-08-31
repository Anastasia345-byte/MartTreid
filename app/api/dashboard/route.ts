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
    range: "A2:X2000",
  },
  debtor: {
    name: "дебиторка (расчет)",
    range: "A1:C30",
  },
  factory: {
    name: "Кредиторка по Заводу (1с)",
    range: "A4:O2000",
  },
  wallet: {
    name: "Техн.Лист (кошелек)",
    range: "A2:J2000",
  },
  account: {
    name: "техн р\\с остатки",
    range: "A2:B2000",
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
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Ошибка Apps Script");
  }

  const headers = Array.isArray(result.data?.headers)
    ? result.data.headers
    : [];

  const rows = Array.isArray(result.data?.rows)
    ? result.data.rows
    : [];

  return headers.length > 0 ? [headers, ...rows] : rows;
}

function latestBalance(
  rows: Row[],
  end: string,
  balanceColumn: number,
) {
  return rows
    .map((row) => ({
      date: date(row[0]),
      value: number(row[balanceColumn]),
    }))
    .filter((row) => row.date && row.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const end =
      request.nextUrl.searchParams.get("end") ||
      new Date().toISOString().slice(0, 10);

    const baseUrl = required("GOOGLE_SHEETS_API_URL");

    const byRange: Record<string, Row[]> = {};
    const warnings: string[] = [];

    for (const [key, settings] of Object.entries(SHEETS)) {
      try {
        byRange[key] = await readSheet(
          baseUrl,
          settings.name,
          settings.range,
        );
      } catch (error) {
        byRange[key] = [];

        const message =
          error instanceof Error
            ? error.message
            : "неизвестная ошибка";

        warnings.push(`${settings.name}: ${message}`);
      }
    }

    const cashRows = byRange.cash ?? [];
    const orderRows = byRange.orders ?? [];
    const debtorRows = byRange.debtor ?? [];
    const factorySourceRows = byRange.factory ?? [];
    const walletRows = byRange.wallet ?? [];
    const accountRows = byRange.account ?? [];

    const cash = cashRows
      .map((row) => ({
        date: date(row[4]),
        amount: number(row[5]),
        source: text(row[6]),
        counterparty: text(row[8]),
        article: text(row[10]),
        flow: text(row[11]),
      }))
      .filter(
        (row) =>
          row.date &&
          row.amount &&
          !/внутрен|перевод между|резерв/i.test(
            `${row.article} ${row.counterparty}`,
          ),
      );

    const orders = orderRows
      .map((row) => ({
        date: date(row[0]),
        order: text(row[1]),
        payer: text(row[2]),
        client: text(row[3]),
        region: text(row[4]),
        product: text(row[6]),
        qty: number(row[7]),
        paymentType: text(row[9]),
        revenue: number(row[11]),
        manager: text(row[17]),
        department: text(row[18]),
        volume: number(row[20]),
        paid: number(row[21]),
        debt: number(row[22]),
        delivery: date(row[14]),
      }))
      .filter((row) => row.date && (row.revenue || row.debt));

    const debtorTotal = number(
      debtorRows.find((row) =>
        /текущая/i.test(text(row[0])),
      )?.[2],
    );

    const debtorDate = date(debtorRows[0]?.[1]);

    const factoryRows = factorySourceRows
      .map((row) => ({
        date: date(row[0]),
        debit: number(row[3]),
        credit: number(row[4]),
        balance: number(row[6]),
      }))
      .filter((row) => row.date && row.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));

    const factory = factoryRows.at(-1)?.balance ?? 0;

    const accountBalance = latestBalance(
      accountRows,
      end,
      1,
    );

    const walletBalance = latestBalance(
      walletRows,
      end,
      9,
    );

    return NextResponse.json(
      {
        source: "google-sheets-apps-script",
        updatedAt: new Date().toISOString(),
        warnings,
        cash,
        orders,
        debtor: {
          date: debtorDate,
          total:
            debtorTotal ||
            orders.reduce(
              (sum, row) => sum + row.debt,
              0,
            ),
        },
        creditor: {
          date: factoryRows.at(-1)?.date || end,
          factory,
          change: 0,
        },
        balances: {
          date: end,
          account: accountBalance,
          wallet: walletBalance,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Dashboard API:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ошибка чтения технических листов",
      },
      { status: 500 },
    );
  }
}
