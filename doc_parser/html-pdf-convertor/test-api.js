const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:3000';
const TEST_HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>API Test Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2196F3; }
        p { line-height: 1.6; }
        .test-section { 
            background-color: #f5f5f5; 
            padding: 15px; 
            border-left: 4px solid #2196F3;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>HTML to PDF API Test</h1>
    
    <div class="test-section">
        <h2>Test Section 1</h2>
        <p>This is a test document to verify the HTML to PDF conversion API.</p>
        <p>Current timestamp: ${new Date().toISOString()}</p>
    </div>
    
    <div class="test-section">
        <h2>Test Section 2</h2>
        <p>The API should properly render all HTML elements and CSS styling.</p>
        <ul>
            <li>Test item 1</li>
            <li>Test item 2</li>
            <li>Test item 3</li>
        </ul>
    </div>
</body>
</html>
`;

/**
 * Test the direct PDF conversion endpoint
 */
async function testDirectConversion() {
    console.log('Testing direct PDF conversion...');
    
    try {
        const response = await fetch(`${API_URL}/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ html: TEST_HTML })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Check if the response is a PDF
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
            throw new Error(`Expected PDF but got ${contentType}`);
        }
        
        // Save the PDF to a file
        const buffer = await response.buffer();
        const outputPath = path.join(__dirname, 'test-direct.pdf');
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`✅ Direct conversion successful! PDF saved to: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`❌ Direct conversion failed: ${error.message}`);
        return false;
    }
}

/**
 * Test the Google Drive upload endpoint
 */
async function testDriveUpload() {
    console.log('Testing Google Drive upload...');
    
    try {
        const response = await fetch(`${API_URL}/api/convert-and-upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                html: TEST_HTML,
                fileName: `api-test-${Date.now()}.pdf`
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(`API reported failure: ${result.message || 'Unknown error'}`);
        }
        
        console.log(`✅ Drive upload successful!`);
        console.log(`   File name: ${result.file.name}`);
        console.log(`   View link: ${result.file.viewLink}`);
        console.log(`   Download link: ${result.file.downloadLink}`);
        return true;
    } catch (error) {
        console.error(`❌ Drive upload failed: ${error.message}`);
        return false;
    }
}

/**
 * Test the local storage endpoint
 */
async function testLocalStorage() {
    console.log('Testing local storage conversion...');
    
    try {
        const response = await fetch(`${API_URL}/api/convert-local`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                html: TEST_HTML,
                fileName: `local-test-${Date.now()}.pdf`
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(`API reported failure: ${result.message || 'Unknown error'}`);
        }
        
        console.log(`✅ Local storage successful!`);
        console.log(`   File name: ${result.file.name}`);
        console.log(`   Download URL: ${result.file.downloadUrl}`);

        // Test if the file is downloadable
        const downloadResponse = await fetch(result.file.downloadUrl);
        if (!downloadResponse.ok) {
            throw new Error(`Download failed! Status: ${downloadResponse.status}`);
        }
        
        console.log(`   Download test: ✅ Successful`);
        return true;
    } catch (error) {
        console.error(`❌ Local storage test failed: ${error.message}`);
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('Starting API tests...');
    
    let directResult = false;
    let driveResult = false;
    let localResult = false;
    
    try {
        directResult = await testDirectConversion();
        localResult = await testLocalStorage();
        driveResult = await testDriveUpload();
    } catch (error) {
        console.error('Unexpected error during tests:', error);
    }
    
    console.log('\nTest Summary:');
    console.log(`Direct Conversion: ${directResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Local Storage: ${localResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Drive Upload: ${driveResult ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Overall: ${directResult && driveResult && localResult ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Run the tests
runTests().catch(console.error); 