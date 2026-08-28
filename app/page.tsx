"use client";
import { useEffect, useMemo, useState } from "react";
import martData from "./mart-data.json";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Filter,
  Info,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  Search,
  Settings2,
  Truck,
  Type,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
type Tab = "overview" | "goods" | "cash" | "logistics" | "sales";
type Tone = "good" | "warn" | "bad";
const monthly = [
  { m: "Мар", revenue: 18.2, profit: 4.1, plan: 19, inc: 17.4, out: 15.8 },
  { m: "Апр", revenue: 19.7, profit: 4.5, plan: 20, inc: 20.1, out: 18.6 },
  { m: "Май", revenue: 21.4, profit: 5.2, plan: 21, inc: 20.8, out: 19.1 },
  { m: "Июн", revenue: 20.8, profit: 4.8, plan: 22, inc: 22.2, out: 21.4 },
  { m: "Июл", revenue: 23.1, profit: 5.6, plan: 23, inc: 22.9, out: 21.6 },
  { m: "Авг", revenue: 22.6, profit: 5.1, plan: 24.5, inc: 21.8, out: 23 },
];
const tabs = [
  {
    id: "overview" as Tab,
    label: "Оперативный дашборд",
    icon: LayoutDashboard,
  },
  { id: "goods" as Tab, label: "Управление товаром", icon: Boxes },
  { id: "cash" as Tab, label: "ДДС", icon: WalletCards },
  { id: "logistics" as Tab, label: "Логистика", icon: Truck },
  { id: "sales" as Tab, label: "Продажи по менеджерам", icon: Users },
];
const kpis = [
  [
    "Остаток денежных средств",
    "12,7 млн ₽",
    "+4,2%",
    "доступно на счетах",
    "good",
    Banknote,
  ],
  [
    "Поступления",
    "21,8 млн ₽",
    "+1,6%",
    "план 22,4 млн ₽",
    "good",
    ArrowUpRight,
  ],
  [
    "Выплаты",
    "23,0 млн ₽",
    "+7,4%",
    "выше плана на 1,1 млн ₽",
    "warn",
    ArrowDownRight,
  ],
  [
    "Чистый денежный поток",
    "−1,2 млн ₽",
    "−1,8 млн ₽",
    "денег достаточно на 19 дней",
    "warn",
    CircleDollarSign,
  ],
  ["Выручка", "22,6 млн ₽", "+9,1%", "92% от плана", "warn", ArrowUpRight],
  [
    "Валовая прибыль",
    "5,1 млн ₽",
    "+6,3%",
    "маржа 22,6%",
    "good",
    CircleDollarSign,
  ],
  [
    "Стоимость остатков",
    "31,4 млн ₽",
    "+11,8%",
    "3,8 млн ₽ без движения",
    "warn",
    Boxes,
  ],
  [
    "Дебиторская задолженность",
    "14,8 млн ₽",
    "+8,7%",
    "просрочено 3,2 млн ₽",
    "bad",
    WalletCards,
  ],
  [
    "Кредиторская задолженность",
    "11,3 млн ₽",
    "−3,1%",
    "заводу — 7,6 млн ₽",
    "good",
    Banknote,
  ],
  [
    "Выполнение плана продаж",
    "92,2%",
    "−7,8 п.п.",
    "до плана 1,9 млн ₽",
    "warn",
    Users,
  ],
] as const;
const alerts = [
  [
    "Просроченная дебиторка выше лимита",
    "3,2 млн ₽",
    "Лимит 2,5 млн ₽ · 6 клиентов",
    "bad",
  ],
  ["Риск дефицита цемента М500", "4 дня", "Минимальный запас — 7 дней", "bad"],
  ["Задержаны 4 доставки", "до 3 дней", "ЦФО · ТрансЛайн и Вектор", "bad"],
  ["План продаж пока не выполнен", "92,2%", "До конца периода — 3 дня", "warn"],
] as const;
const stock = [
  { group: "Сухие смеси", value: 9.8, fill: "#167D74" },
  { group: "Цемент", value: 7.1, fill: "#45A79D" },
  { group: "Кирпич", value: 6.4, fill: "#8CCAC4" },
  { group: "Утеплитель", value: 4.8, fill: "#D59A39" },
  { group: "Прочее", value: 3.3, fill: "#B7CBC7" },
];
const Pill = ({
  tone = "good",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) => <span className={`pill ${tone}`}>{children}</span>;
function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        <Info size={15} />
      </div>
      {children}
    </section>
  );
}
type KpiRow = readonly [string, string, string, string, Tone, any];
function Kpi({ x, open }: { x: KpiRow; open: (s: string) => void }) {
  const I = x[5];
  return (
    <button className={`kpi ${x[4]}`} onClick={() => open(x[0])}>
      <div className="kpi-head">
        <span>{x[0]}</span>
        <I size={17} />
      </div>
      <strong>{x[1]}</strong>
      <div className="kpi-foot">
        <b>{x[2]}</b>
        <span>{x[3]}</span>
      </div>
    </button>
  );
}
const Tip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div className="tip">
      <b>{label}</b>
      {payload.map((p: any) => (
        <span key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value} млн ₽
        </span>
      ))}
    </div>
  ) : null;
