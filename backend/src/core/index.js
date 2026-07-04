"use strict";var _express = _interopRequireDefault(require("express"));
var _cors = _interopRequireDefault(require("cors"));
var _path = _interopRequireDefault(require("path"));
var _http = require("http");
var _expressWs = _interopRequireDefault(require("express-ws"));
var _router = require("./router");
var _middleware = require("./middleware");
var _mongo = require("../utils/database/mongo");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

process.loadEnvFile(_path.default.resolve(process.cwd(), '.env'));

const app = (0, _express.default)();
const httpServer = (0, _http.createServer)(app);
const wsInstance = (0, _expressWs.default)(app, httpServer);

app.use(_express.default.json({ limit: '50mb' }));
app.use(_middleware.loggerMiddleware);
app.use((0, _cors.default)({
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use("/storage", _express.default.static("./storage"));

// WebSocket setup handled by express-ws

(0, _router.registerRoutes)(app);

(0, _mongo.connectDB)().then(() => {
  httpServer.listen(Number.parseInt(process.env.PORT || '5000'), () => {
    console.log(`[omnistudia] running on ${process.env.VITE_BACKEND_URL}`);
  });
});