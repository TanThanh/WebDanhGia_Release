"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Student, PointTransaction, StudentStat, RuleStat, buildWeeklyReport, getSchoolYearStartDate, getWeekIndex, getWeekRange } from "@/lib/report-utils";

type ReportSection = "OVERVIEW" | "PLUS" | "MINUS";

type ReportViewProps = {
  students: Student[];
  transactions: PointTransaction[];
  initialWeek?: number;
  classFilter: string;
  onStudent: (id: string) => void;
};

const fmt = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const fmtDate = (value: Date) => value.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const reasonsText = (reasons: Map<string, number>, limit = 1) => Array.from(reasons.entries()).slice(0, limit).map(([title, count]) => `${title}${count > 1 ? ` (×${count})` : ""}`).join(", ");

function MetricCard({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint: string; tone?: "positive" | "negative" | "neutral" }) {
  return <div className={`report-metric ${tone}`}>
    <div className="report-metric-label">{label}</div>
    <div className="report-metric-value">{value}</div>
    <div className="report-metric-hint">{hint}</div>
  </div>;
}

function StudentPreview({ stat, rank, tone, eligible, onOpen }: { stat: StudentStat; rank: number; tone: "positive" | "negative"; eligible?: boolean; onOpen: () => void }) {
  const total = tone === "positive" ? stat.totalPlus : stat.totalMinus;
  const count = tone === "positive" ? stat.plusCount : stat.minusCount;
  const reason = tone === "positive" ? reasonsText(stat.plusReasons) : reasonsText(stat.minusReasons);
  return <button className="report-rank-row" onClick={onOpen} aria-label={`Xem chi tiết ${stat.student.fullName}`}>
    <span className={`report-rank-number ${rank <= 3 ? "top" : ""}`}>{rank}</span>
    <span className="min-w-0 text-left">
      <span className="block truncate text-xs font-extrabold text-ink">{stat.student.fullName}</span>
      <span className="mt-0.5 block truncate text-[10.5px] text-body">{stat.student.className} · {reason}</span>
    </span>
    <span className="text-right">
      <span className={`block text-sm font-extrabold ${tone === "positive" ? "text-success" : "text-red-600"}`}>{tone === "positive" ? "+" : "−"}{fmt(total)}</span>
      <span className="block text-[10px] text-muted">{count} lượt{eligible ? " · đề xuất" : ""}</span>
    </span>
  </button>;
}

function RulePreview({ item, tone }: { item: RuleStat; tone: "positive" | "negative" }) {
  return <div className="report-rule-row">
    <div className="min-w-0">
      <div className="truncate text-xs font-bold text-ink" title={item.ruleTitle}>{item.ruleTitle}</div>
      <div className="mt-0.5 text-[10px] text-body">{item.category} · {item.students.size} học sinh</div>
    </div>
    <div className="text-right">
      <div className={`font-extrabold ${tone === "positive" ? "text-success" : "text-red-600"}`}>{tone === "positive" ? "+" : "−"}{fmt(Math.abs(item.points))}</div>
      <div className="text-[10px] text-muted">{item.count} lượt</div>
    </div>
  </div>;
}

