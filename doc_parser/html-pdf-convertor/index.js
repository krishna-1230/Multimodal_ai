const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const driveService = require('./drive-service');
const axios = require('axios');
require('dotenv').config({ path: './config.env' });

const app = express();
const port = process.env.PORT || 3100;

// Middleware
// Capture raw body so we can fallback to it if JSON parsing fails
app.use(bodyParser.json({ limit: '50mb', verify: (req, res, buf, encoding) => { req.rawBody = buf.toString(encoding || 'utf8'); } }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// If bodyParser.json throws a SyntaxError (bad JSON), fall back to raw body
app.use((err, req, res, next) => {
  if (err && err instanceof SyntaxError && err.status === 400 && typeof req.rawBody === 'string') {
    req.body = req.rawBody;
    return next();
  }
  next(err);
});
app.use(express.static('public'));

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// Create temp directory if it doesn't exist
if (!fs.existsSync('temp')) {
  fs.mkdirSync('temp');
}

// Create uploads directory for storing PDFs if it doesn't exist
if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}

// Create HTML file for conversion
const createHtmlFile = (html) => {
  const filePath = path.join(__dirname, 'temp', `${uuidv4()}.html`);
  fs.writeFileSync(filePath, html);
  return filePath;
};

// Convert HTML to PDF
async function convertHtmlToPdf(htmlContent, options = {}) {
  // If htmlContent is a complex object with body, css, etc.
  let html = htmlContent;
  let pdfSettings = {
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    },
    displayHeaderFooter: false
  };
  
  // Handle complex JSON format
  if (typeof htmlContent === 'object' && htmlContent !== null) {
    if (htmlContent.body) {
      // Construct full HTML from components
      let fullHtml = '<!DOCTYPE html><html><head>';
      
      // Add CSS if provided
      if (htmlContent.css) {
        fullHtml += htmlContent.css;
      }
      
      fullHtml += '</head><body>';
      
      // Add body content
      fullHtml += htmlContent.body;
      
      fullHtml += '</body></html>';
      
      html = fullHtml;
    }
    
    // Apply PDF settings if provided
    if (htmlContent.settings) {
      const settings = htmlContent.settings;
      pdfSettings = {
        format: settings.paper_size || 'A4',
        landscape: false, // Always portrait
        printBackground: settings.print_background === '1',
        margin: {
          top: settings.margin_top ? `${settings.margin_top}px` : '20px',
          right: settings.margin_right ? `${settings.margin_right}px` : '20px',
          bottom: settings.margin_bottom ? `${settings.margin_bottom}px` : '20px',
          left: settings.margin_left ? `${settings.margin_left}px` : '20px'
        },
        displayHeaderFooter: settings.displayHeaderFooter || false
      };
      // Add custom header and footer if provided
      if (settings.custom_header) {
        pdfSettings.headerTemplate = settings.custom_header;
      }
      if (settings.custom_footer) {
        pdfSettings.footerTemplate = settings.custom_footer;
      }
    }
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Create a temporary HTML file
  const htmlPath = createHtmlFile(html);
  
  // Navigate to the HTML file
  await page.goto(`file://${htmlPath}`, {
    waitUntil: 'networkidle0'
  });
  
  // Generate PDF with the constructed settings
  const pdf = await page.pdf(pdfSettings);
  
  await browser.close();
  
  // Clean up temporary file
  fs.unlinkSync(htmlPath);
  
  return pdf;
}

// API endpoint for HTML to PDF conversion
app.post('/convert', async (req, res) => {
  try {
    let html = req.body.html || req.body;
    
    if (!html) {
      return res.status(400).send('HTML content is required');
    }
    
    const pdf = await convertHtmlToPdf(html);
    
    res.contentType('application/pdf');
    res.send(pdf);
  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
    res.status(500).send('Error converting HTML to PDF');
  }
});

// API endpoint for HTML to PDF conversion and Google Drive upload
app.post('/api/convert-and-upload', async (req, res) => {
  try {
    const jsonData = req.body;
    let html = jsonData.html || jsonData;
    const fileName = jsonData.fileName || (jsonData.settings?.fileName) || `pdf-${Date.now()}.pdf`;
    
    if (!html) {
      return res.status(400).json({ 
        success: false, 
        message: 'HTML content is required' 
      });
    }
    
    // Generate a file name if not provided
    const pdfFileName = fileName || `pdf-${Date.now()}.pdf`;
    
    // Convert HTML to PDF
    const pdfBuffer = await convertHtmlToPdf(html);
    
    // Upload PDF to Google Drive
    const uploadedFile = await driveService.uploadPdfBuffer(pdfBuffer, pdfFileName);
    
    res.status(200).json({
      success: true,
      file: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        viewLink: uploadedFile.webViewLink,
        downloadLink: uploadedFile.webContentLink
      }
    });
  } catch (error) {
    console.error('Error in convert-and-upload:', error);
    res.status(500).json({
      success: false,
      message: 'Error converting and uploading PDF',
      error: error.message
    });
  }
});

