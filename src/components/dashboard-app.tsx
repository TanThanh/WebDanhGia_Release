"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { autoMap, collapseMergedHeaderColumns, detectClassHint, detectHeaderIndex, extractClassHint, ImportField, ImportMapping, normalizeText, SheetMerge } from "@/lib/normalization";
import { calculateScore, classifyScore } from "@/lib/scoring";

type View = "dashboard" | "record" | "students" | "rules" | "activity" | "import";
type RuleType = "CREDIT" | "DEBIT";
type Student = { id: string; ordinal: string; fullName: string; dateOfBirth: string; gender: string; phone: string; note: string; className: string };
type PointRule = { id: string; type: RuleType; points: number; category: string; title: string; note?: string | null };
type PointTransaction = { id: string; batchId: string; studentId: string; ruleId: string; ruleTitle: string; category: string; points: number; activityDate: string; note: string; status: string; createdAt: string; studentName: string; className: string };
type Settings = { schoolYear: string; semester: string; startingScore: number; capScore: boolean };
type Bootstrap = { students: Student[]; rules: PointRule[]; transactions: PointTransaction[]; classes: { id: string; name: string }[]; settings: Settings };
type Toast = { id: number; message: string; batchId?: string };

const nav: { id: View; label: string; glyph: string }[] = [
  { id: "dashboard", label: "Tổng quan", glyph: "▦" }, { id: "record", label: "Ghi nhận", glyph: "+" },
  { id: "students", label: "Học sinh", glyph: "◎" }, { id: "rules", label: "Quy tắc điểm", glyph: "≡" },
  { id: "activity", label: "Nhật ký", glyph: "⌁" }, { id: "import", label: "Import / Export", glyph: "⇩" },
];
const labels: Record<View, string> = { dashboard: "Tổng quan", record: "Ghi nhận", students: "Học sinh", rules: "Quy tắc điểm", activity: "Nhật ký", import: "Import / Export" };
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const fmtDate = (value: string) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("vi-VN") : "—";
const initials = (name: string) => name.trim().split(/\s+/).pop() || "";
const emptyData: Bootstrap = { students: [], rules: [], transactions: [], classes: [], settings: { schoolYear: "2026–2027", semester: "Học kỳ I", startingScore: 50, capScore: true } };

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Yêu cầu không thành công.");
  return body as T;
}

function RollingNumber({ value, decimals = 0 }: { value: number | null; decimals?: number }) {
  const text = value === null ? "—" : value.toLocaleString("vi-VN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className="counter-roll">{[...text].map((char, index) => /\d/.test(char) ? (
    <span className="digit-window" key={`${index}-${char}`}><span className="digit-strip" style={{ "--digit": Number(char) } as React.CSSProperties}>{Array.from({ length: 10 }, (_, number) => <span key={number}>{number}</span>)}</span></span>
  ) : <span key={`${index}-${char}`}>{char}</span>)}</span>;
}

