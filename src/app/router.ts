import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'garage' }
  | { name: 'add' }
  | { name: 'drive'; carId: string }
  | { name: 'group' }
  | { name: 'settings' }
  | { name: 'dev' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, arg] = path.split('/');
  switch (head) {
    case 'add':
      return { name: 'add' };
    case 'drive':
      return arg ? { name: 'drive', carId: decodeURIComponent(arg) } : { name: 'garage' };
    case 'group':
      return { name: 'group' };
    case 'settings':
      return { name: 'settings' };
    case 'dev':
      return { name: 'dev' };
    default:
      return { name: 'garage' };
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'garage':
      return '#/';
    case 'drive':
      return `#/drive/${encodeURIComponent(route.carId)}`;
    default:
      return `#/${route.name}`;
  }
}

let inAppDepth = 0;

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const href = hrefFor(route);
  if (opts.replace) history.replaceState(null, '', href);
  else {
    history.pushState(null, '', href);
    inAppDepth += 1;
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Back if there is somewhere to go back to inside the app, else garage. */
export function goBack(): void {
  if (inAppDepth > 0) {
    inAppDepth -= 1;
    history.back();
  } else navigate({ name: 'garage' }, { replace: true });
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseHash(hash);
}
