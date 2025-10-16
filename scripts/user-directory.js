const DIRECTORY_URL = new URL('../data/userDirectory.json', import.meta.url);

let directoryCache = null;
let directoryPromise = null;

export async function getUserDirectory() {
  if (directoryCache) return directoryCache;
  if (!directoryPromise) {
    directoryPromise = fetch(DIRECTORY_URL, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load user directory (HTTP ${response.status})`);
        }
        const payload = await response.json();
        if (!payload || typeof payload !== 'object') {
          throw new Error('User directory response was not valid JSON.');
        }
        directoryCache = normalizeDirectory(payload);
        return directoryCache;
      })
      .catch((error) => {
        directoryPromise = null;
        throw error;
      });
  }
  return directoryPromise;
}

function normalizeDirectory(raw) {
  const users = Array.isArray(raw.users) ? raw.users : [];
  return {
    adminId: raw.adminId ?? null,
    users: users.map((entry) => ({
      uid: entry.uid ?? null,
      email: entry.email ?? null,
      role: entry.role ?? null,
      displayName: entry.displayName ?? null,
    })),
  };
}

export function findDirectoryEntry(user, directory) {
  if (!user || !directory) return null;
  const { users = [] } = directory;
  if (!users.length) return null;

  return (
    users.find((entry) => entry.uid && entry.uid === user.uid) ||
    users.find((entry) => entry.email && user.email && entry.email.toLowerCase() === user.email.toLowerCase()) ||
    null
  );
}
