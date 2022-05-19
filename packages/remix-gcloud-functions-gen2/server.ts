import type { NextFunction } from "express";
import type { AppLoadContext, ServerBuild } from "@remix-run/server-runtime";
import type {
  Request as GcfRequest,
  Response as GcfResponse,
} from "@google-cloud/functions-framework";
import type { Response as NodeResponse } from "@remix-run/node";
import {
  createRequestHandler as createRemixRequestHandler,
  Headers as NodeHeaders,
  Request as NodeRequest,
} from "@remix-run/node";
import {
  // This has been added as a global in node 15+
  AbortController,
} from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export interface GetLoadContextFunction {
  (req: GcfRequest, res: GcfResponse): AppLoadContext;
}

export type RequestHandler = ReturnType<typeof createRequestHandler>;

/**
 * Returns a request handler for Express that serves the response using Remix.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}) {
  const handleRequest = createRemixRequestHandler(build, mode);

  return async (req: GcfRequest, res: GcfResponse, next: NextFunction) => {
    try {
      let abortController = new AbortController();
      let request = createRemixRequest(req, abortController);
      let loadContext =
        typeof getLoadContext === "function"
          ? getLoadContext(req, res)
          : undefined;
      let response = (await handleRequest(
        request as unknown as Request,
        loadContext
      )) as unknown as NodeResponse;
      sendRemixResponse(res, response, abortController);
    } catch (error) {
      // Express doesn't support async functions, so we have to pass along the
      // error manually using next().
      next(error);
    }
  };
}

export function createRemixHeaders(
  requestHeaders: GcfRequest["headers"]
): NodeHeaders {
  let headers = new NodeHeaders();

  for (let [key, values] of Object.entries(requestHeaders)) {
    if (values) {
      if (Array.isArray(values)) {
        for (const value of values) {
          headers.append(key, value);
        }
      } else {
        headers.set(key, values);
      }
    }
  }

  return headers;
}

export function createRemixRequest(
  req: GcfRequest,
  abortController: AbortController
) {
  let origin = `${req.protocol}://${req.get("host")}`;
  let url = new URL(req.url, origin);
  let init = {
    method: req.method,
    headers: createRemixHeaders(req.headers),
    signal:
      abortController === null || abortController === void 0
        ? void 0
        : abortController.signal,
    abortController,
  };

  if (hasBody(req)) {
    (init as { body?: Buffer }).body = createRemixBody(req);
  }

  return new NodeRequest(url.href, init);
}

function sendRemixResponse(
  res: GcfResponse,
  nodeResponse: NodeResponse,
  abortController: AbortController
) {
  res.statusMessage = nodeResponse.statusText;
  res.status(nodeResponse.status);

  for (let [key, values] of Object.entries(nodeResponse.headers.raw())) {
    for (const value of values) {
      res.append(key, value);
    }
  }

  if (abortController.signal.aborted) {
    res.set("Connection", "close");
  }

  if (Buffer.isBuffer(nodeResponse.body) || typeof nodeResponse.body === 'string') {
    res.send(nodeResponse.body);
  } else if (nodeResponse.body?.pipe) {
    nodeResponse.body.on('end', res.end);
    nodeResponse.body.pipe(res);
  } else {
    res.end();
  }
}
/**
 * Google Cloud Functions includes middleware that processes incoming requests based on their headers and sets the request body to
 * a javascript object. But Remix doesn't like that, remix has its own request processing logic, so we have to turn the body back into
 * something that Remix is expecting. In this case a Buffer with URLSearchParams encoded data works.
 *
 * @param req the request passed in from the Google Cloud Function
 */
function createRemixBody(req: GcfRequest): Buffer {
  return Buffer.from(new URLSearchParams(req.body).toString());
}

function hasBody(req: GcfRequest): boolean {
  const body = req.body;
  if (!body) {
    return false;
  }
  for (var x in body) {
    return true;
  }
  return false;
}
