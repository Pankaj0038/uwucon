const express = require("express");
const app = express();
const port = 5000;
const path = require("path");
const spath = path.join(__dirname, "../public/");
app.use(express.static(spath));

const readline = require("readline");
const stream = require('stream');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fs = require('fs');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const blobStream = require('blob-stream');

// OAuth2 Client Setup
const { OAuth2 } = google.auth;
const credentials = require('../uwuauth.json');
const sheetCredentials = require('../uwucon.json');

const TOKEN_PATH = '../token.json';

const oAuth2Client = new google.auth.OAuth2(
  credentials.web.client_id,
  credentials.web.client_secret,
  credentials.web.redirect_uris[0]  // Ensure redirect_uris[0] is correct
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/spreadsheets'];


const auth = new google.auth.GoogleAuth({
  keyFile: sheetCredentials,
  scopes: SCOPES,
});

// Google Drive & Sheets Setup
const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
const drive = google.drive({ version: 'v3', auth: oAuth2Client });

// Google Sheets Details
const SPREADSHEET_ID = '1H7DqkSMF-4eOXwe1YGw3_p6nTv23jGa_M1lauR8BC4s';
const RANGE = 'Sheet1!A1';

// Multer Setup for File Upload (Disk Storage)
const uploadDirectory = path.join(__dirname, 'uploads'); // Folder where you want to store files temporarily
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory); // Create the folder if it doesn't exist
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory); // Save files in the "uploads" directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Use the current timestamp as the file name
  },
});

const upload = multer({ storage: storage }).single('file');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.redirect("index.html");
});

function authorize(callback) {
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.log('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      callback(oAuth2Client);
    });
  });
}

function uploadFile(auth, filePath, fileName, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  
  const fileMetadata = {
    name: fileName,
    parents: [folderId] // Set the folder ID where the file will be uploaded
  };


  const media = {
    body: fs.createReadStream(filePath), // Read the saved file from disk
  };

  return new Promise((resolve, reject) => {
    drive.files.create(
      {
        resource: fileMetadata,
        media: media,
        fields: 'id',
      },
      (err, file) => {
        if (err) {
          reject('Error uploading file: ' + err);
        } else {
          resolve(file.data.id); // Return the file ID after upload
        }
      }
    );
  });
}


// Route for Google OAuth URL
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// OAuth2 Callback Route
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.log('Error while trying to retrieve access token', err);
    oAuth2Client.setCredentials(token);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    res.send('Authentication successful! You can now upload the PDF.');
  });
});


function generateReceiptId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let receiptId = '';
    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        receiptId += chars[randomIndex];
    }
    return receiptId;
}

function generateReceipt(name, contact, string, id) {
  return new Promise((resolve, reject) => {
    let totalPrice = 0;
    const price = 30;
    const productDetails = [];
    const products = JSON.parse(string.replace(/'/g, '"'))
    const filePath = path.join(__dirname, 'receipts', `receipt_${id}.pdf`);
    const receiptsDir = path.join(__dirname, 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir);
    }


    // Calculate total price and prepare product details
    for (let i = 0; i < products.length; i++) {
      const product = products[i];  // Get each product from the products array
      totalPrice += parseFloat(price);  // Assuming price is constant
      productDetails.push({ name: product, price });
    }

    // Create PDF document
    const doc = new PDFDocument();
    // const stream = doc.pipe(blobStream());
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Add receipt content to PDF
    doc.fontSize(20).text('Receipt', { align: 'center' });
    doc.fontSize(14).text(`Receipt ID: ${id}`, { align: 'right' });
    doc.fontSize(14).text(`Name: ${name}`);
    doc.text(`Contact Number: ${contact}`);
    doc.moveDown();
    doc.text('Products Purchased:', { underline: true });
    productDetails.forEach(product => {
      doc.text(`${product.name} - Rs${product.price}`);
    });
    doc.moveDown();
    doc.text(`Total: Rs-${totalPrice}`, { bold: true });

    // End the document
    doc.end();
    const filename = `receipt_${id}.pdf`
    return filename
    })
}



// Route for File Upload and Data Append to Sheets
app.post("/purchase", upload, async (req, res) => {
  try {
    const name = req.body.name;
    const ids = req.body.posters;
    const ph = req.body.contact;

    const folderId = "1YYR4LnQEhpRYoLCOuvtHvBkeZaHLPF3T"; // Your folder ID
    let fileId = '';

    // Get file path and name
    const filePath = path.join(uploadDirectory, req.file.filename);
    const fileName = req.file.originalname;

    // Authorize and upload the file to Google Drive
    authorize(async (auth) => {
      try {
        fileId = await uploadFile(auth, filePath, fileName,folderId);
        console.log('File uploaded successfully with ID:', fileId);
        const fileURI = "https://drive.google.com/file/d/"+fileId;

        let receiptId = generateReceiptId();

        // After file upload, append data to Google Sheets
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: RANGE,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[name, ids, ph, fileURI,receiptId]], // Append the necessary data
          },
        });
        await generateReceipt(name,ph,ids,receiptId)
        .then(recfile=>{
          // res.redirect(`/download?file=${recfile}`)
          data = {"filename":recfile}
          res.send(data);
        })
      } catch (err) {
        console.error("Error uploading file to Google Drive:", err);
        res.status(500).send("Error uploading file.");
      }
    });
  } catch (err) {
    console.error("General error:", err);
    res.status(500).send("Something went wrong.");
  }
});


app.get('/download', (req, res) => {
  // Define the file path you want to send for download
  let filename = req.query.file;
  const filePath = path.join(__dirname, 'files', fileName); // Replace 'yourfile.pdf' with your actual file

  // Send the file for download
  res.download(filePath, 'receipt.pdf', (err) => {
    if (err) {
      console.error('Error while downloading the file', err);
      res.status(500).send('Error while downloading the file');
    } else {
      console.log('File downloaded successfully');
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
