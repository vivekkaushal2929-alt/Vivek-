# Agent Instructions

## Document Data Extraction Rules
- **E.NO. Extraction (PRIORITIZED)**: **ALWAYS** extract the `E.NO.` value **ONLY** from the prefix/title of the uploaded file or the folder name (if inside a ZIP).
  - Handle prefix: Strip everything up to and including the last hyphen to get the number (e.g., from `Visa application files - E23827656646978`, extract `E23827656646978`).
- **STRICT PROHIBITION**: **NEVER** extract the `E.NO.` from the document content (e.g., work permit numbers, barcodes, or text inside the PDF). Ignore any number inside the document that looks like an E.NO.
- **Data Schema & Mapping Logic**:
  - `NAME`: Extract from "Surname" and "First Names" on Page 1 of the Visa Application Form. Cross-check with the Passport scan.
  - `passport no.`: Extract from the Work Permit (AVIZUL DE MUNCĂ) or the Passport scan.
  - `SE.NO.`: Extract from the numeric code in Field 274 (top right) on Page 1 of the Visa Application Form.
  - `APPOINTMENT DATE`: Always leave this field completely blank.
  - `COMPANY NAME`: Extract the Employer name from the Work Permit or Job Offer.
  - `post code`: Extract ONLY the 6-digit numerical "COR" code from the Work Permit (e.g., 931302, 711402, 522303). This is specifically the "COR" code, NOT a standard postal code.

## Workspace Configuration
- Default capacity: 100 rows.
- Supported imports: `.pdf`, `.zip`.
- Sorting: Final workspace display should favor alphabetical sorting by NAME.
