import { describe, it, expect } from "vitest";
import {
  immunizationPlan, summarizePlan, addMonths, IMMUNIZATION_SCHEDULE,
} from "../immunization.ts";

const DAY = 86_400_000;

describe("addMonths", () => {
  it("menambah bulan mempertahankan tanggal", () => {
    expect(addMonths(new Date("2026-01-15"), 2).toISOString().slice(0, 10)).toBe("2026-03-15");
  });
  it("clamp akhir bulan (31 Jan +1 = 28/29 Feb)", () => {
    expect(addMonths(new Date("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("immunizationPlan — status", () => {
  const dob = "2026-01-01T00:00:00.000Z";

  it("tanggal lahir invalid → kosong", () => {
    expect(immunizationPlan("bukan-tanggal")).toEqual([]);
  });

  it("bayi baru lahir: HB-0 jatuh tempo, lainnya akan datang", () => {
    const now = new Date("2026-01-01T06:00:00Z").getTime();
    const plan = immunizationPlan(dob, [], now);
    const hb0 = plan.find((e) => e.key === "hb0")!;
    expect(hb0.status).toBe("overdue"); // due saat lahir, sudah lewat beberapa jam & belum diberi
    const mr1 = plan.find((e) => e.key === "mr1")!; // usia 9 bulan
    expect(mr1.status).toBe("upcoming");
  });

  it("vaksin yang sudah diberikan → given", () => {
    const now = new Date("2026-02-01Z").getTime();
    const plan = immunizationPlan(dob, ["hb0", "bcg"], now);
    expect(plan.find((e) => e.key === "hb0")!.status).toBe("given");
    expect(plan.find((e) => e.key === "bcg")!.status).toBe("given");
  });

  it("usia 2 bulan: DPT-1 jatuh tempo/terlambat, DPT-3 (4 bln) akan datang", () => {
    const now = addMonths(new Date(dob), 2).getTime();
    const plan = immunizationPlan(dob, [], now);
    expect(plan.find((e) => e.key === "dpt1")!.status).toBe("overdue");
    expect(plan.find((e) => e.key === "dpt3")!.status).toBe("upcoming");
  });

  it("jendela 'due' beberapa hari sebelum jatuh tempo", () => {
    // 10 hari sebelum usia 9 bulan (MR-1) → due (window default 14 hari)
    const due9 = addMonths(new Date(dob), 9).getTime();
    const plan = immunizationPlan(dob, [], due9 - 10 * DAY);
    expect(plan.find((e) => e.key === "mr1")!.status).toBe("due");
  });

  it("terurut berdasarkan tanggal jatuh tempo", () => {
    const plan = immunizationPlan(dob, [], new Date(dob).getTime());
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i - 1]!.dueISO <= plan[i]!.dueISO).toBe(true);
    }
  });
});

describe("summarizePlan", () => {
  it("menghitung per status; total = jumlah jadwal", () => {
    const dob = "2026-01-01T00:00:00.000Z";
    const now = addMonths(new Date(dob), 3).getTime();
    const plan = immunizationPlan(dob, ["hb0"], now);
    const s = summarizePlan(plan);
    expect(s.total).toBe(IMMUNIZATION_SCHEDULE.length);
    expect(s.given).toBe(1);
    expect(s.overdue + s.due + s.upcoming + s.given).toBe(s.total);
  });
});
