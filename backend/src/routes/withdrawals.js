const router = require('express').Router();
const auth = require('../middleware/auth');
const { create, list } = require('../controllers/withdrawalController');

router.post('/', auth, create);
router.get('/', auth, list);

module.exports = router;