export function ReportView({ students, transactions, initialWeek, classFilter, onStudent }: ReportViewProps) {
  const currentSchoolWeek = useMemo(() => getWeekIndex(new Date(), getSchoolYearStartDate()), []);
  const [week, setWeek] = useState(initialWeek || currentSchoolWeek);
  const [section, setSection] = useState<ReportSection>("OVERVIEW");
  const [search, setSearch] = useState("");

  const weekTabs = Array.from({ length: Math.max(currentSchoolWeek, week, 1) }, (_, i) => i + 1);

  const report = useMemo(() => buildWeeklyReport(transactions, students, week, classFilter, getSchoolYearStartDate()), [transactions, students, week, classFilter]);
  const { summary, weekRange, plusRank, minusRank, commendations, rulePlusRank, ruleMinusRank } = report;
  const commendationIds = useMemo(() => new Set(commendations.map((item) => item.student.id)), [commendations]);
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const matchesSearch = (item: StudentStat, reasons: Map<string, number>) => !normalizedSearch || `${item.student.fullName} ${item.student.className} ${Array.from(reasons.keys()).join(" ")}`.toLocaleLowerCase("vi").includes(normalizedSearch);
  const displayPlusRank = plusRank.filter((item) => matchesSearch(item, item.plusReasons));
  const displayMinusRank = minusRank.filter((item) => matchesSearch(item, item.minusReasons));

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      Tuần: week,
      Lớp: classFilter === "__all" ? "Tất cả" : classFilter,
      "Từ ngày": fmtDate(weekRange.start),
      "Đến ngày": fmtDate(weekRange.end),
      "Lượt cộng": summary.plusCount,
      "HS được cộng": summary.plusStudents,
      "Lượt trừ": summary.minusCount,
      "HS bị trừ": summary.minusStudents,
      "Tổng điểm cộng": summary.totalPlus,
      "Tổng điểm trừ": summary.totalMinus,
    }]), "Tổng quan");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(plusRank.map((item, index) => ({
      Hạng: index + 1,
      "Học sinh": item.student.fullName,
      Lớp: item.student.className,
      "Tổng điểm cộng": item.totalPlus,
      "Số việc tốt": item.plusCount,
      "Nội dung": reasonsText(item.plusReasons, Number.POSITIVE_INFINITY),
    }))), "Cộng điểm");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(minusRank.map((item, index) => ({
      Hạng: index + 1,
      "Học sinh": item.student.fullName,
      Lớp: item.student.className,
      "Tổng điểm trừ": item.totalMinus,
      "Số lỗi": item.minusCount,
      "Nội dung": reasonsText(item.minusReasons, Number.POSITIVE_INFINITY),
    }))), "Trừ điểm");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rulePlusRank.map((item) => ({
      "Nội dung": item.ruleTitle, Nhóm: item.category, "Số lượt": item.count, "Số học sinh": item.students.size, "Tổng điểm cộng": item.points,
    }))), "Việc làm tốt");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ruleMinusRank.map((item) => ({
      "Nội dung": item.ruleTitle, Nhóm: item.category, "Số lượt": item.count, "Số học sinh": item.students.size, "Tổng điểm trừ": Math.abs(item.points),
    }))), "Lỗi vi phạm");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(commendations.map((item, index) => ({
      STT: index + 1,
      "Học sinh": item.student.fullName,
      Lớp: item.student.className,
      "Tổng điểm cộng": item.totalPlus,
      "Số việc tốt": item.plusCount,
      "Lý do": reasonsText(item.plusReasons, Number.POSITIVE_INFINITY),
    }))), "Đề xuất tuyên dương");
    XLSX.writeFile(workbook, `Bao_cao_ren_luyen_${classFilter === "__all" ? "Tat_ca" : classFilter}_Tuan_${week}.xlsx`);
  };

  const sectionItems: { id: ReportSection; label: string; count?: number }[] = [
    { id: "OVERVIEW", label: "Tổng hợp" },
    { id: "PLUS", label: "Điểm cộng", count: summary.plusStudents },
    { id: "MINUS", label: "Vi phạm", count: summary.minusStudents },
  ];

  return <div className="report-page">
    <div className="page-head">
      <div>
        <div className="eyebrow">Báo cáo tuần · {classFilter === "__all" ? "Tất cả lớp" : `Lớp ${classFilter}`}</div>
        <h1 className="page-title">Tuần {week}</h1>
        <div className="subtle">{fmtDate(weekRange.start)} – {fmtDate(weekRange.end)}</div>
      </div>
      <button className="btn" onClick={exportExcel} aria-label="Xuất báo cáo tuần ra Excel"><span aria-hidden>⇩</span> Xuất Excel</button>
    </div>

    <div className="report-toolbar flex-col lg:flex-row items-stretch lg:items-center">
      <div className="tabs report-tabs flex-1 min-w-0" role="tablist" aria-label="Chọn tuần báo cáo">
        {weekTabs.map((w) => {
          const wRange = getWeekRange(w, getSchoolYearStartDate());
          return (
            <button
              key={w}
              className={`tab ${week === w ? "active" : ""}`}
              role="tab"
              aria-selected={week === w}
              onClick={() => setWeek(w)}
            >
              Tuần {w}
              <span className="ml-1.5 text-[9.5px] font-normal opacity-70">
                {fmtDate(wRange.start).slice(0, 5)} – {fmtDate(wRange.end).slice(0, 5)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="tabs report-tabs shrink-0" role="tablist" aria-label="Nội dung báo cáo">
        {sectionItems.map((item) => <button key={item.id} className={`tab ${section === item.id ? "active" : ""}`} role="tab" aria-selected={section === item.id} onClick={() => { setSection(item.id); setSearch(""); }}>{item.label}{item.count !== undefined && <span className="report-tab-count">{item.count}</span>}</button>)}
      </div>
    </div>

    <div className="report-metrics">
      <MetricCard label="Được ghi nhận" value={summary.plusStudents} hint={`${summary.plusCount} lượt việc tốt`} tone="positive" />
      <MetricCard label="Cần lưu ý" value={summary.minusStudents} hint={`${summary.minusCount} lượt vi phạm`} tone="negative" />
      <MetricCard label="Điểm cộng" value={`+${fmt(summary.totalPlus)}`} hint="Không bù trừ với vi phạm" tone="positive" />
      <MetricCard label="Điểm trừ" value={`−${fmt(summary.totalMinus)}`} hint="Tổng trị tuyệt đối" tone="negative" />
    </div>

    {section === "OVERVIEW" && <>
      <div className="report-overview-grid">
        <section className="card">
          <div className="section-title"><div><h2>Nổi bật tích cực</h2><p>Học sinh có điểm cộng cao nhất tuần</p></div><button className="btn btn-mini" onClick={() => setSection("PLUS")}>Xem tất cả</button></div>
          <div className="report-rank-list">{plusRank.slice(0, 5).map((item, index) => <StudentPreview key={item.student.id} stat={item} rank={index + 1} tone="positive" eligible={commendationIds.has(item.student.id)} onOpen={() => onStudent(item.student.id)} />)}{!plusRank.length && <div className="report-empty"><strong>Chưa có điểm cộng</strong><span>Tuần này chưa ghi nhận việc làm tốt.</span></div>}</div>
        </section>
        <section className="card">
          <div className="section-title"><div><h2>Học sinh cần lưu ý</h2><p>Xếp theo tổng điểm bị trừ</p></div><button className="btn btn-mini" onClick={() => setSection("MINUS")}>Xem tất cả</button></div>
          <div className="report-rank-list">{minusRank.slice(0, 5).map((item, index) => <StudentPreview key={item.student.id} stat={item} rank={index + 1} tone="negative" onOpen={() => onStudent(item.student.id)} />)}{!minusRank.length && <div className="report-empty"><strong>Không có vi phạm</strong><span>Chưa có học sinh bị trừ điểm trong tuần.</span></div>}</div>
        </section>
      </div>

      <section className="card">
        <div className="section-title"><div><h2>Nội dung nổi bật trong tuần</h2><p>Nhìn nhanh nguyên nhân tạo nên điểm cộng và điểm trừ</p></div></div>
        <div className="report-reason-grid">
          <div><div className="report-column-label positive"><span>Việc làm tốt</span><strong>{rulePlusRank.length} nội dung</strong></div>{rulePlusRank.slice(0, 4).map((item) => <RulePreview key={`plus-${item.ruleId}-${item.ruleTitle}`} item={item} tone="positive" />)}{!rulePlusRank.length && <div className="report-small-empty">Chưa có nội dung.</div>}</div>
          <div><div className="report-column-label negative"><span>Lỗi vi phạm</span><strong>{ruleMinusRank.length} nội dung</strong></div>{ruleMinusRank.slice(0, 4).map((item) => <RulePreview key={`minus-${item.ruleId}-${item.ruleTitle}`} item={item} tone="negative" />)}{!ruleMinusRank.length && <div className="report-small-empty">Chưa có nội dung.</div>}</div>
        </div>
      </section>
    </>}

    {section !== "OVERVIEW" && <section className="card report-detail-card">
      <div className="report-detail-head">
        <div>
          <h2>{section === "PLUS" ? "Xếp hạng điểm cộng" : "Học sinh bị trừ điểm"}</h2>
          <p>{section === "PLUS" ? `${commendations.length} học sinh đủ tiêu chí đề xuất tuyên dương` : "Ưu tiên xem học sinh có tổng điểm trừ cao nhất"}</p>
        </div>
        <input className="input report-search" type="search" placeholder="Tìm học sinh hoặc nội dung…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm trong báo cáo" />
      </div>
      <div className="table-wrap report-table-wrap">
        <table className="data-table report-table">
          <thead><tr><th className="text-center">Hạng</th><th>Học sinh</th><th>Lớp</th><th className="text-right">{section === "PLUS" ? "Điểm cộng" : "Điểm trừ"}</th><th className="text-right">Số lượt</th><th>Nội dung nổi bật</th>{section === "PLUS" && <th>Đánh giá</th>}<th><span className="sr-only">Thao tác</span></th></tr></thead>
          <tbody>{(section === "PLUS" ? displayPlusRank : displayMinusRank).map((item) => {
            const originalRank = (section === "PLUS" ? plusRank : minusRank).findIndex((entry) => entry.student.id === item.student.id) + 1;
            const isPlus = section === "PLUS";
            return <tr key={item.student.id}>
              <td className="text-center"><span className={`report-rank-number ${originalRank <= 3 ? "top" : ""}`}>{originalRank}</span></td>
              <td className="font-extrabold text-ink">{item.student.fullName}</td>
              <td className="text-body">{item.student.className}</td>
              <td className={`text-right font-extrabold ${isPlus ? "text-success" : "text-red-600"}`}>{isPlus ? "+" : "−"}{fmt(isPlus ? item.totalPlus : item.totalMinus)}</td>
              <td className="text-right">{isPlus ? item.plusCount : item.minusCount}</td>
              <td className="report-reason-cell" title={reasonsText(isPlus ? item.plusReasons : item.minusReasons, Number.POSITIVE_INFINITY)}>{reasonsText(isPlus ? item.plusReasons : item.minusReasons, 2)}</td>
              {isPlus && <td>{commendationIds.has(item.student.id) ? <span className="badge good">Đề xuất</span> : <span className="badge warn">Có điểm trừ</span>}</td>}
              <td className="text-right"><button className="btn btn-mini" onClick={() => onStudent(item.student.id)}>Chi tiết</button></td>
            </tr>;
          })}</tbody>
        </table>
        {!(section === "PLUS" ? displayPlusRank : displayMinusRank).length && <div className="report-empty"><strong>Không tìm thấy kết quả</strong><span>Thử đổi từ khóa hoặc chọn một tuần khác.</span></div>}
      </div>
      <div className="report-detail-foot">Đang hiển thị {(section === "PLUS" ? displayPlusRank : displayMinusRank).length} học sinh · Chỉ tính giao dịch đang hiệu lực</div>
    </section>}
  </div>;
}
