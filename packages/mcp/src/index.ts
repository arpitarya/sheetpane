// @sheetpane/mcp (W-39): the server's message handler and its tools, for embedding or testing;
// `sheetpane-mcp` (bin.ts) runs it over stdio.
export { handle, LATEST, SUPPORTED, SERVER_INFO, type Request, type Response } from './protocol.js';
export { TOOLS, callTool, inspectWorkbook, draftRules, checkRules, explainCode, findSkill, guessHeaderRow, type Tool, type ToolResult } from './tools.js';
export { describeApi } from './api.js';
