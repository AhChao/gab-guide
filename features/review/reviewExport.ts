import { ConversationSummary, Message } from '../../types/index';

/**
 * Export content builders for a Review session (moved verbatim out of the page component).
 * `title` is the conversation title, possibly undefined when nothing is active.
 */

/** Full printable HTML report, opened in a new window for Print to PDF. */
export function buildReportHtml(
  title: string | undefined,
  activeSummary: ConversationSummary,
  messages: Message[]
): string {
  return `
    <html>
      <head>
        <title>Gab Guide - Report: ${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print { .no-print { display: none; } body { background: white; } .page-break { page-break-after: always; } }
        </style>
      </head>
      <body class="bg-gray-50 p-8">
        <div class="max-w-4xl mx-auto bg-white p-10 shadow-lg rounded-xl border border-gray-100">
          <div class="flex justify-between items-center mb-10 pb-6 border-b-2 border-blue-600">
            <div>
              <h1 class="text-3xl font-black text-gray-900">Gab Guide Report</h1>
              <p class="text-gray-500 font-medium">Session: ${title}</p>
            </div>
            <div class="text-right text-sm text-gray-400">
              Generated: ${new Date().toLocaleDateString()}<br/>
              ${new Date().toLocaleTimeString()}
            </div>
          </div>

          <section class="mb-12">
            <h2 class="text-xl font-bold text-blue-700 mb-6 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Overall Performance</h2>
            <div class="grid grid-cols-2 gap-8 mb-8">
              <div class="p-5 bg-blue-50 rounded-xl border border-blue-100">
                <h3 class="text-xs font-black text-blue-800 uppercase mb-2">Grammar</h3>
                <p class="text-gray-700 text-sm leading-relaxed">${activeSummary.grammarPerformance}</p>
              </div>
              <div class="p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                <h3 class="text-xs font-black text-indigo-800 uppercase mb-2">Clarity</h3>
                <p class="text-gray-700 text-sm leading-relaxed">${activeSummary.clarityEvaluation}</p>
              </div>
            </div>
            <div class="p-5 bg-gray-50 rounded-xl mb-8 border border-gray-200">
              <h3 class="text-xs font-black text-gray-800 uppercase mb-2">Flow</h3>
              <p class="text-gray-700 text-sm leading-relaxed">${activeSummary.flowAnalysis}</p>
            </div>
            <div>
              <h3 class="text-sm font-bold text-gray-800 mb-4">Strategic Tips:</h3>
              <ul class="space-y-3">
                ${activeSummary.keySuggestions.map(s => `
                  <li class="flex items-start text-sm text-gray-700">
                    <span class="text-blue-600 font-bold mr-2">•</span> ${s}
                  </li>
                `).join('')}
              </ul>
            </div>
          </section>

          <section class="mb-12">
            <h2 class="text-xl font-bold text-indigo-700 mb-6 uppercase tracking-widest border-l-4 border-indigo-600 pl-4">Vocabulary Boosters</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${activeSummary.suggestedVocabulary.map(v => `
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div class="font-bold text-indigo-700 text-base mb-1">${v.phrase}</div>
                  <p class="text-[10px] text-gray-500 mb-2 italic">${v.reason}</p>
                  <p class="text-xs text-indigo-900 border-t border-indigo-50 pt-2"><span class="font-bold">Ex:</span> "${v.example}"</p>
                </div>
              `).join('')}
            </div>
          </section>

          <div class="page-break"></div>

          <section>
            <h2 class="text-xl font-bold text-blue-700 mb-6 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Analysis Details</h2>
            <div class="space-y-8">
              ${messages.map(m => `
                <div class="pb-6 border-b border-gray-100 last:border-0">
                  <div class="flex items-center mb-2">
                    <span class="font-black text-xs uppercase tracking-tighter ${m.role === 'user' ? 'text-blue-600' : 'text-gray-500'}">${m.sender}</span>
                    <span class="mx-2 text-gray-300">•</span>
                    <span class="text-[10px] text-gray-400 font-mono">${m.timestamp}</span>
                  </div>
                  <p class="text-gray-800 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 italic mb-4">"${m.text}"</p>
                  ${m.analysis ? `
                    <div class="ml-6 border-l-2 border-amber-200 pl-4 space-y-4">
                      <div class="flex gap-4">
                        <div class="px-3 py-1 bg-green-50 text-green-700 rounded text-xs font-bold border border-green-100">Score: ${m.analysis.grammarScore}/10</div>
                        <div class="px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">Naturalness: ${m.analysis.naturalnessScore}/10</div>
                      </div>
                      <div>
                        <p class="text-xs font-black text-gray-500 uppercase mb-1">Correction:</p>
                        <p class="text-sm text-blue-800 font-semibold bg-blue-50 p-2 rounded border border-blue-100">"${m.analysis.improvement}"</p>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </section>
          
          <div class="mt-12 pt-6 border-t border-gray-100 text-center text-[10px] text-gray-400 uppercase tracking-widest no-print">
            End of Gab Guide Report
            <button onclick="window.print()" class="block mx-auto mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">Print to PDF</button>
          </div>
        </div>
      </body>
    </html>
  `;
}

/** Plain-text export of the summary (if any) and every message with its correction. */
export function buildTxtExport(
  title: string | undefined,
  summary: ConversationSummary | null,
  messages: Message[]
): string {
  let content = `GAB GUIDE SESSION: ${title || 'Export'}\n`;
  content += "========================================\n\n";

  if (summary) {
    content += "PERFORMANCE SUMMARY\n";
    content += "-------------------\n";
    content += `Grammar: ${summary.grammarPerformance}\n`;
    content += `Clarity: ${summary.clarityEvaluation}\n`;
    content += `Flow: ${summary.flowAnalysis}\n\n`;
    content += "VOCABULARY BOOSTERS\n";
    summary.suggestedVocabulary.forEach(v => {
      content += `- ${v.phrase} (${v.reason}): "${v.example}"\n`;
    });
    content += "\n";
  }

  content += "CONVERSATION DETAILS\n";
  content += "--------------------\n";
  messages.forEach(m => {
    content += `[${m.sender}]: ${m.text}\n`;
    if (m.analysis) {
      content += `  Correction: ${m.analysis.improvement}\n`;
    }
    content += "\n";
  });

  return content;
}