app.post('/api/convert-docx', async (req, res) => {
    const { content } = req.body; // Expecting structured JSON content
    if (!content) {
        return res.status(400).send('Structured content is required.');
    }

    try {
        const transformedContent = content.map(item => ({
            type: item.type,
            value: item.content, // Change 'content' to 'value'
            ...(item.level && { level: item.level }),
            ...(item.width && { width: item.width }),
            ...(item.data && { data: item.data })
        }));
        const response = await axios.post('http://localhost:5001/convert-docx', { content: transformedContent }, { responseType: 'arraybuffer' });
        res.setHeader('Content-Disposition', 'attachment; filename=converted.docx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(Buffer.from(response.data));
    } catch (error) {
        console.error('Error converting to DOCX:', error.message);
        res.status(500).send('Error converting to DOCX.');
    }
});

app.post('/api/convert-pptx', async (req, res) => {
    const { slides } = req.body; // Expecting structured JSON for slides
    if (!slides) {
        return res.status(400).send('Structured slides data is required.');
    }

    try {
        const transformedSlides = slides.map(slide => {
             if (slide.content && Array.isArray(slide.content)) {
                 return {
                     ...slide,
                     content: slide.content.map(item => ({
                         type: item.type,
                         value: item.content, // Change 'content' to 'value'
                         ...(item.level && { level: item.level }),
                         ...(item.width && { width: item.width }),
                         ...(item.data && { data: item.data })
                     }))
                 };
             }
             return slide; // Return slide as is if no content array to transform
         });
        const response = await axios.post('http://localhost:5002/convert-pptx', { slides: transformedSlides }, { responseType: 'arraybuffer' });
        res.setHeader('Content-Disposition', 'attachment; filename=converted.pptx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.send(Buffer.from(response.data));
    } catch (error) {
        console.error('Error converting to PPTX:', error.message);
        res.status(500).send('Error converting to PPTX.');
    }
});

// API endpoint for HTML to PDF conversion with local storage (no Google Drive)
app.post('/api/convert-local', async (req, res) => {
  try {
    const jsonData = req.body;
    let html = jsonData.html || jsonData;
    const fileName = jsonData.fileName || (jsonData.settings?.fileName) || `pdf-${Date.now()}.pdf`;
    
    if (!html) {
      return res.status(400).json({ 
        success: false, 
        message: 'HTML content is required' 
      });
    }
    
    // Generate a unique file name if not provided
    const uniqueId = uuidv4();
    const pdfFileName = fileName ? `${uniqueId}-${fileName}` : `pdf-${uniqueId}-${Date.now()}.pdf`;
    const safePdfFileName = pdfFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Convert HTML to PDF
    const pdfBuffer = await convertHtmlToPdf(html);
    
    // Save PDF to local storage
    const filePath = path.join(__dirname, 'public', 'uploads', safePdfFileName);
    fs.writeFileSync(filePath, pdfBuffer);
    
    // Generate download URL
    const downloadUrl = `${req.protocol}://${req.get('host')}/uploads/${safePdfFileName}`;
    
    res.status(200).json({
      success: true,
      file: {
        name: safePdfFileName,
        path: filePath,
        downloadUrl: downloadUrl
      }
    });
  } catch (error) {
    console.error('Error in convert-local:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error converting and saving PDF',
      error: error.message
    });
  }
});

// Home page with simple form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API documentation page
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`HTML to PDF converter running at http://localhost:${port}`);
});