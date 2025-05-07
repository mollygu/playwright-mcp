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
import { defineTool, type ToolFactory } from './tool.js';

const htmlSnippet: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',

  schema: {
    name: 'browser_take_html_snippet',
    title: 'HTML snapshot',
    description: 'HTML snapshot by retrieving the simplified HTML content of the current page',
    inputSchema: z.object({
      ref: z.string().describe('Exact target element reference from the page snapshot').optional(),
      filterTags: z.array(z.string()).describe('List of HTML tag names to filter out from the result. Default removes meta, script, style, and link tags.').optional(),
      targetSelector: z.string().describe('CSS, XPath, or text selector to target specific parts of the page (e.g. "#main-content", "//article", ":text(\'Results\')"). Has priority over ref parameter.').optional(),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const page = tab.page;

    let html: string;
    // Flag to track if we're getting HTML for a specific element (not full page)
    const isTargetedElement = !!(params.targetSelector || params.ref);

    // Priority: targetSelector > ref > full page
    if (params.targetSelector) {
      // Use the provided selector to extract content
      try {
        const element = await page.$(params.targetSelector);
        if (element) {
          html = await element.evaluate((el: Element) => el.outerHTML);
        } else {
          return {
            code: [`// No elements matched the selector: ${params.targetSelector}`],
            captureSnapshot,
            waitForNetwork: false,
            resultOverride: {
              content: [{ type: 'text', text: `No elements matched the selector: ${params.targetSelector}` }],
            }
          };
        }
      } catch (error: any) {
        return {
          code: [`// Error using selector "${params.targetSelector}": ${error.message}`],
          captureSnapshot,
          waitForNetwork: false,
          resultOverride: {
            content: [{ type: 'text', text: `Error using selector "${params.targetSelector}": ${error.message}` }],
          }
        };
      }
    } else if (params.ref) {
      // Get HTML of a specific element using ref
      try {
        // In the original implementation, it used a refLocator
        // We're simulating that functionality
        const handle = await page.$(params.ref);
        if (!handle) {
          return {
            code: [`// Element with ref ${params.ref} not found`],
            captureSnapshot,
            waitForNetwork: false,
            resultOverride: {
              content: [{ type: 'text', text: `Element with ref ${params.ref} not found` }],
            }
          };
        }
        html = await handle.evaluate((el: Element) => el.outerHTML);
      } catch (error: any) {
        return {
          code: [`// Error getting element with ref "${params.ref}": ${error.message}`],
          captureSnapshot,
          waitForNetwork: false,
          resultOverride: {
            content: [{ type: 'text', text: `Error getting element with ref "${params.ref}": ${error.message}` }],
          }
        };
      }
    } else {
      // Get HTML of the entire page
      html = await page.content();
    }

    // Filter out specified tags
    const defaultTagsToFilter = ['meta', 'script', 'style', 'link'];
    const tagsToFilter = (!params.filterTags || params.filterTags.length === 0) ? defaultTagsToFilter : params.filterTags;

    if (tagsToFilter.length > 0) {
      html = await page.evaluate(
        ({ htmlContent, tags, isTargetedElement }: { htmlContent: string, tags: string[], isTargetedElement: boolean }) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');

          // Filter out each specified tag
          for (const tag of tags) {
            const elements = doc.getElementsByTagName(tag);
            // Remove elements from last to first to avoid index shifting
            for (let i = elements.length - 1; i >= 0; i--) {
              const element = elements[i];
              element.parentNode?.removeChild(element);
            }
          }

          // When targeting a specific element, avoid returning the full document structure
          if (isTargetedElement) {
            // Get the first element in the body which should be our targeted element
            const body = doc.body;
            if (body.children.length > 0) {
              return body.children[0].outerHTML;
            }
            return body.innerHTML; // Fallback
          }

          // Return serialized HTML for full page
          return doc.documentElement.outerHTML;
        },
        { htmlContent: html, tags: tagsToFilter, isTargetedElement }
      );
    }

    // Format the HTML for better readability
    const formattedHtml = await page.evaluate(
      ({ htmlContent }: { htmlContent: string }) => {
        // Function to format HTML with proper indentation
        function formatHTML(html: string): string {
          let formatted = '';
          let indent = '';

          // Helper function to get appropriate indent
          const getIndent = () => {
            let result = '';
            for (let i = 0; i < indent.length; i++) {
              result += ' ';
            }
            return result;
          };

          // Parse the HTML into a document
          const doc = new DOMParser().parseFromString(html, 'text/html');

          // Function to process a node recursively
          function processNode(node: Node, level: number): void {
            indent = '  '.repeat(level);

            if (node.nodeType === 3) { // Text node
              const text = node.textContent?.trim() || '';
              if (text) {
                formatted += getIndent() + text + '\n';
              }
            } else if (node.nodeType === 1) { // Element node
              const tagName = node.nodeName.toLowerCase();

              // Opening tag
              formatted += getIndent() + '<' + tagName;

              // Attributes
              const element = node as Element;
              Array.from(element.attributes).forEach((attr: Attr) => {
                formatted += ' ' + attr.name + '="' + attr.value + '"';
              });

              if (node.childNodes.length === 0) {
                // Self-closing tag
                formatted += ' />\n';
              } else {
                formatted += '>\n';

                // Process children
                Array.from(node.childNodes).forEach(child => {
                  processNode(child, level + 1);
                });

                // Closing tag
                formatted += getIndent() + '</' + tagName + '>\n';
              }
            }
          }

          // Process the document element (for full page) or the body's first child (for targeted elements)
          // Check if our HTML might be a fragment (not full document structure)
          if (!html.trim().startsWith("<html") && doc.body.children.length > 0) {
            processNode(doc.body.children[0], 0);
          } else if (doc.documentElement) {
            processNode(doc.documentElement, 0);
          }

          return formatted;
        }

        return formatHTML(htmlContent);
      },
      { htmlContent: html }
    );

    // Generate code representation - we add this to match the tool pattern
    const code = [
      `// Get HTML content from the current page`,
    ];

    // Return result with formatted HTML
    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      resultOverride: {
        content: [{ type: 'text', text: '```html\n' + formattedHtml + '```' }],
      }
    };
  },
});

export default (captureSnapshot: boolean) => [
  htmlSnippet(captureSnapshot),
]; 