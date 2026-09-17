import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { reportsApi, type WasteReport } from '@/api/reportsApi';
import { pickupApi, type PickupRequest } from '@/api/pickupApi';
import { locationApi, type CollectorLocation } from '@/api/locationApi';
import { getApiErrorMessage } from '@/api/axios';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import StatusChip from '@/components/StatusChip';
import { MapIcon } from '@/components/icons';

type MapPoint = {
  id: string;
  label: string;
  status?: string;
  location_text?: string | null;
  lat: number;
  lng: number;
  type: 'report' | 'pickup' | 'collector';
  created_at?: string;
  updated_at?: string;
  updated_label?: string;
  is_stale?: boolean;
  color?: string;
  distance?: number;
};

type LeafletMap = L.Map;

const statusColors: Record<string, string> = {
  reported: 'bg-amber-500',
  verified: 'bg-sky-500',
  assigned: 'bg-indigo-500',
  cleaned: 'bg-emerald-500',
  approved: 'bg-emerald-600',
  rejected: 'bg-rose-500',
  pending: 'bg-amber-500',
  overdue: 'bg-rose-600',
  completed: 'bg-emerald-600',
  in_progress: 'bg-indigo-500',
  cancelled: 'bg-rose-500'
};

const typeColors: Record<MapPoint['type'], string> = {
  report: '#f59e0b',
  pickup: '#10b981',
  collector: '#2563eb'
};

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

const formatUpdateLabel = (updatedAt?: string | null) => {
  if (!updatedAt) return { label: 'No update', isStale: true };
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return { label: 'Update unknown', isStale: true };
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return { label: 'Updated just now', isStale: false };
  if (minutes < 60) return { label: `Updated ${minutes}m ago`, isStale: diff > STALE_THRESHOLD_MS };
  const hours = Math.floor(minutes / 60);
  return { label: `Updated ${hours}h ago`, isStale: diff > STALE_THRESHOLD_MS };
};

