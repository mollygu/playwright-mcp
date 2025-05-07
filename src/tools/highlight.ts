/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from 'zod';
import { defineTool, type Tool } from './tool.js';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

export default function(captureSnapshot: boolean): Tool<any>[] {
  const highlight = defineTool({
    capability: 'core',

    schema: {
      name: 'browser_highlight',
      title: 'Highlight element',
      description: 'Highlight an element on a web page',
      inputSchema: elementSchema,
      type: 'readOnly',
    },

    handle: async (context, params) => {
      const tab = context.currentTabOrDie();
      
      const code = [
        `// Highlight element "${params.element}"`,
        `await page.locator('${params.ref}').highlight();`,
      ];

      const action = async () => {
        const locator = tab.snapshotOrDie().refLocator(params.ref);
        await locator.highlight();
        
        return {
          content: [{
            type: 'text' as const,
            text: `"${params.element}" highlighted on the page`
          }]
        };
      };

      return {
        code,
        action,
        captureSnapshot,
        waitForNetwork: false,
      };
    },
  });

  return [highlight];
} 