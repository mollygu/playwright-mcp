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

const enableInspectorSchema = z.object({
  outputPath: z.string().optional().describe('Optional path to save the recorded code')
});

export default function(captureSnapshot: boolean): Tool<any>[] {
  const enableInspector = defineTool({
    capability: 'core',

    schema: {
      name: 'browser_enable_inspector',
      title: 'Enable inspector',
      description: 'Enable Playwright Inspector for debugging and selector generation',
      inputSchema: enableInspectorSchema,
      type: 'readOnly',
    },

    handle: async (context, params) => {
      const page = context.currentTabOrDie().page;
      const outputPath = params.outputPath || '/tmp/recorded_test.py';

      const browserContext = page.context();
      // Using internal API, might change in future versions
      await (browserContext as any)._enableRecorder({
        language: 'python-pytest',
        mode: 'inspecting',
        outputFile: outputPath
      });

      return {
        resultOverride: {
          content: [{
            type: 'text',
            text: `Playwright Recorder enabled in inspecting mode with Python pytest as target, if enable record, you can get the recorded scripts in output file: ${outputPath}`,
          }]
        },
        code: [],
        captureSnapshot,
        waitForNetwork: false,
      };
    },
  });

  return [enableInspector];
} 