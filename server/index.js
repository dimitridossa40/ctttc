import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
// ⚠️ FIXED: Import PinataSDK as default export
import PinataSDK from '@pinata/sdk';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import winston from 'winston';

// Import middleware Web3
import { 
  authenticateWeb3Token, 
  requireCompany, 
  requireVerifiedCompany,
  requireCompanyOwnership,
  optionalWeb3Auth 
} from './middleware/Auth.js';

// Import routes
import web3AuthRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import certificateRoutes from './routes/certificate.js';
import ipfsRoutes from './routes/ipfs.js';
import contractRoutes from './routes/contract.js';
import templateRoutes from './routes/template.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// Enhanced logging configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Validation des variables d'environnement
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Variables d'environnement manquantes: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// ⚠️ MISE À JOUR: Utiliser PINATA_JWT au lieu de PINATA_API_KEY
if (!process.env.PINATA_JWT) {
  logger.warn('PINATA_JWT manquant - fonctionnalités IPFS limitées');
}

// ⚠️ FIXED: Helper function pour initialiser le client Pinata
const getPinataClient = () => {
  const jwtToken = process.env.PINATA_JWT;
  
  if (!jwtToken) {
    throw new Error('PINATA_JWT environment variable not configured');
  }
  
  // Use the correct constructor pattern for @pinata/sdk
  return new PinataSDK({
    pinataJWTKey: jwtToken,
    pinataGateway: process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'
  });
};

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour le développement
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Augmenté pour le développement
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Augmenté pour le développement
  message: {
    error: 'Trop de tentatives, veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use('/api/', limiter);

// CORS Configuration - Plus permissive pour le développement
const corsOptions = {
  origin: function (origin, callback) {
    // En développement, autoriser toutes les origines localhost
    if (process.env.NODE_ENV === 'development') {
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    }
    
    // Production origins
    const allowedOrigins = process.env.FRONTEND_URL?.split(',').map(url => url.trim()) || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Autoriser les requêtes sans origin (Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Wallet-Address',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS
app.use(cors(corsOptions));

// Middleware de base
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enhanced request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const walletAddress = req.headers['x-wallet-address'] || req.headers['authorization'] || 'anonymous';
  
  // Log request
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    walletAddress: typeof walletAddress === 'string' ? walletAddress.substring(0, 20) + '...' : 'anonymous',
    ip: req.ip
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      walletAddress: typeof walletAddress === 'string' ? walletAddress.substring(0, 20) + '...' : 'anonymous'
    });
  });

  next();
});

// Enhanced file upload middleware
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5, // Jusqu'à 5 fichiers
    fieldSize: 10 * 1024 * 1024 // 10MB field size limit
  },
  fileFilter: (req, file, cb) => {
    // Enhanced file type validation
    const allowedTypes = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
      'application/pdf': ['.pdf'],
      'application/json': ['.json'],
      'text/plain': ['.txt']
    };
    
    const isValidType = Object.keys(allowedTypes).includes(file.mimetype);
    const hasValidExtension = allowedTypes[file.mimetype]?.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (isValidType && hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
    }
  }
});

