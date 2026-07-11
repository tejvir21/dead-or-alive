const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts. Try again in 1 minute.' },
  standardHeaders: true, legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP requests. Try again in 5 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Rate limit exceeded.' },
});

// ── Validation helpers ────────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  next();
};

// ── Registration rules ────────────────────────────────────────────────────────
const registerRules = [
  body('username')
    .trim().isLength({ min: 3, max: 20 })
    .withMessage('Username must be 3-20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username: letters, numbers, underscores only'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password min 8 characters')
    .matches(/[A-Z]/).withMessage('Password needs an uppercase letter')
    .matches(/[0-9]/).withMessage('Password needs a number')
    .matches(/[^a-zA-Z0-9]/).withMessage('Password needs a special character'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('country').optional().trim().isLength({ min: 2, max: 60 }),
  body('dateOfBirth').optional().isISO8601().withMessage('Invalid date of birth'),
  body('gender').optional().isIn(['male','female','non-binary','prefer_not_to_say']),
  body('displayName').optional().trim().isLength({ max: 30 }),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

module.exports = { authLimiter, otpLimiter, apiLimiter, validate, registerRules, loginRules };
