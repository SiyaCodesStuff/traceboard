import type { EntityType } from "./validators";

export type LinkItem = { id: string; type: EntityType; code: string; title: string };
export type CurrentLink = { id: string; item: LinkItem };
export type LinkPickerData = { options: LinkItem[]; current: CurrentLink[] };
export type LinkActionState = { status?: "success" | "error"; message?: string; id?: string };
export type LinkPickerResult = { data: LinkPickerData; error?: never } | { data?: never; error: string };
