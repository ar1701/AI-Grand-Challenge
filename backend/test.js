
import fs from "fs";
import tokenManager from "./utils/tokenManager.js"


const text = fs.readFileSync("./utils/response.js", "utf-8");

const tokenCount = await tokenManager.countTokens(text);
console.log("Token count for response.js:", tokenCount);

