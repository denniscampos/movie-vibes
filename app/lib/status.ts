export enum MovieStatus {
  NOT_WATCHED = "NOT_WATCHED",
  UPCOMING = "UPCOMING",
  WATCHED = "WATCHED",
}

export type MovieStatusType = keyof typeof MovieStatus;
