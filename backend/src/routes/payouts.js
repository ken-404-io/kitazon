const router = require('express').Router();
const { feed } = require('../controllers/payoutController');

router.get('/feed', feed);

module.exports = router;
