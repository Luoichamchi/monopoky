import { io, type Socket } from 'socket.io-client';
import { save, store } from './ui/dom.ts';

/** Secret per browser: lets the server give you your seat back after a refresh. */
export function token(): string {
  let t = store<string>('ccn.token', '');
  // crypto.randomUUID needs HTTPS; plain-HTTP self-hosting is common, so build it from getRandomValues
  if (!t) save('ccn.token', (t = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('')));
  return t;
}

export function connect(): Socket {
  return io({ auth: { token: token() } });
}

export function ask<T>(sock: Socket, ev: string, msg: unknown): Promise<T> {
  return new Promise(resolve => sock.emit(ev, msg, resolve));
}
