import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedData {
  'SR NO.': number;
  'NAME': string;
  'E.NO.': string;
  'passport no.': string;
  'SE.NO.': string;
  'APPOINTMENT DATE': string;
  'COMPANY NAME': string;
  'post code': string;
}

async function fileToGenerativePart(file: File) {
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64Data,
      mimeType: file.type
    },
  };
}

export async function extractDataFromPDF(files: File | File[], contextName?: string): Promise<ExtractedData> {
  const fileArray = Array.isArray(files) ? files : [files];
  
  // CRITICAL RULE (Memorized): ALWAYS extract E.NO. from the contextName (ZIP/File) or path.
  const referenceFile = fileArray[0];
  const fullPath = referenceFile.name;
  const pathParts = fullPath.split('/');
  const filename = pathParts[pathParts.length - 1];
  
  // Potential sources for E.No.
  let rawENo = "";
  if (contextName) {
    // Priority 1: The uploaded filename (ZIP or primary PDF)
    rawENo = contextName.replace(/\.[^/.]+$/, "");
  } else if (pathParts.length > 1) {
    // Priority 2: Folder name from path
    rawENo = pathParts[pathParts.length - 2];
  } else {
    // Priority 3: Filename prefix
    rawENo = filename.replace(/\.[^/.]+$/, "");
  }

  // Clean E.NO.: Remove common prefixes like "Visa application files - "
  // and handle format like "Visa application files - E23827656646978"
  // Also strip any surrounding brackets [ ] or ( )
  const eNo = rawENo
    .split('-').pop()?.trim() // Get the last part after any hyphen (e.g., after "Visa application files -")
    ?.replace(/^\[|\]$|^\(|\)$/g, "")
    .trim() || rawENo;

  try {
    const fileParts = await Promise.all(fileArray.map(fileToGenerativePart));
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [
          ...fileParts,
          { text: `You are an expert Document Data Extraction Assistant. Your sole job is to extract specific data fields from the provided document(s) which all belong to one single individual.

STRICT EXTRACTION RULES:
1. EXCLUSIVITY: Only use data from these documents.
2. FIELD MAPPING LOGIC:
   - NAME: Extract from "Surname" and "First Names" on the Visa Application Form Page 1. Cross-check with Passport. Format as "SURNAME GIVEN_NAMES".
   - PASSPORT_NO: Extract from "AVIZUL DE MUNCĂ" (Work Permit) nr. section or the Passport scan.
   - SE_NO: Extract the numeric code after "SE" from the barcode zone (top right) on Page 1 of the Visa Application Form. (Note: digits may be separated by spaces in OCR, e.g., "2 3 4 5" -> "2345").
   - COMPANY_NAME: Extract the Employer name from "AVIZUL DE MUNCĂ" or Section 20 of the Visa form. (e.g., IMOB NORVACON SRL).
   - POST_CODE: Extract ONLY the 6-digit numerical "COR" code from the Work Permit (e.g., 931302, 711402, 522303). This is NOT a geographic zip code or a standard address zip code. It is found in the "COR" (Clasificarea Ocupațiilor din România) section of the Work Permit.
   - APPOINTMENT_DATE: Always leave blank.
   - SR_NO: Leave empty unless specified.
   - E_NO: Provided externally but included in output for structural integrity.

IMPORTANT: DO NOT extract any E.NO. from the document content; it is provided externally as "${eNo}". Provide the result in the specified JSON array format containing exactly one object for this individual.` }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              SR_NO: { type: Type.STRING, description: "Leave empty unless specified" },
              NAME: { type: Type.STRING },
              E_NO: { type: Type.STRING },
              PASSPORT_NO: { type: Type.STRING },
              SE_NO: { type: Type.STRING },
              APPOINTMENT_DATE: { type: Type.STRING, description: "Always empty" },
              COMPANY_NAME: { type: Type.STRING },
              POST_CODE: { type: Type.STRING, description: "6 digit COR code only" }
            },
            required: ["SR_NO", "NAME", "E_NO", "PASSPORT_NO", "SE_NO", "APPOINTMENT_DATE", "COMPANY_NAME", "POST_CODE"]
          }
        }
      }
    });

    const results = JSON.parse(response.text || "[]");
    const result = results[0] || {};

    return {
      'SR NO.': 0,
      'NAME': result.NAME || '',
      'E.NO.': eNo,
      'passport no.': result.PASSPORT_NO || '',
      'SE.NO.': result.SE_NO || '',
      'APPOINTMENT DATE': '',
      'COMPANY NAME': result.COMPANY_NAME || '',
      'post code': result.POST_CODE || ''
    };
  } catch (error) {
    console.error("Extraction error:", error);
    // Fallback to empty structure if AI fails
    return {
      'SR NO.': 0,
      'NAME': 'ERROR_EXTRACTING',
      'E.NO.': eNo,
      'passport no.': '',
      'SE.NO.': '',
      'APPOINTMENT DATE': '',
      'COMPANY NAME': '',
      'post code': ''
    };
  }
}
