declare module 'leaflet' {
  export type LatLngExpression = [number, number] | { lat: number; lng: number } | any;
  export type LatLngBoundsExpression = any;

  export interface FitBoundsOptions {
    padding?: [number, number];
    [key: string]: any;
  }

  export interface MapOptions {
    center?: LatLngExpression;
    zoom?: number;
    scrollWheelZoom?: boolean;
    [key: string]: any;
  }

  export interface TileLayerOptions {
    attribution?: string;
    [key: string]: any;
  }

  export interface PathOptions {
    [key: string]: any;
  }

  export interface CircleOptions {
    radius?: number;
    pathOptions?: PathOptions;
    [key: string]: any;
  }

  export interface CircleMarkerOptions {
    radius?: number;
    pathOptions?: PathOptions;
    [key: string]: any;
  }

  export interface MarkerOptions {
    icon?: any;
    [key: string]: any;
  }

  export class Map {
    fitBounds(bounds: any, options?: FitBoundsOptions): void;
  }

  export function latLngBounds(points: any): any;
  export function divIcon(options?: any): any;

  const L: {
    latLngBounds: typeof latLngBounds;
    divIcon: typeof divIcon;
    [key: string]: any;
  };

  export default L;
}

declare module 'leaflet.markercluster';
