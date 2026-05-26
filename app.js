const nodeConfig = require('./config/nodeConfig');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = require('./utils/swagger');
const swaggerJsdoc = require("swagger-jsdoc");
let bodyParser = require('body-parser');
const app = express();
const routes = require('./Routes/index');
const cors = require('cors');
const { config } = require('./config/nodeConfig');
const morgan = require('morgan');
const helmet = require("helmet");

app.disable('x-powered-by');
app.use(helmet());

// 1. Strict Global Policy (This fixes the Medium alerts for your actual API)
app.use(helmet.contentSecurityPolicy({
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'"],       // NO 'unsafe-inline' here
    "style-src": ["'self'"],        // NO 'unsafe-inline' here
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "font-src": ["'self'"],
    "img-src": ["'self'", "data:"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": [],
  },
}));

// 2. Swagger-Specific Setup (Only in non-prod)
if (process.env.NODE_ENV !== 'prod') {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  app.get('/backend/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Apply a RELAXED CSP only to this specific route so Swagger works
  app.use("/backend/api-docs", 
    helmet.contentSecurityPolicy({
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"], // Allowed ONLY for swagger
        "style-src": ["'self'", "'unsafe-inline'"],  // Allowed ONLY for swagger
      },
    }),
    swaggerUi.serve, 
    swaggerUi.setup(swaggerSpec)
  );
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
let whitelist = config().whitelist;
let corsOptions = {
  origin: (origin, callback) => {
    console.info(origin)
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }, credentials: true
}

app.use(cors(corsOptions));

morgan.token('id', function getId(req) {
  return req.id
});

morgan.token('req', function (req) {
  return JSON.stringify(req.body);
});

let loggerFormat = 'Logger --  :id [:date[web]] ":method :url" :status :response-time :req ';

app.use(morgan(loggerFormat, {
  skip: (req, res) => {
    return res.statusCode >= 400
  },
  stream: process.stdout
}));

app.use(morgan(loggerFormat, {
  skip: (req, res) => {
    return res.statusCode < 400
  },
  stream: process.stderr
}));



app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      status: 0, 
      message: "Invalid JSON payload provided." 
    });
  }
  next();
});

app.enable("trust proxy");


app.use('/backend/api',routes);

// 4. THE "CLEAN 404" FIX
app.use((req, res) => {
  res.status(404).json({
    status: 0,
    message: "Endpoint not found"
  });
});

// 2. THE FIX: Global Error Middleware (Add this last!)
app.use((err, req, res, next) => {
  // We log the FULL error to our server terminal (stderr) for us to debug
  console.error("Internal Error:", err.stack);

  // We send a CLEAN, generic message to the user/ZAP
  res.status(err.status || 500).json({
    status: 0,
    message: "An internal error occurred. Please contact support." 
    // Notice: We do NOT send err.stack or err.message here!
  });
});

const { exec } = require('child_process');
// const { startCronJobs } = require('./services/cronService');

(async function () {
    await new Promise((resolve, reject) => {
        const migrate = exec(
            'sequelize db:migrate',
            { env: process.env },
            err => (err ? reject(err) : resolve())
        );

        // Forward stdout+stderr to this process
        migrate.stdout.pipe(process.stdout);
        migrate.stderr.pipe(process.stderr);
    });
    // startCronJobs();
}());


module.exports = app;