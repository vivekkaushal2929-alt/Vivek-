/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelEditor from './components/ExcelEditor';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <>
      <ExcelEditor />
      <Toaster position="bottom-right" />
    </>
  );
}
