import { FIREBASE_CONFIG, AUTH_PROVIDER_SETTINGS } from './config.js';
import { getUserDirectory, findDirectoryEntry } from './user-directory.js';

let initializeApp;
let getAuth;
let GoogleAuthProvider;
let onAuthStateChanged;
let signInWithPopupFn;
let signOutFn;

let firebaseApp = null;
let firebaseAuth = null;
let authProvider = null;
let firebaseLoadPromise = null;
let initializing = false;

const listeners = new Set();
const readyStatuses = new Set(['authenticated', 'anonymous', 'unavailable', 'error']);
let isReady = false;
let readyWaiters = [];

const defaultProfile = () => ({
  role: 'guest',
  adminId: null,
  displayName: null,
  directoryEntry: null,
  email: null,
});

let currentState = {
  status: 'idle',
  user: null,
  profile: defaultProfile(),
  directory: null,
  error: null,
  lastUpdated: Date.now(),
};

function resolveReady(state) {
  if (!isReady && readyStatuses.has(state.status)) {
    isReady = true;
    const waiters = readyWaiters;
    readyWaiters = [];
    waiters.forEach((resolve) => resolve(state));
  }
}

function persistState(state) {
  if (typeof window === 'undefined') return;
  try {
    if (state.user) {
      const payload = {
        user: state.user,
        profile: state.profile,
      };
      window.localStorage.setItem(
        AUTH_PROVIDER_SETTINGS.sessionStorageKey,
        JSON.stringify(payload)
      );
    } else {
      window.localStorage.removeItem(AUTH_PROVIDER_SETTINGS.sessionStorageKey);
    }

    if (state.profile?.adminId) {
      window.localStorage.setItem(AUTH_PROVIDER_SETTINGS.adminStorageKey, state.profile.adminId);
    } else {
      window.localStorage.removeItem(AUTH_PROVIDER_SETTINGS.adminStorageKey);
    }
  } catch (error) {
    console.warn('Study Feeds: Unable to persist auth state', error);
  }
}

function loadPersistedState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_PROVIDER_SETTINGS.sessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      user: parsed.user ?? null,
      profile: parsed.profile ?? defaultProfile(),
    };
  } catch (error) {
    console.warn('Study Feeds: Unable to read stored auth state', error);
    return null;
  }
}

function setState(partial) {
  const next = {
    ...currentState,
    ...partial,
    profile: partial.profile ?? currentState.profile,
    directory: partial.directory ?? currentState.directory,
    error: partial.error ?? null,
    lastUpdated: Date.now(),
  };
  currentState = next;
  window.__SF_AUTH_STATE__ = next;
  persistState(next);
  listeners.forEach((callback) => {
    try {
      callback(next);
    } catch (callbackError) {
      console.error('Study Feeds: auth listener failed', callbackError);
    }
  });
  resolveReady(next);
  return next;
}

async function loadFirebaseModules() {
  if (initializeApp && getAuth && GoogleAuthProvider) return;
  if (firebaseLoadPromise) return firebaseLoadPromise;
  firebaseLoadPromise = Promise.all([
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js'),
  ])
    .then(([appModule, authModule]) => {
      initializeApp = appModule.initializeApp;
      getAuth = authModule.getAuth;
      GoogleAuthProvider = authModule.GoogleAuthProvider;
      onAuthStateChanged = authModule.onAuthStateChanged;
      signInWithPopupFn = authModule.signInWithPopup;
      signOutFn = authModule.signOut;
    })
    .catch((error) => {
      firebaseLoadPromise = null;
      throw error;
    });
  return firebaseLoadPromise;
}

function sanitizeFirebaseUser(user) {
  if (!user) return null;
  return {
    uid: user.uid ?? null,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
  };
}

