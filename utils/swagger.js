const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Baatcheet",
      version: "1.0",
    },
    servers: [
      {
        url: "http://localhost:4000/backend/api/v1",
      },
      {
        url:"http://168.144.90.128/backend/api/v1"
      }
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: 'bearer',
          description: "JWT Authorization header using the Bearer scheme",
          bearerFormat: 'JWT'
        },
      },

      responses: {
        400: {
          description: "Bad Request, Validation Errors etc",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "integer", example: 0 },
                  message: { type: "string", example: "Bad Request" },
                  data: { type: "object" },
                },
              },
            },
          },
        },

        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "integer", example: 0 },
                  message: { type: "string", example: "Unauthorized" },
                  data: { type: "object" },
                },
              },
            },
          },
        },
        
        403: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "integer", example: 0 },
                  message: { type: "string", example: "Unauthorized" },
                  data: { type: "object" },
                },
              },
            },
          },
        },


        409: {
          description: "Conflict",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "integer", example: 0 },
                  message: { type: "string", example: "Conflict message" },
                  data: { type: "object" },
                },
              },
            },
          },
        },

        404: {
          description: "Not Found, Not a valid endpoint, Not recognized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "integer", example: 0 },
                  message: { type: "string", example: "Not Found" },
                  data: { type: "object" },
                },
              },
            },
          },
        },

        422: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "number", example: 0 },
                  message: { type: "string", example: "Validation error" },
                },
              },
            },
          },
        },

        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "integer", example: 0 },
                  message: { type: "string", example: "Internal server error" },
                  data: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  },

  apis: ["./Routes/v1/**/*.js", "./schema/**/*.js" ],
};

module.exports = swaggerOptions;