// Database connection with retry logic
async function connectDatabase(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`; // Test query
      logger.info('✅ Connected to database via Prisma');
      return;
    } catch (error) {
      logger.error(`❌ Database connection attempt ${i + 1} failed:`, error);
      if (i === retries - 1) {
        logger.error('❌ All database connection attempts failed');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

await connectDatabase();

// Routes publiques
app.use('/api/auth', web3AuthRoutes);

// Test route pour vérifier la connexion
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API fonctionne correctement',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes protégées - Utilisateur connecté requis
app.get('/api/user', authenticateWeb3Token, (req, res) => {
  res.json({
    message: 'Accès utilisateur autorisé',
    user: {
      walletAddress: req.user.walletAddress,
      isVerified: req.user.isVerified,
      company: req.user.company ? {
        id: req.user.company.id,
        name: req.user.company.name,
        isVerified: req.user.company.isVerified
      } : null
    },
    timestamp: new Date().toISOString()
  });
});

// Routes protégées - Entreprise requise
app.use('/api/company', authenticateWeb3Token, companyRoutes);
app.use('/api/templates', authenticateWeb3Token, templateRoutes);

// Routes protégées - Certificats
app.use('/api/certificates', authenticateWeb3Token, certificateRoutes);

// Routes avec authentification optionnelle (pour affichage public)
app.use('/api/public/certificates', optionalWeb3Auth, certificateRoutes);

// Routes IPFS avec upload
app.use('/api/ipfs', authenticateWeb3Token, ipfsRoutes);

// Routes protégées - Contrats intelligents
app.use('/api/contracts', authenticateWeb3Token, contractRoutes);

// ⚠️ FIXED: Enhanced file upload with correct Pinata SDK usage
app.post('/api/upload', 
  authenticateWeb3Token, 
  upload.single('file'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      // File validation
      if (req.file.size === 0) {
        return res.status(400).json({ error: 'Fichier vide' });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}_${req.file.originalname}`;

      // Upload to IPFS via Pinata using correct SDK
      let ipfsHash = null;
      let ipfsUrl = null;
      
      if (process.env.PINATA_JWT) {
        try {
          const pinata = getPinataClient();

          // Upload using the correct @pinata/sdk method
          const result = await pinata.pinFileToIPFS(req.file.buffer, {
            pinataMetadata: {
              name: uniqueFilename,
              keyvalues: {
                uploadedBy: req.user.walletAddress,
                uploadDate: new Date().toISOString(),
                originalFileName: req.file.originalname,
                fileSize: req.file.size.toString(),
                mimeType: req.file.mimetype
              }
            },
            pinataOptions: {
              cidVersion: 1
            }
          });

          ipfsHash = result.IpfsHash;
          ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
          
          logger.info('File uploaded to IPFS via Pinata', { 
            filename: uniqueFilename, 
            ipfsHash,
            size: req.file.size,
            uploadedBy: req.user.walletAddress
          });
        } catch (ipfsError) {
          logger.error('IPFS upload error:', ipfsError);
          return res.status(500).json({ 
            error: 'Erreur lors de l\'upload IPFS',
            details: process.env.NODE_ENV === 'development' ? ipfsError.message : undefined
          });
        }
      } else {
        logger.warn('PINATA_JWT not configured, skipping IPFS upload');
      }

      res.json({
        message: 'Fichier uploadé avec succès',
        file: {
          originalName: req.file.originalname,
          filename: uniqueFilename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          ipfsHash,
          ipfsUrl,
          uploadedAt: new Date().toISOString()
        },
        uploadedBy: req.user.walletAddress
      });

    } catch (error) {
      logger.error('Upload error:', error);
      res.status(500).json({ 
        error: 'Erreur lors de l\'upload',
        code: 'UPLOAD_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ⚠️ FIXED: Enhanced upload multiple files route
app.post('/api/upload-multiple', 
  authenticateWeb3Token, 
  upload.array('files', 10), 
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const results = [];
      
      if (process.env.PINATA_JWT) {
        const pinata = getPinataClient();
        
        for (const file of req.files) {
          try {
            const timestamp = Date.now();
            const uniqueFilename = `${timestamp}_${file.originalname}`;

            const result = await pinata.pinFileToIPFS(file.buffer, {
              pinataMetadata: {
                name: uniqueFilename,
                keyvalues: {
                  uploadedBy: req.user.walletAddress,
                  uploadDate: new Date().toISOString(),
                  originalFileName: file.originalname,
                  fileSize: file.size.toString(),
                  mimeType: file.mimetype
                }
              },
              pinataOptions: {
                cidVersion: 1
              }
            });

            results.push({
              success: true,
              originalName: file.originalname,
              filename: uniqueFilename,
              size: file.size,
              mimetype: file.mimetype,
              ipfsHash: result.IpfsHash,
              ipfsUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
            });

          } catch (fileError) {
            logger.error(`Error uploading file ${file.originalname}:`, fileError);
            results.push({
              success: false,
              originalName: file.originalname,
              error: fileError.message
            });
          }
        }
      } else {
        // Fallback without IPFS
        req.files.forEach(file => {
          results.push({
            success: true,
            originalName: file.originalname,
            filename: `${Date.now()}_${file.originalname}`,
            size: file.size,
            mimetype: file.mimetype,
            ipfsHash: null,
            ipfsUrl: null
          });
        });
      }

      const successCount = results.filter(r => r.success).length;
      logger.info(`Multiple file upload completed: ${successCount}/${req.files.length} successful`);

      res.json({
        message: `${successCount} fichiers uploadés avec succès`,
        totalFiles: req.files.length,
        successfulUploads: successCount,
        results: results,
        uploadedBy: req.user.walletAddress
      });

    } catch (error) {
      logger.error('Multiple upload error:', error);
      res.status(500).json({ 
        error: 'Erreur lors de l\'upload multiple',
        code: 'MULTIPLE_UPLOAD_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Enhanced health check
app.get('/api/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbTime = Date.now() - startTime;
    
    // Get system statistics
    const [userCount, companyCount] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.company.count().catch(() => 0)
    ]);

    const memoryUsage = process.memoryUsage();

    // Test Pinata connection
    let pinataStatus = 'not_configured';
    if (process.env.PINATA_JWT) {
      try {
        const pinata = getPinataClient();
        // Test with a simple authentication check
        await pinata.testAuthentication();
        pinataStatus = 'connected';
      } catch (pinataError) {
        pinataStatus = 'error';
        logger.error('Pinata health check failed:', pinataError);
      }
    }

    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        responseTime: `${dbTime}ms`,
        statistics: {
          users: userCount,
          companies: companyCount
        }
      },
      system: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
        }
      },
      blockchain: {
        networks: ['ethereum', 'sepolia', 'polygon'],
        pinataStorage: pinataStatus,
        ipfsGateway: process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud'
      }
    });

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  logger.error('Server error', {
    errorId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    walletAddress: req.user?.walletAddress
  });
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'Token invalide',
      code: 'INVALID_TOKEN',
      errorId
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: 'Token expiré',
      code: 'TOKEN_EXPIRED',
      errorId
    });
  }

  // Multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      error: 'Fichier trop volumineux (max 50MB)',
      code: 'FILE_TOO_LARGE',
      errorId
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ 
      error: 'Trop de fichiers (max 5)',
      code: 'TOO_MANY_FILES',
      errorId
    });
  }

  // Prisma errors
  if (error.code === 'P2002') {
    return res.status(409).json({ 
      error: 'Conflit de données - enregistrement déjà existant',
      field: error.meta?.target,
      code: 'DUPLICATE_ENTRY',
      errorId
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ 
      error: 'Ressource non trouvée',
      code: 'NOT_FOUND',
      errorId
    });
  }

  // Generic server error
  res.status(500).json({ 
    error: 'Erreur serveur interne',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue',
    code: error.code || 'INTERNAL_ERROR',
    errorId
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`🔄 Received ${signal}. Shutting down gracefully...`);
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connection
  await prisma.$disconnect();
  logger.info('Database connection closed');

  // Close logging
  logger.end();
  
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    cors: corsOptions.origin,
    features: {
      pinataStorage: !!process.env.PINATA_JWT,
      rateLimit: true,
      compression: true,
      security: true
    }
  });
});

export default app;