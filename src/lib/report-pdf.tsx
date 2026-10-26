import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  ASSESSMENT_SHORT,
  attendanceRate,
  averageScore,
  overallReportLevel,
  SCORE_LABEL,
  SKILL_LABEL,
  SKILLS,
  type AssessmentKind,
  type ReportDocument,
} from "@/lib/academic";
import { LOGO_PNG } from "@/lib/report-logo";

// PDF laporan hasil belajar. Dibuat sekali saat Academic Lead menerbitkan laporan, lalu disimpan.
// Tampilan diatur di satu tempat ini; data datang dari ringkasan yang dibekukan saat terbit.

const NAVY = "#0b1426";
const NAVY_SOFT = "#172b4d";
const ORANGE = "#f58220";
const ORANGE_SOFT = "#fdebd9";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const KIND_COLOR: Record<AssessmentKind, string> = { baseline: "#9ca3af", mid: "#f8b878", final: ORANGE };

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  logo: { width: 132, height: 33 },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY },
  docMeta: { fontSize: 8, color: MUTED, marginTop: 2 },
  band: { backgroundColor: NAVY, borderRadius: 8, padding: 16, marginBottom: 14 },
  bandName: { fontFamily: "Helvetica-Bold", fontSize: 18, color: "#ffffff", lineHeight: 1.2, marginBottom: 3 },
  bandProgram: { fontFamily: "Helvetica-Bold", fontSize: 11, color: ORANGE, marginTop: 2 },
  bandGrid: { flexDirection: "row", marginTop: 10 },
  bandCell: { flex: 1 },
  bandLabel: { fontSize: 7.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 },
  bandValue: { fontSize: 9.5, color: "#ffffff", marginTop: 1 },
  outcome: { borderLeftWidth: 3, borderLeftColor: ORANGE, backgroundColor: ORANGE_SOFT, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 14 },
  outcomeLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 },
  stats: { flexDirection: "row", marginBottom: 16 },
  stat: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 9, marginRight: 8 },
  statLast: { marginRight: 0 },
  statValue: { fontFamily: "Helvetica-Bold", fontSize: 15, color: NAVY, lineHeight: 1.2 },
  statLabel: { fontSize: 7.5, color: MUTED, marginTop: 4, lineHeight: 1.3 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY, marginBottom: 6, marginTop: 4 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 6, marginBottom: 14 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, alignItems: "center" },
  trLast: { borderBottomWidth: 0 },
  th: { backgroundColor: NAVY_SOFT, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8 },
  cell: { paddingVertical: 5, paddingHorizontal: 6 },
  cIndicator: { flex: 3.2 },
  cSkill: { flex: 1.3 },
  cScore: { flex: 0.9, textAlign: "center" },
  cDelta: { flex: 1, textAlign: "center" },
  up: { color: "#047857", fontFamily: "Helvetica-Bold" },
  down: { color: "#b91c1c", fontFamily: "Helvetica-Bold" },
  chartRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  chartLabel: { width: 150, fontSize: 8, color: INK, paddingRight: 6 },
  chartBars: { flex: 1 },
  barTrack: { height: 5, backgroundColor: "#f3f4f6", borderRadius: 2, marginVertical: 1 },
  bar: { height: 5, borderRadius: 2 },
  legend: { flexDirection: "row", marginTop: 4, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 14 },
  legendDot: { width: 8, height: 8, borderRadius: 2, marginRight: 4 },
  legendText: { fontSize: 7.5, color: MUTED },
  levels: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
  level: { borderWidth: 1, borderColor: ORANGE, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginRight: 8, marginBottom: 6, alignItems: "center", minWidth: 74 },
  levelOverall: { backgroundColor: ORANGE, borderColor: ORANGE },
  levelSkill: { fontSize: 7.5, color: MUTED },
  levelValue: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY },
  noteBox: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10, marginBottom: 10 },
  noteTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: NAVY, marginBottom: 3 },
  rec: { flexDirection: "row", marginBottom: 6 },
  recBullet: { width: 14, fontFamily: "Helvetica-Bold", color: ORANGE },
  recName: { fontFamily: "Helvetica-Bold", color: NAVY },
  scale: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  scaleItem: { fontSize: 7.5, color: MUTED, marginRight: 12 },
  sign: { marginTop: 16, flexDirection: "row" },
  signCell: { flex: 1, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6, marginRight: 16 },
  signRole: { fontSize: 7.5, color: MUTED },
  signName: { fontFamily: "Helvetica-Bold", color: NAVY },
  footerLeft: { position: "absolute", bottom: 24, left: 40, fontSize: 7.5, color: MUTED },
});

