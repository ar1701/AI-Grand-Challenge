"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanSingleFileWithBackend = scanSingleFileWithBackend;
exports.orchestrateSecurityAnalysis = orchestrateSecurityAnalysis;
exports.scanProjectWithBackend = scanProjectWithBackend;
var vscode = require("vscode");
/**
 * Scans a single block of code.
 * Used for the "Scan Active File" command.
 */
function scanSingleFileWithBackend(filename, content) {
    return __awaiter(this, void 0, void 0, function () {
        var baseUrl, endpoint, res, jsonResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    baseUrl = vscode.workspace.getConfiguration().get("secureScan.backendUrl");
                    if (!baseUrl)
                        throw new Error("Backend URL not configured");
                    endpoint = "".concat(baseUrl, "/code-block");
                    return [4 /*yield*/, fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ filename: filename, codeBlock: content })
                        })];
                case 1:
                    res = _a.sent();
                    if (!res.ok) {
                        throw new Error("Backend error ".concat(res.status));
                    }
                    return [4 /*yield*/, res.json()];
                case 2:
                    jsonResponse = (_a.sent());
                    if (jsonResponse.success && jsonResponse.result) {
                        return [2 /*return*/, { entries: jsonResponse.result.entries || [] }];
                    }
                    else {
                        throw new Error(jsonResponse.error || "Invalid response format from single file scan");
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Performs comprehensive security analysis using multi-agent orchestration.
 * Used for the "Security Analysis" command.
 */
function orchestrateSecurityAnalysis(goal, projectPath) {
    return __awaiter(this, void 0, void 0, function () {
        var baseUrl, endpoint, res, errorBody, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    baseUrl = vscode.workspace.getConfiguration().get("secureScan.backendUrl");
                    if (!baseUrl)
                        throw new Error("Backend URL not configured");
                    endpoint = "".concat(baseUrl, "/orchestrate");
                    console.log("\uD83C\uDF10 Making orchestration request to: ".concat(endpoint));
                    console.log("\uD83D\uDCC1 Project path: ".concat(projectPath));
                    console.log("\uD83C\uDFAF Goal: ".concat(goal.substring(0, 100), "..."));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ goal: goal, projectPath: projectPath })
                        })];
                case 2:
                    res = _a.sent();
                    console.log("\uD83D\uDCE1 Response status: ".concat(res.status));
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text()];
                case 3:
                    errorBody = _a.sent();
                    console.error("\u274C Orchestration error response:", errorBody);
                    throw new Error("Backend error ".concat(res.status, ": ").concat(errorBody));
                case 4: return [4 /*yield*/, res.json()];
                case 5:
                    result = _a.sent();
                    console.log("\u2705 Received orchestration response:", result);
                    return [2 /*return*/, result];
                case 6:
                    error_1 = _a.sent();
                    console.error("\uD83D\uDEA8 Orchestration error:", error_1);
                    throw error_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Scans an entire project by sending file paths to the backend.
 * Used for the "Scan Entire Project" command.
 */
function scanProjectWithBackend(filePaths) {
    return __awaiter(this, void 0, void 0, function () {
        var baseUrl, endpoint, res, errorBody, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    baseUrl = vscode.workspace.getConfiguration().get("secureScan.backendUrl");
                    if (!baseUrl)
                        throw new Error("Backend URL not configured");
                    endpoint = "".concat(baseUrl, "/analyze-multiple-files");
                    console.log("\uD83C\uDF10 Making request to: ".concat(endpoint));
                    console.log("\uD83D\uDCC1 Sending ".concat(filePaths.length, " file paths:"), filePaths);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ filePaths: filePaths })
                        })];
                case 2:
                    res = _a.sent();
                    console.log("\uD83D\uDCE1 Response status: ".concat(res.status));
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text()];
                case 3:
                    errorBody = _a.sent();
                    console.error("\u274C Backend error response:", errorBody);
                    throw new Error("Backend error ".concat(res.status, ": ").concat(errorBody));
                case 4: return [4 /*yield*/, res.json()];
                case 5:
                    result = _a.sent();
                    console.log("\u2705 Received response:", result);
                    return [2 /*return*/, result];
                case 6:
                    error_2 = _a.sent();
                    console.error("\uD83D\uDEA8 Network/fetch error:", error_2);
                    throw error_2;
                case 7: return [2 /*return*/];
            }
        });
    });
}
