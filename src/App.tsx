/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApiKeyGuard } from './components/ApiKeyGuard';
import { ImageExpander } from './components/ImageExpander';

export default function App() {
  return (
    <ApiKeyGuard>
      <ImageExpander />
    </ApiKeyGuard>
  );
}

