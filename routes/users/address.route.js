const express = require("express");
const router = express.Router();

const validationRule = require("../../validations/users/auth");
const { verifyTokenFront } = require("../../middlewares/verifyToken");
const { user_profile } = require("../../middlewares/multerUpload");

const {
    add_address,
    list_address,
    edit_address,
    delete_address
} = require("../../controllers/users/address.controller");

router.post("/", [verifyTokenFront], validationRule.validate("address-add-edit-validater"), add_address);
router.put("/", [verifyTokenFront], edit_address);
router.get("/",[verifyTokenFront], list_address);
router.delete("/", [verifyTokenFront], validationRule.validate("delete-address"),delete_address);

module.exports = router;