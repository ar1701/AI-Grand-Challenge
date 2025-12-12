const axios = require('axios');

async function testAnalyzeEndpoint() {
  try {
    console.log('Testing /analyze-multiple-files endpoint...');
    
    const response = await axios.post('http://localhost:8080/analyze-multiple-files', {
      filePaths: [
        '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend/utils/response.js'
      ]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
      console.error('Status:', error.response.status);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test with empty body
async function testEmptyBody() {
  try {
    console.log('Testing with empty body...');
    
    const response = await axios.post('http://localhost:8080/analyze-multiple-files', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Unexpected success:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Expected error response:', error.response.data);
      console.log('Status:', error.response.status);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test with invalid JSON
async function testInvalidRequest() {
  try {
    console.log('Testing with no Content-Type...');
    
    const response = await axios.post('http://localhost:8080/analyze-multiple-files', 
      'invalid data',
      {
        headers: {
          'Content-Type': 'text/plain'
        }
      }
    );
    
    console.log('Unexpected success:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Expected error response:', error.response.data);
      console.log('Status:', error.response.status);
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function runTests() {
  await testEmptyBody();
  console.log('---');
  await testInvalidRequest();
  console.log('---');
  await testAnalyzeEndpoint();
}

runTests();