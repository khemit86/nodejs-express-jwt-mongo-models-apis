const express = require("express");
const router = express.Router();

const validationRule = require("../../validations/users/auth");
const { verifyTokenFront } = require("../../middlewares/verifyToken");
const { user_profile } = require("../../middlewares/multerUpload");

const {
    add_card,
    edit_card,
    delete_card,
    list_card
} = require("../../controllers/users/card.controller");

router.post("/add",[verifyTokenFront],validationRule.validate("add-edit-card-validate"), add_card);
router.put("/edit",[verifyTokenFront],validationRule.validate("add-edit-card-validate"), edit_card);
router.delete("/delete",[verifyTokenFront],delete_card)
router.get("/list",[verifyTokenFront],list_card)

module.exports = router;