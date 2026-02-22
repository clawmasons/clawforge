export interface AppTriggerBinding {
  appSlug: string;
  event: string;
  path: string;
}

export interface TriggeredAppEvent {
  orgSlug: string;
  spaceSlug: string;
  appSlug: string;
  event: string;
  path: string;
  changedPath: string;
}

export async function getSpaceAppTriggerMetadata(
  _apiUrl: string,
  _clawforgeToken: string,
  _orgSlug: string,
  _spaceSlug: string,
): Promise<AppTriggerBinding[]> {
  // Stub for future API call; this establishes the metadata retrieval pattern.
  return [];
}

export async function onAppTriggerEvent(
  event: TriggeredAppEvent,
): Promise<void> {
  // Stub callback hook for future async dispatch (task router, queue, etc.).
  console.log(
    `[trigger] ${event.orgSlug}/${event.spaceSlug} app=${event.appSlug} event=${event.event} path=${event.path} changedPath=${event.changedPath}`,
  );
}
