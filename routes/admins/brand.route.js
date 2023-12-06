const express = require("express");
const router = express.Router();
const brand = require("../../controllers/admins/brand.controller");
const validationRule = require("../../validations/admins/admin");
const { verifyToken } = require("../../middlewares/verifyToken");

//get admin brand list
router.get("/", [verifyToken], brand.list_brand);
//add admin brand
router.post(
  "/",
  [verifyToken],
  validationRule.validate("addBrand"),
  brand.add_brand
);
//edit admin brand
router.put(
  "/edit-brand",
  [verifyToken],
  validationRule.validate("editBrand"),
  brand.edit_brand
);
//delete admin brand
router.delete("/delete-brand/:id", [verifyToken], brand.delete_brand);
//change admin brand status
router.put("/change-status/:id", [verifyToken], brand.change_status_brand);

module.exports = router;
