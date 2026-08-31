import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RANGES = [
  "ДДС недельный - по статьям!A1:Z200",
  "техн.лист плита - заказы!A1:Z200",
  "дебиторка (расчет)!A1:Z200",
  "Кредиторка по Заводу (1с)!A1:Z200",
];

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Не задана переменная ${name}`);
  }

  return value.replace(/\/+$/, "");
}

function ranges(): string[] {
  const configured = process.env.GOOGLE_SHEET_RANGES;

  if (!configured) {
    return DEFAULT_RANGES;
  }

  const parsed: unknown = JSON.parse(configured);

  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => typeof item === "string")
  ) {
    throw new Error(
      "GOOGLE_SHEET_RANGES должен быть JSON-массивом строк",
    );
  }

  return parsed;
}

function parseRange(configuredRange: string) {
  const separatorPosition = configuredRange.lastIndexOf("!");

  if (separatorPosition === -1) {
    return {
      sheetName: configuredRange,
      cellRange: "A:Z",
    };
  }

  return {
    sheetName: configuredRange.slice(0, separatorPosition),
    cellRange: configuredRange.slice(separatorPosition + 1),
  };
}

async function loadRange(
  baseUrl: string,
  configuredRange: string,
) {
  const { sheetName, cellRange } = parseRange(configuredRange);

  const url = new URL(baseUrl);
  url.searchParams.set("sheet", sheetName);
  url.searchParams.set("range", cellRange);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить лист «${sheetName}»: HTTP ${response.status}`,
    );
  }

  const result = await response.json();

 if (!result.success) {
  throw new Error(
    `Ошибка листа «${sheetName}»: ${
      result.error || "неизвестная ошибка Apps Script"
    }`,
  );
}

  const data = result.data ?? {};
  const headers = Array.isArray(data.headers) ? data.headers : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];

  return {
    range: configuredRange,
    majorDimension: "ROWS",
    values: headers.length > 0 ? [headers, ...rows] : rows,
  };
}

export async function GET() {
  try {
    const baseUrl = required("GOOGLE_SHEETS_API_URL");

    const valueRanges = [];

for (const configuredRange of ranges()) {
  const loadedRange = await loadRange(
    baseUrl,
    configuredRange,
  );

  valueRanges.push(loadedRange);
}

    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        source: "google-sheets-apps-script",
        ranges: valueRanges,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Google Sheets Apps Script API:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ошибка чтения Google Sheets",
      },
      { status: 500 },
    );
  }
}
