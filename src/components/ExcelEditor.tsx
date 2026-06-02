import React, { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { 
  Plus, 
  Download, 
  Trash2, 
  Upload, 
  FileSpreadsheet, 
  X,
  FileUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { exportToExcel, parseExcelFile, ExcelData } from '@/lib/excel';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { extractDataFromPDF } from '@/services/geminiService';

export default function ExcelEditor() {
  const [data, setData] = useState<ExcelData[]>(() => {
    // Start with 100 empty rows
    const emptyRows: ExcelData[] = [];
    for (let i = 0; i < 100; i++) {
      emptyRows.push({
        'SR NO.': i + 1,
        'NAME': '',
        'E.NO.': '',
        'passport no.': '',
        'SE.NO.': '',
        'APPOINTMENT DATE': '',
        'COMPANY NAME': '',
        'post code': ''
      });
    }
    return emptyRows;
  });
  const [fileName, setFileName] = useState('Chaudhary_Ajay_Details.xlsx');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  const handleCellChange = (rowIndex: number, column: string, value: string) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [column]: value };
    setData(newData);
  };

  const addRow = () => {
    const newRow: ExcelData = {};
    columns.forEach((col) => {
      newRow[col] = '';
    });
    // If no columns exist, add a default one
    if (columns.length === 0) {
      newRow['Column 1'] = '';
    }
    setData([...data, newRow]);
  };

  const removeRow = (index: number) => {
    const newData = data.filter((_, i) => i !== index);
    setData(newData);
  };

  const addColumn = () => {
    const columnName = prompt('Enter column name:');
    if (columnName && !columns.includes(columnName)) {
      const newData = data.map((row) => ({ ...row, [columnName]: '' }));
      if (newData.length === 0) {
        setData([{ [columnName]: '' }]);
      } else {
        setData(newData);
      }
    } else if (columnName) {
      toast.error('Column already exists or invalid name');
    }
  };

  const removeColumn = (columnName: string) => {
    const newData = data.map((row) => {
      const newRow = { ...row };
      delete newRow[columnName];
      return newRow;
    });
    setData(newData);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const parsedData = await parseExcelFile(file);
        setData(parsedData);
        setFileName(file.name);
        toast.success('File uploaded successfully');
      } catch (error) {
        toast.error('Failed to parse Excel file');
        console.error(error);
      }
    }
  };

  const handleBulkPDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    
    const newEntries: ExcelData[] = [];
    const batchesToProcess: { name: string, files: File[] }[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          const zipFiles = Object.values(contents.files);
          const internalFiles: File[] = [];
          
          for (const zipEntry of zipFiles) {
            if (!zipEntry.dir && zipEntry.name.toLowerCase().endsWith('.pdf')) {
              const blob = await zipEntry.async('blob');
              // We preserve the full path so geminiService can extract E.NO. from folder
              const pdfFile = new File([blob], zipEntry.name, { type: 'application/pdf' });
              internalFiles.push(pdfFile);
            }
          }
          if (internalFiles.length > 0) {
            batchesToProcess.push({ name: file.name, files: internalFiles });
          }
        } else if (file.name.toLowerCase().endsWith('.pdf')) {
          batchesToProcess.push({ name: file.name, files: [file] });
        }
      }

      const totalBatches = batchesToProcess.length;
      if (totalBatches === 0) {
        toast.error('No valid PDF content found to process');
        setIsProcessing(false);
        return;
      }

      for (let i = 0; i < totalBatches; i++) {
        const batch = batchesToProcess[i];
        // Send all files for this batch (individual or ZIP) at once
        const extracted = await extractDataFromPDF(batch.files, batch.name);
        newEntries.push({
          ...extracted,
          'SR NO.': data.length + i + 1
        });
        setProcessingProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      const combinedData = [...data.filter(row => row.NAME), ...newEntries];
      combinedData.sort((a, b) => {
        const nameA = String(a.NAME || '').toLowerCase();
        const nameB = String(b.NAME || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Update SR NO. after sorting
      const sortedWithSR = combinedData.map((row, index) => ({
        ...row,
        'SR NO.': index + 1
      }));

      // Pad back to 100 rows if needed
      const finalData = [...sortedWithSR];
      for (let i = finalData.length; i < Math.max(100, data.length); i++) {
        finalData.push({
          'SR NO.': i + 1,
          'NAME': '',
          'E.NO.': '',
          'passport no.': '',
          'SE.NO.': '',
          'APPOINTMENT DATE': '',
          'COMPANY NAME': '',
          'post code': ''
        });
      }

      setData(finalData);
      toast.success(`Successfully processed ${totalBatches} candidates`);
    } catch (error) {
      toast.error('Error processing bulk files');
      console.error(error);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };
  const handleExport = () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    exportToExcel(data, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
    toast.success('Excel file exported');
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] p-4 md:p-8 font-sans text-[#141414]">
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-[#E4E3E0] p-8 rounded-lg shadow-2xl max-w-md w-full space-y-6 text-center">
              <div className="relative w-24 h-24 mx-auto">
                <Loader2 className="w-24 h-24 animate-spin text-[#141414]" />
                <div className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold">
                  {processingProgress}%
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif italic">Processing Bulk Files</h3>
                <p className="text-sm opacity-60 font-mono">
                  Extracting data from PDFs and ZIP archives using AI. Accuracy is being maintained through schema validation...
                </p>
              </div>
              <div className="w-full bg-[#141414]/10 h-1 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-[#141414] h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${processingProgress}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-8"
      >
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-6 h-6" />
              <span className="font-mono text-xs uppercase tracking-widest opacity-50">ExcelCraft / Editor</span>
            </div>
            <h1 className="text-4xl font-serif italic tracking-tight">Spreadsheet Workspace</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              className="border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] relative overflow-hidden"
              disabled={isProcessing}
            >
              <FileUp className="w-4 h-4 mr-2" />
              Bulk Import (PDF/ZIP)
              <input
                type="file"
                multiple
                accept=".pdf,.zip"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleBulkPDFUpload}
              />
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </div>
            <Button 
              onClick={handleExport}
              className="bg-[#141414] text-[#E4E3E0] hover:bg-[#333] transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export XLSX
            </Button>
            <Button 
              onClick={() => {
                setData([{
                  'SR NO.': 1,
                  'NAME': '',
                  'E.NO.': '',
                  'passport no.': '',
                  'SE.NO.': '',
                  'APPOINTMENT DATE': '',
                  'COMPANY NAME': '',
                  'post code': ''
                }]);
                setFileName('NewSpreadsheet.xlsx');
                toast.info('Workspace cleared');
              }}
              variant="outline" 
              className="border-[#141414] hover:bg-red-500 hover:text-white transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1 space-y-6">
            <Card className="bg-transparent border-[#141414] shadow-none rounded-none">
              <CardHeader className="p-4 border-b border-[#141414]">
                <CardTitle className="text-sm font-mono uppercase tracking-wider">File Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase opacity-50">Filename</label>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="bg-transparent border-[#141414] rounded-none focus-visible:ring-0"
                  />
                </div>
                <div className="pt-4 space-y-2">
                  <Button 
                    onClick={addColumn} 
                    variant="outline" 
                    className="w-full border-[#141414] rounded-none hover:bg-[#141414] hover:text-[#E4E3E0]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Column
                  </Button>
                  <Button 
                    onClick={addRow} 
                    variant="outline" 
                    className="w-full border-[#141414] rounded-none hover:bg-[#141414] hover:text-[#E4E3E0]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Row
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 border border-dashed border-[#141414] opacity-50">
              <p className="text-[10px] font-mono leading-relaxed">
                TIP: YOU CAN IMPORT EXISTING XLSX FILES TO EDIT THEM. EXPORTING WILL GENERATE A NEW FILE WITH ALL CURRENT CHANGES.
              </p>
            </div>
          </aside>

          <main className="lg:col-span-3">
            <div className="border border-[#141414] bg-white overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-[#141414]">
                    <TableRow className="hover:bg-transparent border-b border-[#141414]">
                      <TableHead className="w-12 text-[#E4E3E0] font-mono text-[10px] uppercase text-center border-r border-[#E4E3E0]/20">#</TableHead>
                      {columns.map((col) => (
                        <TableHead key={col} className="text-[#E4E3E0] font-mono text-[10px] uppercase group relative min-w-[150px] border-r border-[#E4E3E0]/20">
                          <div className="flex items-center justify-between">
                            <span>{col}</span>
                            <button 
                              onClick={() => removeColumn(col)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {data.map((row, rowIndex) => (
                        <motion.tr
                          key={rowIndex}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors border-b border-[#141414]"
                        >
                          <TableCell className="text-center font-mono text-xs border-r border-[#141414]/10 group-hover:border-[#E4E3E0]/20">
                            {rowIndex + 1}
                          </TableCell>
                          {columns.map((col) => (
                            <TableCell key={col} className="p-0 border-r border-[#141414]/10 group-hover:border-[#E4E3E0]/20">
                              <input
                                value={row[col] || ''}
                                onChange={(e) => handleCellChange(rowIndex, col, e.target.value)}
                                className="w-full h-full p-3 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#141414] group-hover:focus:ring-[#E4E3E0] font-mono text-sm"
                              />
                            </TableCell>
                          ))}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {data.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={columns.length + 1} className="h-32 text-center text-muted-foreground font-serif italic">
                          No data available. Add a row to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </main>
        </div>
      </motion.div>
    </div>
  );
}
