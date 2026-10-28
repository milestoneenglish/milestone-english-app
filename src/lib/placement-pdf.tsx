import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LEVEL_INFO, SECTION_LABEL, SECTIONS } from "@/lib/placement/levels";
import type { AttemptRow } from "@/lib/placement/server";
import { LOGO_PNG } from "@/lib/report-logo";

// PDF hasil placement test untuk siswa/wali. Dibuat saat diunduh dari data yang sudah terbit.

const NAVY = "#0b1426";
const ORANGE = "#f58220";
const ORANGE_SOFT = "#fdebd9";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  logo: { width: 132, height: 33 },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY },
  docMeta: { fontSize: 8, color: MUTED, marginTop: 2 },
  band: { backgroundColor: NAVY, borderRadius: 8, padding: 16, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bandName: { fontFamily: "Helvetica-Bold", fontSize: 18, color: "#ffffff", lineHeight: 1.2 },
  bandSub: { fontSize: 9, color: "#94a3b8", marginTop: 3 },
  overall: { backgroundColor: ORANGE, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center" },
  overallLabel: { fontSize: 7, color: NAVY, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  overallValue: { fontFamily: "Helvetica-Bold", fontSize: 22, color: NAVY, lineHeight: 1.2 },
  meaning: { borderLeftWidth: 3, borderLeftColor: ORANGE, backgroundColor: ORANGE_SOFT, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 16 },
  meaningTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: NAVY },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY, marginBottom: 6, marginTop: 4 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 6, marginBottom: 16 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, alignItems: "center" },
  trLast: { borderBottomWidth: 0 },
  th: { backgroundColor: "#172b4d", color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8 },
  cell: { paddingVertical: 6, paddingHorizontal: 8 },
  cSkill: { flex: 1.4 },
  cScore: { flex: 1.2 },
  cLevel: { flex: 0.8, fontFamily: "Helvetica-Bold", color: NAVY },
  cMeaning: { flex: 3.4, color: MUTED, fontSize: 8.5 },
  noteBox: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10, marginBottom: 10 },
  noteTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: NAVY, marginBottom: 3 },
  rec: { flexDirection: "row", marginBottom: 6 },
  recBullet: { width: 14, fontFamily: "Helvetica-Bold", color: ORANGE },
  recName: { fontFamily: "Helvetica-Bold", color: NAVY },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: MUTED },
});

const DATE = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const date = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "-");

export type PlacementPdfData = {
  student: string;
  attempt: Pick<AttemptRow, "id" | "levels" | "auto_scores" | "review_comment" | "lead_note" | "submitted_at" | "published_at" | "retest_of">;
  programs: { name: string; category: string; duration_label: string }[];
};

function PlacementPdf({ data }: { data: PlacementPdfData }) {
  const { attempt: a } = data;
  const overall = a.levels.overall ?? null;
  const info = overall ? LEVEL_INFO[overall] : null;
  const number = `PLC-${a.id.slice(0, 8).toUpperCase()}`;
  return (
    <Document title={`Hasil Placement Test - ${data.student}`} author="Milestone English" subject="Hasil placement test">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image milik react-pdf, bukan <img> HTML */}
          <Image src={LOGO_PNG} style={s.logo} />
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Hasil Placement Test</Text>
            <Text style={s.docMeta}>
              {number} · terbit {date(a.published_at)}
            </Text>
          </View>
        </View>

        <View style={s.band}>
          <View>
            <Text style={s.bandName}>{data.student}</Text>
            <Text style={s.bandSub}>
              {a.retest_of ? "Tes ulang" : "Tes awal"} · dikerjakan {date(a.submitted_at)} · 5 keterampilan
            </Text>
          </View>
          <View style={s.overall}>
            <Text style={s.overallLabel}>Level keseluruhan</Text>
            <Text style={s.overallValue}>{overall ?? "-"}</Text>
          </View>
        </View>

        {info && (
          <View style={s.meaning}>
            <Text style={s.meaningTitle}>
              {overall} · {info.name}
            </Text>
            <Text>{info.text}</Text>
          </View>
        )}

        <Text style={s.h2}>Hasil per keterampilan</Text>
        <View style={s.table}>
          <View style={[s.tr, s.th]}>
            <Text style={[s.cell, s.cSkill]}>Keterampilan</Text>
            <Text style={[s.cell, s.cScore]}>Skor</Text>
            <Text style={[s.cell, s.cLevel, { color: "#ffffff" }]}>Level</Text>
            <Text style={[s.cell, s.cMeaning, { color: "#ffffff" }]}>Artinya</Text>
          </View>
          {SECTIONS.map((sec, i) => {
            const level = a.levels[sec];
            const score = a.auto_scores[sec];
            return (
              <View key={sec} style={[s.tr, i === SECTIONS.length - 1 ? s.trLast : {}]} wrap={false}>
                <Text style={[s.cell, s.cSkill]}>{SECTION_LABEL[sec]}</Text>
                <Text style={[s.cell, s.cScore]}>{score ? `${score.correct}/${score.total} benar` : "Dinilai tutor"}</Text>
                <Text style={[s.cell, s.cLevel]}>{level ?? "-"}</Text>
                <Text style={[s.cell, s.cMeaning]}>{level && LEVEL_INFO[level] ? LEVEL_INFO[level].name : "-"}</Text>
              </View>
            );
          })}
        </View>

        {a.review_comment && (
          <View style={s.noteBox} wrap={false}>
            <Text style={s.noteTitle}>Catatan tutor</Text>
            <Text>{a.review_comment}</Text>
          </View>
        )}
        {a.lead_note && (
          <View style={s.noteBox} wrap={false}>
            <Text style={s.noteTitle}>Catatan Academic Lead</Text>
            <Text>{a.lead_note}</Text>
          </View>
        )}

        {data.programs.length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>Program yang direkomendasikan</Text>
            {data.programs.map((p) => (
              <View key={p.name} style={s.rec}>
                <Text style={s.recBullet}>›</Text>
                <Text>
                  <Text style={s.recName}>{p.name}</Text> · {p.category} · {p.duration_label}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer} fixed>
          Grammar, reading, dan listening dinilai otomatis; writing dan speaking dinilai tutor dengan rubrik, lalu ditinjau Academic Lead. Level mengikuti skala CEFR.
        </Text>
      </Page>
    </Document>
  );
}

export function renderPlacementPdf(data: PlacementPdfData): Promise<Buffer> {
  return renderToBuffer(<PlacementPdf data={data} />);
}
