import type { RealtimeFanout, SecretStore } from "@forion/orbit-adapter-kit";
import { createSecretStore } from "@forion/orbit-adapters";
import { resolveEncryptionKey } from "@forion/orbit-core";

/** Worker composition without starting job hosts or database connections. */
export async function createWorkerSecretStore(
  source: NodeJS.ProcessEnv,
  realtime?: RealtimeFanout,
): Promise<SecretStore> {
  const store = createSecretStore(resolveEncryptionKey(source), source, realtime);
  await store.start();
  return store;
}
