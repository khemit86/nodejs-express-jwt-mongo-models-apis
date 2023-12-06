const express = require('express')
const router = express.Router()

const validationRule = require('../../validations/admins/auth')
const { verifyToken } = require('../../middlewares/verifyToken')
const { user_profile } = require('../../middlewares/multerUpload')

const admin = require('../../controllers/admins/admin.controller')

// router.post('/',admin.add_admin)
router.get('/', [verifyToken], admin.admin_profile)
router.post(
  '/login',
  validationRule.validate('admin-login'),
  admin.admin_login
)
router.get('/dials', admin.dials)
router.post(
  '/forgot-password',
  validationRule.validate('forgot-password'),
  admin.admin_forgot_password
)
router.post(
  '/reset-password/:token',
  validationRule.validate('reset-password'),
  admin.admin_reset_password
)
router.post(
  '/change-password',
  [verifyToken],
  validationRule.validate('change-password'),
  admin.changePassword
)
router.post(
  '/edit-profile',
  [verifyToken],
  user_profile.single('profile_pic'),
  admin.edit_admin
)
router.get('/country-list', admin.country_list)

module.exports = router
