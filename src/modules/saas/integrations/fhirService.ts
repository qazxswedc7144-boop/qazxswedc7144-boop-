export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

export interface FHIRBundle extends FHIRResource {
  resourceType: "Bundle";
  type: "transaction" | "message" | "collection";
  entry: Array<{
    fullUrl?: string;
    resource: FHIRResource;
  }>;
}

export class FHIRService {
  /**
   * Transforms a local Patient/Customer database model into a FHIR R4 Patient resource.
   */
  static transformToFHIRPatient(customer: any): FHIRResource {
    return {
      resourceType: "Patient",
      id: customer.id || `pat-${Math.random().toString(36).substring(4, 10)}`,
      active: true,
      name: [
        {
          use: "official",
          text: customer.name || "مريض غير معروف",
          family: customer.name?.split(' ').pop() || "",
          given: customer.name?.split(' ').slice(0, -1) || ["مريض"]
        }
      ],
      telecom: [
        {
          system: "phone",
          value: customer.phone || "000-0000000",
          use: "mobile"
        }
      ],
      gender: customer.gender === "FEMALE" ? "female" : "male",
      managingOrganization: {
        reference: "Organization/pharmaflow-main-branch",
        display: "صيدلية فارما فلو برو"
      }
    };
  }

  /**
   * Transforms sales/prescription item records to FHIR MedicationRequest resource.
   */
  static transformToFHIRMedicationRequest(item: any, customer: any, product: any): FHIRResource {
    const requestId = `mr-${item.id || Math.random().toString(36).substring(4, 10)}`;
    return {
      resourceType: "MedicationRequest",
      id: requestId,
      status: "completed",
      intent: "order",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
              code: "community",
              display: "Community Dispense"
            }
          ]
        }
      ],
      medicationCodeableConcept: {
        coding: [
          {
            system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            code: product?.barcode || "GENERIC_DRUG",
            display: product?.name || item.name || "دواء غير معرف"
          }
        ],
        text: product?.name || item.name || "دواء غير معرف"
      },
      subject: {
        reference: `Patient/${customer?.id || 'anonymous'}`,
        display: customer?.name || "عميل مبيعات نقدي"
      },
      authoredOn: item?.date || new Date().toISOString(),
      dosageInstruction: [
        {
          sequence: 1,
          text: item?.notes || "تناول الدواء حسب إرشادات الطبيب والصيدلي",
          timing: {
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: "d"
            }
          }
        }
      ],
      dispenseRequest: {
        quantity: {
          value: Number(item.quantity || item.qty || 1),
          unit: "box"
        }
      }
    };
  }

  /**
   * Parses an incoming FHIR MedicationRequest from a hospital system (e.g. Al-Mouwasat, Dallah)
   * and translates it into a PharmaFlow unified purchase draft or draft order.
   */
  static parseHospitalPrescription(fhirResource: FHIRResource): any {
    if (fhirResource.resourceType !== "MedicationRequest") {
      throw new Error(`Unsupported FHIR Resource Type: ${fhirResource.resourceType}. Expected MedicationRequest.`);
    }

    const patientRef = fhirResource.subject?.display || "مريض محوّل من المستشفى";
    const medName = fhirResource.medicationCodeableConcept?.text || "دواء موصوف طبيًا";
    const qty = fhirResource.dispenseRequest?.quantity?.value || 1;
    const barcode = fhirResource.medicationCodeableConcept?.coding?.[0]?.code || "";
    const instructions = fhirResource.dosageInstruction?.[0]?.text || "";

    return {
      id: fhirResource.id,
      patientName: patientRef,
      medicineName: medName,
      quantity: Number(qty),
      barcode: barcode,
      instructions: instructions,
      rawResource: fhirResource,
      source: "HOSPITAL_EMR_INTEGRATION",
      status: "PENDING_DISPENSE"
    };
  }

  /**
   * Bundles list of resources into an HL7 FHIR Message Bundle transaction
   */
  static createFHIRBundle(resources: FHIRResource[], type: "transaction" | "message" | "collection" = "collection"): FHIRBundle {
    return {
      resourceType: "Bundle",
      id: `bundle-${Math.random().toString(36).substring(4, 12)}`,
      type,
      entry: resources.map(res => ({
        fullUrl: `urn:uuid:${res.id}`,
        resource: res
      }))
    };
  }
}
