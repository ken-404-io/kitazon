const router = require('express').Router();
const auth = require('../middleware/auth');
const { register, login, me, stats } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.get('/me/stats', auth, stats);

module.exports = router;
