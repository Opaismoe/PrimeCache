export interface HttpStatusInfo {
  name: string
  description: string
  mdnUrl: string
}

export const HTTP_STATUS_CODES: Record<number, HttpStatusInfo> = {
  // 1xx Informational
  100: { name: 'Continue', description: 'The server has received the request headers and the client should proceed to send the request body.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/100' },
  101: { name: 'Switching Protocols', description: 'The requester has asked the server to switch protocols and the server has agreed.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/101' },
  102: { name: 'Processing', description: 'The server has received and is processing the request, but no response is available yet.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/102' },
  103: { name: 'Early Hints', description: 'Used to return some response headers before final HTTP message.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/103' },

  // 2xx Success
  200: { name: 'OK', description: 'The request succeeded.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/200' },
  201: { name: 'Created', description: 'The request succeeded and a new resource was created.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201' },
  202: { name: 'Accepted', description: 'The request has been accepted for processing, but the processing has not been completed.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/202' },
  203: { name: 'Non-Authoritative Information', description: 'The request was successful but the enclosed payload has been modified.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/203' },
  204: { name: 'No Content', description: 'The request succeeded but there is no content to return.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204' },
  206: { name: 'Partial Content', description: 'The server is delivering only part of the resource due to a range header.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206' },

  // 3xx Redirection
  301: { name: 'Moved Permanently', description: 'The URL of the requested resource has been changed permanently.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/301' },
  302: { name: 'Found', description: 'The URI of the requested resource has been changed temporarily.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302' },
  303: { name: 'See Other', description: 'The response can be found under another URI using the GET method.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303' },
  304: { name: 'Not Modified', description: 'The response has not been modified; the client can use the cached version.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304' },
  307: { name: 'Temporary Redirect', description: 'The request should be repeated with another URI, keeping the same method.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307' },
  308: { name: 'Permanent Redirect', description: 'The request and all future requests should be repeated using another URI.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308' },

  // 4xx Client Errors
  400: { name: 'Bad Request', description: 'The server cannot process the request due to a client error (malformed syntax, invalid request message framing, or deceptive request routing).', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400' },
  401: { name: 'Unauthorized', description: 'The request lacks valid authentication credentials for the target resource.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401' },
  403: { name: 'Forbidden', description: 'The server understood the request but refuses to authorize it.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403' },
  404: { name: 'Not Found', description: 'The server cannot find the requested resource.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404' },
  405: { name: 'Method Not Allowed', description: 'The request method is known by the server but is not supported by the target resource.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405' },
  408: { name: 'Request Timeout', description: 'The server would like to shut down this unused connection.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/408' },
  409: { name: 'Conflict', description: 'The request conflicts with the current state of the server.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409' },
  410: { name: 'Gone', description: 'The target resource is no longer available and this condition is likely to be permanent.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/410' },
  422: { name: 'Unprocessable Content', description: 'The request was well-formed but contains semantic errors.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422' },
  429: { name: 'Too Many Requests', description: 'The user has sent too many requests in a given amount of time (rate limiting).', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429' },

  // 5xx Server Errors
  500: { name: 'Internal Server Error', description: 'The server has encountered a situation it does not know how to handle.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500' },
  501: { name: 'Not Implemented', description: 'The request method is not supported by the server and cannot be handled.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/501' },
  502: { name: 'Bad Gateway', description: 'The server, while acting as a gateway, received an invalid response from the upstream server.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502' },
  503: { name: 'Service Unavailable', description: 'The server is not ready to handle the request, commonly due to maintenance or overload.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503' },
  504: { name: 'Gateway Timeout', description: 'The server, while acting as a gateway, did not get a response in time from the upstream server.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504' },
  505: { name: 'HTTP Version Not Supported', description: 'The HTTP version used in the request is not supported by the server.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/505' },
  507: { name: 'Insufficient Storage', description: 'The server is unable to store the representation needed to complete the request.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/507' },
  508: { name: 'Loop Detected', description: 'The server detected an infinite loop while processing the request.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/508' },
  510: { name: 'Not Extended', description: 'Further extensions to the request are required for the server to fulfill it.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/510' },
  511: { name: 'Network Authentication Required', description: 'The client needs to authenticate to gain network access.', mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/511' },
}
