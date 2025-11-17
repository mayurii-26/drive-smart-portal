const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'drive-smart-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware for HTML files (before static files)
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    // Allow login and signup pages
    if (req.path === '/login.html' || req.path === '/signup.html') {
      if (req.session.user) {
        return res.redirect('/dashboard.html');
      }
      return next();
    }
    
    // Admin page requires admin role
    if (req.path === '/admin.html') {
      if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admin privileges required.');
      }
      return next();
    }
    
    // ai.html is the RTO AI Assistant page
    if (req.path === '/ai.html') {
      // Already checked for auth above
      return next();
    }
    
    // problem.html is the Ask Your Problem page
    if (req.path === '/problem.html') {
      // Already checked for auth above
      return next();
    }
    
    // All other HTML pages require authentication
    if (!req.session.user) {
      return res.redirect('/login.html');
    }
  }
  next();
});

// Serve static files from public directory
app.use(express.static('public', { 
  index: false, // Don't serve index.html automatically
  dotfiles: 'deny' // Don't expose dotfiles
}));

// Disable directory listing
app.use((req, res, next) => {
  if (req.path.endsWith('/') && req.path !== '/') {
    return res.status(403).send('Directory listing disabled');
  }
  next();
});

// Initialize data storage
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const usersFile = path.join(dataDir, 'users.json');
const problemsFile = path.join(dataDir, 'problems.json');
const activitiesFile = path.join(dataDir, 'activities.json');
const uploadsFile = path.join(dataDir, 'uploads.json');

// Initialize data files
function initDataFile(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

initDataFile(usersFile);
initDataFile(problemsFile);
initDataFile(activitiesFile);
initDataFile(uploadsFile);

// Create default admin user if not exists
function initAdmin() {
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const adminExists = users.find(u => u.email === 'admin@drivesmart.gov.in');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    users.push({
      id: 'admin-001',
      name: 'Administrator',
      email: 'admin@drivesmart.gov.in',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }
}

initAdmin();

// Cloudinary configuration - ONLY if real environment variables are present
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Validate Cloudinary credentials - only configure if all real values are present
let isCloudinaryConfigured = false;
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET &&
    CLOUDINARY_CLOUD_NAME !== 'your-cloud-name' &&
    CLOUDINARY_API_KEY !== 'your-api-key' &&
    CLOUDINARY_API_SECRET !== 'your-api-secret' &&
    CLOUDINARY_CLOUD_NAME.trim() !== '' &&
    CLOUDINARY_API_KEY.trim() !== '' &&
    CLOUDINARY_API_SECRET.trim() !== '') {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME.trim(),
    api_key: CLOUDINARY_API_KEY.trim(),
    api_secret: CLOUDINARY_API_SECRET.trim()
  });
  isCloudinaryConfigured = true;
  console.log('✅ Cloudinary configured successfully');
} else {
  console.warn('⚠️ Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env file');
  console.warn('   File uploads will not work until Cloudinary is properly configured.');
}

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only allow PDF, JPG, and PNG files
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const allowedExtensions = /\.(jpg|jpeg|png|pdf)$/i;
    
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.test(file.originalname);
    
    if (isValidMimeType && isValidExtension) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, JPG, and PNG files are allowed'));
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied. Admin privileges required.');
}

// Routes

