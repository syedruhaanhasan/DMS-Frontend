import { formatDistanceToNow, format } from "date-fns";

export const formatPKR = (n: number | undefined) =>
  n == null ? "—" : `PKR ${n.toLocaleString("en-PK")}`;

export const relTime = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
export const absTime = (iso: string) => format(new Date(iso), "PPpp");
