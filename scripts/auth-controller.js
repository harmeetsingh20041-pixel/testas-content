import { initAuth, signInWithGoogle, signOutUser, subscribeToAuthChanges } from './auth.js';

const signInButtons = Array.from(document.querySelectorAll('[data-auth-sign-in]'));
const signOutButtons = Array.from(document.querySelectorAll('[data-auth-sign-out]'));
const userContainers = Array.from(document.querySelectorAll('[data-auth-user]'));
const nameTargets = Array.from(document.querySelectorAll('[data-auth-name]'));
const roleTargets = Array.from(document.querySelectorAll('[data-auth-role]'));
const adminIdTargets = Array.from(document.querySelectorAll('[data-admin-id]'));
const statusTargets = Array.from(document.querySelectorAll('[data-auth-status]'));

function setSignInLoading(isLoading) {
  signInButtons.forEach((button) => {
    button.disabled = isLoading;
    button.classList.toggle('is-loading', isLoading);
    if (isLoading) {
      button.dataset.loadingLabel = button.textContent;
      button.textContent = 'Connecting…';
    } else if (button.dataset.loadingLabel) {
      button.textContent = button.dataset.loadingLabel;
      delete button.dataset.loadingLabel;
    }
  });
}

function updateRoleVisibility(role) {
  const normalisedRole = (role ?? 'guest').toLowerCase();
  document.body.dataset.authRole = normalisedRole;

  document.querySelectorAll('[data-requires-role]').forEach((element) => {
    const roles = String(element.dataset.requiresRole || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!roles.length) return;
    const allowed = roles.includes(normalisedRole);
    element.hidden = !allowed;
  });
}

function updateStatusMessage(state) {
  if (!statusTargets.length) return;
  const { status, error } = state;
  const message = (() => {
    if (status === 'unavailable') {
      return 'Authentication is currently unavailable. You can continue browsing as a guest.';
    }
    if (status === 'error') {
      return error?.message || 'Authentication temporarily unavailable.';
    }
    return '';
  })();

  statusTargets.forEach((target) => {
    target.textContent = message;
    target.hidden = !message;
  });
}

function updateSession(state) {
  const { user, profile, status } = state;
  const displayName = profile?.displayName || user?.displayName || user?.email || 'Guest';
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Guest';

  signInButtons.forEach((button) => {
    button.hidden = Boolean(user);
    button.disabled = status === 'unavailable';
    button.title = status === 'unavailable'
      ? 'Authentication is currently unavailable.'
      : '';
  });

  signOutButtons.forEach((button) => {
    button.hidden = !user;
  });

  userContainers.forEach((container) => {
    container.hidden = !user;
  });

  nameTargets.forEach((target) => {
    target.textContent = displayName;
  });

  roleTargets.forEach((target) => {
    target.textContent = roleLabel;
  });

  adminIdTargets.forEach((target) => {
    const adminId = profile?.adminId ?? '';
    target.textContent = adminId ? `Admin ID: ${adminId}` : '';
    target.hidden = !adminId;
  });

  updateRoleVisibility(profile?.role);
  updateStatusMessage(state);
}

signInButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    setSignInLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Study Feeds: sign-in failed', error);
      alert(error?.message || 'Unable to sign in right now.');
    } finally {
      setSignInLoading(false);
    }
  });
});

signOutButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Study Feeds: sign-out failed', error);
      alert('Sign-out did not complete. Please refresh and try again.');
    }
  });
});

subscribeToAuthChanges(updateSession);

initAuth().catch((error) => {
  console.error('Study Feeds: authentication initialisation failed', error);
});
