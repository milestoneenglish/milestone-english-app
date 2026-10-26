import Link from "next/link";
import { Icon, WhatsappIcon } from "@/components/icons";
import { Navbar } from "@/components/landing/navbar";
import { ProgramCatalog } from "@/components/landing/program-catalog";
import { Logo } from "@/components/logo";
import { getLandingContent, whatsappLink } from "@/lib/content";

export const revalidate = 300;

function SectionHeading({ kicker, start, accent, desc, center = false }: { kicker: string; start: string; accent: string; desc?: string; center?: boolean }) {
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-3xl`}>
      <div className="inline-flex items-center gap-2 border-b border-orange/60 pb-1 text-xs font-extrabold uppercase tracking-[0.28em] text-orange">
        <Icon name="book" className="h-5 w-5" />
        {kicker}
      </div>
      <h2 className="mt-4 text-3xl font-extrabold leading-tight text-orange sm:text-4xl lg:text-5xl">
        {start} <span className="text-orange">{accent}</span>
      </h2>
      {desc && <p className="lp-muted mt-4 text-sm leading-relaxed sm:text-base">{desc}</p>}
    </div>
  );
}

const BENEFITS = [
  { icon: "target", no: "01", title: "Outcome-Based", text: "Target belajar jelas sejak placement, diukur dengan rubrik dan bukti progres." },
  { icon: "users", no: "02", title: "Small Batch", text: "Kelas 4–6 peserta agar waktu berbicara, koreksi, dan perhatian tutor tetap personal." },
  { icon: "chart", no: "03", title: "Progress Report", text: "Baseline, tugas akhir, dan review tutor tersimpan sebagai laporan perkembangan." },
  { icon: "mic", no: "04", title: "Real Practice", text: "Simulasi percakapan, presentasi, interview, layanan, atau tugas akademik." },
] as const;

const WHY = [
  { icon: "users", title: "Expert Tutors", text: "Feedback spesifik untuk speaking, writing, dan interview." },
  { icon: "book", title: "Course Material", text: "Silabus jelas dan tugas akhir sesuai kebutuhan program." },
  { icon: "mic", title: "Real Simulation", text: "Role-play, interview, presentasi, dan latihan diskusi." },
  { icon: "chart", title: "Clear Report", text: "Data progres bisa dibaca tanpa menebak-nebak." },
] as const;

// Angka faktual dari spesifikasi, bukan klaim pemasaran.
const STATS = [
  { icon: "book", value: "12", label: "Program pilihan" },
  { icon: "users", value: "4–6", label: "Peserta per batch" },
  { icon: "chart", value: "5", label: "Keterampilan diukur" },
  { icon: "target", value: "1×24 jam", label: "Hasil placement lengkap" },
] as const;

export default async function LandingPage() {
  const { programs, faqs, testimonials, contact, hero, preview } = await getLandingContent();
  const wa = contact.whatsapp ? whatsappLink(contact.whatsapp) : null;

  return (
    <div className="min-h-screen bg-navy text-offwhite">
      <Navbar showTestimonials={testimonials.length > 0} />

      {/* Hero */}
      <header id="hero" className="lp-section lp-hero-media relative -mt-20 overflow-hidden pb-36 pt-32 lg:pb-44 lg:pt-36">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="lp-chip mb-6 inline-flex items-center gap-2 px-4 py-2 text-[11px] font-extrabold uppercase">
              <span className="h-2 w-2 rounded-full bg-orange" />
              {hero.badge}
            </div>
            <h1 className="text-4xl font-black leading-[1.05] text-orange sm:text-6xl lg:text-7xl">
              {hero.title_start} {hero.title_accent} {hero.title_end}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-amber-100/90 sm:text-lg">{hero.subtitle}</p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a href="#programs" className="btn-orange flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm">
                Lihat {programs.length} Program <Icon name="arrow" className="h-4 w-4" />
              </a>
              <Link href="/placement" className="btn-orange flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm">
                <Icon name="test" className="h-4 w-4" /> Placement Test Gratis
              </Link>
              <Link href="/daftar" className="btn-orange flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm">
                Daftar Akun Baru <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-amber-200/80">
              Sudah memiliki akun?{" "}
              <Link href="/masuk" className="font-bold text-orange underline hover:text-orange-light">
                Masuk ke portal
              </Link>
            </p>
          </div>
        </div>
      </header>

      {/* Keunggulan singkat */}
      <section className="relative z-10 -mt-24 pb-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {BENEFITS.map((b) => (
            <article key={b.no} className="lp-pill-card min-h-[210px] p-6 lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange text-navy shadow-lg shadow-orange/20">
                  <Icon name={b.icon} />
                </div>
                <span className="text-4xl font-black tracking-wider text-orange/70">{b.no}</span>
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-orange">{b.title}</h3>
              <p className="lp-muted mt-3 text-sm leading-relaxed">{b.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Metode */}
      <section id="methodology" className="lp-section bg-navy py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <div className="lp-photo lp-about-photo flex items-end overflow-hidden rounded-[36px] p-8">
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-orange">Milestone Method</p>
                <h3 className="mt-3 text-3xl font-black leading-tight text-orange">Belajar dengan jalur yang jelas.</h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/90">Satu alur dari placement, latihan, feedback, sampai bukti progres.</p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <SectionHeading
              kicker="About Us"
              start="Our English System"
              accent="Helps You Improve"
              desc="Milestone tidak menjual kelas yang abstrak. Setiap program punya target outcome, bukti tugas akhir, dan jalur belajar yang bisa dipantau dari awal sampai akhir."
            />
            <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {["Daftar & placement", "Pilih kelas & bayar", "Onboarding", "Belajar tiap minggu", "Assessment akhir", "Laporan & lanjut"].map((step, i) => (
                <li key={step} className="lp-card-soft flex items-center gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange text-sm font-black text-navy">{i + 1}</span>
                  <span className="text-sm font-bold text-white">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href="/daftar" className="btn-orange rounded-full px-7 py-4 text-center text-sm">
                Daftar Akun Sekarang
              </Link>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-orange/40 bg-navy px-7 py-4 text-sm font-bold text-orange hover:bg-orange/10">
                  <WhatsappIcon className="h-5 w-5" /> Chat Konsultasi WA
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Angka kunci */}
      <section className="lp-stats-band border-y border-orange/20 py-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="lp-stat-icon mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                <Icon name={s.icon} />
              </div>
              <p className="lp-stat-glow mt-3 text-3xl font-black sm:text-4xl">{s.value}</p>
              <p className="lp-stat-glow mt-1 text-xs font-black sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Program */}
      <section id="programs" className="lp-section bg-navy py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            kicker="Our Courses"
            start="Pilihan Lengkap"
            accent={`${programs.length} Program`}
            desc="Setiap program memiliki durasi, level masuk, kapasitas 4–6 peserta, dan target outcome yang terukur."
          />
          <ProgramCatalog programs={programs} />
        </div>
      </section>

      {/* Kenapa kami */}
      <section id="why-us" className="lp-section relative overflow-hidden bg-navy-dark py-20 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,130,32,0.28),transparent_34%)] opacity-20" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-7">
            <SectionHeading
              kicker="Why Choose Us"
              start="We Are Built For"
              accent="Your Goal"
              desc="Struktur belajar dibuat terarah, terukur, dan nyaman dipakai dari kelas pertama sampai evaluasi akhir."
            />
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {WHY.map((w) => (
                <div key={w.title} className="lp-pill-card flex gap-4 p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange text-navy">
                    <Icon name={w.icon} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-orange">{w.title}</h3>
                    <p className="lp-muted mt-1 text-sm">{w.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="lp-photo lp-why-photo flex flex-col justify-between overflow-hidden rounded-[42px] p-8">
              <div className="relative z-10 flex justify-end">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-orange text-navy shadow-2xl shadow-orange/30">
                  <Icon name="target" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-orange">Milestone Flow</p>
                <h3 className="mt-4 text-4xl font-black leading-tight text-orange">Clear path, clear progress.</h3>
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  {["Placement", "Practice", "Feedback", "Report"].map((c) => (
                    <span key={c} className="lp-chip px-3 py-2 text-center font-bold">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimoni: tampil hanya jika sudah ada testimoni peserta yang diterbitkan */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="lp-section lp-testimonial-band py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <SectionHeading kicker="Testimonials" start="Cerita Dari" accent="Peserta Kami" center />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {testimonials.map((t) => (
                <article key={t.name + t.quote} className="lp-card border-b-4 border-orange p-6">
                  <p className="lp-muted text-sm italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-6 border-t border-orange/20 pt-4">
                    <p className="font-extrabold text-white">{t.name}</p>
                    <p className="mt-1 text-xs font-bold text-orange">{t.program_label}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section id="faq" className="lp-section bg-navy py-20 lg:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-9">
              <SectionHeading kicker="FAQ" start="Pertanyaan" accent="Populer" desc="Jawaban ringkas sebelum kamu mendaftar atau mencoba placement test." center />
            </div>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details key={f.question} className="lp-card group overflow-hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-bold text-orange transition hover:text-white">
                    <span>{f.question}</span>
                    <span className="shrink-0 text-xl font-black text-orange transition group-open:rotate-45">+</span>
                  </summary>
                  <div className="border-t border-orange/20 px-5 pb-5 pt-4 text-sm leading-relaxed text-amber-100/90">{f.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-orange/25 bg-navy-dark pb-8 pt-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo className="h-10 w-auto" plate />
              <p className="lp-muted mt-5 max-w-md text-sm leading-relaxed">
                Milestone English membantu peserta memilih program yang tepat, belajar dalam batch kecil 4–6 peserta, dan melihat progres dengan rubrik yang jelas.
              </p>
              {contact.address && <p className="mt-2 text-xs text-amber-200/70">{contact.address}</p>}
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-orange">
                  <WhatsappIcon className="h-5 w-5" /> {contact.whatsapp}
                </a>
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-orange">Navigasi</h3>
              <div className="lp-muted mt-4 space-y-3 text-sm">
                <a href="#programs" className="block hover:text-orange">
                  Program
                </a>
                <a href="#methodology" className="block hover:text-orange">
                  Metode
                </a>
                <a href="#faq" className="block hover:text-orange">
                  FAQ
                </a>
                <Link href="/daftar" className="block font-bold text-orange hover:text-orange-light">
                  Daftar akun baru
                </Link>
                <Link href="/masuk" className="block font-bold text-orange hover:text-orange-light">
                  Masuk ke portal
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-extrabold text-orange">Mulai dari sini</h3>
              <p className="lp-muted mt-4 text-sm">Belum tahu level kemampuanmu? Coba placement test gratis.</p>
              {contact.email && <p className="mt-3 text-xs font-bold text-orange">Email: {contact.email}</p>}
              <Link href="/placement" className="btn-orange mt-4 inline-block rounded-xl px-5 py-2.5 text-xs">
                Mulai Placement Test
              </Link>
            </div>
          </div>
          <div className="mt-10 border-t border-orange/20 pt-6">
            <p className="text-xs text-amber-200/70">© {new Date().getFullYear()} Milestone English. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat WhatsApp Milestone English"
          className="btn-orange fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-105"
        >
          <WhatsappIcon />
        </a>
      )}

      {preview && (
        <div className="fixed bottom-4 left-4 z-50 max-w-xs rounded-xl border border-orange/50 bg-navy-dark/95 px-4 py-3 text-xs text-amber-100 shadow-2xl">
          <span className="font-black text-orange">Mode pratinjau.</span> Belum tersambung ke Supabase; katalog memakai data awal.
        </div>
      )}
    </div>
  );
}
