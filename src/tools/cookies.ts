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
import path from 'path';
import fs from 'fs/promises';

const saveCookiesSchema = z.object({
  cookiesPath: z.string().describe('The path to save the cookies.json file'),
});

export default function(captureSnapshot: boolean): Tool<any>[] {
  const saveCookies = defineTool({
    capability: 'core',

    schema: {
      name: 'browser_save_cookies',
      title: 'Save cookies',
      description: 'Save the cookies to a file',
      inputSchema: saveCookiesSchema,
      type: 'readOnly',
    },

    handle: async (context, params) => {
      try {
        const page = context.currentTabOrDie().page;
        const cookies = await page.context().cookies();

        const savedCookiesPath = path.resolve(params.cookiesPath);
        await fs.writeFile(savedCookiesPath, JSON.stringify(cookies, null, 2));

        return {
          resultOverride: {
            content: [{
              type: 'text',
              text: `Cookies saved to ${savedCookiesPath}`,
            }]
          },
          code: [],
          captureSnapshot,
          waitForNetwork: false,
        };
      } catch (err) {
        return {
          resultOverride: {
            content: [{
              type: 'text',
              text: `Failed to save cookies: ${err}`,
            }]
          },
          code: [],
          captureSnapshot,
          waitForNetwork: false,
        };
      }
    },
  });

  return [saveCookies];
} 