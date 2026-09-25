export class MockBroadcastHub {
  #channels = new Map();

  create = (name) => {
    const listeners = new Set();
    const channel = {
      addEventListener(type, listener) {
        if (type === 'message') listeners.add(listener);
      },
      close: () => {
        this.#channels.get(name)?.delete(channel);
      },
      postMessage: (data) => {
        for (const peer of this.#channels.get(name) ?? []) {
          if (peer !== channel) peer.dispatch(data);
        }
      },
      removeEventListener(type, listener) {
        if (type === 'message') listeners.delete(listener);
      },
      dispatch(data) {
        for (const listener of listeners) listener({ data });
      },
    };
    const channels = this.#channels.get(name) ?? new Set();
    channels.add(channel);
    this.#channels.set(name, channels);
    return channel;
  };
}