const createDotIcon = (color: string) =>
  L.divIcon({
    className: 'leaflet-div-icon marker-dot',
    html: `<span style="background:${color};"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
};

const formatDistance = (meters?: number) => {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const normalizePickupStatus = (status?: string | null): string | undefined => {
  if (!status) return undefined;
  if (status === 'approved' || status === 'payment_uploaded') return 'pending';
  return status;
};

const normalizeLocationText = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toPointKey = (point: Pick<MapPoint, 'type' | 'id'>): string => `${point.type}-${point.id}`;

const getPointLocationText = (point: MapPoint): string => {
  const normalized = normalizeLocationText(point.location_text);
  if (normalized) return normalized;
  if (point.type === 'collector') return 'Area not set';
  return 'Location not provided';
};

const FitBounds = ({
  points,
  userLocation,
  focusedPoint
}: {
  points: MapPoint[];
  userLocation: { lat: number; lng: number } | null;
  focusedPoint: MapPoint | null;
}) => {
  const map = useMap() as unknown as LeafletMap;
  const lastFocusedRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusedPoint) {
      const key = `${focusedPoint.type}-${focusedPoint.id}`;
      if (lastFocusedRef.current !== key) {
        lastFocusedRef.current = key;
        const focusBounds = L.latLngBounds([
          [focusedPoint.lat, focusedPoint.lng],
          [focusedPoint.lat, focusedPoint.lng]
        ]);
        map.fitBounds(focusBounds, {
          padding: [36, 36],
          maxZoom: 16
        });
      }
      return;
    }

    const coords = points.map((p) => [p.lat, p.lng]);
    if (userLocation) {
      coords.push([userLocation.lat, userLocation.lng]);
    }
    if (coords.length === 0) return;
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [focusedPoint, points, userLocation, map]);

  return null;
};

export default function AdminMapPage() {
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [collectors, setCollectors] = useState<CollectorLocation[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [pickupStatus, setPickupStatus] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showReports, setShowReports] = useState(true);
  const [showPickups, setShowPickups] = useState(true);
  const [showCollectors, setShowCollectors] = useState(true);
  const [sortNearest, setSortNearest] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number | null } | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [focusedPointId, setFocusedPointId] = useState<string | null>(null);
  const markerRefs = useRef<Record<string, { openPopup: () => void }>>({});

  const markerIcons = useMemo(() => ({
    report: createDotIcon(typeColors.report),
    pickup: createDotIcon(typeColors.pickup),
    collector: createDotIcon(typeColors.collector),
    staleCollector: createDotIcon('#94a3b8')
  }), []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [r, p, c] = await Promise.all([
        reportsApi.listReports(),
        pickupApi.listPickups({ status: undefined }),
        locationApi.listCollectors()
      ]);
      setReports(r);
      setPickups(p);
      setCollectors(c);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const c = await locationApi.listCollectors();
        setCollectors(c);
      } catch {
        // silent refresh
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      () => {
        toast.error('Unable to access location');
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [tracking]);

  const points: MapPoint[] = useMemo(() => {
    const fromReports = showReports
      ? reports
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          id: r.id,
          label: r.description ?? 'Waste report',
          location_text: r.location_text ?? null,
          status: r.status,
          lat: r.latitude as number,
          lng: r.longitude as number,
          type: 'report' as const,
          created_at: r.created_at
        }))
      : [];

    const fromPickups = showPickups
      ? pickups
        .filter((p) => (p as any).latitude != null && (p as any).longitude != null)
        .map((p) => ({
          id: p.id,
          label: p.waste_type ? `${p.waste_type} pickup` : 'Pickup',
          location_text: p.address ?? null,
          status: normalizePickupStatus(p.status),
          lat: (p as any).latitude as number,
          lng: (p as any).longitude as number,
          type: 'pickup' as const,
          created_at: p.created_at
        }))
      : [];

    const fromCollectors = showCollectors
      ? collectors
        .filter((c) => c.latitude != null && c.longitude != null)
        .map((c) => {
          const update = formatUpdateLabel(c.updated_at);
          return {
            id: c.collector_id,
            label: c.name ? `Collector ${c.name}` : 'Collector',
            location_text: c.collector_area ?? null,
            lat: c.latitude,
            lng: c.longitude,
            type: 'collector' as const,
            updated_at: c.updated_at,
            updated_label: update.label,
            is_stale: update.isStale,
            color: update.isStale ? '#94a3b8' : typeColors.collector
          };
        })
      : [];

    const dateInRange = (iso?: string) => {
      if (!iso) return true;
      const ts = new Date(iso).getTime();
      if (Number.isNaN(ts)) return true;
      if (fromDate) {
        const fromTs = new Date(fromDate).getTime();
        if (!Number.isNaN(fromTs) && ts < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate).getTime();
        if (!Number.isNaN(toTs) && ts > toTs + 86_399_000) return false;
      }
      return true;
    };

    const filteredReports = fromReports.filter(
      (p) => (status === 'all' ? true : p.status === status) && dateInRange(p.created_at)
    );
    const filteredPickups = fromPickups.filter(
      (p) => (pickupStatus === 'all' ? true : normalizePickupStatus(p.status) === pickupStatus) && dateInRange(p.created_at)
    );

    const merged = [...filteredReports, ...filteredPickups, ...fromCollectors];
    if (!sortNearest || !userLocation) return merged;
    return merged
      .map((p) => ({
        ...p,
        distance: haversineMeters({ lat: p.lat, lng: p.lng }, { lat: userLocation.lat, lng: userLocation.lng })
      }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }, [
    reports,
    pickups,
    collectors,
    status,
    pickupStatus,
    fromDate,
    toDate,
    showReports,
    showPickups,
    showCollectors,
    sortNearest,
    userLocation
  ]);

  const reportPointsCount = useMemo(() => points.filter((point) => point.type === 'report').length, [points]);
  const pickupPointsCount = useMemo(() => points.filter((point) => point.type === 'pickup').length, [points]);
  const collectorPointsCount = useMemo(() => points.filter((point) => point.type === 'collector').length, [points]);
  const staleCollectorCount = useMemo(
    () => points.filter((point) => point.type === 'collector' && point.is_stale).length,
    [points]
  );
  const focusedPoint = useMemo(
    () => (focusedPointId ? points.find((point) => toPointKey(point) === focusedPointId) ?? null : null),
    [focusedPointId, points]
  );

  useEffect(() => {
    if (!focusedPointId) return;
    const marker = markerRefs.current[focusedPointId];
    if (!marker) return;
    const timer = window.setTimeout(() => {
      marker.openPopup();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [focusedPointId, points]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Operations Map"
        subtitle="Track pickups, reports, and collectors with live updates."
        icon={<MapIcon className="h-5 w-5" />}
        tone="sky"
        chips={(
          <>
            <StatusChip label={`Reports ${reportPointsCount}`} tone="warning" />
            <StatusChip label={`Pickups ${pickupPointsCount}`} tone="success" />
            <StatusChip label={`Collectors ${collectorPointsCount}`} tone="info" />
            <StatusChip label={`Stale collectors ${staleCollectorCount}`} tone={staleCollectorCount > 0 ? 'danger' : 'neutral'} />
          </>
        )}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={clsx('btn', tracking ? 'btn-secondary' : 'btn-outline')}
              onClick={() => setTracking((prev) => !prev)}
            >
              {tracking ? 'Stop tracking' : 'Track my location'}
            </button>
            <button
              type="button"
              className={clsx('btn', sortNearest ? 'btn-primary' : 'btn-outline')}
              onClick={() => setSortNearest((prev) => !prev)}
            >
              Sort nearest
            </button>
            <button
              type="button"
              className={clsx('btn', showReports ? 'btn-primary' : 'btn-outline')}
              onClick={() => setShowReports((prev) => !prev)}
            >
              Reports
            </button>
            <button
              type="button"
              className={clsx('btn', showPickups ? 'btn-primary' : 'btn-outline')}
              onClick={() => setShowPickups((prev) => !prev)}
            >
              Pickups
            </button>
            <button
              type="button"
              className={clsx('btn', showCollectors ? 'btn-primary' : 'btn-outline')}
              onClick={() => setShowCollectors((prev) => !prev)}
            >
              Collectors
            </button>
          </div>
        )}
        footer={(
          <AdminRefreshPanel
            isLoading={isLoading}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void load()}
          />
        )}
      />

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="select w-44">
            <option value="all">All report statuses</option>
            <option value="reported">reported</option>
            <option value="verified">verified</option>
            <option value="assigned">assigned</option>
            <option value="cleaned">cleaned</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
          <select value={pickupStatus} onChange={(e) => setPickupStatus(e.target.value)} className="select w-44">
            <option value="all">All pickup statuses</option>
            <option value="pending">pending</option>
            <option value="assigned">assigned</option>
            <option value="overdue">overdue</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <input type="date" className="field w-40" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="field w-40" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <div className="text-xs text-slate-500">
            Collector updates older than 5 minutes show as stale.
          </div>
        </div>
      </div>

      <div className="card-solid overflow-hidden p-0">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <MapContainer
              center={[4.05, 9.7]}
              zoom={12}
              style={{ height: 520, width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <FitBounds points={points} userLocation={userLocation} focusedPoint={focusedPoint} />
              {focusedPoint ? (
                <CircleMarker
                  center={[focusedPoint.lat, focusedPoint.lng]}
                  radius={18}
                  pathOptions={{
                    color: focusedPoint.color ?? typeColors[focusedPoint.type],
                    weight: 2,
                    fillColor: focusedPoint.color ?? typeColors[focusedPoint.type],
                    fillOpacity: 0.1,
                  }}
                  interactive={false}
                />
              ) : null}
              {userLocation ? (
                <>
                  <Circle
                    center={[userLocation.lat, userLocation.lng]}
                    radius={Math.min(Math.max(userLocation.accuracy ?? 0, 10), 120)}
                    pathOptions={{ color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 0.12 }}
                  />
                  <CircleMarker
                    center={[userLocation.lat, userLocation.lng]}
                    radius={7}
                    pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9 }}
                  >
                    <Popup>Your location</Popup>
                  </CircleMarker>
                </>
              ) : null}
              <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={48}>
                {points.map((p) => {
                  const pointKey = toPointKey(p);
                  const icon =
                    p.type === 'collector'
                      ? (p.is_stale ? markerIcons.staleCollector : markerIcons.collector)
                      : markerIcons[p.type];
                  return (
                    <Marker
                      key={pointKey}
                      position={[p.lat, p.lng]}
                      icon={icon}
                      ref={(marker) => {
                        if (marker) {
                          markerRefs.current[pointKey] = marker;
                        } else {
                          delete markerRefs.current[pointKey];
                        }
                      }}
                      eventHandlers={{
                        click: () => setFocusedPointId(pointKey),
                      }}
                    >
                      <Popup>
                        <div className="text-sm font-semibold text-slate-900">{p.label || p.id}</div>
                        <div className="text-xs text-slate-600">
                          {getPointLocationText(p)}
                        </div>
                        {p.type === 'collector' && p.updated_label ? (
                          <div className={clsx('text-xs', p.is_stale ? 'text-rose-600' : 'text-slate-500')}>
                            {p.updated_label}
                          </div>
                        ) : null}
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            </MapContainer>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-slate-600">
                Loading map...
              </div>
            ) : points.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-slate-600">
                No points to display yet. The map is still available for zooming.
              </div>
            ) : null}
          </div>
          <div className="max-h-[520px] overflow-y-auto border-l border-slate-100">
            {points.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">No points to display.</div>
            ) : (
              points.map((p) => {
                const pointKey = toPointKey(p);
                const distance = userLocation
                  ? haversineMeters({ lat: p.lat, lng: p.lng }, { lat: userLocation.lat, lng: userLocation.lng })
                  : undefined;
                const distanceLabel = formatDistance(distance);
                return (
                  <div
                    key={pointKey}
                    className={clsx(
                      'flex cursor-pointer items-start gap-3 p-3',
                      focusedPointId === pointKey ? 'bg-brand-50/60' : undefined
                    )}
                    onClick={() => setFocusedPointId(pointKey)}
                  >
                    <span
                      className={clsx(
                        'mt-1 h-2.5 w-2.5 rounded-full',
                        p.status ? statusColors[p.status] ?? 'bg-slate-400' : 'bg-slate-400'
                      )}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{p.label || p.id}</div>
                      <div className="text-xs text-slate-600">
                        {getPointLocationText(p)}
                      </div>
                      {p.type === 'collector' && p.updated_label ? (
                        <div className={clsx('text-xs', p.is_stale ? 'text-rose-600' : 'text-slate-500')}>
                          {p.updated_label}{p.is_stale ? ' - stale' : ''}
                        </div>
                      ) : null}
                      {distanceLabel ? (
                        <div className="text-xs text-slate-500">Distance: {distanceLabel}</div>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-medium text-brand-700 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setFocusedPointId(pointKey);
                        }}
                      >
                        Navigate
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
