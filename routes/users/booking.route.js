const express = require('express');
const router = express.Router();

const validationRule = require('../../validations/users/auth');
const { verifyTokenFront } = require('../../middlewares/verifyToken');
const { user_profile } = require('../../middlewares/multerUpload');

const {
    create_booking,
    confirm_booking,
    update_payment_method,
    cancel_booking,
    detail,
    list,
    add_addon,
    pay_addon,
    rating_to_provider,
    rating_to_provider_edit,
    promo_code_check,
    recent_list,
    addon_list,
    addon_accept,
    getRoomId,
    list_get_addon_status
} = require('../../controllers/users/booking.controller');

router.post('/create', [verifyTokenFront],create_booking);//deprecated
router.post('/confirm_booking',[verifyTokenFront],confirm_booking);
router.post('/update_payment_method',[verifyTokenFront], validationRule.validate('booking-payment-method-validator'), update_payment_method);//deprecated
router.post('/cancel_booking',[verifyTokenFront], cancel_booking);
router.get('/detail',[verifyTokenFront],detail);
router.get('/list',[verifyTokenFront],list)
router.post('/add_addon',[verifyTokenFront],add_addon)//deprecated
router.post('/pay_addon',[verifyTokenFront],pay_addon);
router.post('/rating_to_provider',[verifyTokenFront],validationRule.validate('rating-validator'),rating_to_provider),
router.put('/rating_to_provider_edit',[verifyTokenFront],validationRule.validate('rating-validator'),rating_to_provider_edit)
router.get('/recent_list',[verifyTokenFront],recent_list)
router.get('/promo_code_check',[verifyTokenFront],promo_code_check)
router.post('/addon_list',[verifyTokenFront],addon_list)
router.post('/addon_accept',[verifyTokenFront],addon_accept);
router.post('/getRoomId',[verifyTokenFront],getRoomId);
router.post('/list_get_addon_status',[verifyTokenFront],list_get_addon_status);

module.exports = router;