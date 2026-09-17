// ============================================================
// REALTIME
//
// One socket for the whole app, shared by every page that wants
// to know when something changed. The server only sends an event
// to clients holding the matching permission, and the payload is
// just ids — the page refetches through the API, where the
// permission check runs again.
//
// The socket authenticates with the in-memory access token. When
// that expires the server drops the connection; reconnecting
// picks up whatever token the API client holds by then.
// ============================================================

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken, BASE_URL } from './api';

let socket = null;
let connections = 0;

function ensureSocket() {
  if (socket) return socket;

  socket = io(BASE_URL, {
    // Read fresh on every (re)connect rather than captured once,
    // so a reconnect after a refresh uses the new token.
    auth: (callback) => callback({ token: getAccessToken() }),
    autoConnect: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  socket.on('connect_error', (err) => {
    // Expected whenever the token has expired; the API client
    // will refresh on the next request and the socket retries.
    if (import.meta.env.DEV) console.debug('Realtime not connected:', err.message);
  });

  return socket;
}

/** Re-run `handler` whenever any of `events` arrives. */
export function useRealtime(events, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const key = events.join('|');

  useEffect(() => {
    if (!events.length) return undefined;

    const active = ensureSocket();
    connections += 1;

    const listener = () => handlerRef.current();
    events.forEach((event) => active.on(event, listener));

    return () => {
      events.forEach((event) => active.off(event, listener));
      connections -= 1;
      // Tear the socket down once nothing is listening, so
      // signing out does not leave an authenticated connection
      // open in the background.
      if (connections <= 0) {
        active.disconnect();
        socket = null;
        connections = 0;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export const EVENTS = {
  BED: 'bed:changed',
  ADMISSION: 'admission:changed',
  PATIENT: 'patient:changed',
};