function createProfileFromDirectory(user, directory) {
  const adminId = directory?.adminId ?? currentState.profile?.adminId ?? null;
  if (!user) {
    return {
      ...defaultProfile(),
      adminId,
    };
  }

  const entry = findDirectoryEntry(user, directory);
  const fallbackRole = AUTH_PROVIDER_SETTINGS.defaultRole ?? 'student';
  const role = entry?.role ?? fallbackRole;
  const displayName = entry?.displayName ?? user.displayName ?? (user.email ? user.email.split('@')[0] : null);
  const email = user.email ?? entry?.email ?? null;

  return {
    role,
    adminId,
    displayName,
    directoryEntry: entry ?? null,
    email,
  };
}

async function handleAuthState(firebaseUser) {
  try {
    let directory = currentState.directory;
    try {
      directory = await getUserDirectory();
    } catch (directoryError) {
      console.warn('Study Feeds: user directory unavailable', directoryError);
    }
    const profile = createProfileFromDirectory(firebaseUser, directory);
    setState({
      status: firebaseUser ? 'authenticated' : 'anonymous',
      user: sanitizeFirebaseUser(firebaseUser),
      profile,
      directory,
      error: null,
    });
  } catch (error) {
    setState({
      status: 'error',
      user: null,
      profile: defaultProfile(),
      error: { message: error.message },
    });
  }
}

export function subscribeToAuthChanges(callback, options = {}) {
  const { emitCurrent = true } = options;
  listeners.add(callback);
  if (emitCurrent) {
    try {
      callback(currentState);
    } catch (callbackError) {
      console.error('Study Feeds: auth listener failed', callbackError);
    }
  }
  return () => listeners.delete(callback);
}

export function getAuthState() {
  return currentState;
}

export function whenAuthReady() {
  if (isReady) {
    return Promise.resolve(currentState);
  }
  return new Promise((resolve) => {
    readyWaiters.push(resolve);
  });
}

export async function initAuth() {
  if (initializing) {
    return whenAuthReady();
  }
  initializing = true;

  setState({ status: 'initializing' });

  const stored = loadPersistedState();
  if (stored) {
    setState({
      user: stored.user ?? null,
      profile: stored.profile ?? defaultProfile(),
      status: stored.user ? 'authenticated' : 'anonymous',
    });
  }

  try {
    await loadFirebaseModules();
  } catch (error) {
    console.warn('Study Feeds: Firebase libraries could not be loaded', error);
    const next = setState({
      status: 'unavailable',
      error: { message: error.message },
    });
    resolveReady(next);
    return next;
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
  }
  if (!firebaseAuth) {
    firebaseAuth = getAuth(firebaseApp);
  }
  if (!authProvider) {
    authProvider = new GoogleAuthProvider();
    authProvider.setCustomParameters({ prompt: 'select_account' });
  }

  onAuthStateChanged(firebaseAuth, (user) => {
    handleAuthState(user);
  });

  await handleAuthState(firebaseAuth.currentUser ?? null);
  return whenAuthReady();
}

export async function signInWithGoogle() {
  await initAuth();
  if (!firebaseAuth || !authProvider || !signInWithPopupFn) {
    throw new Error('Authentication provider is not available. Try again later.');
  }
  return signInWithPopupFn(firebaseAuth, authProvider);
}

export async function signOutUser() {
  if (!firebaseAuth || !signOutFn) {
    setState({
      status: 'anonymous',
      user: null,
      profile: defaultProfile(),
    });
    return;
  }
  await signOutFn(firebaseAuth);
}

function normaliseRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return null;
  return roles.map((role) => String(role).toLowerCase());
}

export async function requireRole(roles, options = {}) {
  const allowedRoles = normaliseRoles(roles);
  await initAuth();
  const state = await whenAuthReady();
  const role = (state.profile?.role ?? 'guest').toLowerCase();
  const allowed = !allowedRoles || allowedRoles.includes(role);

  if (!allowed) {
    if (typeof options.onDenied === 'function') {
      try {
        options.onDenied(state);
      } catch (callbackError) {
        console.error('Study Feeds: onDenied callback failed', callbackError);
      }
    }
    if (options.redirectTo) {
      window.location.href = options.redirectTo;
    }
  }

  return { allowed, state };
}

export function currentUserRole() {
  return currentState.profile?.role ?? 'guest';
}
