import type {
  VendorSalesDiscountType,
  VendorSalesLineItem,
  VendorSalesSupplyType
} from '../types/solar';

export const INDIAN_GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh'
};

export function roundCurrency(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function extractStateCodeFromGstin(gstin?: string): string {
  const clean = String(gstin || '').trim().toUpperCase();
  if (/^\d{2}[A-Z0-9]{13}$/.test(clean) || /^\d{2}[A-Z]{5}\d{4}/.test(clean)) {
    const code = clean.slice(0, 2);
    if (INDIAN_GST_STATE_CODES[code]) return code;
  }
  return '';
}

export function resolveStateNameAndCode(stateName?: string, gstin?: string, addressFallback?: string): {
  stateName: string;
  stateCode: string;
} {
  const codeFromGst = extractStateCodeFromGstin(gstin);
  const rawState = String(stateName || '').trim();

  if (rawState) {
    const lower = rawState.toLowerCase();
    for (const [code, canonical] of Object.entries(INDIAN_GST_STATE_CODES)) {
      if (lower === canonical.toLowerCase() || lower.includes(canonical.toLowerCase())) {
        return { stateName: canonical, stateCode: code };
      }
    }
    return { stateName: rawState, stateCode: codeFromGst };
  }

  if (codeFromGst && INDIAN_GST_STATE_CODES[codeFromGst]) {
    return { stateName: INDIAN_GST_STATE_CODES[codeFromGst], stateCode: codeFromGst };
  }

  if (addressFallback) {
    const addrLower = addressFallback.toLowerCase();
    for (const [code, canonical] of Object.entries(INDIAN_GST_STATE_CODES)) {
      if (addrLower.includes(canonical.toLowerCase())) {
        return { stateName: canonical, stateCode: code };
      }
    }
  }

  return { stateName: '', stateCode: '' };
}

export function determineVendorSupplyType(params: {
  companyState?: string;
  companyGst?: string;
  companyAddress?: string;
  vendorState?: string;
  vendorGst?: string;
  vendorAddress?: string;
}): {
  supplyType: VendorSalesSupplyType;
  companyStateName: string;
  companyStateCode: string;
  vendorStateName: string;
  vendorStateCode: string;
} {
  const company = resolveStateNameAndCode(
    params.companyState,
    params.companyGst,
    params.companyAddress
  );
  const effectiveCompanyState = company.stateName || 'Chhattisgarh';
  const effectiveCompanyCode = company.stateCode || '22';

  const vendor = resolveStateNameAndCode(
    params.vendorState,
    params.vendorGst,
    params.vendorAddress
  );

  let supplyType: VendorSalesSupplyType = 'INTRA_STATE';
  if (vendor.stateCode && effectiveCompanyCode) {
    supplyType = vendor.stateCode === effectiveCompanyCode ? 'INTRA_STATE' : 'INTER_STATE';
  } else if (vendor.stateName && effectiveCompanyState) {
    supplyType =
      vendor.stateName.trim().toLowerCase() === effectiveCompanyState.trim().toLowerCase()
        ? 'INTRA_STATE'
        : 'INTER_STATE';
  }

  return {
    supplyType,
    companyStateName: effectiveCompanyState,
    companyStateCode: effectiveCompanyCode,
    vendorStateName: vendor.stateName || effectiveCompanyState,
    vendorStateCode: vendor.stateCode || ''
  };
}

export interface LineItemDraftInput {
  id?: string;
  productId?: string;
  description: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discountType?: VendorSalesDiscountType;
  discountValue?: number;
  gstRate: number;
}

export function computeVendorSalesLineItem(
  input: LineItemDraftInput,
  supplyType: VendorSalesSupplyType
): VendorSalesLineItem {
  const quantity = Math.max(0, Number(input.quantity) || 0);
  const rate = Math.max(0, Number(input.rate) || 0);
  const gstRate = Math.min(100, Math.max(0, Number(input.gstRate) || 0));
  const discountType: VendorSalesDiscountType = input.discountType === 'FLAT' ? 'FLAT' : 'PERCENT';
  const rawDiscountVal = Math.max(0, Number(input.discountValue) || 0);

  const lineGross = roundCurrency(quantity * rate);
  const discountValue = discountType === 'PERCENT' ? Math.min(100, rawDiscountVal) : Math.min(lineGross, rawDiscountVal);
  const discountAmount =
    discountType === 'FLAT'
      ? roundCurrency(Math.min(lineGross, discountValue))
      : roundCurrency((lineGross * discountValue) / 100);

  const taxableAmount = roundCurrency(Math.max(0, lineGross - discountAmount));

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (supplyType === 'INTER_STATE') {
    igstRate = gstRate;
    igstAmount = roundCurrency((taxableAmount * igstRate) / 100);
  } else {
    cgstRate = roundCurrency(gstRate / 2);
    sgstRate = roundCurrency(gstRate / 2);
    cgstAmount = roundCurrency((taxableAmount * cgstRate) / 100);
    sgstAmount = roundCurrency((taxableAmount * sgstRate) / 100);
  }

  const taxAmount = roundCurrency(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = roundCurrency(taxableAmount + taxAmount);

  return {
    id: input.id || `vsli-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    productId: input.productId || undefined,
    description: String(input.description || '').trim(),
    hsnCode: String(input.hsnCode || '').trim(),
    quantity,
    unit: String(input.unit || 'NOS').trim() || 'NOS',
    rate,
    discountType,
    discountValue,
    discountAmount,
    taxableAmount,
    gstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    taxAmount,
    totalAmount
  };
}

export function computeVendorSalesInvoiceTotals(
  items: LineItemDraftInput[],
  supplyType: VendorSalesSupplyType
) {
  const computedItems = items.map(item => computeVendorSalesLineItem(item, supplyType));
  const grossAmount = roundCurrency(
    computedItems.reduce((sum, it) => sum + roundCurrency(it.quantity * it.rate), 0)
  );
  const discountAmount = roundCurrency(
    computedItems.reduce((sum, it) => sum + it.discountAmount, 0)
  );
  const subtotal = roundCurrency(
    computedItems.reduce((sum, it) => sum + it.taxableAmount, 0)
  );
  const cgstAmount = roundCurrency(
    computedItems.reduce((sum, it) => sum + it.cgstAmount, 0)
  );
  const sgstAmount = roundCurrency(
    computedItems.reduce((sum, it) => sum + it.sgstAmount, 0)
  );
  const igstAmount = roundCurrency(
    computedItems.reduce((sum, it) => sum + it.igstAmount, 0)
  );
  const taxAmount = roundCurrency(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = roundCurrency(subtotal + taxAmount);

  return {
    items: computedItems,
    grossAmount,
    discountAmount,
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    totalAmount
  };
}
