import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = unknown[];
const SHEETS = {
  cash: "'ДДС недельный - по статьям'!A2:N",
  orders: "'техн.лист плита - заказы'!A2:X",
  debtor: "'дебиторка (расчет)'!A1:C30",
  factory: "'Кредиторка по Заводу (1с)'!A4:O",
  wallet: "'Техн.лист (кошелек)'!A2:J",
  account: "'техн рс остатки'!A2:B",
} as const;

const text = (value: unknown) => value == null ? "" : String(value).trim();
const number = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = text(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const date = (value: unknown) => {
  const raw = text(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная ${name}`);
  return value;
}

function latestBalance(rows: Row[], end: string, balanceColumn: number) {
  return rows
    .map(row => ({ date: date(row[0]), value: number(row[balanceColumn]) }))
    .filter(row => row.date && row.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const end = request.nextUrl.searchParams.get("end") || new Date().toISOString().slice(0, 10);
    const auth = new google.auth.JWT({
      email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      key: required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: required("GOOGLE_SHEET_ID"),
      ranges: Object.values(SHEETS),
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const values = response.data.valueRanges ?? [];
    const byRange = Object.fromEntries(Object.keys(SHEETS).map((key, index) => [key, values[index]?.values ?? []])) as Record<keyof typeof SHEETS, Row[]>;

    const cash = byRange.cash.map(row => ({
      date: date(row[4]), amount: number(row[5]), source: text(row[6]),
      counterparty: text(row[8]), article: text(row[10]), flow: text(row[11]),
    })).filter(row => row.date && row.amount && !/внутрен|перевод между|резерв/i.test(`${row.article} ${row.counterparty}`));

    const orders = byRange.orders.map(row => ({
      date: date(row[0]), order: text(row[1]), payer: text(row[2]), client: text(row[3]),
      region: text(row[4]), product: text(row[6]), qty: number(row[7]), paymentType: text(row[9]),
      revenue: number(row[11]), manager: text(row[17]), department: text(row[18]),
      volume: number(row[20]), paid: number(row[21]), debt: number(row[22]), delivery: date(row[14]),
    })).filter(row => row.date && (row.revenue || row.debt));

    const debtorTotal = number(byRange.debtor.find(row => /текущая/i.test(text(row[0])))?.[2]);
    const debtorDate = date(byRange.debtor[0]?.[1]);
    const factoryRows = byRange.factory.map(row => ({
      date: date(row[0]), debit: number(row[3]), credit: number(row[4]), balance: number(row[6]),
    })).filter(row => row.date && row.date <= end).sort((a, b) => a.date.localeCompare(b.date));
    const factory = factoryRows.at(-1)?.balance ?? 0;
    const accountBalance = latestBalance(byRange.account, end, 1);
    const walletBalance = latestBalance(byRange.wallet, end, 9);

    return NextResponse.json({
      source: "google-sheets",
      updatedAt: new Date().toISOString(),
      cash,
      orders,
      debtor: { date: debtorDate, total: debtorTotal || orders.reduce((sum, row) => sum + row.debt, 0) },
      creditor: { date: factoryRows.at(-1)?.date || end, factory, change: 0 },
      balances: { date: end, account: accountBalance, wallet: walletBalance },
    }, { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Dashboard API:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка чтения технических листов" }, { status: 500 });
  }
}
