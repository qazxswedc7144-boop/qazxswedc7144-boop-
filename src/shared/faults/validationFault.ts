import { ZodError } from "zod";

export interface FormattedFaultDetail {
  field: string;
  message: string;
}

export interface StructuredValidationFault {
  status: "VALIDATION_ERROR";
  message: string;
  errors: FormattedFaultDetail[];
}

/**
 * Parses and formats strict Zod validation errors into an elegant, localized Arabic/English structure
 */
export function formatZodFault(error: ZodError): StructuredValidationFault {
  const errors: FormattedFaultDetail[] = error.issues.map((err) => {
    const fieldPath = err.path.join(".");
    return {
      field: fieldPath || "root",
      message: err.message
    };
  });

  const summaryMessage = errors.length > 0 
    ? `خطأ في التحقق من صحة البيانات: ${errors.map(e => `[${e.field}]: ${e.message}`).join(" | ")}`
    : "خطأ في التحقق من الحقول المرسلة.";

  return {
    status: "VALIDATION_ERROR",
    message: summaryMessage,
    errors
  };
}
