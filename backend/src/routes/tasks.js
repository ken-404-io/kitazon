const router = require('express').Router();
const auth = require('../middleware/auth');
const { list, complete, spin, recentEarnings } = require('../controllers/taskController');

router.get('/', auth, list);
router.post('/:id/complete', auth, complete);
router.post('/spin', auth, spin);
router.get('/earnings/recent', auth, recentEarnings);

module.exports = router;
