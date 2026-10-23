// Lớp mạng: WebSocket + đo độ trễ
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.ping = 0;
    this.onOpen = () => {};
    this.onClose = () => {};
    this._pingTimer = null;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.onOpen();
      this._pingTimer = setInterval(() => {
        this.send({ t: 'ping', ts: Date.now() });
      }, 4000);
    };

    this.ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      if (msg.t === 'pong') {
        this.ping = Date.now() - msg.ts;
        return;
      }
      const list = this.handlers.get(msg.t);
      if (list) for (const fn of list) fn(msg);
      const all = this.handlers.get('*');
      if (all) for (const fn of all) fn(msg);
    };

    this.ws.onclose = () => {
      clearInterval(this._pingTimer);
      this.onClose();
    };
    this.ws.onerror = () => {};
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  close() {
    try {
      this.ws.close();
    } catch (e) {}
  }
}
