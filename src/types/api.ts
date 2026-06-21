import type { SongSummary } from "./song";

export interface SongsPageResponse {
  page: number;
  pageSize: number;
  items: SongSummary[];
}