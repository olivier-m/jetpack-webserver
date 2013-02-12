const {Request} = require("request");

const webserver = require("webserver");

var server = webserver.create();
var server_port = 5001;
var server_host = "localhost";

var req = function(path, callback) {
    return require("request").Request({
        onComplete: callback,
        url: "http://" + server_host + ":" + server_port + path
    })
};

//
// Server and handlers
//
server.listen(server_port, function(request, response) {
    response.writeHead(200, {
        "Content-Type": "text/plain"
    });
    response.write("test");
    response.close();
});

server.registerPrefix('/echo/', function(request, response) {
    response.writeHead(200, {
        "Content-Type": "application/json"
    });
    response.write(JSON.stringify(request));
    response.close();
});

server.registerPath('/raise', function(request, response) {
    throw "Ooooops, error";
});


//
// Tests
//
exports["test basic"] = function(assert, done) {
    req("/", function(response) {
        assert.equal(response.status, 200);
        assert.equal(response.headers['Content-Type'], "text/plain");
        done();
    }).get();
};

exports["test status"] = function(assert, done) {
    req("/foo", function(response) {
        assert.equal(response.status, 404);
        done();
    }).get();
};

exports["test echo"] = function(assert, done) {
    let r = req("/echo/", function(response) {
        assert.equal(response.status, 200);
        assert.equal(response.headers["Content-Type"], "application/json");
        assert.equal(response.json.path, '/echo/');
        assert.equal(response.json.headers["x-test"], "foo");
        done();
    });
    r.headers['X-Test'] = 'foo';
    r.get();
};

exports["test echo get"] = function(assert, done) {
    req("/echo/?foo=1&bar=2&bar=chapi%20chapo", function(response) {
        assert.equal(response.status, 200);
        assert.equal(response.headers["Content-Type"], "application/json");
        assert.equal(response.json.path, '/echo/');
        assert.equal(response.json.queryString, 'foo=1&bar=2&bar=chapi%20chapo');
        assert.equal(response.json.get.foo, 1);
        assert.equal(response.json.get.bar[0], 2);
        assert.equal(response.json.get.bar[1], "chapi chapo");
        done();
    }).get();
};

exports["test echo post"] = function(assert, done) {
    let r = req("/echo/foo", function(response) {
        assert.equal(response.status, 200);
        assert.equal(response.headers["Content-Type"], "application/json");
        assert.equal(response.json.method, 'POST');
        assert.equal(response.json.path, '/echo/foo');
        assert.equal(response.json.postRaw, 'foo=1');
        assert.equal(response.json.post.foo, '1');
        done();
    });
    r.content = "foo=1";
    r.post();
};

exports["test echo raw post"] = function(assert, done) {
    let r = req("/echo/foo", function(response) {
        assert.equal(response.status, 200);
        assert.equal(response.headers["Content-Type"], "application/json");
        assert.equal(response.json.method, 'POST');
        assert.equal(response.json.path, '/echo/foo');
        assert.equal(response.json.postRaw, 'content');
        assert.equal(response.json.post, 'content');
        done();
    });
    r.headers['content-type'] = 'text/plain';
    r.content = "content";
    r.post();
};

exports["test error"] = function(assert, done) {
    req("/raise", function(response) {
        assert.equal(response.status, 500);
        assert.equal(response.text, "An error occured: Ooooops, error");
        done();
    }).get();
};

require("test").run(exports);
