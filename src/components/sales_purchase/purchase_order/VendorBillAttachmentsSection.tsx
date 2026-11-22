import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Upload,
  Eye,
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  X,
  Paperclip
} from 'lucide-react';
import { VendorBillAttachment } from '../../../types/solar';
import { apiClient } from '../../../services/apiClient';

interface VendorBillAttachmentsSectionProps {
  poId: string;
  bills: VendorBillAttachment[];
  onBillsChange?: (bills: VendorBillAttachment[]) => void;
  readOnly?: boolean;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const MAX_BILL_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTS = ['pdf', 'jpg', 'jpeg', 'png'];
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const formatFileSize = (bytes?: number): string => {
  const n = Number(bytes || 0);
  if (!n || n <= 0) return 'File attached';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const isPdfAttachment = (bill: VendorBillAttachment): boolean => {
  const mime = (bill.mimeType || '').toLowerCase();
  const name = (bill.fileName || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf');
};

export const VendorBillAttachmentsSection: React.FC<VendorBillAttachmentsSectionProps> = ({
  poId,
  bills,
  onBillsChange,
  readOnly = false,
  showToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);
  const [busyBillActionId, setBusyBillActionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [previewState, setPreviewState] = useState<{
    bill: VendorBillAttachment;
    blobUrl: string;
    isPdf: boolean;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (previewState?.blobUrl && previewState.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewState.blobUrl);
      }
    };
  }, [previewState]);

  const closePreview = () => {
    if (previewState?.blobUrl && previewState.blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewState.blobUrl);
    }
    setPreviewState(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mimeOk = ALLOWED_MIMES.includes((file.type || '').toLowerCase());
    const extOk = ALLOWED_EXTS.includes(ext);

    if (!mimeOk && !extOk) {
      const msg = 'Unsupported file format. Only PDF, JPG, JPEG, and PNG files are allowed.';
      setErrorMsg(msg);
      showToast?.(msg, 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size <= 0 || file.size > MAX_BILL_BYTES) {
      const msg = file.size <= 0
        ? 'Selected file is empty.'
        : 'Vendor bill exceeds the 10 MB maximum file size limit.';
      setErrorMsg(msg);
      showToast?.(msg, 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected vendor bill file.'));
        reader.readAsDataURL(file);
      });

      const res = await apiClient.uploadPurchaseOrderBill(poId, {
        fileName: file.name,
        fileData
      });

      // If PO has not been committed to solar_purchase_orders yet (create flow), server returns bill + [bill];
      // merge cleanly with local draft bills instead of losing earlier draft bills.
      let nextBills: VendorBillAttachment[] = res.vendorBills || [];
      if (bills.length > 0 && res.bill) {
        const existingIds = new Set(nextBills.map(b => b.id));
        const merged = [...bills.filter(b => !existingIds.has(b.id)), ...nextBills];
        nextBills = merged;
      }

      onBillsChange?.(nextBills);
      showToast?.(`Vendor bill "${file.name}" uploaded successfully`, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload vendor bill.';
      setErrorMsg(msg);
      showToast?.(msg, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewBill = async (bill: VendorBillAttachment) => {
    if (busyBillActionId) return;
    setErrorMsg(null);
    setBusyBillActionId(bill.id);
    try {
      const { blobUrl, mimeType } = await apiClient.fetchAuthorizedBlobUrl(bill.fileUrl);
      const pdf = mimeType.toLowerCase().includes('pdf') || isPdfAttachment(bill);
      if (previewState?.blobUrl && previewState.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewState.blobUrl);
      }
      setPreviewState({ bill, blobUrl, isPdf: pdf });
    } catch (err: any) {
      const msg = err?.message || 'Could not load vendor bill preview.';
      setErrorMsg(msg);
      showToast?.(msg, 'error');
    } finally {
      setBusyBillActionId(null);
    }
  };

  const handleDownloadBill = async (bill: VendorBillAttachment) => {
    if (busyBillActionId) return;
    setErrorMsg(null);
    setBusyBillActionId(bill.id);
    try {
      const downloadUrl = bill.fileUrl.includes('?')
        ? `${bill.fileUrl}&download=1`
        : `${bill.fileUrl}?download=1`;
      const { blobUrl } = await apiClient.fetchAuthorizedBlobUrl(downloadUrl);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = bill.fileName || 'vendor-bill';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (blobUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to download vendor bill.';
      setErrorMsg(msg);
      showToast?.(msg, 'error');
    } finally {
      setBusyBillActionId(null);
    }
  };

  const handleDeleteBill = async (bill: VendorBillAttachment) => {
    if (readOnly || deletingBillId) return;
    setErrorMsg(null);
    setDeletingBillId(bill.id);
    try {
      const res = await apiClient.deletePurchaseOrderBill(poId, bill.id);
      const nextBills = res.vendorBills && res.vendorBills.length > 0
        ? res.vendorBills
        : bills.filter(b => b.id !== bill.id);
      onBillsChange?.(nextBills);
      showToast?.(`Removed vendor bill "${bill.fileName}"`, 'info');
    } catch (err: any) {
      const msg = err?.message || 'Failed to remove vendor bill.';
      setErrorMsg(msg);
      showToast?.(msg, 'error');
    } finally {
      setDeletingBillId(null);
    }
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-amber-600" />
            <span>Vendor Bill Attachments ({bills.length})</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {readOnly
              ? 'View or download vendor tax invoices and supporting bills stored in MySQL.'
              : 'Attach vendor invoice/bill copies in PDF, JPG, JPEG, or PNG format (max 10 MB per file).'}
          </p>
        </div>

        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{isUploading ? 'Uploading Bill...' : 'Upload Vendor Bill'}</span>
            </button>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {bills.length === 0 ? (
        <div className="p-4 bg-white rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
          No vendor bills attached to this purchase order yet.
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map(bill => {
            const pdf = isPdfAttachment(bill);
            const isBusy = busyBillActionId === bill.id;
            const isDeleting = deletingBillId === bill.id;
            return (
              <div
                key={bill.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      pdf
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}
                  >
                    {pdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate" title={bill.fileName}>
                      {bill.fileName}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-2">
                      <span className="uppercase font-semibold">{pdf ? 'PDF' : 'Image'}</span>
                      <span>•</span>
                      <span>{formatFileSize(bill.fileSize)}</span>
                      {bill.uploadedAt && (
                        <>
                          <span>•</span>
                          <span>{new Date(bill.uploadedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleViewBill(bill)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDownloadBill(bill)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      disabled={isDeleting || isUploading}
                      onClick={() => handleDeleteBill(bill)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-md text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete attached vendor bill"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-app Vendor Bill Preview Modal (PDF or Image) */}
      {previewState && (
        <div
          onClick={closePreview}
          className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">{previewState.bill.fileName}</h4>
                <p className="text-[11px] text-slate-500">
                  {formatFileSize(previewState.bill.fileSize)}
                  {previewState.bill.uploadedBy ? ` • Uploaded by ${previewState.bill.uploadedBy}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadBill(previewState.bill)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-3 min-h-[420px]">
              {previewState.isPdf ? (
                <iframe
                  src={previewState.blobUrl}
                  title={previewState.bill.fileName}
                  className="w-full h-[72vh] rounded-lg bg-white"
                />
              ) : (
                <img
                  src={previewState.blobUrl}
                  alt={previewState.bill.fileName}
                  className="max-h-[72vh] w-auto object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
