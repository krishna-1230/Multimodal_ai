#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Check if input and output files are provided
if (process.argv.length < 4) {
  console.log('Usage: node convert-cli.js <input-html-file> <output-pdf-file>');
  process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file '${inputFile}' not found.`);
  process.exit(1);
}

// Convert HTML to PDF
async function convertHtmlToPdf() {
  console.log(`Converting ${inputFile} to ${outputFile}...`);
  
  try {
    // Read HTML file
    const html = fs.readFileSync(inputFile, 'utf8');
    
    // Create a temporary HTML file with absolute paths
    const tempHtml = path.join(__dirname, 'temp-cli.html');
    fs.writeFileSync(tempHtml, html);
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Navigate to the HTML file
    await page.goto(`file://${tempHtml}`, {
      waitUntil: 'networkidle0'
    });
    
    // Generate PDF
    await page.pdf({
      path: outputFile,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    await browser.close();
    
    // Clean up temporary file
    fs.unlinkSync(tempHtml);
    
    console.log(`Successfully converted HTML to PDF: ${outputFile}`);
  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
    process.exit(1);
  }
}

convertHtmlToPdf(); 