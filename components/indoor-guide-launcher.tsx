"use client";

import Link from "next/link";
import { Plane, TrainFront } from "lucide-react";

export function IndoorGuideLauncher() {
  return (
    <Link className="indoor-guide-launcher" href="/guida-interna" aria-label="Apri la guida interna per aeroporti e stazioni">
      <span className="indoor-guide-launcher-icons"><Plane size={17} /><TrainFront size={17} /></span>
      <span><strong>Guida interna</strong><small>Aeroporti e stazioni</small></span>
    </Link>
  );
}
