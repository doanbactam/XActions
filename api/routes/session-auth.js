// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
import express from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import browserAutomation from '../services/browserAutomation.js';
import {
  encryptSessionSecret,
  decryptSessionSecret,
} from '../utils/sessionCrypto.js';
import { createSession } from '../services/xSessionService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Back-compat aliases → Phase A sessionCrypto
const encrypt = (text) => encryptSessionSecret(text);
const decrypt = (encryptedData) => {
  try {
    return decryptSessionSecret(encryptedData);
  } catch (error) {
    console.error('❌ Decryption error:', error.message);
    return null;
  }
};

// Save session cookie for browser automation
router.post('/save-session',
  authenticate,
  [
    body('sessionCookie').notEmpty().withMessage('Session cookie is required'),
    body('username').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionCookie, username } = req.body;

      // Test the session cookie by attempting to authenticate
      const page = await browserAutomation.createPage(sessionCookie);
      const isAuthenticated = await browserAutomation.checkAuthentication(page);
      await page.close();

      if (!isAuthenticated) {
        return res.status(401).json({ 
          error: 'Invalid session cookie - authentication failed' 
        });
      }

      // Phase A: store in XSession (encrypted) + legacy User field sync
      const publicSession = await createSession(req.user.id, {
        sessionCookie,
        username: username || null,
        label: 'primary',
      });

      res.json({
        message: 'Session saved successfully',
        authMethod: 'session',
        session: publicSession,
      });
    } catch (error) {
      console.error('❌ Save session error:', error.message);
      res.status(500).json({ error: 'Failed to save session' });
    }
  }
);

// Remove session cookie (switch back to OAuth)
router.delete('/remove-session',
  authenticate,
  async (req, res) => {
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          sessionCookie: null,
          authMethod: null
        }
      });

      res.json({ message: 'Session removed successfully' });
    } catch (error) {
      console.error('❌ Remove session error:', error.message);
      res.status(500).json({ error: 'Failed to remove session' });
    }
  }
);

// Get current auth method
router.get('/auth-method',
  authenticate,
  async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          authMethod: true,
          twitterUsername: true,
          twitterAccessToken: true,
          sessionCookie: true
        }
      });

      const hasOAuth = !!user.twitterAccessToken;
      const hasSession = !!user.sessionCookie;

      res.json({
        authMethod: user.authMethod,
        hasOAuth,
        hasSession,
        username: user.twitterUsername
      });
    } catch (error) {
      console.error('❌ Get auth method error:', error.message);
      res.status(500).json({ error: 'Failed to get auth method' });
    }
  }
);

// Helper function to get decrypted session cookie (for use in other services)
async function getDecryptedSessionCookie(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionCookie: true }
  });
  if (!user?.sessionCookie) return null;
  return decrypt(user.sessionCookie);
}

export default router;
export { getDecryptedSessionCookie, encrypt, decrypt };