export function DashboardApp() {
  const [data, setData] = useState<Bootstrap>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [classFilter, setClassFilter] = useState("__all");
  const [studentModal, setStudentModal] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await jsonRequest<Bootstrap>("/api/bootstrap")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setStudentModal(null); setSidebarOpen(false); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toast = (message: string, batchId?: string) => {
    const id = Date.now(); setToasts((items) => [...items, { id, message, batchId }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5500);
  };
  const filteredStudents = useMemo(() => {
    const list = classFilter === "__all" ? data.students : data.students.filter((student) => student.className === classFilter);
    return [...list].sort((a, b) => (parseInt(a.ordinal) || 9999) - (parseInt(b.ordinal) || 9999));
  }, [classFilter, data.students]);
  const activeTransactions = useMemo(() => data.transactions.filter((item) => item.status === "ACTIVE"), [data.transactions]);
  const scoreFor = useCallback((studentId: string) => calculateScore(activeTransactions.filter((item) => item.studentId === studentId).map((item) => item.points), data.settings.capScore), [activeTransactions, data.settings.capScore]);
  const go = (next: View) => { setView(next); setSidebarOpen(false); };

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark">RL</div><div><div className="text-sm font-extrabold">Rèn luyện</div><div className="text-[11px] text-body">THCS Phan Tây Hồ</div></div></div>
      <nav className="grid gap-1">{nav.map((item) => <button key={item.id} className={`nav-button ${view === item.id ? "active" : ""}`} onClick={() => go(item.id)}><span className="nav-icon">{item.glyph}</span><span>{item.label}</span></button>)}</nav>
      <div className="flex-1" />
      <div className="side-card"><strong className="text-ink">Năm học {data.settings.schoolYear}</strong><br />38 lỗi trừ điểm · 3 nội dung cộng điểm.<br />Dữ liệu lưu trong JSON server.</div>
    </aside>
    <main className="min-w-0">
      <header className="topbar"><div className="flex items-center gap-2"><button className="btn btn-mini md:hidden" aria-label="Mở menu" onClick={() => setSidebarOpen(true)}>☰</button><span className="text-xs text-body">{labels[view]}</span></div><div className="flex items-center gap-2"><select className="input" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="__all">Tất cả lớp</option>{data.classes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select className="input hidden sm:block" value={data.settings.semester} onChange={async (event) => { const semester = event.target.value; setData((current) => ({ ...current, settings: { ...current.settings, semester } })); await jsonRequest("/api/settings", { method: "PATCH", body: JSON.stringify({ semester }) }); }}><option>Học kỳ I</option><option>Học kỳ II</option></select></div></header>
      <div className="content view-in">
        {loading && <div className="card empty"><strong>Đang tải workspace</strong>Đang đọc dữ liệu JSON…</div>}
        {!loading && error && <div className="card empty"><strong>Chưa kết nối được database</strong><span>{error}</span><div className="mt-4"><button className="btn" onClick={() => void refresh()}>Thử lại</button></div></div>}
        {!loading && !error && view === "dashboard" && <DashboardView students={filteredStudents} transactions={activeTransactions} scoreFor={scoreFor} onGo={go} onStudent={setStudentModal} />}
        {!loading && !error && view === "record" && <RecordView students={filteredStudents} rules={data.rules} scoreFor={scoreFor} onSaved={async (message, batchId) => { toast(message, batchId); await refresh(); }} />}
        {!loading && !error && view === "students" && <StudentsView students={filteredStudents} transactions={activeTransactions} classFilter={classFilter} scoreFor={scoreFor} onGo={go} onStudent={setStudentModal} />}
        {!loading && !error && view === "rules" && <RulesView rules={data.rules} onAdded={async () => { toast("Đã tạo quy tắc thành công."); await refresh(); }} />}
        {!loading && !error && view === "activity" && <ActivityView transactions={data.transactions.filter((item) => classFilter === "__all" || item.className === classFilter)} onUndo={async (batchId) => { await jsonRequest(`/api/transaction-batches/${batchId}/undo`, { method: "POST" }); toast("Đã hoàn tác batch."); await refresh(); }} />}
        {!loading && !error && view === "import" && <ImportView data={data} onImported={async (message) => { toast(message); await refresh(); go("students"); }} onSettings={async (capScore) => { setData((current) => ({ ...current, settings: { ...current.settings, capScore } })); await jsonRequest("/api/settings", { method: "PATCH", body: JSON.stringify({ capScore }) }); }} />}
      </div>
    </main>
    {studentModal && <StudentDetail student={data.students.find((item) => item.id === studentModal)} transactions={data.transactions.filter((item) => item.studentId === studentModal)} score={scoreFor(studentModal)} onClose={() => setStudentModal(null)} onUpdated={async (msg) => { toast(msg); await refresh(); }} />}
    <div className="fixed bottom-5 right-5 z-[60] grid gap-2">{toasts.map((item) => <div key={item.id} className="toast flex min-w-[290px] items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-white shadow-xl"><div><div className="text-xs font-bold">{item.message}</div><small className="text-slate-300">Rèn luyện</small></div>{item.batchId && <button className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold" onClick={async () => { await jsonRequest(`/api/transaction-batches/${item.batchId}/undo`, { method: "POST" }); setToasts((items) => items.filter((entry) => entry.id !== item.id)); toast("Đã hoàn tác thao tác vừa ghi."); await refresh(); }}>Hoàn tác</button>}</div>)}</div>
  </div>;
}

function PageHead({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub: string; action?: React.ReactNode }) {
  return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><div className="subtle">{sub}</div></div>{action}</div>;
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) { return <div className="empty"><strong>{title}</strong>{children}</div>; }
function ratingClass(score: number) { const rating = classifyScore(score); return rating === "Tốt" || rating === "Khá" ? "good" : rating === "Đạt" ? "warn" : "bad"; }

function DashboardView({ students, transactions, scoreFor, onGo, onStudent }: { students: Student[]; transactions: PointTransaction[]; scoreFor: (id: string) => ReturnType<typeof calculateScore>; onGo: (view: View) => void; onStudent: (id: string) => void }) {
  const ids = new Set(students.map((student) => student.id));
  const scoped = transactions.filter((item) => ids.has(item.studentId));
  const average = students.length ? students.reduce((sum, student) => sum + scoreFor(student.id).score, 0) / students.length : null;
  
  const startDate = new Date("2026-09-07T00:00:00+07:00");
  const now = new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const currentWeek = diffTime < 0 ? 1 : Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
  const weekStart = new Date(startDate.getTime() + (currentWeek - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thisWeekScoped = scoped.filter(item => { const d = new Date(item.activityDate); return d >= weekStart && d < weekEnd; });
  const plusStudents = new Set(thisWeekScoped.filter(item => item.points > 0).map(item => item.studentId)).size;
  const minusStudents = new Set(thisWeekScoped.filter(item => item.points < 0).map(item => item.studentId)).size;

  const cards = [
    ["Học sinh", students.length, 0, "đang theo dõi"],
    ["Được cộng điểm", plusStudents, 0, `học sinh (Tuần ${currentWeek})`], ["Bị trừ điểm", minusStudents, 0, `học sinh (Tuần ${currentWeek})`],
    ["Cần lưu ý", students.filter((student) => scoreFor(student.id).score < 0).length, 0, "< 0 điểm"],
  ] as const;
  const low = [...students].sort((a, b) => scoreFor(a.id).score - scoreFor(b.id).score).slice(0, 6);
  const weeklyStats = Array.from({ length: currentWeek }, (_, i) => {
    const w = i + 1;
    const s = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const e = new Date(s.getTime() + 7 * 24 * 60 * 60 * 1000);
    const wScoped = scoped.filter(item => { const d = new Date(item.activityDate); return d >= s && d < e; });
    const pCount = wScoped.filter(item => item.points > 0).length;
    const mCount = wScoped.filter(item => item.points < 0).length;
    const pStudents = new Set(wScoped.filter(item => item.points > 0).map(item => item.studentId)).size;
    const mStudents = new Set(wScoped.filter(item => item.points < 0).map(item => item.studentId)).size;
    return {
      week: w,
      start: s.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' }),
      end: new Date(e.getTime() - 86400000).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' }),
      pCount, mCount, pStudents, mStudents
    };
  }).reverse();

  return <><PageHead eyebrow="Năm học 2026–2027" title="Tổng quan rèn luyện" sub="Theo dõi điểm hiện tại, hoạt động gần đây và học sinh cần chú ý." action={<button className="btn btn-primary" onClick={() => onGo("record")}>+ Ghi nhận điểm</button>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value, decimals, hint]) => <div className="card flex min-h-28 flex-col justify-between p-4" key={label}><div className="text-xs text-body font-bold">{label}</div><div className="mt-2 flex flex-col"><div className="text-[29px] font-extrabold tracking-[-.055em] leading-[1.1]"><RollingNumber value={value} decimals={decimals} /></div><div className="text-[10px] text-muted mt-1">{hint}</div></div></div>)}</div>
    
    <div className="mt-3 card">
      <div className="section-title"><h2>Báo cáo theo tuần</h2></div>
      <div className="table-wrap max-h-[300px] overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tuần</th>
              <th>Thời gian</th>
              <th className="text-right">Lượt cộng</th>
              <th className="text-right">Học sinh được cộng</th>
              <th className="text-right">Lượt trừ</th>
              <th className="text-right">Học sinh bị trừ</th>
            </tr>
          </thead>
          <tbody>
            {weeklyStats.map(w => (
              <tr key={w.week}>
                <td className="font-bold text-ink">Tuần {w.week}</td>
                <td>{w.start} – {w.end}</td>
                <td className={`text-right font-extrabold ${w.pCount > 0 ? "text-success" : "text-muted"}`}>{w.pCount > 0 ? `+${w.pCount}` : "0"}</td>
                <td className="text-right">{w.pStudents > 0 ? w.pStudents : "0"}</td>
                <td className={`text-right font-extrabold ${w.mCount > 0 ? "text-red-600" : "text-muted"}`}>{w.mCount > 0 ? `−${w.mCount}` : "0"}</td>
                <td className="text-right">{w.mStudents > 0 ? w.mStudents : "0"}</td>
              </tr>
            ))}
            {!weeklyStats.length && <tr><td colSpan={6}><Empty title="Chưa có dữ liệu">Dữ liệu tuần sẽ hiển thị ở đây.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_.65fr]"><div className="card"><div className="section-title"><h2>Hoạt động gần đây</h2><button className="btn btn-mini" onClick={() => onGo("activity")}>Xem tất cả</button></div><div className="p-1">{scoped.slice(0, 7).map((item) => <div className="grid grid-cols-[36px_1fr_auto] items-center gap-2.5 rounded-[10px] p-2.5 hover:bg-slate-50" key={item.id}><div className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-slate-50 text-[11px] font-extrabold">{initials(item.studentName)}</div><div><div className="font-bold">{item.studentName}</div><div className="text-[11px] text-body">{item.ruleTitle} · {fmtDate(item.activityDate)}</div></div><div className={`font-extrabold ${item.points > 0 ? "text-success" : "text-red-600"}`}>{item.points > 0 ? "+" : ""}{fmt(item.points)}</div></div>)}{!scoped.length && <Empty title="Chưa có ghi nhận nào">Bắt đầu tại mục “Ghi nhận”.</Empty>}</div></div>
      <div className="card"><div className="section-title"><h2>Điểm thấp nhất</h2><span className="text-xs text-body">Top 6</span></div><div className="p-1">{low.map((student) => { const score = scoreFor(student.id).score; return <button key={student.id} className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-2.5 rounded-[10px] p-2.5 text-left hover:bg-slate-50" onClick={() => onStudent(student.id)}><div className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-slate-50 text-[11px] font-extrabold">{initials(student.fullName)}</div><div><div className="font-bold">{student.fullName}</div><div className="text-[11px] text-body">{student.className} · {classifyScore(score)}</div></div><div className="font-extrabold">{fmt(score)}</div></button>; })}{!low.length && <Empty title="Chưa có học sinh">Import danh sách để xem thống kê.</Empty>}</div></div></div>
  </>;
}
type RuleInput = { id: string; query: string; selected: PointRule | null };
type CustomInput = { id: string; title: string; points: string; selected: PointRule | null };

function FastRecordRow({ student, rules, score, date, onSaved, onApplyToAll }: { student: Student; rules: PointRule[]; score: number; date: string; onSaved: (message: string, batchId: string) => Promise<void>; onApplyToAll: (ruleId: string | null, customTitle: string, customPoints: number) => Promise<void> }) {
  const [ruleInputs, setRuleInputs] = useState<RuleInput[]>([{ id: Math.random().toString(), query: "", selected: null }]);
  const [customInputs, setCustomInputs] = useState<CustomInput[]>([{ id: Math.random().toString(), title: "", points: "", selected: null }]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getVisibleDebitRules = (query: string, selected: PointRule | null) => {
    if (!query.trim() || selected?.title === query) return [];
    const q = normalizeText(query);
    return rules.filter((r) => r.type === "DEBIT" && normalizeText(`${r.title} ${r.category} ${r.id}`).includes(q)).slice(0, 5);
  };

  const getVisibleCreditRules = (query: string, selected: PointRule | null) => {
    if (!query.trim() || selected?.title === query) return [];
    const q = normalizeText(query);
    return rules.filter((r) => r.type === "CREDIT" && normalizeText(`${r.title} ${r.category} ${r.id}`).includes(q)).slice(0, 5);
  };

  const commitAll = async () => {
    const validRules = ruleInputs.map(ri => {
      if (ri.selected) return ri.selected;
      if (ri.query.trim()) {
        const vis = getVisibleDebitRules(ri.query, null);
        if (vis.length > 0) return vis[0];
      }
      return null;
    }).filter(r => r !== null) as PointRule[];

    const validCustom = customInputs.filter(ci => {
      if (ci.selected) return true;
      const pts = parseFloat(ci.points);
      return ci.title.trim() && !isNaN(pts) && pts > 0;
    });

    if (validRules.length === 0 && validCustom.length === 0) return;

    setSaving(true);
    try {
      const messages: string[] = [];
      let lastBatch = "";
      
      for (const rule of validRules) {
        const res = await jsonRequest<{ batchId: string; points: number }>("/api/point-transactions", { method: "POST", body: JSON.stringify({ ruleId: rule.id, studentIds: [student.id], activityDate: date, note: "" }) });
        messages.push(`${res.points > 0 ? "+" : ""}${fmt(res.points)}`);
        lastBatch = res.batchId;
      }
      
      for (const custom of validCustom) {
        let res;
        if (custom.selected) {
          res = await jsonRequest<{ batchId: string; points: number }>("/api/point-transactions", { method: "POST", body: JSON.stringify({ ruleId: custom.selected.id, studentIds: [student.id], activityDate: date, note: "" }) });
        } else {
          res = await jsonRequest<{ batchId: string; points: number }>("/api/point-transactions", { method: "POST", body: JSON.stringify({ customTitle: custom.title.trim(), customPoints: parseFloat(custom.points), studentIds: [student.id], activityDate: date, note: "" }) });
        }
        messages.push(`+${fmt(res.points)}`);
        lastBatch = res.batchId;
      }

      setRuleInputs([{ id: Math.random().toString(), query: "", selected: null }]);
      setCustomInputs([{ id: Math.random().toString(), title: "", points: "", selected: null }]);
      await onSaved(`Đã ghi nhận ${messages.join(", ")} cho ${student.fullName}`, lastBatch);
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  return <div className="grid grid-cols-[36px_250px_1fr_1fr] items-start gap-4 rounded-[10px] p-2.5 hover:bg-slate-50 border-b border-line last:border-0">
    <div className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-slate-50 text-[11px] font-extrabold">{initials(student.fullName)}</div>
    <div>
      <div className="font-bold">{student.fullName}</div>
      <div className="text-[11px] text-body">{student.className} · Điểm hiện tại: <strong className={score >= 80 ? "text-success" : score < 50 ? "text-red-600" : ""}>{fmt(score)}</strong></div>
    </div>
    <div className="flex flex-col gap-2">
      {ruleInputs.map((item, index) => {
        const visRules = getVisibleDebitRules(item.query, item.selected);
        return (
          <div key={item.id} className="relative flex gap-1.5">
            <div className="relative flex-1">
              <input ref={index === 0 ? inputRef : null} className={`input w-full text-sm ${item.selected ? "pr-[50px]" : ""}`} placeholder="Tìm lỗi vi phạm..." value={item.query} onChange={(e) => {
                setRuleInputs(prev => prev.map(p => p.id === item.id ? { ...p, query: e.target.value, selected: null } : p));
              }} disabled={saving} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commitAll(); } }} />
              {item.selected && <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] font-extrabold ${item.selected.type === "CREDIT" ? "text-success" : "text-red-600"}`}>{item.selected.type === "CREDIT" ? "+" : "−"}{fmt(item.selected.points)}</div>}
            </div>
            {index === ruleInputs.length - 1 && <button className="btn btn-mini shrink-0 !px-2.5 text-[15px] font-bold text-body hover:text-ink" onClick={() => setRuleInputs(p => [...p, { id: Math.random().toString(), query: "", selected: null }])} title="Thêm lỗi">+</button>}
            
            {item.query.trim() && !item.selected && visRules.length > 0 && <div className="absolute top-full left-0 mt-1 w-[320px] bg-white rounded-xl shadow-xl border border-line z-20 overflow-hidden">{visRules.map((rule, idx) => <button key={rule.id} className={`w-full text-left p-2.5 text-xs border-b border-line last:border-0 hover:bg-slate-50 ${idx === 0 ? "bg-slate-50" : ""}`} onClick={() => {
              setRuleInputs(prev => prev.map(p => p.id === item.id ? { ...p, query: rule.title, selected: rule } : p));
              inputRef.current?.focus();
            }}><div className="flex justify-between gap-2"><span className="font-bold line-clamp-2">{rule.title}</span><span className={`font-extrabold flex-shrink-0 ${rule.type === "CREDIT" ? "text-success" : "text-red-600"}`}>{rule.type === "CREDIT" ? "+" : "−"}{fmt(rule.points)}</span></div><div className="text-[10px] text-body mt-0.5">{rule.category}</div></button>)}</div>}
          </div>
        )
      })}
    </div>
    <div className="flex flex-col gap-2">
      {customInputs.map((item, index) => {
        const visCredit = getVisibleCreditRules(item.title, item.selected);
        return (
          <div key={item.id} className="relative flex gap-1.5">
            <div className="relative flex-1 flex items-center h-9 rounded-[10px] border border-success/30 bg-white focus-within:border-success focus-within:ring-3 focus-within:ring-success/20 transition overflow-visible">
              <input className="flex-1 w-full h-full text-xs bg-transparent border-none outline-none focus:ring-0 px-3 placeholder-success/60 text-success" placeholder="Việc làm tốt..." value={item.title} onChange={(e) => setCustomInputs(prev => prev.map(p => p.id === item.id ? { ...p, title: e.target.value, selected: null } : p))} disabled={saving} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commitAll(); } }} />
              
              {item.selected ? (
                <div className="flex items-center justify-center px-3 h-full bg-success/5 border-l border-success/10 text-[13px] font-extrabold text-success">
                  +{fmt(item.selected.points)}
                </div>
              ) : (
                <div className="flex items-center justify-center px-1 h-full min-w-[54px] bg-success/5 border-l border-success/10 cursor-text" onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input) input.focus(); }}>
                  {item.points && <span className="text-[13px] font-extrabold text-success leading-none">+</span>}
                  <input type="number" step="0.5" min="0" className="w-[36px] h-full bg-transparent text-[13px] text-center font-extrabold text-success outline-none p-0 border-none focus:ring-0 placeholder-success/40" placeholder="Điểm" value={item.points} onChange={(e) => setCustomInputs(prev => prev.map(p => p.id === item.id ? { ...p, points: e.target.value } : p))} disabled={saving} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commitAll(); } }} style={{ MozAppearance: 'textfield' }} />
                </div>
              )}
            </div>
            
            {item.title.trim() && !item.selected && visCredit.length > 0 && <div className="absolute top-full left-0 mt-1 w-[320px] bg-white rounded-xl shadow-xl border border-line z-50 overflow-hidden">{visCredit.map((rule, idx) => <button key={rule.id} className={`w-full text-left p-2.5 text-xs border-b border-line last:border-0 hover:bg-slate-50 ${idx === 0 ? "bg-slate-50" : ""}`} onClick={() => {
              setCustomInputs(prev => prev.map(p => p.id === item.id ? { ...p, title: rule.title, points: String(rule.points), selected: rule } : p));
            }}><div className="flex justify-between gap-2"><span className="font-bold line-clamp-2">{rule.title}</span><span className="font-extrabold flex-shrink-0 text-success">+{fmt(rule.points)}</span></div><div className="text-[10px] text-body mt-0.5">{rule.category}</div></button>)}</div>}
            
            {index === customInputs.length - 1 && <button className="btn btn-mini shrink-0 !px-2.5 text-[15px] font-bold text-white bg-success hover:bg-green-600 shadow" disabled={saving} onClick={() => {
              const pts = parseFloat(item.points);
              if (item.selected || (item.title.trim() && !isNaN(pts) && pts > 0)) {
                onApplyToAll(item.selected ? item.selected.id : null, item.title, pts || (item.selected?.points ?? 0));
                setCustomInputs([{ id: Math.random().toString(), title: "", points: "", selected: null }]);
              } else {
                 alert("Vui lòng nhập hoặc chọn nội dung cộng điểm trước khi áp dụng toàn lớp!");
              }
            }} title="Áp dụng cho toàn lớp">+</button>}
          </div>
        )
      })}
    </div>
  </div>;
}

function RecordView({ students, rules, scoreFor, onSaved }: { students: Student[]; rules: PointRule[]; scoreFor: (id: string) => ReturnType<typeof calculateScore>; onSaved: (message: string, batchId: string) => Promise<void> }) {
  const [activityDate, setActivityDate] = useState(today());
  const [search, setSearch] = useState("");
  const visibleStudents = students.filter((s) => {
    const q = normalizeText(search);
    return !q || s.ordinal === search.trim() || normalizeText(`${s.fullName} ${s.className} ${s.phone}`).includes(q);
  });
  
  const handleApplyToAll = async (ruleId: string | null, customTitle: string, customPoints: number) => {
    if (visibleStudents.length === 0) return;
    try {
      let res;
      if (ruleId) {
        res = await jsonRequest<{ batchId: string; points: number }>("/api/point-transactions", {
          method: "POST",
          body: JSON.stringify({
            ruleId,
            studentIds: visibleStudents.map(s => s.id),
            activityDate,
            note: ""
          })
        });
      } else {
        res = await jsonRequest<{ batchId: string; points: number }>("/api/point-transactions", {
          method: "POST",
          body: JSON.stringify({
            customTitle: customTitle.trim(),
            customPoints: customPoints,
            studentIds: visibleStudents.map(s => s.id),
            activityDate,
            note: ""
          })
        });
      }
      await onSaved(`Đã cộng +${fmt(res.points)} cho toàn lớp (${visibleStudents.length} HS)`, res.batchId);
    } catch (e: any) {
      alert(e.message || "Lỗi khi áp dụng toàn lớp.");
    }
  };

  return <><PageHead eyebrow="Nhập nhanh" title="Ghi nhận rèn luyện" sub="Chọn học sinh và gõ vài từ khóa quy tắc rồi nhấn Enter để ghi nhận." />
    <div className="card overflow-visible">
      <div className="section-title">
        <h2>Đánh giá học sinh</h2>
        <div className="flex gap-2">
          <input className="input min-w-[260px] flex-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm học sinh (tên, lớp, STT)..." />
          <input type="date" className="input" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} title="Ngày ghi nhận" />
        </div>
      </div>
      <div className="p-2 min-h-[400px]">
        {!students.length && <Empty title="Chưa có học sinh">Hãy chọn một lớp từ menu góc trên, hoặc import danh sách.</Empty>}
        {students.length > 0 && !visibleStudents.length && <Empty title="Không tìm thấy học sinh">Thử thay đổi từ khóa tìm kiếm.</Empty>}
        {visibleStudents.map((student) => <FastRecordRow key={student.id} student={student} rules={rules} score={scoreFor(student.id).score} date={activityDate} onSaved={onSaved} onApplyToAll={handleApplyToAll} />)}
      </div>
    </div></>;
}

function StudentsView({ students, transactions, classFilter, scoreFor, onGo, onStudent }: { students: Student[]; transactions: PointTransaction[]; classFilter: string; scoreFor: (id: string) => ReturnType<typeof calculateScore>; onGo: (view: View) => void; onStudent: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const visible = students.filter((student) => {
    const q = normalizeText(search);
    return !q || student.ordinal === search.trim() || normalizeText(`${student.fullName} ${student.className} ${student.phone} ${student.note}`).includes(q);
  });

  const handleExport = () => {
    if (!students.length) return;
    const wb = XLSX.utils.book_new();
    const currentYear = new Date().getFullYear();
    const schoolStartDate = new Date(`${currentYear}-09-05T00:00:00`);

    const formatVNDate = (dateString: string) => {
      const d = new Date(dateString);
      const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      return `${days[d.getDay()]}/${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const getWeek = (dateString: string) => {
      const d = new Date(dateString);
      const diff = d.getTime() - schoolStartDate.getTime();
      if (diff < 0) return "1";
      return (Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1).toString();
    };

    const sortedStudents = [...students].sort((a, b) => {
      const numA = parseInt(a.ordinal) || 9999;
      const numB = parseInt(b.ordinal) || 9999;
      return numA - numB;
    });

    sortedStudents.forEach((student, index) => {
      const stt = student.ordinal || (index + 1).toString();
      const sheetNameBase = `${stt} - ${student.fullName}`;
      let sheetName = sheetNameBase.replace(/[\[\]\*\/\\\?\:]/g, "").substring(0, 31);
      let counter = 1;
      let finalSheetName = sheetName;
      while (wb.SheetNames.includes(finalSheetName)) {
        finalSheetName = `${sheetName.substring(0, 27)}(${counter})`;
        counter++;
      }

      const studentTx = transactions.filter((tx) => tx.studentId === student.id).sort((a, b) => a.activityDate.localeCompare(b.activityDate));
      
      const rows: unknown[][] = [];
      rows.push(["SỔ THEO DÕI TÌNH HÌNH NỀ NẾP - HỌC TẬP CỦA HỌC SINH"]);
      rows.push([]);
      rows.push(["TUẦN", "NGÀY THÁNG", "NỘI DUNG VI PHẠM", "ĐIỂM TRỪ", "NHỮNG VIỆC LÀM TỐT", "ĐIỂM CỘNG"]);
      
      studentTx.forEach((tx) => {
        const isCredit = tx.points > 0;
        const content = tx.note ? `${tx.ruleTitle} (${tx.note})` : tx.ruleTitle;
        rows.push([
          getWeek(tx.activityDate),
          formatVNDate(tx.activityDate),
          isCredit ? "" : content,
          isCredit ? "" : Math.abs(tx.points),
          isCredit ? content : "",
          isCredit ? tx.points : ""
        ]);
      });

      if (studentTx.length === 0) {
        for (let i = 0; i < 5; i++) rows.push(["", "", "", "", "", ""]);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      ws["!cols"] = [{ wch: 8 }, { wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 40 }, { wch: 10 }];
      
      XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
    });

    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["Không có dữ liệu"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    }

    XLSX.writeFile(wb, `So_Theo_Doi_${classFilter === "__all" ? "Tat_Ca" : classFilter}.xlsx`);
  };

  return <><PageHead eyebrow="Danh sách" title="Học sinh" sub="Danh sách được import từ Excel/CSV và tính điểm tự động từ nhật ký." action={<div className="flex items-center gap-2"><button className="btn font-bold text-success" onClick={handleExport} disabled={!students.length}>Xuất Excel</button><button className="btn btn-primary" onClick={() => onGo("import")}>Import danh sách</button></div>} /><div className="toolbar"><input className="input min-w-[260px] flex-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, lớp, số điện thoại..." /></div><div className="card table-wrap"><table className="data-table"><thead><tr><th>STT</th><th>Họ và tên</th><th>Lớp</th><th>Ngày sinh</th><th>GT</th><th className="text-right">Cộng</th><th className="text-right">Trừ</th><th className="text-right">Điểm</th><th>Xếp loại</th><th /></tr></thead><tbody>{visible.map((student, index) => { const score = scoreFor(student.id); return <tr key={student.id}><td className="text-body">{student.ordinal || index + 1}</td><td className="font-bold">{student.fullName}</td><td>{student.className}</td><td>{student.dateOfBirth ? fmtDate(student.dateOfBirth) : "—"}</td><td>{student.gender || "—"}</td><td className="text-right font-bold text-success">+{fmt(score.credit)}</td><td className="text-right font-bold text-red-600">−{fmt(score.debit)}</td><td className="text-right font-extrabold">{fmt(score.score)}</td><td><span className={`badge ${ratingClass(score.score)}`}>{classifyScore(score.score)}</span></td><td className="text-right"><button className="btn btn-mini" onClick={() => onStudent(student.id)}>Chi tiết</button></td></tr>; })}{!visible.length && <tr><td colSpan={10}><Empty title={students.length ? "Không tìm thấy học sinh" : "Chưa có danh sách học sinh"}>{students.length ? "Thử từ khóa khác." : "Bấm “Import danh sách” để bắt đầu."}</Empty></td></tr>}</tbody></table></div></>;
}

function RulesView({ rules, onAdded }: { rules: PointRule[]; onAdded: () => Promise<void> }) {
  const [type, setType] = useState<RuleType>("DEBIT"); const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = rules.filter((rule) => rule.type === type && normalizeText(`${rule.title} ${rule.category} ${rule.note ?? ""}`).includes(normalizeText(search)));

  const save = async () => {
    if (!newTitle.trim() || !newPoints) return;
    setSaving(true);
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, points: type === "CREDIT" ? Math.abs(Number(newPoints)) : -Math.abs(Number(newPoints)) })
      });
      setCreating(false);
      setNewTitle(""); setNewPoints("");
      await onAdded();
    } catch (e) {
      alert("Lỗi khi tạo quy tắc.");
    } finally {
      setSaving(false);
    }
  };

  return <><PageHead eyebrow="Từ file Quy ước" title="Quy tắc điểm" sub="Danh sách các lỗi trừ điểm và nội dung cộng điểm." action={<button className="btn btn-primary" onClick={() => setCreating(true)}>+ Tạo quy tắc mới</button>} /><div className="toolbar"><div className="tabs"><button className={`tab ${type === "DEBIT" ? "active" : ""}`} onClick={() => setType("DEBIT")}>Trừ điểm</button><button className={`tab ${type === "CREDIT" ? "active" : ""}`} onClick={() => setType("CREDIT")}>Cộng điểm</button></div><input className="input min-w-[260px] flex-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung / nhóm lỗi..." /></div><div className="grid gap-2 lg:grid-cols-2">{visible.map((rule) => <div className="card grid grid-cols-[1fr_auto] gap-3 p-3.5" key={rule.id}><div><div className="text-xs font-bold leading-5">{rule.title}</div><div className="mt-1 text-[10.5px] text-body">{rule.category} · {rule.id}</div>{rule.note && <div className="mt-1 text-[10.5px] leading-4 text-body">{rule.note}</div>}</div><div className={`font-extrabold ${rule.type === "CREDIT" ? "text-success" : "text-red-600"}`}>{rule.type === "CREDIT" ? "+" : "−"}{fmt(rule.points)}</div></div>)}</div>
  {creating && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreating(false); }}><div className="modal-shell p-5" style={{ maxWidth: 400 }}><h3 className="font-extrabold text-lg mb-4">Tạo quy tắc {type === "CREDIT" ? "cộng điểm" : "trừ điểm"}</h3><div className="grid gap-3"><label className="grid gap-1"><span className="text-[11px] font-bold">Tên quy tắc</span><input className="input" placeholder="Ví dụ: Giúp đỡ bạn bè..." value={newTitle} onChange={e => setNewTitle(e.target.value)} /></label><label className="grid gap-1"><span className="text-[11px] font-bold">Số điểm {type === "CREDIT" ? "cộng" : "trừ"}</span><input type="number" className="input" placeholder="Ví dụ: 5" value={newPoints} onChange={e => setNewPoints(e.target.value)} /></label><div className="flex justify-end gap-2 mt-4"><button className="btn" onClick={() => setCreating(false)}>Hủy</button><button className="btn btn-primary" disabled={!newTitle.trim() || !newPoints || saving} onClick={save}>{saving ? "Đang lưu..." : "Tạo quy tắc"}</button></div></div></div></div>}
  </>;
}

