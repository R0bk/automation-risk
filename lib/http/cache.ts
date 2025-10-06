/**
 * Wraps a fetch implementation and guarantees that the last tool,
 * the last system block and the last message (plus its final part)
 * all carry `cache_control: {type:'ephemeral'}`.
 */
export function withEphemeralCacheControl(upstream: typeof fetch = globalThis.fetch): typeof fetch {
  // Cast the async wrapper to `typeof fetch` so that the returned function is fully
  // compatible with the built-in `fetch` signature (overloads included).
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    try {
      // Only patch Anthropic Messages requests with a JSON body
      if (
        typeof input === "string" &&
        init?.body &&
        typeof init.body === "string"
      ) {
        const payload = JSON.parse(init.body as string);

        const add = (obj: { cache_control?: { type: string } } | undefined) => {
          if (!obj) return;
          if (!obj.cache_control) {
            // SDK-level (providerOptions already resolved), so use API shape:
            obj.cache_control = { type: "ephemeral" };
          }
        };

        let cacheControlCount = 0;
        const maxCacheControls = 4;

        // 1. system array (if present – Claude API supports both string | array)
        if (Array.isArray(payload.system) && payload.system.length && cacheControlCount < maxCacheControls) {
          add(payload.system.at(-1));
          cacheControlCount++;
        }

        // 2. messages array - prioritize the most recent messages
        if (Array.isArray(payload.messages) && payload.messages.length && cacheControlCount < maxCacheControls) {
          // Start from the end and work backwards, applying cache control to the most recent messages
          const remainingSlots = maxCacheControls - cacheControlCount;
          const messagesToCache = payload.messages.slice(-Math.min(remainingSlots, payload.messages.length));

          for (const msg of messagesToCache) {
            if (cacheControlCount >= maxCacheControls) break;
            
            if (Array.isArray(msg?.content) && msg.content.length) {
              // Only cache the last content part of each message to stay within limits
              add(msg.content.at(-1));
              cacheControlCount++;
            } else if (typeof msg?.content === "string") {
              add(msg);
              cacheControlCount++;
            }
          }
        }

        init.body = JSON.stringify(payload);
      }
    } catch {
      // Fail-open: if the body isn't JSON just forward untouched.
    }
    // The upstream implementation already satisfies the `fetch` contract; forward the
    // (potentially patched) request.
    return upstream(input, init);
  }) as typeof fetch;
}
