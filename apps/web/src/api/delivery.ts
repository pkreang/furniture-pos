import { apiGet, apiSend } from "./client";

export type DeliveryStatus =
  | "PENDING"
  | "SCHEDULED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export interface Zone {
  id: number;
  name: string;
  fee: number;
}

export interface Channel {
  id: number;
  name: string;
  type: "IN_HOUSE" | "COURIER";
}

export interface Team {
  id: number;
  name: string;
  branchId: number;
}

export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  teamId: number;
  isActive: boolean;
}

export interface DeliveryStatusEntry {
  id: number;
  status: DeliveryStatus;
  note: string | null;
  createdAt: string;
}

export interface Delivery {
  id: number;
  saleId: number;
  zoneId: number;
  channelId: number;
  teamId: number | null;
  driverId: number | null;
  status: DeliveryStatus;
  scheduledDate: string;
  timeSlot: string | null;
  addressText: string;
  recipientName: string | null;
  recipientPhone: string | null;
  fee: number;
  note: string | null;
  history?: DeliveryStatusEntry[];
  zone?: Zone;
  channel?: Channel;
  team?: Team | null;
  driver?: Driver | null;
  sale?: { number: string; branchId?: number };
}

export interface BookDeliveryInput {
  saleId: number;
  zoneId: number;
  channelId: number;
  teamId?: number;
  driverId?: number;
  scheduledDate: string;
  timeSlot?: string;
  addressText: string;
  recipientName?: string;
  recipientPhone?: string;
  note?: string;
}

export const fetchZones = (): Promise<Zone[]> => apiGet("/api/delivery/zones");
export const createZone = (name: string, fee: number): Promise<Zone> =>
  apiSend("POST", "/api/delivery/zones", { name, fee });
export const updateZone = (id: number, patch: Partial<Zone>): Promise<Zone> =>
  apiSend("PATCH", `/api/delivery/zones/${id}`, patch);

export const fetchChannels = (): Promise<Channel[]> => apiGet("/api/delivery/channels");
export const createChannel = (name: string, type: Channel["type"]): Promise<Channel> =>
  apiSend("POST", "/api/delivery/channels", { name, type });

export const fetchTeams = (): Promise<Team[]> => apiGet("/api/delivery/teams");
export const createTeam = (name: string, branchId: number): Promise<Team> =>
  apiSend("POST", "/api/delivery/teams", { name, branchId });

export const fetchDrivers = (): Promise<Driver[]> => apiGet("/api/delivery/drivers");
export const createDriver = (name: string, teamId: number): Promise<Driver> =>
  apiSend("POST", "/api/delivery/drivers", { name, teamId });
export const updateDriver = (id: number, patch: Partial<Driver>): Promise<Driver> =>
  apiSend("PATCH", `/api/delivery/drivers/${id}`, patch);

export function fetchDeliveries(status?: DeliveryStatus): Promise<Delivery[]> {
  const query = status ? `?status=${status}` : "";
  return apiGet(`/api/deliveries${query}`);
}

export const fetchDelivery = (id: number): Promise<Delivery> => apiGet(`/api/deliveries/${id}`);

export const bookDelivery = (input: BookDeliveryInput): Promise<Delivery> =>
  apiSend("POST", "/api/deliveries", input);

export const changeDeliveryStatus = (
  id: number,
  status: DeliveryStatus,
  note?: string,
): Promise<Delivery> => apiSend("PATCH", `/api/deliveries/${id}/status`, { status, note });
