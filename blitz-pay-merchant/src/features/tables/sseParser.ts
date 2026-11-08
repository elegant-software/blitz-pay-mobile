export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental text/event-stream parser: feed it chunks as they arrive, it emits complete events.
 * Follows the WHATWG rules we need: `event:` and multi-line `data:` fields, comments, CRLF line ends.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = '';
  let eventName = '';
  let data: string[] = [];

  const dispatch = () => {
    if (data.length > 0) onEvent({ event: eventName || 'message', data: data.join('\n') });
    eventName = '';
    data = [];
  };

  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') {
        dispatch();
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') eventName = value;
      else if (field === 'data') data.push(value);
    }
  };
}
