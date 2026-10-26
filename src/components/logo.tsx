import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "h-9 w-auto", plate = false }: { className?: string; plate?: boolean }) {
  const img = <Image src="/logo.png" alt="Milestone English" width={440} height={109} priority className={className} />;
  return (
    <Link href="/" aria-label="Milestone English, kembali ke beranda" className="inline-flex items-center">
      {plate ? <span className="rounded-xl bg-white/95 px-3 py-2 shadow-lg ring-1 ring-orange/30">{img}</span> : img}
    </Link>
  );
}
