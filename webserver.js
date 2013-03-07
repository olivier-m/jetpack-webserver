/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {components, Cc, Ci} = require("chrome");
const {ByteReader} = require("sdk/io/byte-streams");
const querystring = require("sdk/querystring");

const {nsHttpServer} = require("./httpd");

const PR_UINT32_MAX = Math.pow(2, 32) - 1;

const create = exports.create = function() {
    let server = new nsHttpServer();

    return {
        listen: function(port, callback) {
            let host = "localhost";
            if (typeof(port) === "string" && port.indexOf(":") !== -1) {
                [host, port] = port.split(":");
                port = parseInt(port);
                if (host !== "0.0.0.0") {
                    server.identity.add("http", host, port);
                }
            }

            if (typeof(callback) === "function") {
                this.registerPath("/", callback);
            }

            server._start(port, host);
            return true;
        },
        close: function() {
            server.stop(function() {});
        },
        get host() {
            return server._host;
        },
        get port() {
            return server._port;
        },

        // Extension, not compatible with PhantomJS 1.8 API
        registerPrefix: function(path, callback) {
            server.registerPrefixHandler(path, handler(callback))
        },
        registerPath: function(path, callback) {
            server.registerPathHandler(path, handler(callback))
        }
    };
};

const handler = function(callback) {
    return {
        handle: function(request, response) {
            let req = new HttpRequest(request);
            let res = new HttpResponse(response);

            try {
                callback(req, res);
            } catch(e) {
                if (!res._headersSent) {
                    res.statusCode = 500;
                    res.headers = {
                        "Content-Type": "text/plain"
                    };
                }
                let txt = "An error occured: " + e;
                res.write(txt);
                res.close();
            }
        }
    };
};


const HttpRequest = function(request) {
    // Method
    this.method = request.method;

    // URL
    this.url = request.path;
    if (request.queryString) {
        this.url += "?" + request.queryString;
    }

    // HTTP Version
    this.httpVersion = request.httpVersion;

    // Headers
    this.headers = {};
    let H = request.headers;
    while (H.hasMoreElements()) {
        let h = H.getNext().QueryInterface(Ci.nsISupportsString).data;
        this.headers[h] = request.getHeader(h);
    }

    // Post and Raw Post
    this.post = this.postRaw = null;
    if (this.method == "POST" || this.method == "PUT") {
        let bi = new ByteReader(request.bodyInputStream);
        this.post = this.postRaw = bi.read();

        if (this.post && request.hasHeader("content-type") && request.getHeader("content-type").indexOf("application/x-www-form-urlencoded") == 0) {
            try {
                this.post = querystring.parse(this.post);
            } catch(e) {
                console.exception(e);
            }
        }
    }

    // Extension, not compatible with PhantomJS 1.8 API
    this.path = request.path;
    this.queryString = request.queryString;
    this.get = this.queryString ? querystring.parse(this.queryString) : {};
};


const HttpResponse = function(response) {
    this.headers = {};
    this.statusCode = 200;
    this._response = response;
    this._headersSent = false;
    this._encoding = null;

    response.processAsync();
};

HttpResponse.prototype = {
    setEncoding: function(encoding) {
        this._encoding = encoding;
    },

    header: function(name) {
        if (name in this.headers) {
            return this.headers[name];
        }
        return "";
    },

    setHeader: function(name, value) {
        this.headers[name] = value;
    },

    write: function(data) {
        if (!this._headersSent) {
            this._sendHeaders();
        }

        if (data == "" || !this._encoding) {
            this._response.write(data);
        }
        else if (this._encoding == "binary") {
            let pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
            pipe.init(true, false, 8192, PR_UINT32_MAX, null);

            let binOutput = Cc["@mozilla.org/binaryoutputstream;1"]
                            .createInstance(Ci.nsIBinaryOutputStream);
            binOutput.setOutputStream(pipe.outputStream);
            binOutput.writeBytes(data, data.length);

            this._response.bodyOutputStream.writeFrom(pipe.inputStream, data.length);
        }
        else {
            let pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
            pipe.init(true, false, 8192, PR_UINT32_MAX, null);

            let os = Cc["@mozilla.org/intl/converter-output-stream;1"]
                        .createInstance(Ci.nsIConverterOutputStream);

            os.init(pipe.outputStream, this._encoding, 0, 0x0000);
            os.writeString(data);
            this._response.bodyOutputStream.writeFrom(pipe.inputStream, data.length);
        }
    },

    writeHead: function(statusCode, headers) {
        if (this._headersSent) {
            throw "Headers already sent";
        }
        headers = headers || {};
        this.statusCode = statusCode;
        for (var i in headers) {
            this.headers[i] = headers[i];
        }
        this._sendHeaders();
    },

    close: function() {
        if (!this._headersSent) {
            this._sendHeaders();
            this._response.processAsync();
            this._response.write("");
        }
        this._response.finish();
    },

    closeGracefully: function() {
        this.write("");
        this._response.finish();
    },

    _sendHeaders: function() {
        let desc = httpCode[this.statusCode] || "";
        this._response.processAsync();
        this._response.setStatusLine("1.1", this.statusCode, desc);
        for (let h in this.headers) {
            this._response.setHeader(h, this.headers[h], false);
        }
        this._headersSent = true;
    }
};


const httpCode = {
    "100": "Continue",
    "101":"Switching Protocols",
    "200": "OK",
    "201":"Created",
    "202":"Accepted",
    "203":"Non-Authoritative Information",
    "204":"No Content",
    "205":"Reset Content",
    "206":"Partial Content",
    "300":"Multiple Choices",
    "301":"Moved Permanently",
    "302":"Found",
    "303":"See Other",
    "304":"Not Modified",
    "305":"Use Proxy",
    "307":"Temporary Redirect",
    "400": "Bad Request",
    "401": "Unauthorized",
    "402": "Payment Required",
    "403": "Forbidden",
    "404": "Not Found",
    "405": "Method Not Allowed",
    "406": "Not Acceptable",
    "407": "Proxy Authentication Required",
    "408": "Request Timeout",
    "409": "Conflict",
    "410": "Gone",
    "411": "Length Required",
    "412": "Precondition Failed",
    "413": "Request Entity Too Large",
    "414": "Request-URI Too Long",
    "415": "Unsupported Media Type",
    "417": "Expectation Failed",
    "500": "Internal Server Error",
    "501": "Not Implemented",
    "502": "Bad Gateway",
    "503": "Service Unavailable",
    "504": "Gateway Timeout",
    "505": "HTTP Version Not Supported"
};
