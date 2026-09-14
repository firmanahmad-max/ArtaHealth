import { describe, it, expect } from "vitest";
import {
  rankEntries, weekStartLocal, weekKeyLocal, weeklyPoints, personalBestWeek, weekMomentum,
  type PointEvent,
} from "../leaderboard.ts";

describe("rankEntries", () => {
  it("urut turun; seri berbagi peringkat (competition ranking)", () => {
    const r = rankEntries([{ n: "a", s: 10 }, { n: "b", s: 30 }, { n: "c", s: 10 }, { n: "d", s: 20 }],
      (e) => e.s, (e) => e.n);
    expect(r.map((x) => [x.entry.n, x.rank])).toEqual([["b", 1], ["d", 2], ["a", 3], ["c", 3]]);
  });
  it("persentil: teratas 100, terbawah 0", () => {
    const r = rankEntries([{ s: 5 }, { s: 9 }, { s: 1 }], (e) => e.s);
    expect(r[0]!.percentile).toBe(100);
    expect(r[2]!.percentile).toBe(0);
  });
  it("satu entri → persentil 100", () => {
    expect(rankEntries([{ s: 7 }], (e) => e.s)[0]!.percentile).toBe(100);
  });
});

describe("minggu lokal (Senin)", () => {
  it("weekStartLocal mundur ke Senin", () => {
    // 2026-09-16 = Rabu → Senin = 2026-09-14
    expect(weekStartLocal(new Date(2026, 8, 16)).getDate()).toBe(14);
    // Senin tetap Senin
    expect(weekStartLocal(new Date(2026, 8, 14)).getDate()).toBe(14);
  });
  it("weekKeyLocal = tanggal Senin", () => {
    expect(weekKeyLocal("2026-09-16T10:00:00")).toBe("2026-09-14");
  });
});

describe("weeklyPoints", () => {
  const now = new Date(2026, 8, 16, 12, 0, 0).getTime(); // Rabu 16 Sep 2026 → minggu Senin 14 Sep
  it("bucket per minggu, sertakan minggu kosong, urut lama→baru", () => {
    const events: PointEvent[] = [
      { at: new Date(2026, 8, 15, 9).toISOString(), points: 10 }, // minggu ini (14 Sep)
      { at: new Date(2026, 8, 16, 9).toISOString(), points: 5 },  // minggu ini
      { at: new Date(2026, 8, 8, 9).toISOString(), points: 8 },   // minggu lalu (7 Sep)
    ];
    const w = weeklyPoints(events, now, 4);
    expect(w).toHaveLength(4);
    expect(w[3]!.weekKey).toBe("2026-09-14");
    expect(w[3]!.points).toBe(15);
    expect(w[3]!.events).toBe(2);
    expect(w[2]!.weekKey).toBe("2026-09-07");
    expect(w[2]!.points).toBe(8);
    expect(w[0]!.points).toBe(0); // minggu terjauh kosong
  });
  it("event di luar jendela diabaikan; poin non-finite dilewati", () => {
    const w = weeklyPoints([
      { at: new Date(2026, 7, 1).toISOString(), points: 99 },     // jauh sebelum jendela
      { at: new Date(2026, 8, 15).toISOString(), points: NaN },
    ], now, 3);
    expect(w.reduce((s, x) => s + x.points, 0)).toBe(0);
  });
});

describe("personalBestWeek & weekMomentum", () => {
  const now = new Date(2026, 8, 16, 12).getTime();
  const events: PointEvent[] = [
    { at: new Date(2026, 8, 1, 9).toISOString(), points: 20 },  // minggu 31 Agu
    { at: new Date(2026, 8, 9, 9).toISOString(), points: 30 },  // minggu 7 Sep (rekor)
    { at: new Date(2026, 8, 15, 9).toISOString(), points: 25 }, // minggu 14 Sep (berjalan)
  ];
  it("rekor pribadi = minggu poin tertinggi", () => {
    const w = weeklyPoints(events, now, 4);
    expect(personalBestWeek(w)!.points).toBe(30);
  });
  it("momentum: delta vs minggu lalu + peringkat di antara minggu aktif", () => {
    const m = weekMomentum(weeklyPoints(events, now, 4));
    expect(m.current!.points).toBe(25);
    expect(m.previous!.points).toBe(30);
    expect(m.delta).toBe(-5);
    expect(m.direction).toBe("down");
    expect(m.rankAmongWeeks).toBe(2); // 25 → peringkat 2 dari {30,25,20}
    expect(m.isPersonalBest).toBe(false);
  });
  it("minggu berjalan jadi rekor → isPersonalBest true", () => {
    const ev: PointEvent[] = [
      { at: new Date(2026, 8, 9, 9).toISOString(), points: 10 },
      { at: new Date(2026, 8, 15, 9).toISOString(), points: 40 },
    ];
    const m = weekMomentum(weeklyPoints(ev, now, 4));
    expect(m.isPersonalBest).toBe(true);
    expect(m.rankAmongWeeks).toBe(1);
  });
});
