const express = require("express");
const router = express.Router();
const brand = require("../../controllers/users/brand.controller");
const { verifyTokenFront } = require("../../middlewares/verifyToken");

//get admin brand list
router.get("/", brand.list_brand);
module.exports = router;
