const router = require('express').Router();
const auth = require('../middleware/auth');
const { get } = require('../controllers/referralController');

router.get('/', auth, get);

module.exports = router;