// Default route - always serve login
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard.html');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// API Routes

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: 'user-' + Date.now(),
      name,
      email,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    
    res.json({ success: true, message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    // Log activity
    const activities = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
    activities.push({
      userId: user.id,
      userName: user.name,
      action: 'login',
      timestamp: new Date().toISOString(),
      details: { email: user.email }
    });
    fs.writeFileSync(activitiesFile, JSON.stringify(activities, null, 2));
    
    res.json({ success: true, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/user', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// RTO AI Assistant
app.post('/api/assistant', requireAuth, (req, res) => {
  const { query } = req.body;
  
  // Log activity
  const activities = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
  activities.push({
    userId: req.session.user.id,
    userName: req.session.user.name,
    action: 'assistant_query',
    timestamp: new Date().toISOString(),
    details: { query }
  });
  fs.writeFileSync(activitiesFile, JSON.stringify(activities, null, 2));
  
  // RTO service knowledge base
  const rtoServices = {
    'll': {
      summary: 'Learner\'s License (LL) is the first step to obtaining a driving license in India. It allows you to learn driving under supervision.',
      documents: ['Age proof (Birth Certificate, Aadhaar, Passport)', 'Address proof (Aadhaar, Utility bill, Bank statement)', '4 passport size photographs', 'Medical certificate (Form 1A) for certain categories'],
      fees: 'Rs. 200 (varies by state)',
      steps: ['Fill Form 1', 'Submit documents at RTO', 'Appear for LL test (written)', 'Pass the test to receive LL'],
      timeline: '7-15 days after passing the test',
      online: 'Available on Parivahan Sewa portal',
      offline: 'Visit nearest RTO office',
      tips: ['Study traffic signs and rules thoroughly', 'Practice mock tests online', 'Carry all original documents'],
      sources: ['Parivahan Sewa (parivahan.gov.in)', 'State RTO website', 'Motor Vehicles Act 1988']
    },
    'dl': {
      summary: 'Driving License (DL) is the official document that authorizes you to drive motor vehicles on public roads.',
      documents: ['Learner\'s License (valid for at least 30 days)', 'Age and address proof', '4 passport photographs', 'Driving test appointment receipt'],
      fees: 'Rs. 500-2000 (varies by vehicle type and state)',
      steps: ['Complete 30 days with LL', 'Book driving test slot', 'Appear for driving test', 'Pass test to receive DL'],
      timeline: '15-30 days after passing driving test',
      online: 'Available on Parivahan Sewa portal',
      offline: 'Visit RTO office for test',
      tips: ['Practice driving with a licensed driver', 'Familiarize yourself with test route', 'Ensure vehicle is in good condition'],
      sources: ['Parivahan Sewa', 'State RTO', 'Motor Vehicles Act 1988']
    },
    'rc': {
      summary: 'Registration Certificate (RC) is the official document proving vehicle ownership and registration with RTO.',
      documents: ['Invoice from dealer', 'Insurance certificate', 'PUC certificate', 'Address proof', 'PAN card/Aadhaar'],
      fees: 'Rs. 300-1500 (varies by vehicle type)',
      steps: ['Purchase vehicle from dealer', 'Dealer submits documents to RTO', 'RTO processes registration', 'Receive RC card'],
      timeline: '7-15 days from date of application',
      online: 'Track status on Parivahan portal',
      offline: 'Dealer handles registration process',
      tips: ['Verify all details on invoice', 'Ensure insurance is active', 'Keep all documents safe'],
      sources: ['Parivahan Sewa', 'Vehicle dealer', 'RTO office']
    },
    'rc transfer': {
      summary: 'RC Transfer is required when vehicle ownership changes, such as buying a used vehicle.',
      documents: ['Original RC', 'NOC from previous owner', 'Insurance certificate', 'PUC certificate', 'Address proof of new owner', 'Sale agreement'],
      fees: 'Rs. 500-2000 (varies by state)',
      steps: ['Obtain NOC from previous owner', 'Submit Form 29 and 30 at RTO', 'Pay transfer fees', 'Complete verification', 'Receive updated RC'],
      timeline: '15-30 days',
      online: 'Form submission available online',
      offline: 'Visit RTO for verification',
      tips: ['Verify vehicle history', 'Check for pending challans', 'Ensure NOC is valid'],
      sources: ['Parivahan Sewa', 'RTO office']
    },
    'hypothecation removal': {
      summary: 'Hypothecation removal is required when vehicle loan is fully paid and you want to remove the financier\'s name from RC.',
      documents: ['Original RC', 'Loan closure letter from bank', 'NOC from financier', 'Insurance certificate', 'PUC certificate'],
      fees: 'Rs. 200-500',
      steps: ['Obtain loan closure certificate', 'Get NOC from financier', 'Submit Form 35 at RTO', 'Pay fees and complete process'],
      timeline: '7-15 days',
      online: 'Application available online',
      offline: 'Visit RTO for submission',
      tips: ['Ensure all loan dues are cleared', 'Get proper NOC from bank', 'Keep closure certificate safe'],
      sources: ['Parivahan Sewa', 'Financing bank', 'RTO office']
    },
    'noc': {
      summary: 'No Objection Certificate (NOC) is required when transferring vehicle registration to another state.',
      documents: ['Original RC', 'Insurance certificate', 'PUC certificate', 'Address proof of new state', 'Challan clearance certificate'],
      fees: 'Rs. 100-500',
      steps: ['Clear all pending challans', 'Submit NOC application at current RTO', 'Pay fees', 'Receive NOC'],
      timeline: '7-10 days',
      online: 'Application available online',
      offline: 'Visit RTO office',
      tips: ['Clear all traffic violations first', 'Ensure insurance is valid', 'Get address proof for new state'],
      sources: ['Parivahan Sewa', 'RTO office']
    },
    'puc': {
      summary: 'Pollution Under Control (PUC) certificate is mandatory for all vehicles to ensure they meet emission standards.',
      documents: ['RC or vehicle registration number', 'Previous PUC (if renewing)'],
      fees: 'Rs. 50-200',
      steps: ['Visit authorized PUC center', 'Vehicle emission test', 'Pay fees', 'Receive PUC certificate'],
      timeline: 'Same day (immediate)',
      online: 'Available at authorized centers',
      offline: 'Visit PUC center',
      tips: ['Get PUC before expiry', 'Keep vehicle well-maintained', 'Carry RC or vehicle number'],
      sources: ['Authorized PUC centers', 'Parivahan Sewa']
    },
    'insurance': {
      summary: 'Motor vehicle insurance is mandatory under the Motor Vehicles Act to cover third-party liability.',
      documents: ['RC or vehicle details', 'Previous insurance (if renewing)', 'Identity proof'],
      fees: 'Varies by vehicle type and coverage (Rs. 2000-10000+)',
      steps: ['Compare insurance plans', 'Choose policy', 'Submit documents', 'Pay premium', 'Receive policy'],
      timeline: 'Same day to 3 days',
      online: 'Available on insurance company websites',
      offline: 'Visit insurance office or agent',
      tips: ['Compare multiple insurers', 'Check coverage details', 'Renew before expiry', 'Keep policy document safe'],
      sources: ['Insurance company websites', 'IRDA approved insurers']
    },
    'state penalties': {
      summary: 'Traffic violation penalties vary by state and violation type as per the Motor Vehicles (Amendment) Act 2019.',
      documents: ['Challan receipt', 'Vehicle RC', 'DL'],
      fees: 'Rs. 500-10000+ depending on violation',
      steps: ['Receive challan', 'Pay penalty online or offline', 'Keep receipt', 'Clear violation from record'],
      timeline: 'Immediate (online) or same day (offline)',
      online: 'Available on state traffic police portals',
      offline: 'Visit traffic police station or court',
      tips: ['Pay promptly to avoid additional charges', 'Keep payment receipts', 'Check for discounts on early payment'],
      sources: ['State traffic police websites', 'Parivahan Sewa', 'eChallan portals']
    },
    'international permit': {
      summary: 'International Driving Permit (IDP) allows you to drive in foreign countries that recognize Indian licenses.',
      documents: ['Valid Indian DL', 'Passport size photographs', 'Passport copy', 'Visa copy (if available)'],
      fees: 'Rs. 1000',
      steps: ['Apply at RTO or through agent', 'Submit documents', 'Pay fees', 'Receive IDP'],
      timeline: '7-10 days',
      online: 'Application available online',
      offline: 'Visit RTO office',
      tips: ['Apply well in advance of travel', 'Ensure DL is valid', 'Check country requirements'],
      sources: ['RTO office', 'Parivahan Sewa']
    },
    'license category': {
      summary: 'Adding a new vehicle category to existing driving license requires passing a driving test for that category.',
      documents: ['Original DL', 'Medical certificate (for commercial)', 'Age proof', 'Passport photographs'],
      fees: 'Rs. 500-2000',
      steps: ['Apply for new category', 'Book test slot', 'Appear for driving test', 'Pass test to get updated DL'],
      timeline: '15-30 days after passing test',
      online: 'Available on Parivahan Sewa',
      offline: 'Visit RTO for test',
      tips: ['Practice for specific vehicle type', 'Ensure you meet age requirements', 'Carry all documents'],
      sources: ['Parivahan Sewa', 'RTO office']
    },
    'scrappage': {
      summary: 'Vehicle scrappage policy allows you to officially scrap old vehicles and get benefits for purchasing new ones.',
      documents: ['Original RC', 'Vehicle', 'Identity proof', 'NOC from financier (if applicable)'],
      fees: 'Varies (may get benefits instead)',
      steps: ['Register vehicle for scrappage', 'Get vehicle evaluated', 'Scrap at authorized center', 'Receive scrappage certificate', 'Get benefits for new vehicle'],
      timeline: '15-30 days',
      online: 'Registration available online',
      offline: 'Visit authorized scrappage center',
      tips: ['Check vehicle age eligibility', 'Compare scrappage benefits', 'Ensure all documents are ready'],
      sources: ['Government scrappage portal', 'Authorized scrappage centers']
    }
  };
  
  // Simple keyword matching
  const queryLower = query.toLowerCase();
  let matchedService = null;
  
  for (const [key, service] of Object.entries(rtoServices)) {
    if (queryLower.includes(key) || key.includes(queryLower)) {
      matchedService = service;
      break;
    }
  }
  
  // Check for common keywords
  if (!matchedService) {
    if (queryLower.includes('learner') || queryLower.includes('ll')) {
      matchedService = rtoServices.ll;
    } else if (queryLower.includes('driving license') || queryLower.includes('dl')) {
      matchedService = rtoServices.dl;
    } else if (queryLower.includes('registration') || queryLower.includes('rc')) {
      matchedService = rtoServices.rc;
    } else if (queryLower.includes('transfer')) {
      matchedService = rtoServices['rc transfer'];
    } else if (queryLower.includes('hypothecation')) {
      matchedService = rtoServices['hypothecation removal'];
    } else if (queryLower.includes('noc') || queryLower.includes('no objection')) {
      matchedService = rtoServices.noc;
    } else if (queryLower.includes('puc') || queryLower.includes('pollution')) {
      matchedService = rtoServices.puc;
    } else if (queryLower.includes('insurance')) {
      matchedService = rtoServices.insurance;
    } else if (queryLower.includes('penalty') || queryLower.includes('challan') || queryLower.includes('fine')) {
      matchedService = rtoServices['state penalties'];
    } else if (queryLower.includes('international') || queryLower.includes('idp')) {
      matchedService = rtoServices['international permit'];
    } else if (queryLower.includes('category') || queryLower.includes('add')) {
      matchedService = rtoServices['license category'];
    } else if (queryLower.includes('scrap')) {
      matchedService = rtoServices.scrappage;
    }
  }
  
  if (matchedService) {
    res.json({ success: true, data: matchedService });
  } else {
    res.json({ 
      success: true, 
      data: {
        summary: 'I can help you with various RTO services. Please ask about: Learner\'s License (LL), Driving License (DL), RC Registration/Transfer, Hypothecation Removal, NOC, PUC, Insurance, State Penalties, International Permits, License Category Addition, or Vehicle Scrappage.',
        documents: [],
        fees: '',
        steps: [],
        timeline: '',
        online: '',
        offline: '',
        tips: ['Be specific about which RTO service you need help with', 'Have your documents ready before applying'],
        sources: ['Parivahan Sewa (parivahan.gov.in)']
      }
    });
  }
});

// Document Upload with multer error handling
app.post('/api/upload', requireAuth, (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      // Handle multer errors (file size, file type, etc.)
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 10MB limit' });
        }
        return res.status(400).json({ error: 'Upload error: ' + err.message });
      }
      // Handle fileFilter errors
      if (err.message) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Validate Cloudinary configuration
    if (!isCloudinaryConfigured) {
      console.error('❌ Upload failed: Cloudinary not configured');
      return res.status(500).json({ 
        error: 'Cloudinary not configured – please update .env file with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET' 
      });
    }
    
    // Double-check env vars are valid (not placeholders)
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    
    if (!cloudName || !apiKey || !apiSecret ||
        cloudName === 'your-cloud-name' || apiKey === 'your-api-key' || apiSecret === 'your-api-secret') {
      console.error('❌ Upload failed: Invalid Cloudinary credentials in .env');
      return res.status(500).json({ 
        error: 'Cloudinary not configured – please update .env file with real Cloudinary credentials' 
      });
    }
    
    // Validate file buffer exists
    if (!req.file.buffer) {
      return res.status(400).json({ error: 'File buffer is missing' });
    }
    
    // Validate file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only PDF, JPG, and PNG files are allowed' });
    }
    
    // Ensure Cloudinary is configured with latest env vars
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });
    
    // Upload to Cloudinary using upload_stream
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          resource_type: 'auto', 
          folder: 'drive-smart',
          allowed_formats: ['jpg', 'jpeg', 'png', 'pdf']
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload successful:', result.secure_url);
            resolve(result);
          }
        }
      );
      
      // Write buffer to upload stream
      // upload_stream.end() can accept data directly, so we write buffer and end stream
      uploadStream.end(req.file.buffer);
    });
    
    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error('Cloudinary upload failed - no URL returned');
    }
    
    const uploadRecord = {
      id: 'upload-' + Date.now(),
      userId: req.session.user.id,
      userName: req.session.user.name,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      cloudinaryUrl: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
      uploadedAt: new Date().toISOString(),
      category: req.body.category || 'general'
    };
    
    // Save upload record
    const uploads = JSON.parse(fs.readFileSync(uploadsFile, 'utf8'));
    uploads.push(uploadRecord);
    fs.writeFileSync(uploadsFile, JSON.stringify(uploads, null, 2));
    
    // Log activity
    const activities = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
    activities.push({
      userId: req.session.user.id,
      userName: req.session.user.name,
      action: 'document_upload',
      timestamp: new Date().toISOString(),
      details: { fileName: req.file.originalname, category: uploadRecord.category }
    });
    fs.writeFileSync(activitiesFile, JSON.stringify(activities, null, 2));
    
    res.json({ success: true, upload: uploadRecord });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