function ActivityView({ transactions, onUndo }: { transactions: PointTransaction[]; onUndo: (batchId: string) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, PointTransaction[]>();
    for (const item of transactions) {
      if (!groups.has(item.batchId)) groups.set(item.batchId, []);
      groups.get(item.batchId)!.push(item);
    }
    return Array.from(groups.values()).map(group => {
      if (group.length === 1) return group[0];
      return {
        ...group[0],
        id: group[0].batchId,
        studentName: `${group.length} học sinh`
      };
    });
  }, [transactions]);

  const visible = groupedTransactions.filter((item) => normalizeText(`${item.studentName} ${item.ruleTitle} ${item.category} ${item.note}`).includes(normalizeText(search)));
  const undo = async (batchId: string) => { setBusy(batchId); try { await onUndo(batchId); } finally { setBusy(""); } };
  
  return <><PageHead eyebrow="Lịch sử" title="Nhật ký cộng / trừ" sub="Mỗi học sinh là một giao dịch riêng; thao tác hàng loạt dùng cùng batch." /><div className="toolbar"><input className="input min-w-[260px] flex-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm học sinh, nội dung, ghi chú..." /></div><div className="card table-wrap"><table className="data-table"><thead><tr><th>Ngày</th><th>Học sinh</th><th>Nội dung</th><th>Nhóm</th><th className="text-right">Điểm</th><th>Trạng thái</th><th /></tr></thead><tbody>{visible.map((item) => <tr className={item.status !== "ACTIVE" ? "opacity-45" : ""} key={item.id}><td>{fmtDate(item.activityDate)}</td><td className="font-bold">{item.studentName}</td><td className="max-w-[420px]">{item.ruleTitle}</td><td className="text-body">{item.category}</td><td className={`text-right font-extrabold ${item.points > 0 ? "text-success" : "text-red-600"}`}>{item.points > 0 ? "+" : ""}{fmt(item.points)}</td><td><span className={`badge ${item.status === "ACTIVE" ? "good" : ""}`}>{item.status === "ACTIVE" ? "Đang hiệu lực" : "Đã hoàn tác"}</span></td><td className="text-right">{item.status === "ACTIVE" && <button className="btn btn-mini btn-danger" disabled={busy === item.batchId} onClick={() => void undo(item.batchId)}>Undo batch</button>}</td></tr>)}{!visible.length && <tr><td colSpan={7}><Empty title="Chưa có nhật ký">Các giao dịch cộng/trừ điểm sẽ xuất hiện ở đây.</Empty></td></tr>}</tbody></table></div></>;
}