const DATE = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const date = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "-");
const fmt = (n: number | null) => (n === null ? "-" : n.toFixed(1).replace(".", ","));

function Delta({ from, to }: { from?: number | null; to?: number | null }) {
  if (from == null || to == null) return <Text style={[s.cell, s.cDelta]}>-</Text>;
  const d = to - from;
  return <Text style={[s.cell, s.cDelta, d > 0 ? s.up : d < 0 ? s.down : {}]}>{d > 0 ? `+${d}` : String(d)}</Text>;
}

function ReportPdf({ doc }: { doc: ReportDocument }) {
  const { summary: sum } = doc;
  const kinds = sum.kinds;
  const first = kinds[0];
  const last = kinds[kinds.length - 1];
  const avgFirst = first ? averageScore(sum.indicators, first) : null;
  const avgLast = last ? averageScore(sum.indicators, last) : null;
  const rate = attendanceRate(sum.attendance);
  const overall = overallReportLevel(doc.levels);
  const skills = SKILLS.filter((k) => doc.levels[k]);
  const number = `LAP-${doc.reportId.slice(0, 8).toUpperCase()}`;

  return (
    <Document title={`Laporan ${sum.program} - ${sum.student}`} author="Milestone English" subject="Laporan hasil belajar">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image milik react-pdf, bukan <img> HTML */}
          <Image src={LOGO_PNG} style={s.logo} />
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Laporan Hasil Belajar</Text>
            <Text style={s.docMeta}>
              {number} · terbit {date(doc.publishedAt)}
            </Text>
          </View>
        </View>

        <View style={s.band}>
          <Text style={s.bandName}>{sum.student}</Text>
          <Text style={s.bandProgram}>{sum.program}</Text>
          <View style={s.bandGrid}>
            <View style={s.bandCell}>
              <Text style={s.bandLabel}>Batch</Text>
              <Text style={s.bandValue}>{sum.batch}</Text>
            </View>
            <View style={s.bandCell}>
              <Text style={s.bandLabel}>Tutor</Text>
              <Text style={s.bandValue}>{sum.tutor}</Text>
            </View>
            <View style={[s.bandCell, { flex: 1.6 }]}>
              <Text style={s.bandLabel}>Periode</Text>
              <Text style={s.bandValue}>
                {date(sum.period.start)} – {date(sum.period.end)}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.outcome}>
          <Text style={s.outcomeLabel}>Target program</Text>
          <Text>{sum.outcome}</Text>
        </View>

        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statValue}>{rate === null ? "-" : `${rate}%`}</Text>
            <Text style={s.statLabel}>
              Kehadiran ({sum.attendance.present + sum.attendance.late} dari {sum.attendance.sessions} sesi)
            </Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>
              {sum.tasks.done}/{sum.tasks.total}
            </Text>
            <Text style={s.statLabel}>Tugas selesai</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>
              {fmt(avgFirst)} » {fmt(avgLast)}
            </Text>
            <Text style={s.statLabel}>Rata-rata skor awal ke akhir (skala 1–4)</Text>
          </View>
          <View style={[s.stat, s.statLast]}>
            <Text style={[s.statValue, { color: ORANGE }]}>{overall ?? "-"}</Text>
            <Text style={s.statLabel}>Level akhir keseluruhan</Text>
          </View>
        </View>

        <Text style={s.h2}>Nilai per indikator</Text>
        <View style={s.table}>
          <View style={[s.tr, s.th]}>
            <Text style={[s.cell, s.cIndicator]}>Indikator</Text>
            <Text style={[s.cell, s.cSkill]}>Keterampilan</Text>
            {kinds.map((k) => (
              <Text key={k} style={[s.cell, s.cScore]}>
                {ASSESSMENT_SHORT[k]}
              </Text>
            ))}
            <Text style={[s.cell, s.cDelta]}>Perubahan</Text>
          </View>
          {sum.indicators.map((ind, idx) => (
            <View key={ind.id} style={[s.tr, idx === sum.indicators.length - 1 ? s.trLast : {}]} wrap={false}>
              <Text style={[s.cell, s.cIndicator]}>{ind.label}</Text>
              <Text style={[s.cell, s.cSkill, { color: MUTED }]}>{SKILL_LABEL[ind.skill]}</Text>
              {kinds.map((k) => (
                <Text key={k} style={[s.cell, s.cScore, k === last ? { fontFamily: "Helvetica-Bold" } : {}]}>
                  {ind.scores[k] ?? "-"}
                </Text>
              ))}
              <Delta from={first ? ind.scores[first] : null} to={last ? ind.scores[last] : null} />
            </View>
          ))}
        </View>

        <View wrap={false}>
          <Text style={s.h2}>Grafik perkembangan</Text>
          {sum.indicators.map((ind) => (
            <View key={ind.id} style={s.chartRow}>
              <Text style={s.chartLabel}>{ind.label}</Text>
              <View style={s.chartBars}>
                {kinds.map((k) => (
                  <View key={k} style={s.barTrack}>
                    <View style={[s.bar, { width: `${((ind.scores[k] ?? 0) / 4) * 100}%`, backgroundColor: KIND_COLOR[k] }]} />
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={s.legend}>
            {kinds.map((k) => (
              <View key={k} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: KIND_COLOR[k] }]} />
                <Text style={s.legendText}>Assessment {ASSESSMENT_SHORT[k].toLowerCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        <View wrap={false}>
          <Text style={s.h2}>Level akhir per keterampilan</Text>
          <View style={s.levels}>
            {skills.map((k) => (
              <View key={k} style={s.level}>
                <Text style={s.levelSkill}>{SKILL_LABEL[k]}</Text>
                <Text style={s.levelValue}>{doc.levels[k]}</Text>
              </View>
            ))}
            {overall && (
              <View style={[s.level, s.levelOverall]}>
                <Text style={[s.levelSkill, { color: NAVY }]}>Keseluruhan</Text>
                <Text style={s.levelValue}>{overall}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={s.h2}>Catatan tutor</Text>
        <View style={s.noteBox} wrap={false}>
          <Text style={s.noteTitle}>Kekuatan</Text>
          <Text>{doc.strengths}</Text>
        </View>
        <View style={s.noteBox} wrap={false}>
          <Text style={s.noteTitle}>Yang perlu ditingkatkan</Text>
          <Text>{doc.improvements}</Text>
        </View>

        <View wrap={false}>
          <Text style={s.h2}>Rekomendasi program berikutnya</Text>
          {doc.recommendations.map((r, i) => (
            <View key={r.name} style={s.rec}>
              <Text style={s.recBullet}>{i + 1}.</Text>
              <Text style={{ flex: 1 }}>
                <Text style={s.recName}>{r.name}</Text>
                {r.reason ? ` · ${r.reason}` : ""}
              </Text>
            </View>
          ))}
          <Text style={{ color: MUTED, fontSize: 8, marginTop: 2 }}>Daftar langsung dari portal tanpa placement ulang; level di atas dipakai sebagai acuan kelas berikutnya.</Text>
        </View>

        <View style={s.scale} wrap={false}>
          <Text style={[s.scaleItem, { fontFamily: "Helvetica-Bold" }]}>Skala skor:</Text>
          {[1, 2, 3, 4].map((n) => (
            <Text key={n} style={s.scaleItem}>
              {n} = {SCORE_LABEL[n]}
            </Text>
          ))}
        </View>

        <View style={s.sign} wrap={false}>
          <View style={s.signCell}>
            <Text style={s.signRole}>Disusun oleh tutor</Text>
            <Text style={s.signName}>{sum.tutor}</Text>
          </View>
          <View style={[s.signCell, { marginRight: 0 }]}>
            <Text style={s.signRole}>Ditinjau dan diterbitkan oleh Academic Lead</Text>
            <Text style={s.signName}>{doc.reviewer}</Text>
          </View>
        </View>

        <Text style={s.footerLeft} fixed>
          Milestone English · {number} · {sum.student} · {sum.program}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(doc: ReportDocument): Promise<Buffer> {
  return renderToBuffer(<ReportPdf doc={doc} />);
}