function Table({
  title,
  heads,
  rows,
}: {
  title: string;
  heads: string[];
  rows: string[][];
}) {
  const [q, setQ] = useState("");
  const shown = rows.filter((r) =>
    r.join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Panel title={title} sub={`${shown.length} строк в текущем представлении`}>
      <div className="tools">
        <label>
          <Search size={14} />
          <input
            placeholder="Поиск по таблице"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button>
          <Download size={14} />
          Выгрузить
        </button>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {heads.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>
                    {j === r.length - 1 ? (
                      <Pill
                        tone={
                          /разрыв|риск|задерж|дефицит|неликвид/i.test(c)
                            ? "bad"
                            : /внимание|избыток|пути/i.test(c)
                              ? "warn"
                              : "good"
                        }
                      >
                        {c}
                      </Pill>
                    ) : (
                      c
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
function Heading({
  eye,
  title,
  status,
  tone = "warn",
}: {
  eye: string;
  title: string;
  status?: string;
  tone?: Tone;
}) {
  return (
    <div className="heading">
      <div>
        <span>{eye}</span>
        <h2>{title}</h2>
      </div>
      {status && <Pill tone={tone}>{status}</Pill>}
    </div>
  );
}
function Mini({ data }: { data: string[][] }) {
  return (
    <div className="mini-grid">
      {data.map((x, i) => (
        <div className="mini" key={x[0]}>
          <span>{x[0]}</span>
          <b>{x[1]}</b>
          <small
            className={
              /просроч|выше|\+12|−/.test(x[2] || "") ? "attention" : ""
            }
          >
            {x[2]}
          </small>
        </div>
      ))}
    </div>
  );
}
function RankList({
  title,
  items,
}: {
  title: string;
  items: { name: string; value: number }[];
}) {
  const max = Math.max(...items.map((x) => x.value), 1);
  return (
    <Panel title={title}>
      <div className="rank-list">
        {items.length ? (
          items.map((x: any, i: number) => (
            <div key={x.name}>
              <span>
                <i>{i + 1}</i>
                <b>{x.name}</b>
                <strong>{shortRub(x.value)}</strong>
              </span>
              <em>
                <i style={{ width: `${(x.value / max) * 100}%` }} />
              </em>
            </div>
          ))
        ) : (
          <p>Нет детализации по выбранному источнику</p>
        )}
      </div>
    </Panel>
  );
}
function Overview({ open, live }: { open: (s: string) => void; live: any }) {
  const cards = [
    {
      n: "Сбор средств",
      v: live.incoming,
      d: live.incomingDelta,
      primary: true,
    },
    { n: "Операционные расходы", v: live.outgoing, d: live.outgoingDelta },
    { n: "Операционный остаток", v: live.net, d: live.netDelta },
    { n: "Остаток денежных средств", v: live.balance, d: live.balanceDelta },
  ];
  return (
    <>
      <div className="operational-cards">
        {cards.map((x) => (
          <button
            key={x.n}
            className={x.primary ? "primary-card" : ""}
            onClick={() => open(x.n)}
          >
            <span>
              {x.n}
              <Info size={16} />
            </span>
            <strong>{shortRub(x.v)}</strong>
            <small className={String(x.d).startsWith("−") ? "down" : ""}>
              {x.d} <i>к предыдущему периоду</i>
            </small>
          </button>
        ))}
      </div>
      <div className="flow-layout">
        <Panel
          title="Денежный поток"
          sub="Поступления и выплаты за выбранный период"
        >
          <ResponsiveContainer width="100%" height={285}>
            <AreaChart data={live.chart}>
              <defs>
                <linearGradient id="flowFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16877d" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#16877d" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#DDEBE8" vertical={false} />
              <XAxis dataKey="m" axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<Tip />} />
              <Area
                dataKey="inc"
                name="Поступления"
                stroke="#16877D"
                fill="url(#flowFill)"
                strokeWidth={4}
              />
              <Line
                dataKey="out"
                name="Выплаты"
                stroke="#D99A32"
                strokeDasharray="10 8"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="Структура денежных средств"
          sub={`На ${rangeLabel(live.end, live.end)}`}
        >
          <div className="money-structure">
            <ResponsiveContainer width="46%" height={230}>
              <PieChart>
                <Pie
                  data={live.moneySources}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={1}
                >
                  {live.moneySources.map((x: any, i: number) => (
                    <Cell key={x.name} fill={i === 0 ? "#16877D" : "#A9D8D2"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => shortRub(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div>
              <b>{shortRub(live.balance)}</b>
              <small>всего</small>
              {live.moneySources.map((x: any, i: number) => (
                <p key={x.name}>
                  <i className={`dot d${i}`} />
                  <span>{x.name}</span>
                  <strong>{shortRub(x.value)}</strong>
                </p>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      <button
        className="wide-alert"
        onClick={() => open(live.alerts[0]?.[0] || "Требует внимания")}
      >
        <AlertTriangle />
        <span>
          <b>Требует внимания</b>
          <small>
            {live.alerts[0]?.[2] ||
              "Критических отклонений за выбранный период не выявлено"}
          </small>
        </span>
        <strong>Перейти к задолженности →</strong>
      </button>
      <div className="debt-title">
        <span>Задолженность</span>
        <h2>Расчёты и обязательства</h2>
        <small>Сравнение с предыдущим периодом</small>
      </div>
      <div className="debt-cards">
        <Kpi
          x={[
            "Дебиторская задолженность",
            shortRub(live.totalDebt),
            live.debtDelta,
            "по книге расчётов",
            "warn",
            WalletCards,
          ]}
          open={open}
        />
        <Kpi
          x={[
            "Долг перед заводом",
            shortRub(live.factoryDebt),
            live.factoryDelta,
            "на текущую дату",
            "bad",
            Banknote,
          ]}
          open={open}
        />
        <Kpi
          x={[
            "Оплаты заводу",
            shortRub(live.factoryPayments),
            live.factoryPaymentsDelta,
            "за выбранный период",
            "good",
            ArrowUpRight,
          ]}
          open={open}
        />
      </div>
      <div className="top-debtors">
        <RankList title="ТОП-5 · Кошелёк" items={live.walletDebtors} />
        <RankList title="ТОП-5 · Расчётный счёт" items={live.accountDebtors} />
      </div>
    </>
  );
}
const goods = [
  [
    "Основной склад",
    "Цемент М500",
    "Цемент",
    "т",
    "84",
    "7 920 ₽",
    "665 280 ₽",
    "3",
    "Дефицит",
  ],
  [
    "Северный",
    "Штукатурка ГипсПро",
    "Сухие смеси",
    "меш.",
    "1 240",
    "438 ₽",
    "543 120 ₽",
    "18",
    "Норма",
  ],
  [
    "Основной склад",
    "Утеплитель 50 мм",
    "Утеплитель",
    "упак.",
    "680",
    "1 860 ₽",
    "1 264 800 ₽",
    "76",
    "Избыток",
  ],
  [
    "Южный",
    "Кирпич М150",
    "Кирпич",
    "шт.",
    "42 600",
    "19 ₽",
    "809 400 ₽",
    "14",
    "Норма",
  ],
  [
    "Северный",
    "Клей плиточный",
    "Сухие смеси",
    "меш.",
    "320",
    "362 ₽",
    "115 840 ₽",
    "104",
    "Неликвид",
  ],
];
function Goods() {
  return (
    <>
      <Heading
        eye="Закупки · продажи · остатки"
        title="Управление товаром"
        status="7 позиций требуют внимания"
      />
      <Mini
        data={[
          ["Остатки по себестоимости", "31,4 млн ₽", "+11,8%"],
          ["Закупки", "18,7 млн ₽", "96% плана"],
          ["Продажи", "22,6 млн ₽", "+9,1%"],
          ["Оборачиваемость", "4,7 раза", "−0,3"],
          ["Неликвидные запасы", "3,8 млн ₽", "12,1%"],
        ]}
      />
      <div className="split">
        <Panel title="Стоимость запасов по группам" sub="млн ₽">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stock} layout="vertical">
              <CartesianGrid stroke="#E4EEEC" horizontal={false} />
              <XAxis type="number" axisLine={false} />
              <YAxis
                dataKey="group"
                type="category"
                width={95}
                axisLine={false}
              />
              <Tooltip />
              <Bar dataKey="value" fill="#167D74" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Товарный баланс" sub="контроль движений за период">
          <div className="balance">
            <div>
              <span>На начало</span>
              <b>28,1 млн ₽</b>
            </div>
            <em>+</em>
            <div>
              <span>Поступления</span>
              <b>18,2 млн ₽</b>
            </div>
            <em>−</em>
            <div>
              <span>Продажи</span>
              <b>14,9 млн ₽</b>
            </div>
            <em>=</em>
            <div className="result">
              <span>На конец</span>
              <b>31,4 млн ₽</b>
            </div>
          </div>
          <div className="check">
            <PackageCheck />
            <span>
              <b>Баланс сходится</b>
              <small>Расхождение менее 0,01%</small>
            </span>
          </div>
        </Panel>
      </div>
      <Table
        title="Остатки по складам"
        heads={[
          "Склад",
          "Товар",
          "Группа",
          "Ед.",
          "Количество",
          "Себестоимость",
          "Стоимость",
          "Без движения",
          "Статус",
        ]}
        rows={goods}
      />
    </>
  );
}
const cal = [
  [
    "28 авг",
    "12,7 млн ₽",
    "1,4 млн ₽",
    "2,1 млн ₽",
    "0,3 млн ₽",
    "11,7 млн ₽",
    "Норма",
  ],
  [
    "29 авг",
    "11,7 млн ₽",
    "0,8 млн ₽",
    "3,2 млн ₽",
    "0,6 млн ₽",
    "8,7 млн ₽",
    "Норма",
  ],
  [
    "30 авг",
    "8,7 млн ₽",
    "0,5 млн ₽",
    "5,9 млн ₽",
    "0,4 млн ₽",
    "2,9 млн ₽",
    "Внимание",
  ],
  [
    "31 авг",
    "2,9 млн ₽",
    "1,1 млн ₽",
    "4,7 млн ₽",
    "0,2 млн ₽",
    "−0,9 млн ₽",
    "Разрыв",
  ],
];
function Cash() {
  return (
    <>
      <Heading
        eye="Факт и прогноз"
        title="Движение денежных средств"
        status="Риск разрыва 31 августа"
        tone="bad"
      />
      <Mini
        data={[
          ["Остаток на начало", "13,9 млн ₽", ""],
          ["Поступления", "21,8 млн ₽", "97% плана"],
          ["Выплаты", "23,0 млн ₽", "+1,1 млн ₽ к плану"],
          ["Чистый поток", "−1,2 млн ₽", ""],
          ["Свободный остаток", "4,6 млн ₽", "после обязательств"],
        ]}
      />
      <div className="split equal">
        <Panel title="Прогноз остатка" sub="обязательные платежи учтены">
          <ResponsiveContainer width="100%" height={245}>
            <AreaChart
              data={[
                { d: "28", v: 12.7 },
                { d: "29", v: 8.7 },
                { d: "30", v: 2.9 },
                { d: "31", v: -0.9 },
                { d: "1 сен", v: 3.4 },
              ]}
            >
              <CartesianGrid stroke="#E4EEEC" vertical={false} />
              <XAxis dataKey="d" />
              <YAxis />
              <Tooltip />
              <Area
                dataKey="v"
                stroke="#167D74"
                fill="#DFF1EE"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Деньги по источникам" sub="12,7 млн ₽ доступно">
          <div className="bars">
            {[
              ["Расчётные счета", "10,4 млн ₽", 82],
              ["Кошелёк и наличные", "1,8 млн ₽", 14],
              ["Прочие счета", "0,5 млн ₽", 4],
            ].map((x) => (
              <div key={x[0] as string}>
                <span>
                  <b>{x[0]}</b>
                  <strong>{x[1]}</strong>
                </span>
                <i>
                  <em style={{ width: `${x[2]}%` }} />
                </i>
              </div>
            ))}
          </div>
          <p className="hint">
            Внутренние переводы между счетами исключены из оборота.
          </p>
        </Panel>
      </div>
      <Table
        title="Платёжный календарь"
        heads={[
          "Дата",
          "На начало",
          "Поступления",
          "Обязательные выплаты",
          "Другие выплаты",
          "На конец",
          "Статус",
        ]}
        rows={cal}
      />
    </>
  );
}
const deliveries = [
  [
    "МТ-2841",
    "СтройАльянс",
    "Москва",
    "ТрансЛайн",
    "27 авг",
    "29 авг",
    "18,4 т",
    "96 400 ₽",
    "+2 дня",
    "Задержана",
  ],
  [
    "МТ-2847",
    "База №7",
    "Тула",
    "Вектор",
    "28 авг",
    "—",
    "12,1 т",
    "71 800 ₽",
    "в пути",
    "В пути",
  ],
  [
    "МТ-2852",
    "ДомКомплект",
    "Калуга",
    "ТрансЛайн",
    "28 авг",
    "28 авг",
    "21,6 т",
    "102 300 ₽",
    "0 дней",
    "Вовремя",
  ],
  [
    "МТ-2854",
    "ПроектСтрой",
    "Москва",
    "АвтоПрофи",
    "29 авг",
    "—",
    "8,3 т",
    "54 200 ₽",
    "—",
    "Запланирована",
  ],
];
function Logistics() {
  return (
    <>
      <Heading
        eye="Сроки · стоимость · качество"
        title="Логистика"
        status="4 доставки задержаны"
        tone="bad"
      />
      <Mini
        data={[
          ["Доставки", "148", "132 завершено"],
          ["Доставлено вовремя", "91,7%", "план 95%"],
          ["Стоимость логистики", "1,86 млн ₽", "+12,4%"],
          ["Стоимость на тонну", "4 920 ₽", "+6,8%"],
          ["Доля в выручке", "8,2%", "норма до 8%"],
        ]}
      />
      <div className="split equal">
        <Panel title="Стоимость логистики" sub="план и факт, тыс. ₽">
          <ResponsiveContainer width="100%" height={245}>
            <BarChart
              data={[
                { w: "1 нед", p: 410, f: 398 },
                { w: "2 нед", p: 420, f: 451 },
                { w: "3 нед", p: 430, f: 476 },
                { w: "4 нед", p: 440, f: 535 },
              ]}
            >
              <CartesianGrid stroke="#E4EEEC" vertical={false} />
              <XAxis dataKey="w" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="p" fill="#B7CBC7" />
              <Bar dataKey="f" fill="#167D74" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Причины задержек" sub="12 задержек за период">
          <div className="bars reasons">
            {[
              ["Очередь на погрузке", "5 случаев", 42],
              ["Поломка транспорта", "3 случая", 25],
              ["Перенос клиентом", "2 случая", 17],
              ["Документы", "2 случая", 16],
            ].map((x) => (
              <div key={x[0] as string}>
                <span>
                  <b>{x[0]}</b>
                  <strong>{x[1]}</strong>
                </span>
                <i>
                  <em style={{ width: `${x[2]}%` }} />
                </i>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Table
        title="Доставки"
        heads={[
          "Заказ",
          "Клиент",
          "Регион",
          "Перевозчик",
          "План",
          "Факт",
          "Вес",
          "Стоимость",
          "Отклонение",
          "Статус",
        ]}
        rows={deliveries}
      />
    </>
  );
}
const managers = [
  [
    "Анна Соколова",
    "5,2 млн ₽",
    "5,6 млн ₽",
    "107,7%",
    "1,42 млн ₽",
    "25,4%",
    "38",
    "147 тыс. ₽",
    "0,18 млн ₽",
    "Лидер",
  ],
  [
    "Михаил Орлов",
    "4,8 млн ₽",
    "4,7 млн ₽",
    "97,9%",
    "1,06 млн ₽",
    "22,6%",
    "34",
    "138 тыс. ₽",
    "0,42 млн ₽",
    "Норма",
  ],
  [
    "Елена Ким",
    "4,5 млн ₽",
    "4,1 млн ₽",
    "91,1%",
    "0,91 млн ₽",
    "22,2%",
    "29",
    "141 тыс. ₽",
    "0,76 млн ₽",
    "Внимание",
  ],
  [
    "Дмитрий Волков",
    "4,3 млн ₽",
    "3,6 млн ₽",
    "83,7%",
    "0,72 млн ₽",
    "20,0%",
    "27",
    "133 тыс. ₽",
    "1,24 млн ₽",
    "Риск",
  ],
  [
    "Ирина Белова",
    "3,7 млн ₽",
    "4,6 млн ₽",
    "124,3%",
    "0,99 млн ₽",
    "21,5%",
    "32",
    "144 тыс. ₽",
    "0,60 млн ₽",
    "Лидер",
  ],
];
function Sales() {
  return (
    <>
      <Heading eye="Команда продаж" title="Продажи по менеджерам" />
      <Mini
        data={[
          ["План продаж", "24,5 млн ₽", ""],
          ["Выручка", "22,6 млн ₽", "92,2% плана"],
          ["Валовая прибыль", "5,1 млн ₽", "22,6%"],
          ["Средний чек", "141 тыс. ₽", "+4,8%"],
          ["Просроченная дебиторка", "3,2 млн ₽", "14,2% выручки"],
        ]}
      />
      <div className="split">
        <Panel title="Выполнение плана" sub="по менеджерам">
          <ResponsiveContainer width="100%" height={245}>
            <BarChart
              data={managers.map((r) => ({
                n: r[0].split(" ")[0],
                v: parseFloat(r[3]),
              }))}
            >
              <CartesianGrid stroke="#E4EEEC" vertical={false} />
              <XAxis dataKey="n" />
              <YAxis domain={[0, 140]} />
              <Tooltip />
              <Bar dataKey="v">
                {managers.map((r) => (
                  <Cell
                    key={r[0]}
                    fill={
                      parseFloat(r[3]) >= 100
                        ? "#167D74"
                        : parseFloat(r[3]) < 90
                          ? "#C7544C"
                          : "#D59A39"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Состав рейтинга" sub="веса показателей прозрачны">
          <div className="score">
            {[
              ["Выполнение плана", 30],
              ["Валовая прибыль", 25],
              ["Маржинальность", 15],
              ["Качество оплат", 15],
              ["Клиентская база", 10],
              ["Возвраты и скидки", 5],
            ].map((x) => (
              <p key={x[0] as string}>
                <span>{x[0]}</span>
                <b>{x[1]}%</b>
              </p>
            ))}
          </div>
        </Panel>
      </div>
      <Table
        title="Результаты менеджеров"
        heads={[
          "Менеджер",
          "План",
          "Выручка",
          "Выполнение",
          "Валовая прибыль",
          "Маржа",
          "Заказы",
          "Средний чек",
          "Просрочено",
          "Статус",
        ]}
        rows={managers}
      />
    </>
  );
}
const iso = (d: Date) => d.toISOString().slice(0, 10),
  parse = (s: string) => new Date(`${s}T12:00:00`),
  dayMs = 86400000;
function rangeLabel(start: string, end: string) {
  const f = (x: string) =>
    parse(x)
      .toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(" г.", "");
  return start === end ? f(start) : `${f(start)} — ${f(end)}`;
}
function previousRange(start: string, end: string) {
  const a = parse(start),
    b = parse(end),
    days = Math.round((b.getTime() - a.getTime()) / dayMs) + 1;
  b.setDate(a.getDate() - 1);
  a.setDate(a.getDate() - days);
  return [iso(a), iso(b)];
}
function shiftRange(start: string, end: string, step: number) {
  const days =
      Math.round((parse(end).getTime() - parse(start).getTime()) / dayMs) + 1,
    a = parse(start),
    b = parse(end);
  a.setDate(a.getDate() + step * days);
  b.setDate(b.getDate() + step * days);
  return [iso(a), iso(b)];
}
function DateControl({
  mode,
  setMode,
  start,
  setStart,
  end,
  setEnd,
  compare,
  setCompare,
}: {
  mode: string;
  setMode: (x: string) => void;
  start: string;
  setStart: (x: string) => void;
  end: string;
  setEnd: (x: string) => void;
  compare: boolean;
  setCompare: (x: boolean) => void;
}) {
  const prev = previousRange(start, end),
    apply = (m: string) => {
      setMode(m);
      if (m === "day") {
        setStart("2026-08-28");
        setEnd("2026-08-28");
      }
      if (m === "week") {
        setStart("2026-08-24");
        setEnd("2026-08-30");
      }
    };
  return (
    <div className="period-panel">
      <div className="period-modes">
        <button
          className={mode === "day" ? "active" : ""}
          onClick={() => apply("day")}
        >
          День
        </button>
        <button
          className={mode === "week" ? "active" : ""}
          onClick={() => apply("week")}
        >
          Неделя
        </button>
        <button
          className={mode === "range" ? "active" : ""}
          onClick={() => setMode("range")}
        >
          Диапазон
        </button>
      </div>
      <button
        className="period-arrow"
        onClick={() => {
          const r = shiftRange(start, end, -1);
          setStart(r[0]);
          setEnd(r[1]);
        }}
      >
        <ChevronLeft size={18} />
      </button>
      <div className="dates">
        <CalendarDays size={18} />
        <label>
          <small>С</small>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setMode("range");
            }}
          />
        </label>
        <span>—</span>
        <label>
          <small>По</small>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => {
              setEnd(e.target.value);
              setMode("range");
            }}
          />
        </label>
      </div>
      <button
        className="period-arrow"
        onClick={() => {
          const r = shiftRange(start, end, 1);
          setStart(r[0]);
          setEnd(r[1]);
        }}
      >
        <ChevronRight size={18} />
      </button>
      <label className="compare">
        <input
          type="checkbox"
          checked={compare}
          onChange={(e) => setCompare(e.target.checked)}
        />
        <span>
          <b>Сравнить</b>
          <small>{rangeLabel(prev[0], prev[1])}</small>
        </span>
      </label>
    </div>
  );
}
const rub = (v: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
const shortRub = (v: number) =>
  Math.abs(v) >= 1000000
    ? (v / 1000000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) +
      " млн ₽"
    : rub(v);
function buildLive(data: any, start: string, end: string) {
  const prev = previousRange(start, end),
    inRange = (d: string, a: string, b: string) => d >= a && d <= b,
    curCash: any[] = data.cash.filter((x: any) => inRange(x.date, start, end)),
    oldCash: any[] = data.cash.filter((x: any) => inRange(x.date, prev[0], prev[1])),
    curOrders: any[] = data.orders.filter((x: any) => inRange(x.date, start, end)),
    oldOrders: any[] = data.orders.filter((x: any) =>
      inRange(x.date, prev[0], prev[1]),
    ),
    sum = (arr: any[], key: string) =>
      arr.reduce((s, x) => s + (Number(x[key]) || 0), 0),
    incoming = (a: any[]) =>
      a.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0),
    outgoing = (a: any[]) =>
      Math.abs(a.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0)),
    inc = incoming(curCash),
    oldInc = incoming(oldCash),
    out = outgoing(curCash),
    oldOut = outgoing(oldCash),
    net = inc - out,
    oldNet = oldInc - oldOut,
    revenue = sum(curOrders, "revenue"),
    oldRevenue = sum(oldOrders, "revenue"),
    orders = new Set(curOrders.map((x) => x.order).filter(Boolean)).size,
    oldOrdersCount = new Set(oldOrders.map((x) => x.order).filter(Boolean))
      .size,
    debt = sum(curOrders, "debt"),
    volume = sum(curOrders, "volume"),
    delta = (a: number, b: number) =>
      b
        ? `${a >= b ? "+" : "−"}${Math.abs((a / b - 1) * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`
        : "нет базы",
    tone = (a: number, b: number): Tone => (a >= b ? "good" : "warn"),
    allCash: any[] = data.cash.filter((x: any) => x.date <= end),
    oldAllCash: any[] = data.cash.filter((x: any) => x.date < start),
    calculatedBalance = sum(allCash, "amount"),
    balance = data.balances ? data.balances.account + data.balances.wallet : calculatedBalance,
    oldBalance = sum(oldAllCash, "amount"),
    sourceBalance = (rx: RegExp) =>
      allCash
        .filter((x) => rx.test(String(x.source)))
        .reduce((s, x) => s + x.amount, 0),
    accountBalance = Math.max(0, data.balances?.account ?? sourceBalance(/р\/с|расч/i)),
    walletBalance = Math.max(0, data.balances?.wallet ?? balance - accountBalance),
    factoryRows = curCash.filter(
      (x) =>
        x.amount < 0 &&
        /завод|поставщик/i.test(`${x.article} ${x.counterparty}`),
    ),
    oldFactoryRows = oldCash.filter(
      (x) =>
        x.amount < 0 &&
        /завод|поставщик/i.test(`${x.article} ${x.counterparty}`),
    ),
    factoryPayments = outgoing(factoryRows),
    oldFactoryPayments = outgoing(oldFactoryRows),
    byDay = new Map<string, any>(),
    byManager = new Map<string, number>(),
    byDebtor = new Map<
      string,
      { name: string; value: number; wallet: boolean }
    >();
  for (const x of curCash) {
    const d = byDay.get(x.date) || {
      m: x.date.slice(5).split("-").reverse().join("."),
      revenue: 0,
      inc: 0,
      out: 0,
    };
    x.amount >= 0
      ? (d.inc += x.amount / 1e6)
      : (d.out += Math.abs(x.amount) / 1e6);
    byDay.set(x.date, d);
  }
  for (const x of curOrders) {
    const d = byDay.get(x.date) || {
      m: x.date.slice(5).split("-").reverse().join("."),
      revenue: 0,
      inc: 0,
      out: 0,
    };
    d.revenue += x.revenue / 1e6;
    byDay.set(x.date, d);
    byManager.set(x.manager, (byManager.get(x.manager) || 0) + x.revenue);
    if (x.debt > 0) {
      const name = x.client || x.payer || "Без названия",
        old = byDebtor.get(name);
      byDebtor.set(name, {
        name,
        value: (old?.value || 0) + x.debt,
          wallet: /кош|крым|налич/i.test(String(x.paymentType)),
      });
    }
  }
  const managers = [...byManager]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value: shortRub(value) })),
    allDebtors = [...byDebtor.values()].sort((a, b) => b.value - a.value),
    walletDebtors = allDebtors.filter((x) => x.wallet).slice(0, 5),
    accountDebtors = allDebtors.filter((x) => !x.wallet).slice(0, 5),
    totalDebt = data.debtor.total || debt,
    factoryDebt = data.creditor.factory || 0,
    kpis: KpiRow[] = [
      [
        "Поступления",
        shortRub(inc),
        delta(inc, oldInc),
        "по операциям ДДС",
        tone(inc, oldInc),
        ArrowUpRight,
      ],
      [
        "Выплаты",
        shortRub(out),
        delta(out, oldOut),
        "по операциям ДДС",
        out <= oldOut ? "good" : "warn",
        ArrowDownRight,
      ],
      [
        "Чистый денежный поток",
        shortRub(net),
        delta(net, oldNet),
        "поступления минус выплаты",
        net >= 0 ? "good" : "bad",
        CircleDollarSign,
      ],
      [
        "Остаток денежных средств",
        shortRub(balance),
        delta(balance, oldBalance),
        "на выбранную дату",
        balance >= 0 ? "good" : "bad",
        Banknote,
      ],
      [
        "Общая дебиторка",
        shortRub(totalDebt),
        `на ${data.debtor.date || "—"}`,
        "расчётный лист книги",
        "warn",
        WalletCards,
      ],
      [
        "Кредиторка перед заводом",
        shortRub(factoryDebt),
        `+${shortRub(data.creditor.change || 0)}`,
        `на ${data.creditor.date || "—"}`,
        "bad",
        Banknote,
      ],
    ],
    alerts: any[] = [];
  if (net < 0)
    alerts.push([
      "Отрицательный денежный поток",
      shortRub(net),
      "Выплаты превышают поступления за выбранный период",
      "bad",
    ]);
  if ((data.creditor.change || 0) > 0)
    alerts.push([
      "Рост долга перед заводом",
      shortRub(data.creditor.change),
      `Общий долг ${shortRub(factoryDebt)}`,
      "bad",
    ]);
  if (debt > 0)
    alerts.push([
      "Не оплачены заказы периода",
      shortRub(debt),
      `${curOrders.filter((x) => x.debt > 0).length} строк с остатком долга`,
      "warn",
    ]);
  if (!curCash.length)
    alerts.push([
      "Нет операций ДДС",
      "0 строк",
      "Проверьте выбранный период",
      "warn",
    ]);
  return {
    kpis,
    alerts,
    chart: [...byDay.values()].sort((a, b) => a.m.localeCompare(b.m)),
    managers,
    rows: curCash.length + curOrders.length,
    end,
    incoming: inc,
    outgoing: out,
    net,
    balance,
    incomingDelta: delta(inc, oldInc),
    outgoingDelta: delta(out, oldOut),
    netDelta: delta(net, oldNet),
    balanceDelta: delta(balance, oldBalance),
    moneySources: [
      { name: "Расчётный счёт", value: accountBalance },
      { name: "Кошелёк", value: walletBalance },
    ],
    totalDebt,
    debtDelta: "на текущую дату",
    factoryDebt,
    factoryDelta: delta(
      factoryDebt,
      Math.max(1, factoryDebt - (data.creditor.change || 0)),
    ),
    factoryPayments,
    factoryPaymentsDelta: delta(factoryPayments, oldFactoryPayments),
    walletDebtors,
    accountDebtors,
  };
}
export default function Home() {
  const [tab, setTab] = useState<Tab>("overview"),
    [filters, setFilters] = useState(false),
    [detail, setDetail] = useState<string | null>(null),
    [mode, setMode] = useState("week"),
    [start, setStart] = useState("2026-08-24"),
    [end, setEnd] = useState("2026-08-30"),
    [compare, setCompare] = useState(true),
    [font, setFont] = useState("large"),
    [data, setData] = useState<any>(martData),
    [dataState, setDataState] = useState<"loading" | "google" | "fallback">("loading"),
    [updatedAt, setUpdatedAt] = useState<string>("");
  useEffect(() => {
    const controller = new AbortController();
    setDataState("loading");
    fetch(`/api/dashboard?end=${encodeURIComponent(end)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Google Sheets недоступен");
        return response.json();
      })
      .then((nextData) => {
        setData(nextData);
        setUpdatedAt(nextData.updatedAt || "");
        setDataState("google");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDataState("fallback");
      });
    return () => controller.abort();
  }, [end]);
  const prev = previousRange(start, end),
    live = useMemo(() => buildLive(data, start, end), [data, start, end]);
  return (
    <main className={`shell font-${font}`}>
      <div className="workspace">
        <header>
          <div>
            <p>
              МАРТ-ТРЕЙД <span>Управленческая аналитика</span>
            </p>
            <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
          </div>
          <div className="head-actions">
            <div className="font-control" title="Размер шрифта">
              <Type size={16} />
              {["normal", "large", "xlarge"].map((x) => (
                <button
                  key={x}
                  className={font === x ? "active" : ""}
                  onClick={() => setFont(x)}
                >
                  A
                </button>
              ))}
            </div>
            <button
              className={filters ? "active" : ""}
              onClick={() => setFilters(!filters)}
            >
              <Filter size={17} />
              Фильтры
            </button>
          </div>
        </header>
        <DateControl
          mode={mode}
          setMode={setMode}
          start={start}
          setStart={setStart}
          end={end}
          setEnd={setEnd}
          compare={compare}
          setCompare={setCompare}
        />
        <div className="period-summary">
          <b>{rangeLabel(start, end)}</b>
          {compare && (
            <span>сравнивается с {rangeLabel(prev[0], prev[1])}</span>
          )}
        </div>
        {filters && (
          <div className="filterbar">
            {[
              "Все юрлица",
              "Все склады",
              "Все товарные группы",
              "Все менеджеры",
              "Все регионы",
            ].map((x) => (
              <select key={x}>
                <option>{x}</option>
              </select>
            ))}
            <button onClick={() => setFilters(false)}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className="content">
          {tab === "overview" && <Overview open={setDetail} live={live} />}{" "}
          {tab === "goods" && <Goods />}
          {tab === "cash" && <Cash />}
          {tab === "logistics" && <Logistics />}
          {tab === "sales" && <Sales />}
        </div>
      </div>
      <aside>
        <div className="brand">
          <b>МТ</b>
          <span>
            <strong>Март-Трейд</strong>
            <small>{dataState === "google" ? "Google Sheets" : "Резервный снимок"}</small>
          </span>
        </div>
        <nav>
          {tabs.map((t) => {
            const I = t.icon;
            return (
              <button
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
                key={t.id}
              >
                <I size={20} />
                {t.label}
                {t.id === "overview" && <i>4</i>}
              </button>
            );
          })}
        </nav>
        <div className="nav-bottom">
          <button>
            <Settings2 size={19} />
            Источники данных
          </button>
          <p>
            <i />
            <span>
              <b>{dataState === "loading" ? "Обновление…" : dataState === "google" ? "Данные актуальны" : "Резервные данные"}</b>
              <small>{dataState === "google" && updatedAt ? new Date(updatedAt).toLocaleString("ru-RU") : "Google Sheets не подключён"}</small>
            </span>
          </p>
        </div>
      </aside>
      {detail && (
        <div className="modal" onClick={() => setDetail(null)}>
          <article onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setDetail(null)}>
              <X />
            </button>
            <span className="eye">Детализация показателя</span>
            <h2>{detail}</h2>
            <p>
              Данные рассчитаны за {rangeLabel(start, end)}
              {compare ? ` и сравнены с ${rangeLabel(prev[0], prev[1])}` : ""}.
              Применены все активные фильтры.
            </p>
            <div className="detail-grid">
              <div>
                <span>Текущее значение</span>
                <b>
                  {live.kpis.find((k: KpiRow) => k[0] === detail)?.[1] ||
                    "Требует действия"}
                </b>
              </div>
              <div>
                <span>Обновлено</span>
                <b>28.08.2026, 09:42</b>
              </div>
            </div>
            <h3>Как рассчитано</h3>
            <p>
              Показатель собран из детальных операций после очистки, исключения
              дублей и внутренних перемещений.
            </p>
            <button className="primary" onClick={() => setDetail(null)}>
              Перейти к строкам
            </button>
          </article>
        </div>
      )}
    </main>
  );
}