const importLabels: Record<ImportField, string> = { fullName: "Họ và tên *", ordinal: "STT", dateOfBirth: "Ngày sinh", gender: "Giới tính", className: "Lớp", phone: "Số ĐT", note: "Ghi chú" };
type PreparedImportSheet = { name: string; headers: string[]; rows: unknown[][]; detectedClass: string; mergedHeaderCount: number };

function ImportView({ data, onImported, onSettings }: { data: Bootstrap; onImported: (message: string) => Promise<void>; onSettings: (cap: boolean) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<PreparedImportSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [defaultClass, setDefaultClass] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [status, setStatus] = useState("Chưa chọn file");
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const applySheet = (sheet: PreparedImportSheet, sourceFileName: string) => {
    setSelectedSheet(sheet.name);
    setHeaders(sheet.headers);
    setRows(sheet.rows);
    setMapping(autoMap(sheet.headers));
    setDefaultClass(sheet.detectedClass);
    setStatus(`${sourceFileName} · sheet ${sheet.name} · ${sheet.rows.length} dòng`);
  };

  const readFile = async (file: File) => {
    setStatus("Đang đọc file...");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const preparedSheets = workbook.SheetNames.map((name): PreparedImportSheet | null => {
        const worksheet = workbook.Sheets[name];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false, dateNF: "dd/mm/yyyy" });
        if (!raw.some((row) => row.some((cell) => String(cell).trim()))) return null;
        const headerIndex = detectHeaderIndex(raw);
        const headerMerges = ((worksheet["!merges"] ?? []) as SheetMerge[]).filter((merge) => merge.s.r === headerIndex && merge.e.r === headerIndex && merge.e.c > merge.s.c);
        const logicalRows = collapseMergedHeaderColumns(raw, headerIndex, (worksheet["!merges"] ?? []) as SheetMerge[]);
        const headers = logicalRows[headerIndex].map((value, column) => String(value || `Cột ${column + 1}`).trim() || `Cột ${column + 1}`);
        const rows = logicalRows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell).trim()));
        return { name, headers, rows, detectedClass: detectClassHint(raw, headerIndex), mergedHeaderCount: headerMerges.length };
      }).filter((sheet): sheet is PreparedImportSheet => sheet !== null);
      if (!preparedSheets.length) throw new Error("File không có dữ liệu.");

      const fileClass = extractClassHint(file.name);
      const scoreSheet = (sheet: PreparedImportSheet) => {
        let score = Object.values(autoMap(sheet.headers)).filter((index) => index >= 0).length;
        if (fileClass && sheet.detectedClass === fileClass) score += 100;
        if (normalizeText(sheet.name).includes("hoc sinh")) score += 10;
        return score;
      };
      const preferred = preparedSheets.reduce((best, sheet) => scoreSheet(sheet) > scoreSheet(best) ? sheet : best);
      setFileName(file.name);
      setSheets(preparedSheets);
      applySheet(preferred, file.name);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Không đọc được file.");
      setSheets([]); setSelectedSheet(""); setDefaultClass(""); setRows([]); setMapping(null);
    }
  };
  const importNow = async () => {
    if (!mapping || mapping.fullName < 0) { setStatus("Vui lòng mapping cột Họ và tên."); return; }
    const get = (row: unknown[], field: ImportField) => mapping[field] >= 0 ? String(row[mapping[field]] ?? "").trim() : "";
    const students = rows.map((row, index) => ({ ordinal: get(row, "ordinal") || String(index + 1), fullName: get(row, "fullName"), dateOfBirth: get(row, "dateOfBirth"), gender: get(row, "gender"), className: get(row, "className") || defaultClass.trim() || "Chưa phân lớp", phone: get(row, "phone"), note: get(row, "note") })).filter((student) => student.fullName);
    if (!students.length) { setStatus("Không tìm thấy học sinh hợp lệ."); return; }
    setImporting(true);
    try {
      const result = await jsonRequest<{ importedCount: number; skippedCount: number }>("/api/imports/students", { method: "POST", body: JSON.stringify({ fileName, mode, mapping, students }) });
      await onImported(`Đã import ${result.importedCount} học sinh${result.skippedCount ? `, bỏ qua ${result.skippedCount} dòng trùng` : ""}.`);
    } catch (caught) { setStatus(caught instanceof Error ? caught.message : "Import thất bại."); }
    finally { setImporting(false); }
  };
  const downloadTemplate = () => {
    const csv = "\uFEFFSTT,Họ và tên,Ngày sinh,Giới tính,Lớp,Số ĐT,Ghi chú\n1,Nguyễn Văn A,01/01/2012,Nam,9/15,0900000000,\n2,Trần Thị B,02/02/2012,Nữ,9/15,0911111111,\n";
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); anchor.download = "mau_danh_sach_hoc_sinh.csv"; anchor.click(); URL.revokeObjectURL(anchor.href);
  };
  const exportExcel = () => {
    const scoreFor = (id: string) => calculateScore(data.transactions.filter((item) => item.studentId === id && item.status === "ACTIVE").map((item) => item.points), data.settings.capScore);
    const studentRows = data.students.map((student, index) => { const score = scoreFor(student.id); return { STT: student.ordinal || index + 1, "Họ và tên": student.fullName, "Ngày sinh": student.dateOfBirth, "Giới tính": student.gender, "Lớp": student.className, "Số ĐT": student.phone, "Ghi chú": student.note, "Điểm đầu kỳ": 50, "Tổng cộng": score.credit, "Tổng trừ": score.debit, "Điểm hiện tại": score.score, "Xếp loại": classifyScore(score.score) }; });
    const logRows = data.transactions.map((item) => ({ Ngày: item.activityDate, "Học sinh": item.studentName, Lớp: item.className, Loại: item.points > 0 ? "Cộng" : "Trừ", "Nội dung": item.ruleTitle, Nhóm: item.category, Điểm: item.points, "Ghi chú": item.note, "Trạng thái": item.status === "ACTIVE" ? "Hiệu lực" : "Đã hoàn tác", Batch: item.batchId }));
    const ruleRows = data.rules.map((rule) => ({ Mã: rule.id, Loại: rule.type === "CREDIT" ? "Cộng" : "Trừ", Nhóm: rule.category, "Nội dung": rule.title, Điểm: rule.points, "Ghi chú": rule.note ?? "" }));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(studentRows), "Học sinh"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(logRows), "Nhật ký"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ruleRows), "Quy tắc"); XLSX.writeFile(workbook, `Ren_luyen_${today()}.xlsx`);
  };
  return <><PageHead eyebrow="Dữ liệu học sinh" title="Import / Export" sub="Import .xlsx, .xls hoặc .csv; hệ thống tự dò tiêu đề và cho sửa mapping trước khi nhập." />
    <div className="grid gap-3 lg:grid-cols-[.78fr_1.22fr]"><div className="grid content-start gap-3"><button className={`card grid min-h-[180px] place-items-center border-dashed p-6 text-center transition hover:-translate-y-px ${dragging ? "border-slate-500 bg-slate-50" : ""}`} onClick={() => fileRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void readFile(file); }}><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} /><div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-white text-lg">↥</div><strong>Kéo thả file vào đây</strong><div className="subtle mt-1">hoặc bấm để chọn file Excel / CSV</div></div></button>
      <div className="card p-4"><h2 className="mb-2 font-extrabold">Mẫu danh sách</h2><div className="subtle mb-3">Các cột tùy chọn: STT, Ngày sinh, Giới tính, Lớp, Số ĐT, Ghi chú. Chỉ “Họ và tên” bắt buộc.</div><button className="btn" onClick={downloadTemplate}>Tải file mẫu CSV</button></div>
      <div className="card p-4"><h2 className="mb-3 font-extrabold">Cài đặt điểm</h2><label className="flex items-center gap-2 text-xs text-body"><input type="checkbox" className="h-4 w-4 accent-slate-900" checked={data.settings.capScore} onChange={(event) => void onSettings(event.target.checked)} />Giới hạn điểm hiển thị tối đa 50</label><div className="mt-2 text-[11px] leading-5 text-body">Khởi điểm là 50; tùy chọn này quyết định điểm cộng có được vượt 50 hay không.</div></div>
      <div className="card p-4"><h2 className="mb-2 font-extrabold">Sao lưu dữ liệu</h2><div className="subtle mb-3">Xuất học sinh, tổng hợp điểm, nhật ký và quy tắc ra Excel.</div><button className="btn" onClick={exportExcel}>Xuất Excel</button></div></div>
      <div className="card overflow-hidden"><div className="section-title"><h2>Preview import</h2><span className="max-w-[60%] truncate text-xs text-body">{status}</span></div>{!mapping ? <Empty title="Chưa có dữ liệu để xem trước">Chọn một file danh sách học sinh ở bên trái.</Empty> : <div className="p-4"><div className="mb-3 grid grid-cols-2 gap-2">{sheets.length > 1 && <label className="grid gap-1.5"><span className="text-[10.5px] font-bold text-body">Sheet dữ liệu</span><select className="input" value={selectedSheet} onChange={(event) => { const sheet = sheets.find((item) => item.name === event.target.value); if (sheet) applySheet(sheet, fileName); }}>{sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}{sheet.detectedClass ? ` · Lớp ${sheet.detectedClass}` : ""}</option>)}</select></label>}<label className="grid gap-1.5"><span className="text-[10.5px] font-bold text-body">Lớp mặc định</span><input className="input" value={defaultClass} onChange={(event) => setDefaultClass(event.target.value)} placeholder="Ví dụ: 9/15" /></label></div><div className="grid grid-cols-2 gap-2">{(Object.keys(importLabels) as ImportField[]).map((field) => <label className="grid gap-1.5" key={field}><span className="text-[10.5px] font-bold text-body">{importLabels[field]}</span><select className="input" value={mapping[field]} onChange={(event) => setMapping({ ...mapping, [field]: Number(event.target.value) })}><option value={-1}>— Không dùng —</option>{headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}</select></label>)}</div><div className="notice my-3">Hệ thống đã tự dò cột{(sheets.find((sheet) => sheet.name === selectedSheet)?.mergedHeaderCount ?? 0) > 0 ? ", đồng thời ghép các cột nằm dưới tiêu đề gộp Họ và tên" : ""}. Hãy kiểm tra lại mapping. {mapping.className < 0 && defaultClass ? <>Không dùng cột “Lớp cũ”; học sinh sẽ được xếp vào <strong>lớp {defaultClass}</strong>.</> : null}</div><div className="max-h-80 overflow-auto rounded-[10px] border border-line"><table className="data-table"><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, index) => <td key={index}>{String(row[index] ?? "")}</td>)}</tr>)}</tbody></table></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="tabs"><button className={`tab ${mode === "replace" ? "active" : ""}`} onClick={() => setMode("replace")}>Thay thế danh sách</button><button className={`tab ${mode === "append" ? "active" : ""}`} onClick={() => setMode("append")}>Bổ sung</button></div><button className="btn btn-primary" disabled={importing || mapping.fullName < 0} onClick={() => void importNow()}>{importing ? "Đang import..." : `Import ${rows.filter((row) => String(row[mapping.fullName] ?? "").trim()).length} học sinh`}</button></div></div>}</div>
    </div></>;
}

