"use client";

/**
 * Cetak HANYA satu bagian halaman. Beberapa kartu punya aturan @media print sendiri; tanpa
 * pelingkup, aturan "sembunyikan semua kecuali aku" dari kartu lain ikut aktif dan kartu-kartu
 * itu tercetak bertumpuk. Pola: set `<body data-print="nama">` selama dialog cetak, dan aturan
 * CSS tiap kartu dilingkup ke `body[data-print="nama"]` (lihat printOnlyCss).
 */
export function printOnly(name: string): void {
  document.body.dataset.print = name;
  const clear = () => { delete document.body.dataset.print; window.removeEventListener("afterprint", clear); };
  window.addEventListener("afterprint", clear);
  window.print();
}

/** CSS cetak terlingkup untuk elemen ber-class `cls` yang dicetak via printOnly(name). */
export const printOnlyCss = (name: string, cls: string, extra = ""): string =>
  `@media print{body[data-print=${name}] *{visibility:hidden}` +
  `body[data-print=${name}] .${cls},body[data-print=${name}] .${cls} *{visibility:visible}` +
  `body[data-print=${name}] .${cls}{position:absolute;left:0;top:0;width:100%;border:none${extra}}` +
  `.ah-noprint{display:none!important}}`;
