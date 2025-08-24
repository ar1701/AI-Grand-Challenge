const dotenv = require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT
const apiKey = process.env.GEMINI_API_KEY
const {generateContent} = require("./utils/codeAnalysis.js")
const fs = require('fs')

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));


const sampleCode = fs.readFileSync("sample.txt", "utf8")
// console.log(sampleCode)



app.post("/code-block", async (req,res)=>{
    try {
        const {codeBlock} = req.body;

        const response = await generateContent(codeBlock);

        return res.json({
            "success": true,
            "result": response
        });
    } catch (error) {
        console.error("Error in /code-block:", error);
        return res.status(500).json({
            "success": false,
            "error": "Failed to analyze code"
        });
    }
})
app.get('/', (req,res)=>{
    res.json("Hello, this is an express server !")
})

app.listen(port, (req, res)=>{
    console.log(`Server Started: http://localhost:${port}`)
})