function StudentDetail({ student, transactions, score, onClose, onUpdated }: { student?: Student; transactions: PointTransaction[]; score: ReturnType<typeof calculateScore>; onClose: () => void; onUpdated: (message: string) => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [saving, setSaving] = useState(false);

  if (!student) return null;

  const startEdit = (item: PointTransaction) => {
    setEditingId(item.id);
    setEditTitle(item.ruleTitle);
    setEditPoints(String(item.points));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditPoints("");
  };

  const saveEdit = async (id: string) => {
    const pts = parseFloat(editPoints);
    if (!editTitle.trim() || isNaN(pts)) {
      alert("Vui lòng nhập tên nội dung và số điểm hợp lệ.");
      return;
    }
    setSaving(true);
    try {
      await jsonRequest(`/api/point-transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ruleTitle: editTitle.trim(), points: pts })
      });
      setEditingId(null);
      await onUpdated("Đã cập nhật điểm thành công.");
    } catch (e: any) {
      alert(e.message || "Lỗi khi cập nhật điểm.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async (item: PointTransaction) => {
    if (!confirm(`Bạn có chắc muốn xóa/hủy lượt điểm này của ${student.fullName}?\n\nNội dung: ${item.ruleTitle} (${item.points > 0 ? "+" : ""}${item.points}đ)`)) {
      return;
    }
    setSaving(true);
    try {
      await jsonRequest(`/api/point-transactions/${item.id}`, { method: "DELETE" });
      await onUpdated("Đã xóa lượt ghi điểm thành công.");
    } catch (e: any) {
      alert(e.message || "Lỗi khi xóa lượt ghi điểm.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-shell"><div className="flex min-h-[70px] items-center justify-between gap-3 border-b border-line px-4"><div className="flex items-center gap-3"><span className="h-6 w-1 rounded-full bg-gradient-to-b from-red-400 to-red-600" /><div><strong className="text-[15px] font-extrabold uppercase tracking-[.04em]">{student.fullName}</strong><div className="text-[11px] text-body">{student.className} · {classifyScore(score.score)}</div></div></div><button className="btn h-9 w-9 px-0 text-lg" aria-label="Đóng" onClick={onClose}>×</button></div><div className="overflow-auto p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Điểm hiện tại", fmt(score.score)], ["Tổng cộng", `+${fmt(score.credit)}`], ["Tổng trừ", `−${fmt(score.debit)}`], ["Xếp loại", classifyScore(score.score)]].map(([label, value]) => <div className="card min-h-24 p-3" key={label}><div className="mb-5 text-[11px] text-body">{label}</div><div className="text-lg font-extrabold">{value}</div></div>)}</div><div className="mt-4 flex items-center justify-between border-b border-line py-3"><h2 className="font-extrabold">Nhật ký cá nhân</h2><span className="text-xs text-body">{transactions.length} giao dịch</span></div><div>{transactions.map((item) => (
    <div className={`border-b border-line px-1 py-3 transition ${item.status !== "ACTIVE" ? "opacity-45 bg-slate-50/50" : ""}`} key={item.id}>
      {editingId === item.id ? (
        <div className="grid gap-2 p-2 bg-slate-50 rounded-lg border border-line">
          <div className="text-xs font-bold text-ink">Chỉnh sửa nội dung & điểm:</div>
          <div className="flex gap-2">
            <input className="input flex-1 text-xs" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Tên nội dung vi phạm / việc tốt..." disabled={saving} />
            <input type="number" step="0.5" className="input w-24 text-xs text-center font-bold" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} placeholder="Điểm" disabled={saving} />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button className="btn btn-mini" onClick={cancelEdit} disabled={saving}>Hủy</button>
            <button className="btn btn-mini btn-primary" onClick={() => saveEdit(item.id)} disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[86px_1fr_auto_auto] items-center gap-3">
          <div className="text-xs text-body">{fmtDate(item.activityDate)}</div>
          <div>
            <div className="text-xs font-bold">{item.ruleTitle}</div>
            <div className="mt-1 text-[11px] text-body">
              {item.category}{item.note ? ` · ${item.note}` : ""}{item.status !== "ACTIVE" ? " · Đã hoàn tác" : ""}
            </div>
          </div>
          <div className={`text-right font-extrabold ${item.points > 0 ? "text-success" : "text-red-600"}`}>
            {item.points > 0 ? "+" : ""}{fmt(item.points)}
          </div>
          {item.status === "ACTIVE" ? (
            <div className="flex items-center gap-1.5 ml-2">
              <button className="btn btn-mini !px-2 text-[11px]" title="Sửa điểm/nội dung" onClick={() => startEdit(item)} disabled={saving}>✏️ Sửa</button>
              <button className="btn btn-mini btn-danger !px-2 text-[11px]" title="Xóa bỏ lượt điểm này" onClick={() => deleteTransaction(item)} disabled={saving}>🗑️ Xóa</button>
            </div>
          ) : <div className="w-[100px]" />}
        </div>
      )}
    </div>
  ))}{!transactions.length && <Empty title="Chưa có giao dịch">Nhật ký của học sinh sẽ xuất hiện ở đây.</Empty>}</div></div></div></div>;
}
