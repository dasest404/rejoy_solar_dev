import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  SalesInvoice,
  VendorSalesInvoice,
  ExpenseRecord,
  TdsEntry
} from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import { buildGstSummary, formatINR, formatDateIN, downloadCsv, round2 } from './accountingUtils';
import { CheckCircle2, FileCheck2, Download, X } from 'lucide-react';

interface GstTaxTabProps {
  workspace: AccountingWorkspace;
  salesInvoices: SalesInvoice[];
  vendorSalesInvoices: VendorSalesInvoice[];
  expenses: ExpenseRecord[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const GstTaxTab: React.FC<GstTaxTabProps> = ({
  workspace,
  salesInvoices,
  vendorSalesInvoices,
  expenses,
  canManage,
  onRefresh,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'SUMMARY' | 'GSTR1' | 'GSTR3B' | 'TDS' | 'EINVOICE'>('SUMMARY');
  const [depositTarget, setDepositTarget] = useState<TdsEntry | null>(null);
  const [challanForm, setChallanForm] = useState({
    challanNo: '',
    bsrCode: '',
    depositDate: new Date().toISOString().slice(0, 10),
    bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || ''
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const gst = useMemo(
    () => buildGstSummary(salesInvoices, vendorSalesInvoices, workspace.vendorBills, expenses),
    [salesInvoices, vendorSalesInvoices, workspace.vendorBills, expenses]
  );

  const tdsTotals = useMemo(() => {
    const deducted = round2(workspace.tdsEntries.filter(t => t.status === 'DEDUCTED').reduce((s, t) => s + t.tdsAmount, 0));
    const deposited = round2(workspace.tdsEntries.filter(t => t.status === 'DEPOSITED').reduce((s, t) => s + t.tdsAmount, 0));
    return { deducted, deposited };
  }, [workspace.tdsEntries]);

  const b2bInvoices = useMemo(
    () =>
      salesInvoices.filter(
        inv => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && (inv.customerGst || '').trim().length >= 10
      ),
    [salesInvoices]
  );

  const handleDepositTds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositTarget || busyId) return;
    setBusyId(depositTarget.id);
    try {
      await apiClient.depositTdsEntry(depositTarget.id, challanForm);
      setDepositTarget(null);
      await onRefresh();
      showToast('TDS challan deposit recorded & posted to ledger.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to deposit TDS challan', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleGenerateIrn = async (invoiceId: string) => {
    setBusyId(invoiceId);
    try {
      await apiClient.generateEinvoiceIrn(invoiceId);
      await onRefresh();
      showToast('E-Invoice IRN and Acknowledgement generated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate IRN', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Output GST Liability</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(gst.outputTotalTax)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Taxable Sales: {formatINR(gst.outputTaxable)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Eligible Input Tax Credit (ITC)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">{formatINR(gst.inputTotalItc)}</div>
          <div className="text-xs text-slate-500 mt-0.5">From Vendor Bills & ITC Expenses</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            {gst.netPayable > 0 ? 'Net GST Cash Payable' : 'ITC Credit Carryforward'}
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${gst.netPayable > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {formatINR(gst.netPayable > 0 ? gst.netPayable : gst.itcCarryForward)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">CGST + SGST + IGST net position</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">TDS Pending Challan</div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${tdsTotals.deducted > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {formatINR(tdsTotals.deducted)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Deposited YTD: {formatINR(tdsTotals.deposited)}</div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'SUMMARY', label: 'GST & ITC Summary' },
              { id: 'GSTR1', label: 'GSTR-1 Outward Supplies' },
              { id: 'GSTR3B', label: 'GSTR-3B Return Summary' },
              { id: 'TDS', label: `TDS Register (${workspace.tdsEntries.length})` },
              { id: 'EINVOICE', label: `E-Invoicing IRN (${b2bInvoices.length})` }
            ] as const
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                subTab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `gst-summary-${new Date().toISOString().slice(0, 10)}`,
              ['Metric', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax'],
              [
                ['Output GST (Sales)', gst.outputTaxable, gst.outputCgst, gst.outputSgst, gst.outputIgst, gst.outputTotalTax],
                ['Input ITC (Purchases)', gst.inputTaxable, gst.inputCgst, gst.inputSgst, gst.inputIgst, gst.inputTotalItc],
                ['Net Payable / (ITC)', 0, 0, 0, 0, gst.netPayable > 0 ? gst.netPayable : -gst.itcCarryForward]
              ]
            )
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Export GST CSV
        </button>
      </div>

      {/* 1. SUMMARY */}
      {subTab === 'SUMMARY' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">GST Component</th>
                <th className="py-3 px-4 text-right">Taxable Value (₹)</th>
                <th className="py-3 px-4 text-right">CGST (₹)</th>
                <th className="py-3 px-4 text-right">SGST (₹)</th>
                <th className="py-3 px-4 text-right">IGST (₹)</th>
                <th className="py-3 px-4 text-right">Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Outward Taxable Supplies (Sales & Vendor Invoices)</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(gst.outputTaxable)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(gst.outputCgst)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(gst.outputSgst)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(gst.outputIgst)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">{formatINR(gst.outputTotalTax)}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-emerald-800">Less: Eligible Input Tax Credit (Bills & Expenses)</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(gst.inputTaxable)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">{formatINR(gst.inputCgst)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">{formatINR(gst.inputSgst)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">{formatINR(gst.inputIgst)}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">{formatINR(gst.inputTotalItc)}</td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
              <tr>
                <td colSpan={5} className="py-3 px-4 text-right text-slate-900">
                  {gst.netPayable > 0 ? 'Net GST Tax Payable in Cash Ledger' : 'Net Unutilized ITC Balance'}
                </td>
                <td className={`py-3 px-4 text-right font-mono tabular-nums ${gst.netPayable > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {formatINR(gst.netPayable > 0 ? gst.netPayable : gst.itcCarryForward)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 2. GSTR-1 */}
      {subTab === 'GSTR1' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">
              GSTR-1 Outward Invoices ({gst.b2bInvoicesCount} B2B · {gst.b2cInvoicesCount} B2C)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Party Name</th>
                  <th className="py-2.5 px-4">GSTIN</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Taxable (₹)</th>
                  <th className="py-2.5 px-4 text-right">GST (₹)</th>
                  <th className="py-2.5 px-4 text-right">Invoice Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesInvoices.filter(i => i.status !== 'CANCELLED' && i.status !== 'DRAFT').map(inv => {
                  const isB2b = (inv.customerGst || '').trim().length >= 10;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="py-2 px-4 font-mono text-slate-600">{formatDateIN(inv.invoiceDate)}</td>
                      <td className="py-2 px-4 font-semibold text-slate-800">{inv.customerName}</td>
                      <td className="py-2 px-4 font-mono text-slate-600">{inv.customerGst || 'URD / B2C'}</td>
                      <td className="py-2 px-4 font-semibold text-slate-700">{isB2b ? 'B2B' : 'B2C'}</td>
                      <td className="py-2 px-4 text-right font-mono tabular-nums">{formatINR(inv.subtotal)}</td>
                      <td className="py-2 px-4 text-right font-mono tabular-nums">{formatINR(inv.taxAmount)}</td>
                      <td className="py-2 px-4 text-right font-mono tabular-nums font-bold">{formatINR(inv.totalAmount)}</td>
                    </tr>
                  );
                })}
                {vendorSalesInvoices.filter(i => i.status !== 'DRAFT').map(vsi => (
                  <tr key={vsi.id} className="hover:bg-slate-50">
                    <td className="py-2 px-4 font-mono font-bold text-slate-900">{vsi.invoiceNumber}</td>
                    <td className="py-2 px-4 font-mono text-slate-600">{formatDateIN(vsi.invoiceDate)}</td>
                    <td className="py-2 px-4 font-semibold text-slate-800">{vsi.vendorName}</td>
                    <td className="py-2 px-4 font-mono text-slate-600">{vsi.vendorGst || 'URD'}</td>
                    <td className="py-2 px-4 font-semibold text-slate-700">Vendor B2B</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums">{formatINR(vsi.subtotal)}</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums">{formatINR(vsi.taxAmount)}</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums font-bold">{formatINR(vsi.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. GSTR-3B */}
      {subTab === 'GSTR3B' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900">GSTR-3B Consolidated Tax Return Computation</h3>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            <div className="p-3 bg-slate-50 font-bold text-slate-700 grid grid-cols-3">
              <span>Table Section</span>
              <span className="text-right">Taxable Value</span>
              <span className="text-right">Tax Amount</span>
            </div>
            <div className="p-3 grid grid-cols-3">
              <span>3.1(a) Outward Taxable Supplies (Other than zero-rated)</span>
              <span className="text-right font-mono">{formatINR(gst.outputTaxable)}</span>
              <span className="text-right font-mono font-semibold">{formatINR(gst.outputTotalTax)}</span>
            </div>
            <div className="p-3 grid grid-cols-3">
              <span>4(A)(5) All Other ITC (Vendor Material Bills & Expenses)</span>
              <span className="text-right font-mono">{formatINR(gst.inputTaxable)}</span>
              <span className="text-right font-mono font-semibold text-emerald-700">{formatINR(gst.inputTotalItc)}</span>
            </div>
            <div className="p-3 grid grid-cols-3 bg-slate-50 font-bold">
              <span>6.1 Payment of Tax (Net Payable / Credit Balance)</span>
              <span className="text-right font-mono">—</span>
              <span className={`text-right font-mono ${gst.netPayable > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {gst.netPayable > 0 ? `Pay ${formatINR(gst.netPayable)}` : `ITC Cr ${formatINR(gst.itcCarryForward)}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. TDS REGISTER */}
      {subTab === 'TDS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Section</th>
                  <th className="py-2.5 px-4">Deductee Party</th>
                  <th className="py-2.5 px-4">Source Ref</th>
                  <th className="py-2.5 px-4">Deduction Date</th>
                  <th className="py-2.5 px-4 text-right">TDS Amount (₹)</th>
                  <th className="py-2.5 px-4">Challan / Deposit</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.tdsEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No TDS deductions recorded yet. Deduct TDS when recording vendor payments.
                    </td>
                  </tr>
                ) : (
                  workspace.tdsEntries.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{t.section}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{t.partyName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{t.sourceNumber || t.sourceId}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{formatDateIN(t.deductionDate)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatINR(t.tdsAmount)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {t.challanNo ? `${t.challanNo} (${formatDateIN(t.depositDate)})` : 'Pending Challan'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`font-semibold ${t.status === 'DEPOSITED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {canManage && t.status === 'DEDUCTED' && (
                          <button
                            type="button"
                            onClick={() => setDepositTarget(t)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
                          >
                            Record Challan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. E-INVOICING */}
      {subTab === 'EINVOICE' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Customer & GSTIN</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Total (₹)</th>
                  <th className="py-2.5 px-4">IRN / Ack No</th>
                  <th className="py-2.5 px-4">E-Invoice Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {b2bInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No B2B invoices with valid customer GSTIN found for E-Invoice IRN generation.
                    </td>
                  </tr>
                ) : (
                  b2bInvoices.map(inv => {
                    const generated = inv.einvoiceStatus === 'GENERATED' && Boolean(inv.einvoiceIrn);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-800">{inv.customerName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{inv.customerGst}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{formatDateIN(inv.invoiceDate)}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">{formatINR(inv.totalAmount)}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 max-w-xs truncate">
                          {generated ? `${inv.einvoiceIrn?.slice(0, 22)}... (Ack ${inv.einvoiceAckNo})` : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`font-semibold inline-flex items-center gap-1 ${generated ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {generated && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {generated ? 'GENERATED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {canManage && !generated && (
                            <button
                              type="button"
                              disabled={busyId === inv.id}
                              onClick={() => handleGenerateIrn(inv.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              {busyId === inv.id ? 'Generating...' : 'Generate IRN'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TDS CHALLAN MODAL */}
      {depositTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Record TDS Challan 281 Deposit</h3>
              <button type="button" onClick={() => setDepositTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleDepositTds} className="p-5 space-y-3">
              <div className="text-xs text-slate-600">
                Party: <strong>{depositTarget.partyName}</strong> ({depositTarget.section}) · Amount:{' '}
                <strong className="font-mono">{formatINR(depositTarget.tdsAmount)}</strong>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Challan Serial # *</label>
                  <input
                    type="text"
                    required
                    value={challanForm.challanNo}
                    onChange={e => setChallanForm({ ...challanForm, challanNo: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">BSR Code</label>
                  <input
                    type="text"
                    value={challanForm.bsrCode}
                    onChange={e => setChallanForm({ ...challanForm, bsrCode: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Date *</label>
                  <input
                    type="date"
                    required
                    value={challanForm.depositDate}
                    onChange={e => setChallanForm({ ...challanForm, depositDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account *</label>
                  <select
                    required
                    value={challanForm.bankAccountId}
                    onChange={e => setChallanForm({ ...challanForm, bankAccountId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    {workspace.bankAccounts.filter(b => b.isActive).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDepositTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === depositTarget.id}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Deposit & Post JV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
