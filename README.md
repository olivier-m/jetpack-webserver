Jetpack Webserver
=================

Jetpack Webserver is an HTTP server for Mozilla Addon-SDK.

Installation
------------

Jetpack net-log is a Mozilla Addon-SDK package (not an extension). Just copy this repository to the `packages` directory of your extension or package. Then, add the following line in your `package.json` file:

```js
{
  //...
  "dependencies": ["webserver"]
}
```

Usage
-----

Webserver provides a `create` function that returns an object containing this properties:

### listen(port, [callback])

Starts the server on `port`. If `callback` is a function, the root (/) URL will answer with this callback.

### close()

Stop the server.

### port

Return the port the server is listening on.

### registerPrefix(path, callback)

Register a path prefix. **Path should ends with /**. Every URL starting with `path` will answer request with the provided `callback`.

### registerPath(path, callback)

Register a `callback` for a provided `path`.


Callback function
-----------------

A callback function receives two arguments: `request` and `response`.

### request

Request contains the request performed by the client. It contains this properties:

 * `method`: Defines the request method (`'GET'`, `'POST'`, etc.)
 * `url`: The path part and query string part (if any) of the request URL
 * `httpVersion`: The actual HTTP version
 * `headers`: All of the HTTP headers as key-value pairs
 * `post`: The request body (only for `'POST'` and `'PUT'` method requests)
 * `postRaw`: The raw post data. If the `Content-Type` header is set to `'application/x-www-form-urlencoded'` (the default for form submissions), `post` will be automatically updated with a URL-decoded version of the data.
 * `path`: The request path
 * `queryString`: The complete (raw) queryString
 * `get`: An object containing URL-decoded version of `queryString`.

## response

The `response` object should be used to create the response using the following properties and functions:

 * `headers`: Stores all HTTP headers as key-value pairs. These must be set **BEFORE** calling `write` for the first time.
 * `statusCode`: Sets the returned HTTP status code.
 * `write(data)`: Sends a chunk for the response body. Can be called multiple times.
 * `writeHead(statusCode, headers)`: Sends a response header to the request. The status code is a 3-digit HTTP status code (e.g. `404`). The last argument, headers, are the response headers. Optionally one can give a human-readable `headers` collection as the second argument.
 * `close()`: Closes the HTTP connection.

To avoid the client detecting a connection drop, remember to use `write()` at least once.Sending an empty string (i.e. `response.write('')`) would be enough if the only aim is, for example, to return an HTTP status code of `200` (`"OK"`).


Example
-------

```js
"use strict"

const {webserver} = require("webserver");

var server = webserver.create();

server.listen(8000, function(request, response) {
    // Simple / response
    response.writeHead(200, {
        "Content-Type": "text/plain";
    });
    response.write("test");
    response.close();
});

server.registerPrefix("/echo/", function(request, response) {
    // Simple echo response
    response.headers["Content-Type"] = "application/json";
    response.write(JSON.stringify(request, null, "  "));
    response.close();
});
```
