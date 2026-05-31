// server/middleware/validate.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { sanitizeObject } from "../../src/shared/security/sanitize";
import { formatZodFault } from "../../src/shared/faults/validationFault";

/**
 * Express middleware to sanitize and validate request body details using schemas and sanitization layers.
 */
export function validateRequestBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Deep sanitization of the input payload to secure against Injection
      if (req.body) {
        req.body = sanitizeObject(req.body);
      }

      // 2. Schema parse and validation
      const parsedData = schema.parse(req.body);
      
      // Update body with verified parsings
      req.body = parsedData;

      next();
      return;
    } catch (err) {
      if (err instanceof ZodError) {
        const structuredErrors = formatZodFault(err);
        return res.status(400).json(structuredErrors);
      }

      return res.status(500).json({
        error: "SERVER_VALIDATION_FAILURE",
        message: "An error occurred while validating the request payload."
      });
    }
  };
}
