import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = unknown[];

const SHEETS = {
  cash: { name: "ДДС недельный - по статьям", range: "A2:N10000" },
  orders: { name: "техн.лист плита - заказы", range: "A2:X10000" },
  debtor: { name: "дебиторка (расчет)", range: "A1:C100" },
  factory: { name: "Кредиторка по Заводу (1с)", range: "A4:O10000" },
  wallet: { name: "Техн.Лист (кошелек)", range: "A2:J10000" },
  account: { name: "техн р\\с остатки", range: "A2:B10000" },
  planWallet: { name: "техн План поступлений (кошелек)", range: "A1:L10000" },
  planAccount: { name: "техн План по сбору средств (б/н)", range: "A1:L10000" },
  collectionSettings: { name: "План/факт по сбору средств", range: "A1:B3" },
} as const;

const text = (value: unknown) => (value == null ? "" : String(value).trim());

const number = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = text(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const date = (value: unknown) => {
  const raw = text(value);
  if (!raw) return "";

  const russianDate = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})/);
  if (russianDate) {
    const day = russianDate[1].padStart(2, "0");
    const month = russianDate[2].padStart(2, "0");
    const rawYear = russianDate[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная ${name}`);
  return value.replace(/\/+$/, "");
}

async function readSheet(baseUrl: string, sheetName: string, cellRange: string): Promise<Row[]> {
  const url = new URL(baseUrl);
  url.searchParams.set("sheet", sheetName);
  url.searchParams.set("range", cellRange);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Ошибка Apps Script");

  const headers = Array.isArray(result.data?.headers) ? result.data.headers : [];
  const rows = Array.isArray(result.data?.rows) ? result.data.rows : [];
  return headers.length ? [headers, ...rows] : rows;
}

function latestBalance(
  rows: Row[],
  end: string,
  dateColumn: number,
  balanceColumn: number,
) {
  return rows
    .map((row) => ({ date: date(row[dateColumn]), value: number(row[balanceColumn]) }))
    .filter((row) => row.date && row.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? 0;
}

function previousRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const previousEnd = new Date(startDate.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  return [previousStart.toISOString().slice(0, 10), previousEnd.toISOString().slice(0, 10)] as const;
}

export async function GET(request: NextRequest) {
  try {
    const end = request.nextUrl.searchParams.get("end") || new Date().toISOString().slice(0, 10);
    const start = request.nextUrl.searchParams.get("start") || end;
    const [previousStart, previousEnd] = previousRange(start, end);
    const baseUrl = required("GOOGLE_SHEETS_API_URL");
    const byRange: Record<string, Row[]> = {};
    const warnings: string[] = [];

    for (const [key, settings] of Object.entries(SHEETS)) {
      try {
        byRange[key] = await readSheet(baseUrl, settings.name, settings.range);
      } catch (error) {
        byRange[key] = [];
        warnings.push(`${settings.name}: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
      }
    }

    const cash = (byRange.cash ?? [])
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
          !/внутрен|перевод между|резерв/i.test(`${row.article} ${row.counterparty}`),
      );

    const orders = (byRange.orders ?? [])
      .map((row) => ({
        date: date(row[0]),
        order: text(row[1]),
        payer: text(row[2]),
        client: text(row[3]),
        region: text(row[4]),
        product: text(row[6]),
        qty: number(row[7]),
        paymentType: text(row[9]),
        revenue: number(row[10]),
        manager: text(row[17]),
        department: text(row[18]),
        volume: number(row[20]),
        paid: number(row[21]),
        debt: number(row[22]),
        delivery: date(row[14]),
      }))
      .filter((row) => row.date && (row.revenue || row.debt));

    const debtorRows = byRange.debtor ?? [];
    const debtorTotal = number(
      debtorRows.find((row) => /дебиторская задолженность текущая/i.test(text(row[0])))?.[2],
    );
    const debtorDate = date(debtorRows[0]?.[1]);

    type FactoryState = { date: string; balance: number };
    const currentFactories = new Map<string, FactoryState>();
    const previousFactories = new Map<string, FactoryState>();
    let currentFactory = "Без названия";
    let factoryPayments = 0;

    for (const row of byRange.factory ?? []) {
      const rowDate = date(row[0]);
      const label = text(row[0]);

      if (!rowDate) {
        if (label && !/период|контрагент|счет/i.test(label)) currentFactory = label;
        continue;
      }

      const balance = Math.max(0, number(row[6]));
      const state = { date: rowDate, balance };

      if (rowDate <= end) {
        const old = currentFactories.get(currentFactory);
        if (!old || old.date <= rowDate) currentFactories.set(currentFactory, state);
      }
      if (rowDate < start) {
        const old = previousFactories.get(currentFactory);
        if (!old || old.date <= rowDate) previousFactories.set(currentFactory, state);
      }
      if (rowDate >= start && rowDate <= end) factoryPayments += Math.max(0, number(row[3]));
    }

    const factories = [...currentFactories]
      .map(([name, state]) => ({ name, value: state.balance, date: state.date }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const factory = factories.reduce((sum, item) => sum + item.value, 0);
    const previousFactory = [...previousFactories.values()].reduce(
      (sum, item) => sum + item.balance,
      0,
    );
    const factoryDate = factories.map((item) => item.date).sort().at(-1) || end;

    const accountBalance = latestBalance(byRange.account ?? [], end, 0, 1);
    const walletBalance = latestBalance(byRange.wallet ?? [], end, 1, 9);

    const settingsRows = byRange.collectionSettings ?? [];
    const transferRate =
      number(settingsRows.find((row) => /ставка перевода в б\/н/i.test(text(row[0])))?.[1]) || 18;
    const crimeaRate =
      number(settingsRows.find((row) => /ставка перевода\s*-?\s*крым/i.test(text(row[0])))?.[1]) || 20;
    const inRange = (value: string, from: string, to: string) => value >= from && value <= to;
    const convertWallet = (amount: number, row: Row) => {
      const marker = row.slice(4, 10).map(text).join(" ");
      const rate = /крым/i.test(marker) ? crimeaRate : transferRate;
      return amount * (1 + rate / 100);
    };

    const walletOperations = (byRange.wallet ?? [])
      .map((row) => ({ row, date: date(row[1]), income: number(row[2]), expense: number(row[3]) }))
      .filter((item) => item.date);
    const accountOperations = cash;
    const planWalletRows = (byRange.planWallet ?? [])
      .map((row) => ({ row, date: date(row[1]), amount: number(row[2]) }))
      .filter((item) => item.date && item.amount);
    const planAccountRows = (byRange.planAccount ?? [])
      .map((row) => ({ row, date: date(row[1]), amount: number(row[2]) }))
      .filter((item) => item.date && item.amount);

    const collectionFor = (from: string, to: string) => {
      const walletRows = walletOperations.filter((item) => inRange(item.date, from, to));
      const accountRows = accountOperations.filter((item) => inRange(item.date, from, to));
      const wallet = walletRows.reduce((sum, item) => sum + Math.max(0, item.income), 0);
      const walletConverted = walletRows.reduce(
        (sum, item) => sum + convertWallet(Math.max(0, item.income), item.row),
        0,
      );
      const account = accountRows
        .filter((item) => item.amount > 0)
        .reduce((sum, item) => sum + item.amount, 0);
      const expenses =
        walletRows.reduce((sum, item) => sum + Math.max(0, item.expense), 0) +
        Math.abs(
          accountRows
            .filter((item) => item.amount < 0)
            .reduce((sum, item) => sum + item.amount, 0),
        );
      return { wallet, walletConverted, account, totalConverted: walletConverted + account, expenses };
    };

    const planFor = (from: string, to: string) => {
      const walletRows = planWalletRows.filter((item) => inRange(item.date, from, to));
      const accountRows = planAccountRows.filter((item) => inRange(item.date, from, to));
      const wallet = walletRows.reduce((sum, item) => sum + item.amount, 0);
      const walletConverted = walletRows.reduce(
        (sum, item) => sum + convertWallet(item.amount, item.row),
        0,
      );
      const account = accountRows.reduce((sum, item) => sum + item.amount, 0);
      return { wallet, walletConverted, account, totalConverted: walletConverted + account };
    };

    const collection = {
      rates: { wallet: transferRate, crimea: crimeaRate },
      current: collectionFor(start, end),
      previous: collectionFor(previousStart, previousEnd),
      plan: planFor(start, end),
      previousPlan: planFor(previousStart, previousEnd),
    };

    return NextResponse.json(
      {
        source: "google-sheets-apps-script",
        updatedAt: new Date().toISOString(),
        warnings,
        cash,
        orders,
        debtor: {
          date: debtorDate,
          total: debtorTotal || orders.reduce((sum, row) => sum + row.debt, 0),
        },
        creditor: {
          date: factoryDate,
          factory,
          change: factory - previousFactory,
          payments: factoryPayments,
          factories,
        },
        balances: { date: end, account: accountBalance, wallet: walletBalance },
        collection,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Dashboard API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка чтения технических листов" },
      { status: 500 },
    );
  }
}
