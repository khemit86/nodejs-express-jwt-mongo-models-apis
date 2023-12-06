const express = require("express");
const router = express.Router();

const validationRule = require("../../validations/admins/auth");
const { verifyTokenFront } = require("../../middlewares/verifyToken");
const { user_profile } = require("../../middlewares/multerUpload");

const {
    breed_list
} = require("../../controllers/users/breed.controller");

router.get("/list", [verifyTokenFront], breed_list)


module.exports = router;