app.get('/api/uploads', requireAuth, (req, res) => {
  const uploads = JSON.parse(fs.readFileSync(uploadsFile, 'utf8'));
  const userUploads = req.session.user.role === 'admin' 
    ? uploads 
    : uploads.filter(u => u.userId === req.session.user.id);
  res.json({ success: true, uploads: userUploads });
});

// Ask Your Problem
app.post('/api/problem', requireAuth, (req, res) => {
  try {
    const { problem, category } = req.body;
    const problems = JSON.parse(fs.readFileSync(problemsFile, 'utf8'));
    
    const problemRecord = {
      id: 'prob-' + Date.now(),
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      problem,
      category: category || 'general',
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    
    problems.push(problemRecord);
    fs.writeFileSync(problemsFile, JSON.stringify(problems, null, 2));
    
    // Log activity
    const activities = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
    activities.push({
      userId: req.session.user.id,
      userName: req.session.user.name,
      action: 'problem_submitted',
      timestamp: new Date().toISOString(),
      details: { problemId: problemRecord.id, category }
    });
    fs.writeFileSync(activitiesFile, JSON.stringify(activities, null, 2));
    
    res.json({ success: true, message: 'Problem submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit problem' });
  }
});

// Admin routes
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const activities = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
  const uploads = JSON.parse(fs.readFileSync(uploadsFile, 'utf8'));
  const problems = JSON.parse(fs.readFileSync(problemsFile, 'utf8'));
  
  const stats = {
    totalUsers: users.filter(u => u.role === 'user').length,
    totalAdmins: users.filter(u => u.role === 'admin').length,
    totalActivities: activities.length,
    totalUploads: uploads.length,
    totalProblems: problems.length,
    recentLogins: activities.filter(a => a.action === 'login').slice(-10),
    aiQueries: activities.filter(a => a.action === 'assistant_query').length,
    chatbotQueries: activities.filter(a => a.action === 'chatbot_query').length,
    uploadsByCategory: {},
    problemsByStatus: {}
  };
  
  uploads.forEach(u => {
    stats.uploadsByCategory[u.category] = (stats.uploadsByCategory[u.category] || 0) + 1;
  });
  
  problems.forEach(p => {
    stats.problemsByStatus[p.status] = (stats.problemsByStatus[p.status] || 0) + 1;
  });
  
  res.json({ success: true, stats });
});

app.get('/api/admin/activities', requireAdmin, (req, res) => {
  const activities = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
  res.json({ success: true, activities: activities.reverse().slice(0, 100) });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const activities = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
  
  const usersWithStats = users.map(user => {
    const userActivities = activities.filter(a => a.userId === user.id);
    return {
      ...user,
      password: undefined, // Don't send password
      loginCount: userActivities.filter(a => a.action === 'login').length,
      lastLogin: userActivities.filter(a => a.action === 'login').slice(-1)[0]?.timestamp,
      totalActivities: userActivities.length
    };
  });
  
  res.json({ success: true, users: usersWithStats });
});

app.get('/api/admin/problems', requireAdmin, (req, res) => {
  const problems = JSON.parse(fs.readFileSync(problemsFile, 'utf8'));
  res.json({ success: true, problems: problems.reverse() });
});

// HTML files are handled by the middleware above and static file serving

// Start server
app.listen(PORT, () => {
  console.log(`Drive Smart Portal running on http://localhost:${PORT}`);
  console.log('Default admin: admin@drivesmart.gov.in / admin123');
});


