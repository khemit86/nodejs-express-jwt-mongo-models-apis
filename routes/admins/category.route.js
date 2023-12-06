const express = require("express");
const router = express.Router();
const category = require("../../controllers/admins/category.controller");
const validationRule = require("../../validations/admins/admin");
const { verifyToken } = require("../../middlewares/verifyToken");

//get admin category list
router.get("/", [verifyToken], category.list_category);
//get admin home category list
router.get("/home_list_category", [verifyToken], category.home_list_category);
//get admin home category list
router.get("/search-list-category", [verifyToken], category.search_list_category);
//add admin category
router.post(
  "/",
  [verifyToken],
  validationRule.validate("addCategory"),
  category.add_category
);
//edit admin category
router.put(
  "/edit-category",
  [verifyToken],
  validationRule.validate("editCategory"),
  category.edit_category
);
//delete admin category
router.delete("/delete-category/:id", [verifyToken], category.delete_category);
//change admin category status
router.put(
  "/change-status/:id",
  [verifyToken],
  category.change_status_category
);

//edit order category
router.post("/edit-order-category",[verifyToken],category.edit_order_category);

module.exports = router;
