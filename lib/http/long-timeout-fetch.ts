import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";

type NodeHeaders = Record<string, string | string[]>;

const COLLECTED_METHODS = new Set(["GET", "HEAD"]);

const requestHeadersToNodeHeaders = (headers: Headers): NodeHeaders => {
  const map = new Map<string, string[]>();

  headers.forEach((value, key) => {
    const bucket = map.get(key) ?? [];
    bucket.push(value);
    map.set(key, bucket);
  });

  const result: NodeHeaders = {};
  for (const [key, values] of map) {
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
};

export function createLongTimeoutFetch(timeoutMs: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);

    if (request.signal?.aborted) {
      throw new DOMException("This operation was aborted.", "AbortError");
    }

    const url = new URL(request.url);
    const isHttps = url.protocol === "https:";
    const method = request.method ?? "GET";

    const headers = new Headers(request.headers);

    let bodyBuffer: Buffer | undefined;
    if (!COLLECTED_METHODS.has(method)) {
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        bodyBuffer = Buffer.from(arrayBuffer);
        if (!headers.has("content-length")) {
          headers.set("content-length", String(bodyBuffer.length));
        }
      }
    }

    const requestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method,
      headers: requestHeadersToNodeHeaders(headers),
    } as const;

    return await new Promise<Response>((resolve, reject) => {
      const client = isHttps ? httpsRequest : httpRequest;
      const req = client(requestOptions, (res) => {
        const status = res.statusCode ?? 0;
        const statusText = res.statusMessage ?? "";

        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (value === undefined) continue;
          if (Array.isArray(value)) {
            for (const item of value) {
              responseHeaders.append(key, item);
            }
          } else {
            responseHeaders.append(key, value);
          }
        }

        const body = Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>;
        resolve(
          new Response(body, {
            status,
            statusText,
            headers: responseHeaders,
          })
        );
      });

      const abortSignal = request.signal;
      const cleanup = () => {
        if (abortSignal) abortSignal.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        req.destroy(new DOMException("This operation was aborted.", "AbortError"));
        cleanup();
      };

      if (abortSignal) {
        if (abortSignal.aborted) {
          onAbort();
          return;
        }
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });

      req.on("error", (error) => {
        cleanup();
        reject(error);
      });

      req.on("close", cleanup);

      try {
        if (bodyBuffer) {
          req.write(bodyBuffer);
        }
        req.end();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  };
}

