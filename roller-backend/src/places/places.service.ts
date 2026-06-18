import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlacePrediction {
  place_id: string;
  description: string;
}

export interface PlaceDetails {
  address: string;
  lat: number;
  lng: number;
}

@Injectable()
export class PlacesService {
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GOOGLE_MAPS_API_KEY', '');
  }

  async autocomplete(input: string): Promise<PlacePrediction[]> {
    if (!this.apiKey) return [];

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
    );
    url.searchParams.set('input', input);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('language', 'es');

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      predictions?: Array<{ place_id: string; description: string }>;
    };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];

    return (data.predictions ?? []).map((p) => ({
      place_id: p.place_id,
      description: p.description,
    }));
  }

  async details(placeId: string): Promise<PlaceDetails | null> {
    if (!this.apiKey) return null;

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/details/json',
    );
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'formatted_address,geometry');
    url.searchParams.set('key', this.apiKey);

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      result?: {
        formatted_address: string;
        geometry?: { location: { lat: number; lng: number } };
      };
    };

    if (data.status !== 'OK' || !data.result?.geometry?.location) return null;

    return {
      address: data.result.formatted_address,
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
    };
  }
}
