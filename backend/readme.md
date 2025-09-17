# AI-Powered Vulnerability Scanner Backend

![Node.js](https://img.shields.io/badge/Node.js-18.x-blue?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-green?style=for-the-badge&logo=express)
![Redis](https://img.shields.io/badge/Redis-6.x-red?style=for-the-badge&logo=redis)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

This project is a high-performance backend service for a smart code vulnerability scanner, designed to be the engine for a VS Code extension or other developer tools. It leverages large language models (LLMs) to perform deep, context-aware security analysis of source code.

## About The Project

The goal of this backend is to provide an expert-level security audit on demand. Instead of relying on traditional static analysis tools that use fixed rules, this service uses a sophisticated prompt to instruct powerful AI models (from Google and OpenAI) to act as elite cybersecurity experts, finding a wide range of vulnerabilities with detailed explanations and remediation advice.

## Key Features

-   **Dual AI Engine Support**: Seamlessly switch between **Google Gemini** and **OpenAI GPT** models via a simple configuration setting.
-   **Intelligent Redis Caching**: Drastically reduces response time and API costs by caching analysis results. It uses a **SHA-256 content hash** as the key, ensuring that any file modification triggers a fresh analysis.
-   **Asynchronous Job Queue**: A robust, production-ready API model that uses a job queue. This allows the client (e.g., a VS Code extension) to remain responsive and not freeze while waiting for long-running analysis tasks.
-   **Secure and Robust**: The API is protected with **API Key Authentication** and includes **server-side rate limiting** to prevent abuse.
-   **Advanced Error Handling**: Features fail-fast startup logic and timeouts for all external services (Redis, AI APIs) to ensure the server remains stable and never hangs.
-   **Automatic Batching**: A `TokenManager` class intelligently batches multiple files to respect the context window limits of the AI models.

## Technology Stack

-   **Backend**: Node.js, Express.js
-   **AI Integration**: `@google/genai`, `openai`
-   **Caching**: Redis
-   **Environment Management**: `dotenv`

---

## Getting Started

Follow these steps to set up and run the project locally for development.

### Prerequisites

-   **Node.js**: Version 18.x or later.
-   **Docker**: The recommended way to run a local Redis instance. (Alternatively, you can install Redis natively).
-   **API Keys**: You will need API keys from Google AI (for Gemini) and/or OpenAI.

### Setup and Installation

1.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Start the Redis Server**
    The easiest way is with Docker. This command will start a Redis container in the background.
    ```bash
    docker run -d -p 6379:6379 --name vulnerability-scanner-redis redis
    ```

4.  **Create and Configure the Environment File**
    Create a `.env` file in the root of the project by copying the example:
    ```bash
    cp .env.example .env
    ```
    Now, open the `.env` file and add your configuration details.

    **`.env` file contents:**
    ```env
    # --- Server Configuration ---
    PORT=8080

    # --- API Keys ---
    # Your secret key to protect the API. Generate a secure random string for this.
    API_KEY=your_super_secret_api_key_here
    GEMINI_API_KEY=your_google_gemini_api_key
    OPENAI_API_KEY=sk-your_openai_api_key

    # --- Engine Selection ---
    # Choose which AI model to use. Options: "gemini" or "openai"
    ANALYSIS_ENGINE=openai

    # --- Redis Configuration ---
    REDIS_URL=redis://127.0.0.1:6379
    ```

5.  **Run the Server**
    ```bash
    npm start
    ```
    The server should now be running, connected to Redis, and ready to accept requests at `http://localhost:8080`.

---

## API Usage

For complete details on endpoints, payloads, and response formats, please refer to the **`API_DOCS.md`** file.

Here is a quick example of how to test the synchronous endpoint using `cURL`:

```bash
curl -X POST http://localhost:8080/analyze-multiple-files \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_super_secret_api_key_here" \
  -d '{
    "filePaths": [
      "/path/to/your/file.js"
    ]
  }'
```

-   **First Request (Cache Miss)**: This will take ~50 seconds as it calls the AI model.
-   **Second Request (Cache Hit)**: This will return a response in milliseconds, served directly from the Redis cache.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.