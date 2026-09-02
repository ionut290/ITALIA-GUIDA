"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, TrainFront } from "lucide-react";
import styles from "./indoor-guide-launcher.module.css";

export function IndoorGuideLauncher() {
  const pathname = usePathname();
  if (pathname.startsWith("/guida-interna")) return null;
  return (
    <Link className={styles.launcher} href="/guida-interna" aria-label="Apri la guida interna per aeroporti e stazioni">
      <span className={styles.icons}><Plane size={16} /><TrainFront size={16} /></span>
      <span className={styles.copy}><strong>Guida interna</strong><small>Aeroporti e stazioni</small></span>
    </Link>
  );
}
