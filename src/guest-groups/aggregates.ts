/**
 * Pure aggregate computation shared by the backfill migration and the
 * recompute endpoint. Snapshots per-guest data onto guest_groups so the
 * guests table can be dropped once the aggregates are validated.
 */

export interface GuestAggregateInput {
  status: string;
  is_minor: boolean | number | null;
  lat: number | null;
  lng: number | null;
  native_language: string | null;
  /** Raw simple-array storage: comma-separated string. */
  other_languages: string | null;
  speaks_english: boolean | number | null;
  car_seats: number | null;
}

export interface GroupAggregates {
  agg_guest_count: number;
  agg_minor_count: number;
  agg_status_counts: Record<string, number>;
  agg_avg_lat: number | null;
  agg_avg_lng: number | null;
  agg_languages: string[];
  agg_speaks_english: boolean;
  agg_car_seats: number;
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

export function computeGroupAggregates(
  guests: GuestAggregateInput[],
): GroupAggregates {
  const statusCounts: Record<string, number> = {};
  for (const g of guests) {
    statusCounts[g.status] = (statusCounts[g.status] ?? 0) + 1;
  }

  // Cancelled guests are excluded from every aggregate except the status breakdown
  const active = guests.filter((g) => g.status !== 'cancelled');

  const points = active.filter(
    (g): g is GuestAggregateInput & { lat: number; lng: number } =>
      g.lat !== null && g.lng !== null,
  );
  let avgLat: number | null = null;
  let avgLng: number | null = null;
  if (points.length > 0) {
    avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    // A single shared location would expose the host's home: blur it to ~110 m
    const allSame = points.every(
      (p) => p.lat === points[0].lat && p.lng === points[0].lng,
    );
    if (allSame) {
      avgLat = round3(avgLat);
      avgLng = round3(avgLng);
    }
  }

  const languages = new Set<string>();
  for (const g of active) {
    if (g.native_language?.trim()) languages.add(g.native_language.trim());
    if (g.other_languages) {
      for (const lang of g.other_languages.split(',')) {
        const l = lang.trim();
        if (l) languages.add(l);
      }
    }
  }

  return {
    agg_guest_count: active.length,
    agg_minor_count: active.filter((g) => !!g.is_minor).length,
    agg_status_counts: statusCounts,
    agg_avg_lat: avgLat,
    agg_avg_lng: avgLng,
    agg_languages: [...languages].sort(),
    agg_speaks_english: active.some((g) => !!g.speaks_english),
    agg_car_seats: active.reduce((sum, g) => sum + (g.car_seats ?? 0), 0),
  };
}
