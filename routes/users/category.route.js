const express = require("express");
const router = express.Router();
const category = require("../../controllers/users/category.controller");
const { verifyTokenFront } = require("../../middlewares/verifyToken");

//get admin category list
router.get("/list-sub-category", [verifyTokenFront], category.list_sub_category);
router.get("/listCategory",  category.list_category);
router.get("/homeCategory",  category.home_category);

router.get("/searchCategory/",category.searchCategory);

module.exports = router;
